import re
import threading
from typing import Any, Dict, List, Optional

from config import settings

# ---------- Rules (fast, no ML needed) ----------

PII_PATTERNS: Dict[str, re.Pattern] = {
    "EMAIL": re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
    # Indian mobile, or US style with separators
    "PHONE": re.compile(r"(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)|\b\d{3}[-.]\d{3}[-.]\d{4}\b"),
    "SSN": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "AADHAAR": re.compile(r"(?<!\d)[2-9]\d{3}\s?\d{4}\s?\d{4}(?!\d)"),
    "PAN": re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"),
    "API_KEY": re.compile(
        r"(?i)(?:bearer|api[ _]?key|secret|password|token)\s*[:=]\s*['\"]?[a-zA-Z0-9_\-]{16,}['\"]?"
        r"|\bsk-[A-Za-z0-9]{20,}\b|\bAIza[0-9A-Za-z_\-]{35}\b|\bghp_[A-Za-z0-9]{36}\b"
    ),
}

CARD_CANDIDATE = re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)")

INJECTION_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"ignore (all |any )?(previous|prior|above) (instructions|prompts|rules)",
        r"disregard (all |any )?(previous|prior|above)",
        r"forget (everything|all) (you|above|previous)",
        r"reveal (your )?(system|hidden) prompt",
        r"you are now (in )?(dan|developer mode)",
        r"jailbreak",
    ]
]

# How risky each finding is (0 to 1)
PII_WEIGHTS = {
    "CREDIT_CARD": 0.9, "API_KEY": 0.9, "SSN": 0.9,
    "AADHAAR": 0.8, "PAN": 0.7, "EMAIL": 0.4, "PHONE": 0.4,
}
INJECTION_WEIGHT = 0.85


def _luhn_ok(number: str) -> bool:
    digits = [int(d) for d in number if d.isdigit()]
    if not 13 <= len(digits) <= 19:
        return False
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


class RiskClassifier:
    def __init__(self):
        # Cheap: nothing heavy is loaded here
        self._lock = threading.Lock()
        self._model = None
        self._tokenizer = None
        self._device = None
        self._injection_idx = 1

    # ---------- Rule-based checks ----------

    def scan_regex_pii(self, text: str) -> List[str]:
        detected = [name for name, rx in PII_PATTERNS.items() if rx.search(text)]
        if any(_luhn_ok(m.group()) for m in CARD_CANDIDATE.finditer(text)):
            detected.append("CREDIT_CARD")
        return detected

    def scan_injection(self, text: str) -> bool:
        return any(rx.search(text) for rx in INJECTION_PATTERNS)

    # ---------- Optional ML (lazy, background loaded) ----------

    @property
    def ml_ready(self) -> bool:
        return self._model is not None

    def _load_model(self) -> None:
        with self._lock:
            if self._model is not None:
                return
            # Heavy imports happen here, only when ML is enabled
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer

            self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self._tokenizer = AutoTokenizer.from_pretrained(settings.ML_MODEL_NAME)
            model = AutoModelForSequenceClassification.from_pretrained(settings.ML_MODEL_NAME)
            model.to(self._device).eval()

            # Find the "injection" label, falling back to index 1
            for idx, label in model.config.id2label.items():
                if "inject" in str(label).lower() or "unsafe" in str(label).lower():
                    self._injection_idx = int(idx)
            self._model = model

    def warm_up(self) -> None:
        """Load the model in a background thread so the server starts instantly."""
        if settings.ENABLE_ML_CLASSIFIER:
            threading.Thread(target=self._load_model, daemon=True).start()

    def _ml_score(self, text: str) -> Optional[float]:
        if not settings.ENABLE_ML_CLASSIFIER or not self.ml_ready:
            return None
        import torch

        inputs = self._tokenizer(
            text, return_tensors="pt", truncation=True, max_length=512
        ).to(self._device)
        with torch.inference_mode():
            probs = torch.softmax(self._model(**inputs).logits, dim=-1)
        return probs[0][self._injection_idx].item()

    # ---------- Main entry point ----------

    def inspect_prompt(self, text: str) -> Dict[str, Any]:
        detected_pii = self.scan_regex_pii(text)
        injection = self.scan_injection(text)

        rule_score = max([PII_WEIGHTS.get(p, 0.5) for p in detected_pii], default=0.0)
        if injection:
            rule_score = max(rule_score, INJECTION_WEIGHT)

        ml_score = self._ml_score(text)
        risk_score = max(rule_score, ml_score or 0.0)

        ml_flagged = ml_score is not None and ml_score > settings.PII_CONFIDENCE_THRESHOLD
        is_safe = not detected_pii and not injection and not ml_flagged

        return {
            "is_safe": is_safe,
            "risk_score": round(risk_score, 4),
            "detected_pii": detected_pii,
            "injection_detected": injection,
            "ml_used": ml_score is not None,
        }


# Cheap to create now, because nothing heavy loads in __init__
risk_classifier = RiskClassifier()