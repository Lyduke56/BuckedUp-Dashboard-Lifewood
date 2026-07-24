"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Lock, Sun, Moon, ChevronDown, Check, Building2 } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { NotificationBell } from "@/components/molecules/NotificationBell";

interface AppHeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onNotificationNavigate: (productName: string) => void;
}

interface CompanyChoice {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  status: "Active" | "Partner";
}

const COMPANY_CHOICES: CompanyChoice[] = [
  {
    id: "buckedup",
    name: "BuckedUp",
    title: "BuckedUp AIGC Video Monitoring",
    subtitle: "Powered by Lifewood PH",
    status: "Active"
  },
  {
    id: "redbull",
    name: "Red Bull",
    title: "Red Bull AIGC Video Monitoring",
    subtitle: "Powered by Lifewood PH",
    status: "Partner"
  },
  {
    id: "monster",
    name: "Monster Energy",
    title: "Monster Energy AIGC Video Monitoring",
    subtitle: "Powered by Lifewood PH",
    status: "Partner"
  },
  {
    id: "celsius",
    name: "Celsius",
    title: "Celsius AIGC Video Monitoring",
    subtitle: "Powered by Lifewood PH",
    status: "Partner"
  },
  {
    id: "nutrabio",
    name: "NutraBio",
    title: "NutraBio AIGC Video Monitoring",
    subtitle: "Powered by Lifewood PH",
    status: "Partner"
  }
];

export function AppHeader({
  theme,
  onToggleTheme,
  onNotificationNavigate,
}: AppHeaderProps) {
  const { user, role, loading: authLoading, signOut } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState<CompanyChoice>(COMPANY_CHOICES[0]);
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canSelectCompany = role === "super-admin" || role === "admin";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="app-header">
      <div className="brand-row" style={{ position: "relative" }}>
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

        {!canSelectCompany ? (
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
        ) : (
          <div
            ref={dropdownRef}
            style={{
              position: 'relative',
              marginLeft: '10px',
              borderLeft: '1px solid var(--header-border)',
              paddingLeft: '6px'
            }}
            className="hidden md:inline-flex select-none"
          >
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: (isHovered || isOpen) ? 'var(--header-badge-bg, rgba(255, 255, 255, 0.08))' : 'transparent',
                border: (isHovered || isOpen) ? '1px solid var(--header-badge-border, rgba(255, 255, 255, 0.15))' : '1px solid transparent',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                outline: 'none'
              }}
              title="Filter by Partnered Company (Super-Admin / Admin)"
            >
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textAlign: 'left',
                lineHeight: '1.2'
              }}>
                <span style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--header-text)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}>
                  {selectedCompany.title}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  color: 'var(--header-text)',
                  opacity: 0.65,
                  marginTop: '2px',
                  letterSpacing: '0.03em'
                }}>
                  {selectedCompany.subtitle}
                </span>
              </div>
              <ChevronDown
                size={14}
                style={{
                  color: 'var(--header-text)',
                  opacity: (isHovered || isOpen) ? 0.9 : 0,
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'opacity 0.2s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  marginLeft: '2px',
                  flexShrink: 0
                }}
              />
            </button>

            {isOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: '6px',
                  minWidth: '290px',
                  background: 'var(--panel-bg-opaque, #0d1310)',
                  border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.15))',
                  borderRadius: '10px',
                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35), 0 0 12px var(--castleton-glow, rgba(16, 185, 129, 0.15))',
                  padding: '8px',
                  zIndex: 1000,
                  animation: 'fadeIn 0.15s ease-out'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px 8px 10px',
                  borderBottom: '1px solid var(--line, rgba(255, 255, 255, 0.08))',
                  marginBottom: '4px'
                }}>
                  <Building2 size={14} style={{ color: 'var(--castleton, #10b981)' }} />
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--ink-soft, rgba(255, 255, 255, 0.65))'
                  }}>
                    Partnered Companies (Demo Filter)
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {COMPANY_CHOICES.map((choice) => {
                    const isSelected = selectedCompany.id === choice.id;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => {
                          setSelectedCompany(choice);
                          setIsOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          background: isSelected
                            ? 'var(--castleton-glow, rgba(16, 185, 129, 0.12))'
                            : 'transparent',
                          border: isSelected
                            ? '1px solid var(--castleton, #10b981)'
                            : '1px solid transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'var(--glass-hover, rgba(255, 255, 255, 0.06))';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{
                            fontSize: '13px',
                            fontWeight: isSelected ? 700 : 600,
                            color: isSelected ? 'var(--castleton, #10b981)' : 'var(--ink, #ffffff)'
                          }}>
                            {choice.name}
                          </span>
                          <span style={{
                            fontSize: '10px',
                            color: 'var(--ink-soft, rgba(255, 255, 255, 0.65))',
                            marginTop: '1px'
                          }}>
                            {choice.title}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: choice.status === "Active"
                              ? 'var(--castleton-glow, rgba(16, 185, 129, 0.2))'
                              : 'var(--glass-bg, rgba(255, 255, 255, 0.08))',
                            color: choice.status === "Active"
                              ? 'var(--castleton, #10b981)'
                              : 'var(--ink-soft, rgba(255, 255, 255, 0.5))',
                            textTransform: 'uppercase',
                            border: `1px solid ${choice.status === "Active" ? 'var(--castleton, #10b981)' : 'var(--glass-border, rgba(255, 255, 255, 0.1))'}`
                          }}>
                            {choice.status}
                          </span>
                          {isSelected && (
                            <Check size={14} style={{ color: 'var(--castleton, #10b981)' }} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
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
