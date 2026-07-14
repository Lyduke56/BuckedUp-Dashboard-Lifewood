"use client";

import { useState, type FormEvent } from "react";
import { useProfiles } from "@/lib/useProfiles";
import { createClient } from "@/lib/supabase/client";
import { roleLabel } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

const ROLE_OPTIONS: UserRole[] = ["operator", "lead", "admin"];

interface CreatedAccount {
  email: string;
  role: UserRole;
  temporaryPassword: string;
}

export function ManageUsersView() {
  const { profiles, loading } = useProfiles();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("operator");
  const [manualPassword, setManualPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRoleChange = async (id: string, role: UserRole) => {
    setSavingId(id);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);
    setSavingId(null);
    if (updateError) setError(updateError.message);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail.trim(),
        role: newRole,
        password: manualPassword ? newPassword.trim() : undefined,
      }),
    });
    const body = await res.json();

    setCreating(false);
    if (!res.ok) {
      setCreateError(body.error ?? "Failed to create account");
      return;
    }

    setCreated(body as CreatedAccount);
    setNewEmail("");
    setNewRole("operator");
    setManualPassword(false);
    setNewPassword("");
  };

  const dismissCreated = () => {
    setCreated(null);
    setCopied(false);
  };

  const copyPassword = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.temporaryPassword);
      setCopied(true);
    } catch {
      // Clipboard API can be unavailable (permissions/insecure context) —
      // the password stays visible in the panel to copy manually either way.
    }
  };

  if (loading && profiles.length === 0) {
    return <div className="empty-state">Loading accounts…</div>;
  }

  return (
    <div>
      <div className="content-angle-label">Create user</div>
      {created ? (
        <div
          className="callout"
          style={{
            borderLeft: "4px solid var(--castleton)",
            marginBottom: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div>
            Account created for <strong>{created.email}</strong> ({roleLabel(created.role)}).
          </div>
          <div style={{ fontSize: "12px", fontWeight: 700 }}>
            Temporary password — copy this now, it will not be shown again:
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <code
              style={{
                fontFamily: "monospace",
                fontSize: "14px",
                padding: "6px 10px",
                borderRadius: "8px",
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
              }}
            >
              {created.temporaryPassword}
            </code>
            <button type="button" className="header-btn" onClick={copyPassword}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div>
            <button type="button" className="header-btn" onClick={dismissCreated}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form
          className="form-grid"
          onSubmit={handleCreate}
          style={{ marginBottom: "20px" }}
        >
          {createError ? (
            <div className="callout form-error">{createError}</div>
          ) : null}

          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="name@company.com"
              required
            />
          </label>

          <label className="form-field">
            <span>Role</span>
            <select
              value={newRole}
              onChange={(event) => setNewRole(event.target.value as UserRole)}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field form-field-wide" style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={manualPassword}
              onChange={(event) => setManualPassword(event.target.checked)}
              style={{ width: "auto" }}
            />
            <span style={{ textTransform: "none", letterSpacing: "normal" }}>
              Set the temporary password manually (otherwise one is generated for you)
            </span>
          </label>

          {manualPassword ? (
            <label className="form-field form-field-wide">
              <span>Temporary password</span>
              <input
                type="text"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required={manualPassword}
              />
            </label>
          ) : null}

          <div className="form-actions">
            <span />
            <button type="submit" className="issue-submit-btn" disabled={creating}>
              {creating ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      )}

      <div className="content-angle-label">Existing users</div>
      {error ? (
        <div
          className="callout"
          style={{
            borderLeft: "4px solid #dc3545",
            color: "#b02a37",
            marginBottom: "16px",
            background: "rgba(220, 53, 69, 0.05)",
          }}
        >
          {error}
        </div>
      ) : null}
      <div className="table-scroll">
        <table className="video-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id}>
                <td>{profile.email}</td>
                <td>
                  <select
                    className="user-role-select"
                    value={profile.role}
                    disabled={savingId === profile.id}
                    onChange={(event) =>
                      handleRoleChange(profile.id, event.target.value as UserRole)
                    }
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
