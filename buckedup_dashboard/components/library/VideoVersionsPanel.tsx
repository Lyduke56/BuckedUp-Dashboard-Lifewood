"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface VideoVersionRow {
  id: string;
  video_url: string;
  note: string | null;
  is_current: boolean;
  created_at: string;
}

interface VideoVersionsPanelProps {
  productId: string;
  onVersionAdded: (url: string) => void;
}

async function fetchVersions(productId: string): Promise<VideoVersionRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("video_versions")
    .select("id, video_url, note, is_current, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  return (data as VideoVersionRow[]) ?? [];
}

export function VideoVersionsPanel({ productId, onVersionAdded }: VideoVersionsPanelProps) {
  const [versions, setVersions] = useState<VideoVersionRow[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVersions(productId).then(setVersions);
  }, [productId]);

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_current_video_version", {
      p_product_id: productId,
      p_video_url: newUrl.trim(),
      p_note: newNote.trim() || null,
    });

    setAdding(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const url = newUrl.trim();
    setNewUrl("");
    setNewNote("");
    setVersions(await fetchVersions(productId));
    onVersionAdded(url);
  };

  return (
    <div className="video-versions">
      <div className="content-angle-label">Video versions</div>
      {error ? <div className="callout form-error">{error}</div> : null}
      {versions.length === 0 ? (
        <div className="issue-empty">No versions uploaded yet.</div>
      ) : (
        <ul className="video-version-list">
          {versions.map((version) => (
            <li key={version.id} className="video-version-item">
              <a href={version.video_url} target="_blank" rel="noopener noreferrer">
                {version.video_url.replace(/^https?:\/\//, "")}
              </a>
              {version.note ? (
                <span className="video-version-note">{version.note}</span>
              ) : null}
              {version.is_current ? (
                <span className="video-version-current">Current</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="issue-form">
        <input
          type="url"
          placeholder="New video URL…"
          value={newUrl}
          onChange={(event) => setNewUrl(event.target.value)}
        />
        <input
          type="text"
          placeholder="Note (optional)…"
          value={newNote}
          onChange={(event) => setNewNote(event.target.value)}
        />
        <button
          type="button"
          className="issue-submit-btn"
          disabled={adding || !newUrl.trim()}
          onClick={handleAdd}
        >
          {adding ? "Adding…" : "Add version"}
        </button>
      </div>
    </div>
  );
}
