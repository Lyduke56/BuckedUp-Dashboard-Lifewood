"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/molecules/PageHeader";
import { SearchBar } from "@/components/molecules/SearchBar";
import { BuckyTranscriptModal } from "@/components/organisms/BuckyTranscriptModal";
import { useBuckyConversationUsers } from "@/lib/useBuckyConversationUsers";
import { roleLabel } from "@/lib/utils";

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Admin-only: lets admins read back who's been talking to Bucky (the AI
// assistant) and what was said/done, since bucky_messages has been
// durably saved and admin-readable since Phase 10 but had no screen to
// browse it. Purely a list-then-modal read view -- no writes happen here.
export function BuckyConversationsView() {
  const { conversationUsers, loading } = useBuckyConversationUsers();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string } | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversationUsers;
    return conversationUsers.filter((u) => u.email.toLowerCase().includes(term));
  }, [conversationUsers, search]);

  if (loading && conversationUsers.length === 0) {
    return (
      <div>
        <PageHeader
          title="Bucky | BuckedUp"
          overline="AI ASSISTANT"
          subtitle="Read back saved conversations with Bucky, per user."
        />
        <div className="empty-state">Loading conversations…</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Bucky | BuckedUp"
        overline="AI ASSISTANT"
        subtitle="Read back saved conversations with Bucky, per user."
      />

      {conversationUsers.length === 0 ? (
        <div className="empty-state">No one has talked to Bucky yet.</div>
      ) : (
        <>
          <SearchBar
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email..."
            className="mb-4"
            style={{ maxWidth: "320px" }}
          />

          <div className="table-scroll">
            <table className="video-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Messages</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.userId}
                    onClick={() => setSelectedUser({ id: u.userId, email: u.email })}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{u.email}</td>
                    <td>{roleLabel(u.role)}</td>
                    <td>{u.messageCount}</td>
                    <td>{formatRelative(u.lastMessageAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedUser ? (
        <BuckyTranscriptModal
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          onClose={() => setSelectedUser(null)}
        />
      ) : null}
    </div>
  );
}
