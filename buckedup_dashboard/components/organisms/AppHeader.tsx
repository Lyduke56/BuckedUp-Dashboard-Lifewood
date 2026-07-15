"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Lock, Sun, Moon } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { NotificationBell } from "@/components/molecules/NotificationBell";

interface AppHeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onNotificationNavigate: (productName: string) => void;
}

export function AppHeader({
  theme,
  onToggleTheme,
  onNotificationNavigate,
}: AppHeaderProps) {
  const { user, loading: authLoading, signOut } = useAuth();

  return (
    <header className="app-header">
      <div className="brand-row">
        <img
          src="/lifewood-full-cream.svg"
          alt="Lifewood"
          className="brand-logo"
        />
        <span className="brand-divider-line" />
        <img
          src="/buckedup-alt.svg"
          alt="BuckedUp"
          className="brand-logo logo-buckedup"
        />
        <span style={{
          fontSize: '16px',
          fontWeight: 700,
          color: 'var(--header-text)',
          marginLeft: '48px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          borderLeft: '1px solid var(--header-border)',
          paddingLeft: '8px',
          height: '14px',
          display: 'inline-flex',
          alignItems: 'center'
        }} className="hidden md:inline-flex select-none">
          BuckedUp AIGC Video Monitoring
        </span>
      </div>
      <div className="app-header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

        {authLoading ? null : user ? (
          <div className="auth-status" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <NotificationBell onNavigate={onNotificationNavigate} />
            <span className="auth-email" style={{ fontSize: '12px', color: 'var(--header-text)', fontWeight: 600 }}>{user.email}</span>
            <button type="button" className="header-btn" onClick={signOut} style={{
              background: 'var(--header-badge-bg, rgba(255,255,255,0.1))',
              border: '1px solid var(--header-badge-border, rgba(255,255,255,0.15))',
              color: 'var(--header-text)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}>
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="login-link" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#ffffff',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'none',
            transition: 'background 0.2s ease'
          }}>
            <Lock size={12} />
            Sign in to edit
          </Link>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          style={{
            width: "56px",
            height: "28px",
            position: "relative",
            borderRadius: "9999px",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: "rgba(255, 255, 255, 0.06)",
            cursor: "pointer",
            padding: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "background 0.3s ease",
            outline: "none",
            flexShrink: 0
          }}
          title="Toggle Theme"
        >
          {/* Sliding white/gold circular thumb */}
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: theme === "light" ? "2px" : "28px",
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: theme === "light" ? "#f8cb00ff" : "#ffffff",
              boxShadow: "0 2px 5px rgba(0, 0, 0, 0.25)",
              transition: "left 0.25s cubic-bezier(0.25, 1, 0.5, 1), background 0.25s ease",
              zIndex: 1
            }}
          />
          <div style={{ zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", color: theme === "light" ? "#ffffff" : "rgba(255, 255, 255, 0.65)", transition: "color 0.25s ease" }}>
            <Sun size={12} />
          </div>
          <div style={{ zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", color: theme === "dark" ? "#090e0c" : "rgba(255, 255, 255, 0.65)", transition: "color 0.25s ease" }}>
            <Moon size={12} />
          </div>
        </button>
      </div>
    </header>
  );
}
