"use client";

import { useState } from "react";
import { useNotifications } from "@/lib/useNotifications";
import { BellIcon } from "@/components/atoms/icons";

interface NotificationBellProps {
  onNavigate: (productName: string) => void;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell({ onNavigate }: NotificationBellProps) {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="notification-bell">
      <button
        type="button"
        className="header-btn notification-bell-trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="notification-badge">{unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <>
          <div
            className="notification-backdrop"
            onClick={() => setOpen(false)}
          />
          <div className="notification-dropdown" style={{ width: "380px" }}>
            <div className="notification-dropdown-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "16px" }}>
              <span style={{ whiteSpace: "nowrap" }}>Notifications</span>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {unreadCount > 0 ? (
                  <button type="button" onClick={() => markAllRead()}>
                    Mark all read
                  </button>
                ) : null}
                {notifications.length > 0 ? (
                  <button type="button" onClick={() => {
                    clearAll();
                  }}>
                    Clear all
                  </button>
                ) : null}
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="notification-empty">No notifications yet.</div>
            ) : (
              <ul className="notification-list">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`notification-item${notification.read ? "" : " unread"}`}
                    onClick={() => {
                      markRead(notification.id);
                      setOpen(false);
                      if (notification.productName) {
                        onNavigate(notification.productName);
                      }
                    }}
                  >
                    <span className="notification-message">
                      {notification.message}
                    </span>
                    <span className="notification-time">
                      {formatRelative(notification.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
