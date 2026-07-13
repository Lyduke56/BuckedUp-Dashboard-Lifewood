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

  // "file" uploads to Supabase Storage; "url" submits an external link
  // (e.g. an unlisted YouTube URL) straight into set_current_video_version,
  // skipping storage entirely — VideoModal already embeds YouTube/Drive/
  // direct URLs, so no playback-side change is needed.
  const [inputMode, setInputMode] = useState<"file" | "url">("file");
  const [urlValue, setUrlValue] = useState("");
  // A ref mirror so the (stable) external upload handler can read the
  // latest mode/url without being re-registered on every keystroke.
  const inputStateRef = useRef({ inputMode, urlValue });
  useEffect(() => {
    inputStateRef.current = { inputMode, urlValue };
  }, [inputMode, urlValue]);

  // Local state used ONLY if externalControls is false
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localNote, setLocalNote] = useState("");
  const [localUploading, setLocalUploading] = useState(false);

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

  // Submit an external URL (unlisted YouTube etc.) as the current version —
  // no storage upload, just the RPC that also syncs products.video_url.
  const submitUrl = async (url: string, noteText: string, setUploadState: (val: boolean) => void) => {
    setUploadState(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_current_video_version", {
      p_product_id: productId,
      p_video_url: url.trim(),
      p_note: noteText.trim() || null,
    });

    setUploadState(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setVersions(await fetchVersions(productId));
    onVersionAdded(url.trim());
    setUrlValue("");
    if (externalControls) {
      onNoteChange?.("");
    } else {
      setLocalNote("");
    }
  };

  // Register external upload handler if externalControls is true
  useEffect(() => {
    if (externalControls && onUploadReady && onFileChange) {
      const handler = async () => {
        const { inputMode: mode, urlValue: url } = inputStateRef.current;
        if (mode === "url") {
          if (url.trim()) {
            await submitUrl(url, noteValue, setUploading || (() => {}));
          }
        } else {
          const selectedParentFile = fileInputRef.current?.files?.[0];
          if (selectedParentFile) {
            await executeUpload(selectedParentFile, noteValue, setUploading || (() => {}));
          }
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
    if (inputMode === "url") {
      if (urlValue.trim()) await submitUrl(urlValue, localNote, setLocalUploading);
    } else if (localFile) {
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

      {/* Source toggle: upload a file, or paste an external (YouTube) URL. */}
      <div className="filter-pills" style={{ marginTop: "8px" }}>
        <button
          type="button"
          className={`pill${inputMode === "file" ? " active" : ""}`}
          onClick={() => setInputMode("file")}
        >
          Upload file
        </button>
        <button
          type="button"
          className={`pill${inputMode === "url" ? " active" : ""}`}
          onClick={() => setInputMode("url")}
        >
          Paste YouTube URL
        </button>
      </div>

      {/* Render depending on mode */}
      {externalControls ? (
        <div className="issue-form versions-file-row">
          {inputMode === "url" ? (
            <input
              type="url"
              placeholder="https://youtube.com/watch?v=… (unlisted is fine)"
              value={urlValue}
              onChange={(event) => setUrlValue(event.target.value)}
            />
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
              onChange={handleFileChange}
            />
          )}
        </div>
      ) : (
        <div className="issue-form">
          {inputMode === "url" ? (
            <input
              type="url"
              placeholder="https://youtube.com/watch?v=… (unlisted is fine)"
              value={urlValue}
              onChange={(event) => setUrlValue(event.target.value)}
            />
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
              onChange={handleFileChange}
            />
          )}
          <input
            type="text"
            placeholder="Note (optional)…"
            value={localNote}
            onChange={(event) => setLocalNote(event.target.value)}
          />
          <button
            type="button"
            className="issue-submit-btn"
            disabled={
              localUploading ||
              (inputMode === "url" ? !urlValue.trim() : !localFile)
            }
            onClick={handleLocalUploadClick}
          >
            {localUploading ? "Saving…" : inputMode === "url" ? "Save URL" : "Upload version"}
          </button>
        </div>
      )}
    </div>
  );
}
