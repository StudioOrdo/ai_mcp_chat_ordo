"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createPublicFormMetadata,
  PUBLIC_FORM_HONEYPOT_FIELD_NAME,
  PUBLIC_FORM_STARTED_AT_FIELD_NAME,
} from "@/lib/security/public-form-protection";

const HONEYPOT_STYLE = {
  position: "absolute",
  left: "-10000px",
  top: "auto",
  width: "1px",
  height: "1px",
  overflow: "hidden",
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [{ honeypotValue, startedAt }] = useState(() => createPublicFormMetadata());
  const [honeypotInput, setHoneypotInput] = useState(honeypotValue);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          [PUBLIC_FORM_HONEYPOT_FIELD_NAME]: honeypotInput,
          [PUBLIC_FORM_STARTED_AT_FIELD_NAME]: startedAt,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Login failed");
        setPassword(""); // Clear password on failure, retain email
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="public-entry-shell" data-public-entry-page="login">
      <section className="profile-panel-surface public-entry-card public-entry-card-split" data-public-entry-card="true">
        <div className="public-entry-aside">
          <div className="public-entry-header">
            <p className="public-entry-kicker">Return to your workspace</p>
            <h1 className="public-entry-title" data-public-entry-title="true">Sign In</h1>
            <p className="public-entry-description">
              Saved conversations, workspace context, and referral activity pick up where you left off.
            </p>
          </div>
          <p className="public-entry-support">
            Use the account that already holds your route access and prior conversation history.
          </p>
        </div>

        <div className="grid gap-(--space-4) rounded-[1.4rem] border border-foreground/10 bg-background/72 p-(--space-inset-default) sm:rounded-[1.6rem] sm:p-(--space-inset-panel)">
          <form onSubmit={handleSubmit} className="public-entry-form" data-public-entry-form="true">
            <div role="alert" aria-live="assertive" className="alert-error" style={error ? undefined : { display: "none" }}>
              {error}
            </div>

            <div aria-hidden="true" style={HONEYPOT_STYLE}>
              <label htmlFor={PUBLIC_FORM_HONEYPOT_FIELD_NAME}>Website</label>
              <input
                id={PUBLIC_FORM_HONEYPOT_FIELD_NAME}
                name={PUBLIC_FORM_HONEYPOT_FIELD_NAME}
                type="text"
                value={honeypotInput}
                onChange={(e) => setHoneypotInput(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
              />
              <input
                type="hidden"
                name={PUBLIC_FORM_STARTED_AT_FIELD_NAME}
                value={startedAt}
                readOnly
              />
            </div>

            <div className="public-entry-form-fields">
              <div className="space-y-1.5">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary focus-ring"
              data-public-entry-primary-action="true"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="public-entry-secondary-link text-center">
            Need an account to save your workspace?{" "}
            <Link href="/register" className="font-semibold text-accent-interactive transition-colors hover:text-foreground hover:underline">
              Register
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
