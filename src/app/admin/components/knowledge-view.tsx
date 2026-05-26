"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, ArrowLeft, Plus } from "lucide-react";
import type { ViewState } from "./shared";
import { timeAgo } from "./shared";

type KnowledgeFile = {
  filename: string;
  size: number;
  modifiedAt: number;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function KnowledgeView({
  onNavigate,
  editingFilename,
}: {
  onNavigate: (view: ViewState) => void;
  editingFilename?: string;
}) {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [content, setContent] = useState("");
  const [newFilename, setNewFilename] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [creating, setCreating] = useState(false);

  const isNew = editingFilename === "__new__";
  const isEditing = !!editingFilename;

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge");
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      // ignore
    }
  }, []);

  const fetchFileContent = useCallback(async (filename: string) => {
    try {
      const res = await fetch(`/api/knowledge/${filename}`);
      const data = await res.json();
      setContent(data.content ?? "");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isEditing && !isNew) {
      fetchFileContent(editingFilename!);
    } else {
      fetchFiles();
    }
  }, [isEditing, isNew, editingFilename, fetchFileContent, fetchFiles]);

  const handleSave = async () => {
    setSaving(true);
    if (isNew) {
      const filename = newFilename.endsWith(".md") ? newFilename : `${newFilename}.md`;
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content }),
      });
      if (res.ok) {
        onNavigate({ type: "knowledge" });
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create file");
      }
    } else {
      await fetch(`/api/knowledge/${editingFilename}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    await fetch(`/api/knowledge/${filename}`, { method: "DELETE" });
    fetchFiles();
  };

  // Editor view
  if (isEditing) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => onNavigate({ type: "knowledge" })}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Knowledge Base
        </button>

        {isNew && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Filename</label>
            <input
              className="w-full max-w-md border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              placeholder="e.g. my-policy"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Alphanumeric, hyphens, underscores only. .md extension added automatically.
            </p>
          </div>
        )}

        <Textarea
          className="text-sm font-mono bg-background border-border text-foreground min-h-[500px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write markdown content..."
        />

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onNavigate({ type: "knowledge" })}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || (isNew && !newFilename.trim())}
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
          </Button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <Button
        size="sm"
        onClick={() => onNavigate({ type: "knowledge-edit", filename: "__new__" })}
      >
        <Plus className="h-4 w-4 mr-1" />
        New Document
      </Button>

      <div className="border border-border rounded-lg overflow-hidden">
        {files.map((file) => (
          <div
            key={file.filename}
            className="flex items-center justify-between py-3 px-4 border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
            onClick={() => onNavigate({ type: "knowledge-edit", filename: file.filename })}
          >
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{file.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.size)} -- Modified {timeAgo(file.modifiedAt)}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(file.filename);
              }}
            >
              Delete
            </Button>
          </div>
        ))}
        {files.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No knowledge documents yet.
          </p>
        )}
      </div>
    </div>
  );
}
