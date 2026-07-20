/* eslint-disable @next/next/no-img-element */
"use client";

import { Suspense, useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Particles } from "@/components/atoms/Particles";

const BACKGROUND_IMAGES = [
  "/login_images/Gemini_Generated_Image_7h0und7h0und7h0u.png",
  "/login_images/Gemini_Generated_Image_afqsssafqsssafqs.png",
  "/login_images/Gemini_Generated_Image_aqpz3aaqpz3aaqpz.png",
  "/login_images/Gemini_Generated_Image_z1emn4z1emn4z1em.png",
];

const MailIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="input-icon"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="input-icon"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);


const SignInIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginLeft: "8px", display: "inline-block" }}
  >
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteLinkInvalid = searchParams.get("error") === "invite-link-invalid";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const displayError =
    error ??
    (inviteLinkInvalid
      ? "That invite link is invalid or has expired. Ask an admin to resend the invite."
      : null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setSubmitting(false);
      setError(signInError.message);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="login-shell">
      {/* Background Slideshow Layer */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 0 }}
      >
        {BACKGROUND_IMAGES.map((src, index) => (
          <img
            key={src}
            src={src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[3000ms] ease-in-out"
            style={{
              opacity: index === currentImageIndex ? 0.69 : 0,
              filter: "brightness(0.7) contrast(1.1) saturate(0.6)",
            }}
          />
        ))}
        {/* Dark space green overlay to blend the images and preserve the space green theme */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle at center, rgba(4, 16, 12, 0.2) 0%, rgba(2, 7, 5, 0.75) 100%)",
            mixBlendMode: "multiply",
          }}
        />
      </div>

      {/* Interactive Particles layer */}
      <Particles
        className="absolute inset-0 z-0 bg-transparent"
        quantity={350}
        ease={30}
        staticity={25}
        size={1.5}
        color="#ffffff"
        refresh
      />

      {/* Fluid background orbs */}
      <div className="fluid-orb orb-1"></div>
      <div className="fluid-orb orb-2"></div>
      <div className="fluid-orb orb-3"></div>

      <div className="login-tilt-container" style={{ width: "100%", maxWidth: "680px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="brand-row login-brand-row">
            <div className="brand-logo-container">
              <img
                src="/lifewood.svg"
                alt="Lifewood"
                className="brand-logo login-brand-logo"
              />
            </div>
            <span className="brand-divider-line login-brand-divider" />
            <img
              src="/buckedup-alt.svg"
              alt="BuckedUp"
              className="brand-logo"
            />
          </div>

          <div className="login-header-group">
            <h1 className="login-title">AIGC Video Production Monitor</h1>
            <div className="login-badge-wrap">
              <span className="login-badge">Secure Access</span>
            </div>
          </div>

          <p className="login-sub">
            AIGC video queues monitoring & pipeline administration.<br></br>Authorized partners sign in to manage, edit, and update video tasks.
          </p>

          {displayError ? <div className="callout login-error">{displayError}</div> : null}

          <div className="login-fields-container" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <label className="login-field">
              <span>Email Address</span>
              <div className="input-with-icon">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="name@lifewood.com"
                />
                <MailIcon />
              </div>
            </label>

            <label className="login-field">
              <span>Password</span>
              <div className="input-with-icon">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                />
                <LockIcon />
              </div>
            </label>
          </div>

          <button type="submit" className="login-submit-btn" disabled={submitting}>
            <span>{submitting ? "Authenticating…" : "Sign In"}</span>
            {!submitting && <SignInIcon />}
          </button>
        </form>

        <div style={{
          marginTop: "30px",
          fontSize: "18px",
          fontWeight: 600,
          color: "rgba(255, 255, 255, 0.9)",
          letterSpacing: "0.08em",
          textShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
          pointerEvents: "none"
        }}>
          Powered by Lifewood PH
        </div>
      </div>
    </div>
  );
}
