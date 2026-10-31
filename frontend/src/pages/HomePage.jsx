import { Link } from "react-router-dom";

const FEATURES = [
  {
    number: "01",
    title: "Keep sensitive data safe",
    description: "Catch personal information and secrets before they leave your team's workspace.",
    icon: "01",
  },
  {
    number: "02",
    title: "Spot risky prompts",
    description: "Identify unsafe requests and prompt injection attempts before they reach an AI provider.",
    icon: "02",
  },
  {
    number: "03",
    title: "See how your team works",
    description: "Give admins clear usage, policy, and audit insights without exposing secrets in event logs.",
    icon: "03",
  },
];

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot" /> SECURITY FOR THE AI ERA</div>
          <h1>Give your team the freedom to use AI, <span>with guardrails.</span></h1>
          <p className="hero-description">
            A safer workspace for AI conversations. Protect sensitive information, catch risky prompts, and give your organization the visibility it needs.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="button button-primary button-large">Create your workspace <span aria-hidden="true">→</span></Link>
            <Link to="/login" className="button button-quiet button-large">Sign in</Link>
          </div>
          <div className="hero-trust"><span aria-hidden="true">✓</span> Security checks before every AI request</div>
        </div>
        <div className="hero-visual" aria-label="Illustration of a protected AI workspace">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <div className="visual-glow" />
          <div className="visual-card">
            <div className="visual-card-top"><span className="brand-icon">G</span><span>GUARDTRACE SHIELD</span><span className="live-pill">ACTIVE</span></div>
            <div className="visual-prompt">
              <span className="visual-label">YOUR TEAM</span>
              <div className="visual-message"><span className="message-mark">↗</span><span>Ask anything. Work smarter.</span></div>
            </div>
            <div className="scan-line"><span /><i /></div>
            <div className="visual-result"><span className="result-check">✓</span><span><strong>Protected and ready</strong><small>Privacy checks passed</small></span><span className="result-time">12 ms</span></div>
            <div className="visual-provider"><span>SECURE ROUTING</span><span className="provider-line" /><span>AI PROVIDER</span></div>
          </div>
          <div className="floating-chip chip-one"><span className="chip-check">✓</span> Sensitive data blocked</div>
          <div className="floating-chip chip-two"><span className="chip-spark">✦</span> Safe to continue</div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Platform principles">
        <span>BUILT FOR RESPONSIBLE AI</span>
        <i />
        <span>PRIVACY-FIRST MONITORING</span>
        <i />
        <span>ORGANIZATION-WIDE VISIBILITY</span>
      </section>

      <section id="features" className="features-section">
        <div className="section-heading">
          <span className="eyebrow">ONE WORKSPACE. BUILT-IN PROTECTION.</span>
          <h2>More confidence in every conversation.</h2>
          <p>Keep productivity moving while helping protect the information and people that matter.</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <article key={feature.number} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <span className="feature-number">{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="workflow-section">
        <div className="workflow-copy">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2>A thoughtful layer between your team and AI.</h2>
          <p>GuardTraceAI checks each message before it is sent, routes safe requests to your AI service, and gives admins useful insights into usage and policy events.</p>
          <Link to="/register" className="text-link">Create a secure workspace <span aria-hidden="true">→</span></Link>
        </div>
        <div className="workflow-steps">
          <div className="workflow-step"><span>1</span><div><strong>Your team asks</strong><p>Employees work in a familiar chat experience.</p></div></div>
          <div className="workflow-step"><span>2</span><div><strong>GuardTrace checks</strong><p>Messages are screened for sensitive data and risky prompts.</p></div></div>
          <div className="workflow-step"><span>3</span><div><strong>Admins stay informed</strong><p>Review organization trends and respond to security events.</p></div></div>
        </div>
      </section>

      <section className="home-cta">
        <div><span className="eyebrow">START WITH CONFIDENCE</span><h2>Make safer AI a team habit.</h2></div>
        <Link to="/register" className="button button-primary button-large">Get started <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  );
}
