"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/useAuth";
import { useProfiles } from "@/lib/useProfiles";
import { createClient } from "@/lib/supabase/client";
import { roleLabel } from "@/lib/utils";
import type { Profile, UserRole, ViewId } from "@/lib/types";
import { ShieldCheck, Lock, Check } from "lucide-react";

const ASSIGNABLE_ROLES: UserRole[] = ["operator", "admin", "client", "super-admin"];
const ALL_ROLES: UserRole[] = ["operator", "admin", "client", "super-admin"];

const AVAILABLE_TABS: { id: ViewId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "catalog", label: "Catalog" },
  { id: "library", label: "Video Library" },
  { id: "analytics", label: "Analytics" },
  { id: "reviews", label: "Approvals Inbox" },
  { id: "planning", label: "Production Planning" },
  { id: "super-admin", label: "User Management" },
  { id: "bucky", label: "Bucky AI Audit Logs" },
];

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
  const [selectedTabs, setSelectedTabs] = useState<ViewId[]>(AVAILABLE_TABS.map((t) => t.id));
  const [isReadOnly, setIsReadOnly] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [invited, setInvited] = useState<InvitedAccount | null>(null);

  // Edit Permissions Modal for existing users
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editTabs, setEditTabs] = useState<ViewId[]>([]);
  const [editReadOnly, setEditReadOnly] = useState<boolean>(false);
  const [updatingPermissions, setUpdatingPermissions] = useState(false);

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

    const res = await fetch("/api/super-admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail.trim(),
        role: newRole,
        tabPermissions: newRole === "super-admin" ? selectedTabs : null,
        isReadOnly: newRole === "super-admin" ? isReadOnly : false,
      }),
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
    setSelectedTabs(AVAILABLE_TABS.map((t) => t.id));
    setIsReadOnly(false);
  };

  const dismissInvited = () => setInvited(null);

  const handleDelete = async (profileId: string, email: string) => {
    if (!window.confirm(`Delete ${email}'s account? This can't be undone.`)) {
      return;
    }
    setDeletingId(profileId);
    setError(null);
    const res = await fetch(`/api/super-admin/users/${profileId}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to delete account");
    }
  };

  const openPermissionsModal = (profile: Profile) => {
    setEditingProfile(profile);
    setEditTabs(
      profile.tabPermissions && Array.isArray(profile.tabPermissions) && profile.tabPermissions.length > 0
        ? profile.tabPermissions
        : AVAILABLE_TABS.map((t) => t.id)
    );
    setEditReadOnly(Boolean(profile.isReadOnly));
  };

  const handleSavePermissions = async () => {
    if (!editingProfile) return;
    setUpdatingPermissions(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        tab_permissions: editTabs,
        is_read_only: editReadOnly,
      })
      .eq("id", editingProfile.id);

    setUpdatingPermissions(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setEditingProfile(null);
    }
  };

  if (loading && profiles.length === 0) {
    return <div className="empty-state">Loading accounts…</div>;
  }

  return (
    <div>
      <div className="content-angle-label">Create user</div>
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
          <div className="callout form-error" style={{ gridColumn: "1 / -1" }}>{createError}</div>
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
            onChange={(event) => {
              const roleVal = event.target.value as UserRole;
              setNewRole(roleVal);
              if (roleVal === "super-admin" && selectedTabs.length === 0) {
                setSelectedTabs(AVAILABLE_TABS.map((t) => t.id));
              }
            }}
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </label>

        {/* Tab Permission Checkboxes & Read-Only Access — Appears ONLY for Super-Admin role */}
        {newRole === "super-admin" && (
          <div style={{
            gridColumn: "1 / -1",
            background: "var(--glass-bg, rgba(255, 255, 255, 0.03))",
            border: "1px solid var(--glass-border, rgba(255, 255, 255, 0.1))",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "4px"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={16} style={{ color: "var(--castleton, #10b981)" }} />
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                  Super-Admin Tab Permissions & Access Control
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setSelectedTabs(AVAILABLE_TABS.map((t) => t.id))}
                  style={{ fontSize: "11px", color: "var(--castleton, #10b981)", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}
                >
                  Select All
                </button>
                <span style={{ opacity: 0.3 }}>|</span>
                <button
                  type="button"
                  onClick={() => setSelectedTabs([])}
                  style={{ fontSize: "11px", color: "var(--ink-soft, #94a3b8)", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px", marginBottom: "14px" }}>
              {AVAILABLE_TABS.map((tab) => {
                const isChecked = selectedTabs.includes(tab.id);
                return (
                  <label key={tab.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--text-main)" }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTabs((prev) => [...prev, tab.id]);
                        } else {
                          setSelectedTabs((prev) => prev.filter((id) => id !== tab.id));
                        }
                      }}
                    />
                    {tab.label}
                  </label>
                );
              })}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--text-main)", borderTop: "1px solid var(--line, rgba(255, 255, 255, 0.08))", paddingTop: "10px" }}>
              <input
                type="checkbox"
                checked={isReadOnly}
                onChange={(e) => setIsReadOnly(e.target.checked)}
              />
              <span style={{ fontWeight: 600, color: isReadOnly ? "#f59e0b" : "var(--text-main)" }}>
                Enable Read-Only Access (User can view allowed tabs & Bucky transcripts, but cannot make modifications)
              </span>
            </label>
          </div>
        )}

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
              <th>Access & Permissions</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => {
              const isUserReadOnly = Boolean(profile.isReadOnly);
              const customTabsCount = profile.tabPermissions && Array.isArray(profile.tabPermissions) ? profile.tabPermissions.length : null;

              return (
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
                      {ALL_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {isUserReadOnly && (
                        <span style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(245, 158, 11, 0.15)",
                          color: "#f59e0b",
                          border: "1px solid rgba(245, 158, 11, 0.3)"
                        }}>
                          READ-ONLY
                        </span>
                      )}
                      {customTabsCount !== null && (
                        <span style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#10b981",
                          border: "1px solid rgba(16, 185, 129, 0.3)"
                        }}>
                          {customTabsCount}/{AVAILABLE_TABS.length} TABS
                        </span>
                      )}
                      {profile.role === "super-admin" && (
                        <button
                          type="button"
                          onClick={() => openPermissionsModal(profile)}
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "var(--text-main)",
                            cursor: "pointer"
                          }}
                        >
                          Permissions
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {(profile as any).inviteStatus === "pending" && (
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Permissions Editor Modal for Existing Users */}
      {editingProfile && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: "var(--modal-bg, #0d1310)",
            border: "1px solid var(--glass-border, rgba(255, 255, 255, 0.15))",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "500px",
            padding: "24px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <ShieldCheck size={20} style={{ color: "var(--castleton, #10b981)" }} />
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
                  Manage Permissions
                </h3>
                <p style={{ fontSize: "12px", color: "var(--ink-soft)", margin: 0 }}>
                  {editingProfile.email}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)" }}>Allowed Navigation Tabs</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setEditTabs(AVAILABLE_TABS.map((t) => t.id))}
                    style={{ fontSize: "11px", color: "var(--castleton)", background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTabs([])}
                    style={{ fontSize: "11px", color: "var(--ink-soft)", background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {AVAILABLE_TABS.map((tab) => {
                  const isChecked = editTabs.includes(tab.id);
                  return (
                    <label key={tab.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--text-main)" }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditTabs((prev) => [...prev, tab.id]);
                          } else {
                            setEditTabs((prev) => prev.filter((id) => id !== tab.id));
                          }
                        }}
                      />
                      {tab.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", marginBottom: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--text-main)" }}>
                <input
                  type="checkbox"
                  checked={editReadOnly}
                  onChange={(e) => setEditReadOnly(e.target.checked)}
                />
                <span style={{ fontWeight: 600, color: editReadOnly ? "#f59e0b" : "var(--text-main)" }}>
                  Read-Only Access Mode
                </span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--text-main)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={updatingPermissions}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--castleton, #10b981)",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {updatingPermissions ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
