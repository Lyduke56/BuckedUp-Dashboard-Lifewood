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
      {/* MODIFIED: Keep the form visible even after an invite is sent. Just show the success callout above it. */}
      {invited && (
        <div className="p-4 rounded-xl flex flex-col gap-2.5 mb-4 bg-blue-500/10 border-l-4 border-blue-500 text-blue-400 shadow-sm">
          <div className="text-sm font-medium">
            Invite sent to <strong className="text-blue-300">{invited.email}</strong> ({roleLabel(invited.role)}).
            They&apos;ll receive an email to set their password.
          </div>
          <div className="mt-1">
            <button
              type="button"
              className="px-4 py-1.5 text-xs font-bold rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors border border-blue-500/20"
              onClick={dismissInvited}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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
              <tr key={profile.id} className="video-table-row">
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
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* ADDED: Mock property 'inviteExpired' to demonstrate conditional Resend Invite.
                        In a real scenario, this would check the profile's invite status from the DB. */}
                    {(profile as any).inviteStatus === 'pending' && (
                      <button
                        type="button"
                        className="px-3.5 py-1.5 text-[11px] font-bold rounded-full bg-white/5 hover:bg-white/10 text-[var(--text-main)] transition-colors border border-white/10"
                        disabled={(profile as any).inviteExpired}
                        title={(profile as any).inviteExpired ? "Invite has expired" : "Resend Invite"}
                        style={{ opacity: (profile as any).inviteExpired ? 0.5 : 1 }}
                      >
                        {(profile as any).inviteExpired ? "Expired" : "Resend Invite"}
                      </button>
                    )}
                    {profile.id !== user?.id ? (
                      <button
                        type="button"
                        className="px-3.5 py-1.5 text-[11px] font-bold rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/20"
                        disabled={deletingId === profile.id}
                        onClick={() => handleDelete(profile.id, profile.email)}
                      >
                        {deletingId === profile.id ? "Deleting…" : "Delete"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
