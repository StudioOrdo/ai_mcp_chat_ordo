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

interface FieldErrors {
  email?: string;
  password?: string;
  name?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [{ honeypotValue, startedAt }] = useState(() => createPublicFormMetadata());
  const [honeypotInput, setHoneypotInput] = useState(honeypotValue);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateLocal(): FieldErrors {
    const errors: FieldErrors = {};
    if (!email.includes("@") || !email.includes(".")) {
      errors.email = "Enter a valid email address";
    }
    if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    if (password.length > 72) {
      errors.password = "Password must be at most 72 characters";
    }
    if (!name.trim()) {
      errors.name = "Name is required";
    }
    if (name.trim().length > 100) {
      errors.name = "Name must be at most 100 characters";
    }
    return errors;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGeneralError("");

    const errors = validateLocal();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          [PUBLIC_FORM_HONEYPOT_FIELD_NAME]: honeypotInput,
          [PUBLIC_FORM_STARTED_AT_FIELD_NAME]: startedAt,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        if (res.status === 409) {
          setFieldErrors({ email: "This email is already registered" });
        } else if (res.status === 400) {
          setGeneralError(body.error || "Invalid input");
        } else {
          setGeneralError(body.error || "Registration failed");
        }
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setGeneralError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="public-entry-shell" data-public-entry-page="register">
      <section className="profile-panel-surface public-entry-card public-entry-card-split" data-public-entry-card="true">
        <div className="public-entry-aside">
          <div className="public-entry-header">
            <p className="public-entry-kicker">Create your workspace</p>
            <h1 className="public-entry-title" data-public-entry-title="true">Create Account</h1>
            <p className="public-entry-description">
              Save conversations, unlock richer tools, and keep validated referrals attached as you move into an account.
            </p>
          </div>
          <p className="public-entry-support">
            Start with the essentials here. Longer referral and workspace details can follow once the account exists.
          </p>
        </div>

        <div className="grid gap-(--space-4) rounded-[1.4rem] border border-foreground/10 bg-background/72 p-(--space-inset-default) sm:rounded-[1.6rem] sm:p-(--space-inset-panel)">
          <form onSubmit={handleSubmit} className="public-entry-form" data-public-entry-form="true">
            <div role="alert" aria-live="assertive" className="alert-error" style={generalError ? undefined : { display: "none" }}>
              {generalError}
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
                <label htmlFor="name" className="form-label">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: undefined })); }}
                  className={`input-field ${fieldErrors.name ? "ring-2 ring-red-500/50" : ""}`}
                  placeholder="Your name"
                  autoComplete="name"
                  aria-describedby="name-error"
                  aria-invalid={!!fieldErrors.name}
                />
                {fieldErrors.name && (
                  <p id="name-error" className="field-error">{fieldErrors.name}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                  className={`input-field ${fieldErrors.email ? "ring-2 ring-red-500/50" : ""}`}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-describedby="email-error"
                  aria-invalid={!!fieldErrors.email}
                />
                {fieldErrors.email && (
                  <p id="email-error" className="field-error">{fieldErrors.email}</p>
                )}
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
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                  className={`input-field ${fieldErrors.password ? "ring-2 ring-red-500/50" : ""}`}
                  placeholder="8+ characters"
                  autoComplete="new-password"
                  aria-describedby="password-description password-error"
                  aria-invalid={!!fieldErrors.password}
                />
                <p id="password-description" className="text-xs opacity-50">
                  8–72 characters required.
                </p>
                {fieldErrors.password && (
                  <p id="password-error" className="field-error">{fieldErrors.password}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary focus-ring"
              data-public-entry-primary-action="true"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <div className="grid gap-(--space-2)">
            <p className="public-entry-secondary-link text-center">
              Already have a workspace?{" "}
              <Link href="/login" className="font-semibold text-accent-interactive transition-colors hover:text-foreground hover:underline">
                Sign In
              </Link>
            </p>
            <p className="public-entry-secondary-link text-center">
              Valid referral links continue through registration automatically after the account is created.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
