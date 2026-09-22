import re
import torch
import torch.nn as nn
from typing import Dict, List, Any
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from config import settings


class RiskClassifier:
    def __init__(self):
        # 1. High-Speed Regex Rules for PII and Secret Interception
        self.pii_patterns: Dict[str, str] = {
            "EMAIL": r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
            "PHONE": r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
            "SSN": r"\b\d{3}-\d{2}-\d{4}\b",
            "CREDIT_CARD": r"\b(?:\d[ -]*?){13,16}\b",
            "API_KEY": r"(?i)(bearer|api[ _]?key|secret|password)\s*[:=]\s*['\"]?[a-zA-Z0-9_\-]{16,}['\"]?"
        }

        # 2. PyTorch & HuggingFace Model Setup
        # We use DistilBERT because it is lightweight, fast, and runs efficiently on CPU/GPU
        self.model_name = "distilbert-base-uncased"
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        
        # Use GPU if available, otherwise fall back to CPU
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Load pre-trained sequence classification model
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.model_name, 
            num_labels=2
        ).to(self.device)
        
        # Set model to evaluation mode (disables dropout, speeds up inference)
        self.model.eval()

    def scan_regex_pii(self, text: str) -> List[str]:
        """Scans the prompt against regular expressions to detect sensitive data patterns."""
        detected = []
        for pii_type, pattern in self.pii_patterns.items():
            if re.search(pattern, text):
                detected.append(pii_type)
        return detected

    @torch.no_grad()  # Tells PyTorch not to calculate gradients, saving RAM and execution time
    def inspect_prompt(self, text: str) -> Dict[str, Any]:
        """
        Runs both Regex PII detection and Transformer Risk Scoring on the prompt text.
        Returns a dictionary with safety status, risk score, and detected PII categories.
        """
        # Step 1: Execute Fast Deterministic Regex Scan
        detected_pii = self.scan_regex_pii(text)

        # Step 2: Tokenize Text for the Neural Network
        inputs = self.tokenizer(
            text, 
            return_tensors="pt", 
            truncation=True, 
            max_length=512
        ).to(self.device)

        # Step 3: PyTorch Model Forward Pass
        outputs = self.model(**inputs)
        
        # Convert raw output logits to probabilities using Softmax
        probabilities = torch.softmax(outputs.logits, dim=-1)
        
        # Probability of class 1 (Unsafe / High Risk)
        risk_score = probabilities[0][1].item()

        # Step 4: Evaluate overall safety against configured thresholds
        has_pii = len(detected_pii) > 0
        exceeds_risk_threshold = risk_score > settings.PII_CONFIDENCE_THRESHOLD
        
        is_safe = (not has_pii) and (not exceeds_risk_threshold)

        return {
            "is_safe": is_safe,
            "risk_score": round(risk_score, 4),
            "detected_pii": detected_pii
        }


# Global instance of the risk classifier
risk_classifier = RiskClassifier()