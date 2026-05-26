"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil } from "lucide-react";
import { timeAgo } from "./shared";

type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  active: number;
  created_at: number;
  expires_at: number | null;
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  normal: "bg-blue-50 text-blue-700 border-blue-200",
  low: "bg-gray-100 text-gray-700 border-gray-200",
};

export function AnnouncementsView() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", priority: "normal", expiresAt: "" });
  const [saving, setSaving] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      setAnnouncements(data.announcements ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreate = async () => {
    setSaving(true);
    await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        content: form.content,
        priority: form.priority,
        expiresAt: form.expiresAt || undefined,
      }),
    });
    setSaving(false);
    setCreating(false);
    setForm({ title: "", content: "", priority: "normal", expiresAt: "" });
    fetchAnnouncements();
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/announcements/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        content: form.content,
        priority: form.priority,
        active: editing.active,
        expiresAt: form.expiresAt || undefined,
      }),
    });
    setSaving(false);
    setEditing(null);
    setForm({ title: "", content: "", priority: "normal", expiresAt: "" });
    fetchAnnouncements();
  };

  const handleToggleActive = async (ann: Announcement) => {
    await fetch(`/api/announcements/${ann.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: ann.title,
        content: ann.content,
        priority: ann.priority,
        active: !ann.active,
        expiresAt: ann.expires_at ? new Date(ann.expires_at * 1000).toISOString() : undefined,
      }),
    });
    fetchAnnouncements();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    fetchAnnouncements();
  };

  const startEdit = (ann: Announcement) => {
    setEditing(ann);
    setCreating(false);
    setForm({
      title: ann.title,
      content: ann.content,
      priority: ann.priority,
      expiresAt: ann.expires_at
        ? new Date(ann.expires_at * 1000).toISOString().slice(0, 16)
        : "",
    });
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ title: "", content: "", priority: "normal", expiresAt: "" });
  };

  const cancelForm = () => {
    setCreating(false);
    setEditing(null);
    setForm({ title: "", content: "", priority: "normal", expiresAt: "" });
  };

  const showForm = creating || editing;

  return (
    <div className="space-y-4">
      {!showForm && (
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4 mr-1" />
          New Announcement
        </Button>
      )}

      {showForm && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Title</label>
              <input
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Announcement title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Content</label>
              <Textarea
                className="text-sm bg-background border-border text-foreground"
                rows={4}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Announcement content..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Expires At</label>
                <input
                  type="datetime-local"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={cancelForm} disabled={saving}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={editing ? handleUpdate : handleCreate}
                disabled={saving || !form.title || !form.content}
              >
                {saving ? "Saving..." : editing ? "Save Changes" : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {announcements.map((ann) => (
        <Card key={ann.id} className="bg-card border-border shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-foreground">{ann.title}</span>
                  <Badge className={`text-xs border ${PRIORITY_STYLES[ann.priority]}`}>
                    {ann.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{ann.content}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Created {timeAgo(ann.created_at)}</span>
                  {ann.expires_at && (
                    <span>Expires: {new Date(ann.expires_at * 1000).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    ann.active ? "bg-green-500" : "bg-gray-300"
                  }`}
                  onClick={() => handleToggleActive(ann)}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      ann.active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <Button size="sm" variant="outline" onClick={() => startEdit(ann)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(ann.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {announcements.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No announcements yet.
        </p>
      )}
    </div>
  );
}
