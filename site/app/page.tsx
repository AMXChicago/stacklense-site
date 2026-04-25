"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function Home() {
  const supabase = createClient();
  const emailRef = useRef<HTMLInputElement>(null);
  const email2Ref = useRef<HTMLInputElement>(null);
  const [submitted1, setSubmitted1] = useState(false);
  const [submitted2, setSubmitted2] = useState(false);
  const [error1, setError1] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  async function persistSignup(email: string, source: "hero" | "footer") {
    const { error } = await supabase
      .from("waitlist")
      .insert({ email, source });
    // Duplicate emails hit our unique index — treat as a successful signup so
    // we don't leak which addresses are already on the list.
    if (error && error.code !== "23505") {
      console.error("waitlist insert failed:", error);
    }
  }

  function handleSubmit1(e: React.FormEvent) {
    e.preventDefault();
    const email = emailRef.current?.value.trim() ?? "";
    if (!email || !email.includes("@")) {
      setError1(true);
      return;
    }
    setError1(false);
    setSubmitted1(true);
    void persistSignup(email, "hero");
  }

  function handleSubmit2(e: React.FormEvent) {
    e.preventDefault();
    const email = email2Ref.current?.value.trim() ?? "";
    if (!email || !email.includes("@")) return;
    setSubmitted2(true);
    void persistSignup(email, "footer");
  }

  function focusEmail() {
    setTimeout(() => emailRef.current?.focus(), 0);
  }

  return (
    <>
      {/* NAV */}
      <nav>
        <a className="nav-logo" href="/">
          <div className="nav-logo-mark"></div>
          StackLense
        </a>
        <div className="nav-right">
          <a className="nav-link" href="#how-it-works">
            How it works
          </a>
          <a className="nav-link" href="#features">
            Features
          </a>
          <a className="nav-cta" href="#waitlist" onClick={focusEmail}>
            Get early access
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-eyebrow">Now in early access</div>

        <h1 className="hero-h1">
          Your codebase
          <br />
          has a <em>memory</em> now
        </h1>

        <p className="hero-sub">
          StackLense watches every deploy and builds a living blueprint of your
          architecture — decisions, services, security choices — captured
          automatically.
        </p>

        {!submitted1 ? (
          <>
            <form
              className="waitlist-form"
              id="waitlist"
              onSubmit={handleSubmit1}
            >
              <input
                ref={emailRef}
                className={`waitlist-input${error1 ? " input-error" : ""}`}
                id="email"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                aria-label="Email address"
              />
              <button type="submit" className="waitlist-btn">
                Join waitlist →
              </button>
            </form>
            <div className="hero-note">
              No credit card. No install. Connect in 60 seconds.
            </div>
          </>
        ) : (
          <div className="success-msg">
            ✓ You&rsquo;re on the list. We&rsquo;ll be in touch soon.
          </div>
        )}

        <div className="hero-agents">
          <div className="hero-agents-label">Works with any AI coding agent</div>
          <div className="agent-chips">
            <span className="agent-chip">Codex</span>
            <span className="agent-chip">Claude</span>
            <span className="agent-chip">Cursor</span>
            <span className="agent-chip">Gemini</span>
            <span className="agent-chip">Windsurf</span>
            <span className="agent-chip">Any agent</span>
          </div>
        </div>
      </section>

      {/* TERMINAL */}
      <div className="terminal-section">
        <div className="terminal">
          <div className="terminal-bar">
            <div className="t-dot r"></div>
            <div className="t-dot y"></div>
            <div className="t-dot g"></div>
            <div className="t-title">stacklense — blueprint update</div>
          </div>
          <div className="terminal-body">
            <div className="t-line">
              <span className="t-prompt">→</span>
              <span className="t-cmd">
                ECR push detected:{" "}
                <span className="t-green">msp-platform:v2.4.1</span>
              </span>
            </div>
            <div className="t-out t-dim">
              {"  "}Analyzing diff with Claude Sonnet…
            </div>
            <div className="t-out t-dim">
              {"  "}Scanning 847 changed lines across 12 files…
            </div>
            <br />
            <div className="t-line">
              <span className="t-prompt">✓</span>
              <span className="t-green">Blueprint updated</span>
            </div>
            <div className="t-out">
              Services detected:{" "}
              <span className="t-green">
                ECR, ECS Fargate, RDS, SES, Route 53, Secrets Manager
              </span>
              <br />
              New decision logged:{" "}
              <span className="t-amber">
                Switched auth to JWT (stateless for Fargate scale)
              </span>
              <br />
              Security flag:{" "}
              <span className="t-amber">
                No WAF configured on ALB — consider adding
              </span>
              <br />
              Flows mapped:{" "}
              <span className="t-green">
                GitHub Actions → ECR → ECS → RDS
              </span>
            </div>
            <br />
            <div className="t-line">
              <span className="t-prompt">→</span>
              <span className="t-cmd">
                Blueprint saved to{" "}
                <span className="t-green">
                  stacklense.com/dashboard/msp-platform
                </span>
              </span>
            </div>
            <div className="t-out t-dim">{"  "}STACKLENS.md updated in repo</div>
            <div className="t-out t-dim">
              {"  "}Decision log: 14 decisions, 2 open flags
            </div>
            <br />
            <div className="t-line">
              <span className="t-prompt">$</span>
              <span className="t-cursor"></span>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="section reveal" id="how-it-works">
        <div className="section-label">How it works</div>
        <h2 className="section-h2">
          Connect once.
          <br />
          Know everything, forever.
        </h2>

        <div className="steps">
          <div className="step">
            <div className="step-num">01</div>
            <div className="step-icon">🔗</div>
            <div className="step-title">Connect your project</div>
            <p className="step-desc">
              Link your GitHub repo, AWS account, or both. OAuth for GitHub. A
              read-only IAM role for AWS. Takes 60 seconds. No code changes
              required.
            </p>
          </div>
          <div className="step">
            <div className="step-num">02</div>
            <div className="step-icon">⚡</div>
            <div className="step-title">Deploy as normal</div>
            <p className="step-desc">
              Keep using Codex, Cursor, Claude — whatever you use. StackLense
              listens in the background via webhooks and EventBridge. You do
              nothing different.
            </p>
          </div>
          <div className="step">
            <div className="step-num">03</div>
            <div className="step-icon">🗺️</div>
            <div className="step-title">Your blueprint updates</div>
            <p className="step-desc">
              Every push triggers an AI analysis. Services, decisions, data
              flows, security choices — all captured and versioned. Your
              dashboard updates in real time.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        className="section reveal"
        id="features"
        style={{ paddingTop: 0 }}
      >
        <div className="section-label">Features</div>
        <h2 className="section-h2">
          Everything a vibe coder
          <br />
          wishes they had documented.
        </h2>

        <div className="features">
          <div className="feature">
            <div className="feature-icon">🗺️</div>
            <div className="feature-title">Living Architecture Diagram</div>
            <p className="feature-desc">
              Auto-generated diagram of every service, connection, and data flow
              in your stack. Updates on every deploy. Never out of date.
            </p>
            <span className="feature-tag">auto-updated</span>
          </div>
          <div className="feature">
            <div className="feature-icon">📋</div>
            <div className="feature-title">Decision Log</div>
            <p className="feature-desc">
              Every architectural choice is captured — why JWT instead of
              sessions, why Fargate instead of EC2, why SES instead of SendGrid.
              AI infers the reasoning from your diffs.
            </p>
            <span className="feature-tag">AI-inferred</span>
          </div>
          <div className="feature">
            <div className="feature-icon">🛡️</div>
            <div className="feature-title">Security Posture Tracking</div>
            <p className="feature-desc">
              Know what&rsquo;s exposed, what&rsquo;s encrypted, what&rsquo;s
              behind auth. Get flagged when a deploy introduces a potential
              security concern — before your client&rsquo;s auditor does.
            </p>
            <span className="feature-tag">audit-ready</span>
          </div>
          <div className="feature">
            <div className="feature-icon">📜</div>
            <div className="feature-title">Deploy History</div>
            <p className="feature-desc">
              Every deploy logged with a plain-English summary of what changed
              architecturally. Not just &ldquo;commit abc123&rdquo; — but what
              it actually meant for your system.
            </p>
            <span className="feature-tag">plain English</span>
          </div>
          <div className="feature">
            <div className="feature-icon">🤖</div>
            <div className="feature-title">AI-Tool Agnostic</div>
            <p className="feature-desc">
              Works whether you&rsquo;re using Codex, Claude, Cursor, Gemini, or
              all four. StackLense watches what happens at the infrastructure
              level — it doesn&rsquo;t care what wrote the code.
            </p>
            <span className="feature-tag">any agent</span>
          </div>
          <div className="feature">
            <div className="feature-icon">📤</div>
            <div className="feature-title">Audit Export</div>
            <p className="feature-desc">
              Export your full blueprint as a PDF, JSON, or shareable link —
              ready for a client security review, SOC 2 audit, or new developer
              onboarding.
            </p>
            <span className="feature-tag">export anywhere</span>
          </div>
        </div>
      </section>

      {/* MSP CALLOUT */}
      <div className="callout reveal">
        <div>
          <div className="callout-eyebrow">Built for MSPs first</div>
          <h3 className="callout-h3">
            Your clients ask how their data is protected.
            <br />
            Now you can show them.
          </h3>
          <p className="callout-p">
            MSPs deal with client audits, security reviews, and compliance
            questions constantly. StackLense gives you a living document that
            answers those questions automatically — without pulling in your AI
            agent to explain what it built.
          </p>
        </div>
        <div className="callout-list">
          <div className="callout-item">
            <div className="callout-item-icon">🔒</div>
            <div>
              <div className="callout-item-title">
                Security posture at a glance
              </div>
              <div className="callout-item-desc">
                Know exactly what&rsquo;s exposed, encrypted, and behind auth
                across every client environment.
              </div>
            </div>
          </div>
          <div className="callout-item">
            <div className="callout-item-icon">📋</div>
            <div>
              <div className="callout-item-title">
                Audit-ready documentation
              </div>
              <div className="callout-item-desc">
                Export a full architecture report in seconds. No scrambling
                before a client review.
              </div>
            </div>
          </div>
          <div className="callout-item">
            <div className="callout-item-icon">🔄</div>
            <div>
              <div className="callout-item-title">Always current</div>
              <div className="callout-item-desc">
                Blueprint updates with every deploy. Documentation that
                can&rsquo;t go stale.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div className="footer-cta reveal">
        <h2>
          Start knowing
          <br />
          what you built.
        </h2>
        <p>Join the waitlist. First 100 users get free access, forever.</p>

        {!submitted2 ? (
          <>
            <form
              className="waitlist-form"
              style={{ margin: "0 auto 16px", maxWidth: 380 }}
              onSubmit={handleSubmit2}
            >
              <input
                ref={email2Ref}
                className="waitlist-input"
                id="email2"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                aria-label="Email address"
              />
              <button type="submit" className="waitlist-btn">
                Join →
              </button>
            </form>
            <div className="hero-note">
              No credit card. No install. Connect in 60 seconds.
            </div>
          </>
        ) : (
          <div className="success-msg" style={{ marginTop: 12 }}>
            ✓ You&rsquo;re on the list!
          </div>
        )}
      </div>

      <footer>
        <div className="footer-logo">StackLense © 2025</div>
        <div className="footer-links">
          <a className="footer-link" href="#">
            Privacy
          </a>
          <a className="footer-link" href="#">
            Terms
          </a>
          <a className="footer-link" href="mailto:hello@stacklense.com">
            Contact
          </a>
        </div>
      </footer>
    </>
  );
}
