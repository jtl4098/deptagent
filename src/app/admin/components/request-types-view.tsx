"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Pencil, X } from "lucide-react";

type FieldDef = {
  key: string;
  label: string;
  type: "string" | "number";
  required: boolean;
};

type RequestType = {
  id: string;
  name: string;
  description: string;
  required_fields: string;
  enabled: number;
  created_at: number;
  updated_at: number;
};

export function RequestTypesView() {
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [editing, setEditing] = useState<RequestType | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", description: "" });
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchRequestTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/request-types");
      const data = await res.json();
      setRequestTypes(data.requestTypes ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchRequestTypes();
  }, [fetchRequestTypes]);

  const handleCreate = async () => {
    setSaving(true);
    await fetch("/api/request-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id,
        name: form.name,
        description: form.description,
        requiredFields: fields,
      }),
    });
    setSaving(false);
    setCreating(false);
    resetForm();
    fetchRequestTypes();
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/request-types/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        requiredFields: fields,
      }),
    });
    setSaving(false);
    setEditing(null);
    resetForm();
    fetchRequestTypes();
  };

  const handleToggleEnabled = async (rt: RequestType) => {
    await fetch(`/api/request-types/${rt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rt.enabled }),
    });
    fetchRequestTypes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this request type?")) return;
    await fetch(`/api/request-types/${id}`, { method: "DELETE" });
    fetchRequestTypes();
  };

  const resetForm = () => {
    setForm({ id: "", name: "", description: "" });
    setFields([]);
  };

  const startEdit = (rt: RequestType) => {
    setEditing(rt);
    setCreating(false);
    setForm({ id: rt.id, name: rt.name, description: rt.description });
    try {
      setFields(JSON.parse(rt.required_fields));
    } catch {
      setFields([]);
    }
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    resetForm();
  };

  const cancelForm = () => {
    setCreating(false);
    setEditing(null);
    resetForm();
  };

  const addField = () => {
    setFields([...fields, { key: "", label: "", type: "string", required: true }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FieldDef>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const showForm = creating || editing;

  return (
    <div className="space-y-4">
      {!showForm && (
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4 mr-1" />
          New Request Type
        </Button>
      )}

      {showForm && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {creating && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">ID</label>
                  <input
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                    value={form.id}
                    onChange={(e) => setForm({ ...form, id: e.target.value })}
                    placeholder="e.g. book"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Book"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <input
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Fields</label>
              <div className="space-y-2">
                {fields.map((field, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 items-center">
                    <input
                      className="border border-border rounded-md px-2 py-1.5 text-sm bg-background text-foreground"
                      value={field.key}
                      onChange={(e) => updateField(i, { key: e.target.value })}
                      placeholder="key"
                    />
                    <input
                      className="border border-border rounded-md px-2 py-1.5 text-sm bg-background text-foreground"
                      value={field.label}
                      onChange={(e) => updateField(i, { label: e.target.value })}
                      placeholder="Label"
                    />
                    <select
                      className="border border-border rounded-md px-2 py-1.5 text-sm bg-background text-foreground"
                      value={field.type}
                      onChange={(e) => updateField(i, { type: e.target.value as "string" | "number" })}
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(i, { required: e.target.checked })}
                      />
                      Required
                    </label>
                    <Button size="sm" variant="ghost" onClick={() => removeField(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="mt-2" onClick={addField}>
                <Plus className="h-3 w-3 mr-1" />
                Add Field
              </Button>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={cancelForm} disabled={saving}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={editing ? handleUpdate : handleCreate}
                disabled={saving || (!editing && (!form.id || !form.name))}
              >
                {saving ? "Saving..." : editing ? "Save Changes" : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {requestTypes.map((rt) => {
        let fieldCount = 0;
        try {
          fieldCount = JSON.parse(rt.required_fields).length;
        } catch {
          // ignore
        }

        return (
          <Card key={rt.id} className="bg-card border-border shadow-sm">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{rt.name}</span>
                    <Badge className="text-xs border bg-muted/50 text-muted-foreground">
                      {fieldCount} fields
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">{rt.id}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{rt.description}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      rt.enabled ? "bg-green-500" : "bg-gray-300"
                    }`}
                    onClick={() => handleToggleEnabled(rt)}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        rt.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <Button size="sm" variant="outline" onClick={() => startEdit(rt)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(rt.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {requestTypes.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No request types configured.
        </p>
      )}
    </div>
  );
}
