"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/useAuth";
import { useProfiles } from "@/lib/useProfiles";
import { createClient } from "@/lib/supabase/client";
import { roleLabel } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

const ROLE_OPTIONS: UserRole[] = ["operator", "lead", "admin"];

interface InvitedAccount {
  email: string;
  role: UserRole;
}

export function ManageUsersView() {
  const { user } = useAuth();
  const { profiles, loading } = useProfiles();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("operator");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [invited, setInvited] = useState<InvitedAccount | null>(null);

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
      body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
    });
    const body = await res.json();

    setCreating(false);
    if (!res.ok) {
      setCreateError(body.error ?? "Failed to send invite");
      return;
    }

    setInvited(body as InvitedAccount);
    setNewEmail("");
    setNewRole("operator");
  };

  const dismissInvited = () => setInvited(null);

  const handleDelete = async (profileId: string, email: string) => {
    if (!window.confirm(`Delete ${email}'s account? This can't be undone.`)) {
      return;
    }
    setDeletingId(profileId);
    setError(null);
    const res = await fetch(`/api/admin/users/${profileId}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to delete account");
    }
  };

  if (loading && profiles.length === 0) {
    return <div className="empty-state">Loading accounts…</div>;
  }

  return (
    <div>
      <div className="content-angle-label">Create user</div>
      {invited ? (
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
            Invite sent to <strong>{invited.email}</strong> ({roleLabel(invited.role)}).
            They&apos;ll receive an email to set their password.
          </div>
          <div>
            <button type="button" className="header-btn" onClick={dismissInvited}>
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

          <div className="form-actions">
            <span />
            <button type="submit" className="issue-submit-btn" disabled={creating}>
              {creating ? "Sending invite…" : "Send invite"}
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
              <th></th>
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
                <td>
                  {profile.id !== user?.id ? (
                    <button
                      type="button"
                      className="header-btn"
                      disabled={deletingId === profile.id}
                      onClick={() => handleDelete(profile.id, profile.email)}
                    >
                      {deletingId === profile.id ? "Deleting…" : "Delete"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
