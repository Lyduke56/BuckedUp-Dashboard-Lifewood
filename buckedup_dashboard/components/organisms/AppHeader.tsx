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
  const { user, role, loading: authLoading, signOut } = useAuth();

  return (
    <header className="app-header">
      <div className="brand-row">
        <div className="brand-logo-container">
          <img
            src="/lifewood.svg"
            alt="Lifewood"
            className="brand-logo"
          />
        </div>
        <span className="brand-divider-line" />
        <img
          src="/buckedup-alt.svg"
          alt="BuckedUp"
          className="brand-logo logo-buckedup"
        />
        <div style={{
          display: 'inline-flex',
          flexDirection: 'column',
          justifyContent: 'center',
          marginLeft: '10px',
          borderLeft: '1px solid var(--header-border)',
          paddingLeft: '12px',
          lineHeight: '1.2'
        }} className="hidden md:inline-flex select-none">
          <span style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--header-text)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
            BuckedUp AIGC Video Monitoring
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: 500,
            color: 'var(--header-text)',
            opacity: 0.65,
            marginTop: '2px',
            letterSpacing: '0.03em'
          }}>
            Powered by Lifewood PH
          </span>
        </div>
      </div>
      <div className="app-header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

        {authLoading ? null : user ? (
          <div className="auth-status" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <NotificationBell onNavigate={onNotificationNavigate} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="auth-email" style={{ fontSize: '12px', color: 'var(--header-text)', fontWeight: 600 }}>{user.email}</span>
              {role && (
                <span style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: role === 'super-admin' ? 'rgba(6, 182, 212, 0.15)' : role === 'admin' ? 'rgba(234, 179, 8, 0.15)' : role === 'client' ? 'rgba(244, 114, 182, 0.15)' : 'rgba(132, 204, 22, 0.15)',
                  color: role === 'super-admin' ? '#06b6d4' : role === 'admin' ? '#eab308' : role === 'client' ? '#f472b6' : '#84cc16',
                  border: `1px solid ${role === 'super-admin' ? 'rgba(6, 182, 212, 0.3)' : role === 'admin' ? 'rgba(234, 179, 8, 0.3)' : role === 'client' ? 'rgba(244, 114, 182, 0.3)' : 'rgba(132, 204, 22, 0.3)'}`
                }}>
                  {role}
                </span>
              )}
            </div>
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
