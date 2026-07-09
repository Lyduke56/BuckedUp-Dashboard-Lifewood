"use client";

import { useEffect, useRef, useState } from "react";
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

function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? url);
  } catch {
    return url;
  }
}

export function VideoVersionsPanel({ productId, onVersionAdded }: VideoVersionsPanelProps) {
  const [versions, setVersions] = useState<VideoVersionRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [newNote, setNewNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchVersions(productId).then(setVersions);
  }, [productId]);

  const handleAdd = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    const supabase = createClient();
    const path = `${productId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("videos").getPublicUrl(path);

    const { error: rpcError } = await supabase.rpc("set_current_video_version", {
      p_product_id: productId,
      p_video_url: publicUrl,
      p_note: newNote.trim() || null,
    });

    setUploading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setFile(null);
    setNewNote("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setVersions(await fetchVersions(productId));
    onVersionAdded(publicUrl);
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
                {fileNameFromUrl(version.video_url)}
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
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
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
          disabled={uploading || !file}
          onClick={handleAdd}
        >
          {uploading ? "Uploading…" : "Upload version"}
        </button>
      </div>
    </div>
  );
}
