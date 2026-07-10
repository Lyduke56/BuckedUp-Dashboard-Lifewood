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
  /** Called after a version is successfully uploaded */
  onVersionAdded: (url: string) => void;
  
  /** Whether the controls (note, file, upload trigger) are handled by the parent */
  externalControls?: boolean;

  // The following props are only required if externalControls is true:
  noteValue?: string;
  onNoteChange?: (value: string) => void;
  onUploadReady?: (handler: () => Promise<void>) => void;
  uploading?: boolean;
  setUploading?: (value: boolean) => void;
  onFileChange?: (file: File | null) => void;
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

export function VideoVersionsPanel({
  productId,
  onVersionAdded,
  externalControls = false,
  noteValue = "",
  onNoteChange,
  onUploadReady,
  uploading = false,
  setUploading,
  onFileChange,
}: VideoVersionsPanelProps) {
  const [versions, setVersions] = useState<VideoVersionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state used ONLY if externalControls is false
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localNote, setLocalNote] = useState("");
  const [localUploading, setLocalUploading] = useState(false);

  const isUploading = externalControls ? uploading : localUploading;
  const currentNote = externalControls ? noteValue : localNote;
  const currentFile = externalControls ? null : localFile; // Only used internally if not external

  useEffect(() => {
    fetchVersions(productId).then(setVersions);
  }, [productId]);

  // Upload handler logic (unified)
  const executeUpload = async (fileToUpload: File, noteText: string, setUploadState: (val: boolean) => void) => {
    setUploadState(true);
    setError(null);

    const supabase = createClient();
    const path = `${productId}/${Date.now()}-${fileToUpload.name}`;

    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(path, fileToUpload, { contentType: fileToUpload.type });

    if (uploadError) {
      setUploadState(false);
      setError(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("videos").getPublicUrl(path);

    const { error: rpcError } = await supabase.rpc("set_current_video_version", {
      p_product_id: productId,
      p_video_url: publicUrl,
      p_note: noteText.trim() || null,
    });

    setUploadState(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = "";
    setVersions(await fetchVersions(productId));
    onVersionAdded(publicUrl);

    if (externalControls) {
      onFileChange?.(null);
      onNoteChange?.("");
    } else {
      setLocalFile(null);
      setLocalNote("");
    }
  };

  // Register external upload handler if externalControls is true
  useEffect(() => {
    if (externalControls && onUploadReady && onFileChange) {
      const handler = async () => {
        // Find if parent file state exists via fileInputRef
        const selectedParentFile = fileInputRef.current?.files?.[0];
        if (selectedParentFile) {
          await executeUpload(selectedParentFile, noteValue, setUploading || (() => {}));
        }
      };
      onUploadReady(handler);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalControls, noteValue, productId, onFileChange, onUploadReady]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (externalControls) {
      onFileChange?.(selected);
    } else {
      setLocalFile(selected);
    }
  };

  const handleLocalUploadClick = async () => {
    if (localFile) {
      await executeUpload(localFile, localNote, setLocalUploading);
    }
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

      {/* Render depending on mode */}
      {externalControls ? (
        <div className="issue-form versions-file-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <div className="issue-form">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
            onChange={handleFileChange}
          />
          <input
            type="text"
            placeholder="Note (optional)…"
            value={localNote}
            onChange={(event) => setLocalNote(event.target.value)}
          />
          <button
            type="button"
            className="issue-submit-btn"
            disabled={localUploading || !localFile}
            onClick={handleLocalUploadClick}
          >
            {localUploading ? "Uploading…" : "Upload version"}
          </button>
        </div>
      )}
    </div>
  );
}
