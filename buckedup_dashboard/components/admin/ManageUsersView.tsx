"use client";

import { useState } from "react";
import { useProfiles } from "@/lib/useProfiles";
import { createClient } from "@/lib/supabase/client";
import { roleLabel } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

const ROLE_OPTIONS: UserRole[] = ["editor", "approver", "admin"];

export function ManageUsersView() {
  const { profiles, loading } = useProfiles();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (loading && profiles.length === 0) {
    return <div className="empty-state">Loading accounts…</div>;
  }

  return (
    <div>
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
