"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { StudioKit, StudioTemplate } from "@/lib/creative/queries";
import { COLOR_ROLES, type TemplateDecoration, type TemplateSlot } from "@/lib/creative/types";
import { IMAGE_MODELS, formatUsd, usdFromTicks, type ImageModelId } from "@/lib/playground/provider";

type TemplateStudioProps = {
  kits: StudioKit[];
  templates: StudioTemplate[];
  configured: boolean;
  defaultModel: ImageModelId;
  loadError: string | null;
};

const NUMBER_FIELDS = [
  { key: "x", label: "X" },
  { key: "y", label: "Y" },
  { key: "w", label: "W" },
  { key: "size", label: "Size" },
] as const;

function blankSlot(index: number): TemplateSlot {
  return {
    key: `field${index + 1}`,
    label: `Field ${index + 1}`,
    kind: "text",
    x: 0.5,
    y: 0.5,
    w: 0.6,
    align: "center",
    size: 0.03,
    weight: 700,
    colorRole: "secondary",
    transform: "none",
  };
}

export function TemplateStudio({
  kits,
  templates: initialTemplates,
  configured,
  defaultModel,
  loadError,
}: TemplateStudioProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState(initialTemplates[0]?.id ?? "");
  const [draft, setDraft] = useState<StudioTemplate | null>(initialTemplates[0] ?? null);
  const [kitId, setKitId] = useState(kits[0]?.id ?? "");
  const [model, setModel] = useState<ImageModelId>(defaultModel);
  const [newName, setNewName] = useState("");
  const [copyFrom, setCopyFrom] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState<"save" | "backdrop" | "create" | "delete" | "reference" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const referenceInput = useRef<HTMLInputElement>(null);

  const kit = useMemo(() => kits.find((entry) => entry.id === kitId) ?? null, [kits, kitId]);

  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      setDraft(templates.find((entry) => entry.id === id) ?? null);
      setError(null);
      setNotice(null);
    },
    [templates],
  );

  /** Replace a template everywhere it is held, including the open draft. */
  const absorb = useCallback((template: StudioTemplate) => {
    setTemplates((current) => {
      const exists = current.some((entry) => entry.id === template.id);
      return exists
        ? current.map((entry) => (entry.id === template.id ? { ...entry, ...template } : entry))
        : [...current, template].sort((a, b) => a.name.localeCompare(b.name));
    });
    setDraft((current) => (current?.id === template.id ? { ...current, ...template } : current));
  }, []);

  // Previews are composed, never generated, so they cost nothing and can run
  // on every edit. Debounced only to avoid queueing renders while typing.
  useEffect(() => {
    if (!draft || !kit) return;

    const timer = setTimeout(async () => {
      setPreviewing(true);

      try {
        const response = await fetch("/api/creative/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: draft.id,
            kitVersionId: kit.version.id,
            slots: draft.slots,
            decorations: draft.decorations ?? [],
            logo: draft.logo ?? null,
          }),
        });

        if (!response.ok) {
          setPreviewUrl(null);
          return;
        }

        const blob = await response.blob();
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
      } catch {
        setPreviewUrl(null);
      } finally {
        setPreviewing(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [draft, kit]);

  function patchSlot(index: number, patch: Partial<TemplateSlot>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            slots: current.slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
          }
        : current,
    );
  }

  function patchDecoration(index: number, patch: Partial<TemplateDecoration>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            decorations: (current.decorations ?? []).map((item, i) =>
              i === index ? { ...item, ...patch } : item,
            ),
          }
        : current,
    );
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/creative/templates/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description ?? "",
          backdrop_prompt: draft.backdrop_prompt,
          slots: draft.slots,
          decorations: draft.decorations ?? [],
          logo: draft.logo ?? null,
        }),
      });

      const data = (await response.json()) as { template?: StudioTemplate; error?: string };

      if (!response.ok || !data.template) {
        setError(data.error ?? "Could not save the template.");
        return;
      }

      absorb({ ...draft, ...data.template });
      setNotice("Saved.");
    } catch {
      setError("Network error while saving.");
    } finally {
      setBusy(null);
    }
  }

  async function generateBackdrop() {
    if (!draft) return;
    setBusy("backdrop");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/creative/templates/${draft.id}/backdrop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });

      const data = (await response.json()) as {
        template?: StudioTemplate;
        backdropUrl?: string | null;
        costInUsdTicks?: number | null;
        error?: string;
      };

      if (!response.ok || !data.template) {
        setError(data.error ?? "Could not generate the backdrop.");
        return;
      }

      absorb({ ...draft, ...data.template, backdropUrl: data.backdropUrl ?? null });
      const spend = usdFromTicks(data.costInUsdTicks);
      setNotice(spend == null ? "New backdrop generated." : `New backdrop generated for ${formatUsd(spend)}.`);
    } catch {
      setError("Network error while generating the backdrop.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadReference(file: File) {
    if (!draft) return;
    setBusy("reference");
    setError(null);

    try {
      const form = new FormData();
      form.append("reference", file);

      const response = await fetch(`/api/creative/templates/${draft.id}/reference`, {
        method: "POST",
        body: form,
      });

      const data = (await response.json()) as { referenceUrl?: string | null; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not upload the reference.");
        return;
      }

      absorb({ ...draft, referenceUrl: data.referenceUrl ?? null });
      setNotice("Reference saved.");
    } catch {
      setError("Network error while uploading the reference.");
    } finally {
      setBusy(null);
      if (referenceInput.current) referenceInput.current.value = "";
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/creative/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          ...(copyFrom && selectedId ? { copyFromId: selectedId } : {}),
        }),
      });

      const data = (await response.json()) as { template?: StudioTemplate; error?: string };

      if (!response.ok || !data.template) {
        setError(data.error ?? "Could not create the template.");
        return;
      }

      const created = {
        ...data.template,
        previewUrl: null,
        backdropUrl: null,
        referenceUrl: null,
      };
      absorb(created);
      setSelectedId(created.id);
      setDraft(created);
      setNewName("");
      setNotice("Created. It has no backdrop yet — generate one below.");
    } catch {
      setError("Network error while creating the template.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!draft) return;
    setBusy("delete");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/creative/templates/${draft.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not delete the template.");
        return;
      }

      const remaining = templates.filter((entry) => entry.id !== draft.id);
      setTemplates(remaining);
      setSelectedId(remaining[0]?.id ?? "");
      setDraft(remaining[0] ?? null);
      setNotice("Deleted.");
    } catch {
      setError("Network error while deleting.");
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        {loadError}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-muted">{notice}</p> : null}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Templates</h2>
        <p className="mt-1 text-xs text-muted">
          A template is a whole design: the photograph it sits on and where the words go. The
          photograph is generated here, once, so making a post later costs nothing.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {templates.map((entry) => {
            const thumb = entry.previewUrl ?? entry.backdropUrl;

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => select(entry.id)}
                aria-pressed={selectedId === entry.id}
                className={`overflow-hidden rounded-xl border text-left transition-colors ${
                  selectedId === entry.id
                    ? "border-accent bg-surface-elevated"
                    : "border-border hover:border-accent/40"
                }`}
              >
                <span className="relative block aspect-[4/5] bg-background">
                  {thumb ? (
                    <Image src={thumb} alt="" fill unoptimized sizes="180px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center px-2 text-center text-[10px] text-muted">
                      No backdrop yet
                    </span>
                  )}
                </span>
                <span className="block px-2 py-1.5">
                  <span className="block truncate text-xs font-medium">{entry.name}</span>
                  <span className="block text-[10px] tabular-nums text-muted">
                    {entry.width}×{entry.height}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <label className="flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              New template
            </span>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              required
              maxLength={120}
              placeholder="Bet slip — parlay"
              className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={copyFrom}
              onChange={(event) => setCopyFrom(event.target.checked)}
            />
            Copy the selected layout
          </label>
          <button
            type="submit"
            disabled={busy !== null}
            className="h-10 rounded-full border border-border px-4 text-sm disabled:opacity-50"
          >
            {busy === "create" ? "Creating…" : "Create"}
          </button>
        </form>
      </section>

      {draft ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Name
                  </span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Description
                  </span>
                  <input
                    value={draft.description ?? ""}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Backdrop prompt
                </span>
                <textarea
                  value={draft.backdrop_prompt}
                  onChange={(event) => setDraft({ ...draft, backdrop_prompt: event.target.value })}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-accent"
                />
                <span className="mt-1 block text-xs text-muted">
                  Say &quot;no text, no numbers&quot; explicitly. A backdrop that arrives with
                  invented odds printed on it is worse than no backdrop.
                </span>
              </label>

              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-40 flex-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Model
                  </span>
                  <select
                    value={model}
                    onChange={(event) => setModel(event.target.value as ImageModelId)}
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
                  >
                    {IMAGE_MODELS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} · {option.tier}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={generateBackdrop}
                  disabled={busy !== null || !configured}
                  className="h-10 rounded-full bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
                >
                  {busy === "backdrop"
                    ? "Generating…"
                    : draft.backdropUrl
                      ? "Replace backdrop"
                      : "Generate backdrop"}
                </button>
                <p className="pb-2.5 text-xs text-muted">
                  The only step that costs money.
                  {draft.backdropUrl ? " The current one is kept." : ""}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Reference
                </span>
                {draft.referenceUrl ? (
                  <a
                    href={draft.referenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="relative h-14 w-12 overflow-hidden rounded border border-border"
                  >
                    <Image src={draft.referenceUrl} alt="" fill unoptimized sizes="48px" className="object-cover" />
                  </a>
                ) : null}
                <input
                  ref={referenceInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadReference(file);
                  }}
                  className="text-xs text-muted file:mr-2 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:text-foreground"
                />
                <span className="text-xs text-muted">
                  A design to work against. Nothing reads it — the image API takes text only.
                </span>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Fields</h3>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, slots: [...draft.slots, blankSlot(draft.slots.length)] })
                  }
                  className="text-xs text-accent underline-offset-4 hover:underline"
                >
                  Add a field
                </button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-200 text-xs">
                  <thead className="text-left text-[10px] uppercase tracking-widest text-muted">
                    <tr>
                      <th className="pb-2 pr-2">Label</th>
                      {NUMBER_FIELDS.map((field) => (
                        <th key={field.key} className="pb-2 pr-2">{field.label}</th>
                      ))}
                      <th className="pb-2 pr-2">Align</th>
                      <th className="pb-2 pr-2">Face</th>
                      <th className="pb-2 pr-2">Colour</th>
                      <th className="pb-2 pr-2">Case</th>
                      <th className="pb-2 pr-2">Example</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.slots.map((slot, index) => (
                      <tr key={slot.key} className="border-t border-border">
                        <td className="py-1 pr-2">
                          <input
                            value={slot.label}
                            onChange={(event) => patchSlot(index, { label: event.target.value })}
                            className="h-8 w-28 rounded border border-border bg-background px-2 outline-none focus:border-accent"
                          />
                        </td>
                        {NUMBER_FIELDS.map((field) => (
                          <td key={field.key} className="py-1 pr-2">
                            <input
                              type="number"
                              step="0.005"
                              value={slot[field.key]}
                              onChange={(event) =>
                                patchSlot(index, { [field.key]: Number(event.target.value) })
                              }
                              className="h-8 w-20 rounded border border-border bg-background px-2 tabular-nums outline-none focus:border-accent"
                            />
                          </td>
                        ))}
                        <td className="py-1 pr-2">
                          <select
                            value={slot.align}
                            onChange={(event) =>
                              patchSlot(index, { align: event.target.value as TemplateSlot["align"] })
                            }
                            className="h-8 rounded border border-border bg-background px-1 outline-none focus:border-accent"
                          >
                            <option value="left">left</option>
                            <option value="center">center</option>
                            <option value="right">right</option>
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            value={slot.font ?? "body"}
                            onChange={(event) =>
                              patchSlot(index, {
                                font: event.target.value === "display" ? "display" : undefined,
                              })
                            }
                            className="h-8 rounded border border-border bg-background px-1 outline-none focus:border-accent"
                          >
                            <option value="body">body</option>
                            <option value="display">display</option>
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            value={slot.colorRole}
                            onChange={(event) =>
                              patchSlot(index, {
                                colorRole: event.target.value as TemplateSlot["colorRole"],
                              })
                            }
                            className="h-8 rounded border border-border bg-background px-1 outline-none focus:border-accent"
                          >
                            {COLOR_ROLES.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            value={slot.transform}
                            onChange={(event) =>
                              patchSlot(index, {
                                transform: event.target.value as TemplateSlot["transform"],
                              })
                            }
                            className="h-8 rounded border border-border bg-background px-1 outline-none focus:border-accent"
                          >
                            <option value="none">as typed</option>
                            <option value="uppercase">UPPER</option>
                          </select>
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            value={slot.placeholder ?? ""}
                            onChange={(event) =>
                              patchSlot(index, { placeholder: event.target.value })
                            }
                            className="h-8 w-32 rounded border border-border bg-background px-2 outline-none focus:border-accent"
                          />
                        </td>
                        <td className="py-1">
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                slots: draft.slots.filter((_, i) => i !== index),
                              })
                            }
                            className="text-muted hover:text-red-300"
                            aria-label={`Remove ${slot.label}`}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Decorations</h3>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      decorations: [
                        ...(draft.decorations ?? []),
                        { type: "rule", x: 0.2, y: 0.5, w: 0.6, h: 0.004, colorRole: "accent" },
                      ],
                    })
                  }
                  className="text-xs text-accent underline-offset-4 hover:underline"
                >
                  Add one
                </button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-150 text-xs">
                  <thead className="text-left text-[10px] uppercase tracking-widest text-muted">
                    <tr>
                      <th className="pb-2 pr-2">Type</th>
                      <th className="pb-2 pr-2">X</th>
                      <th className="pb-2 pr-2">Y</th>
                      <th className="pb-2 pr-2">W</th>
                      <th className="pb-2 pr-2">H</th>
                      <th className="pb-2 pr-2">Colour</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.decorations ?? []).map((item, index) => (
                      <tr key={index} className="border-t border-border">
                        <td className="py-1 pr-2">
                          <select
                            value={item.type}
                            onChange={(event) =>
                              patchDecoration(index, {
                                type: event.target.value as TemplateDecoration["type"],
                              })
                            }
                            className="h-8 rounded border border-border bg-background px-1 outline-none focus:border-accent"
                          >
                            <option value="rule">rule</option>
                            <option value="block">block</option>
                            <option value="barcode">barcode</option>
                          </select>
                        </td>
                        {(["x", "y", "w", "h"] as const).map((field) => (
                          <td key={field} className="py-1 pr-2">
                            <input
                              type="number"
                              step="0.005"
                              value={item[field]}
                              onChange={(event) =>
                                patchDecoration(index, { [field]: Number(event.target.value) })
                              }
                              className="h-8 w-20 rounded border border-border bg-background px-2 tabular-nums outline-none focus:border-accent"
                            />
                          </td>
                        ))}
                        <td className="py-1 pr-2">
                          <select
                            value={item.colorRole}
                            onChange={(event) =>
                              patchDecoration(index, {
                                colorRole: event.target.value as TemplateDecoration["colorRole"],
                              })
                            }
                            className="h-8 rounded border border-border bg-background px-1 outline-none focus:border-accent"
                          >
                            {COLOR_ROLES.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1">
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                decorations: (draft.decorations ?? []).filter((_, i) => i !== index),
                              })
                            }
                            className="text-muted hover:text-red-300"
                            aria-label="Remove decoration"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={busy !== null}
                className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
              >
                {busy === "save" ? "Saving…" : "Save template"}
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy !== null}
                className="rounded-full border border-border px-4 py-2.5 text-sm text-muted hover:text-red-300 disabled:opacity-50"
              >
                {busy === "delete" ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>

          <section className="h-fit space-y-3 rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Live preview</h3>
              {previewing ? <span className="text-xs text-muted">updating…</span> : null}
            </div>

            {kits.length > 1 ? (
              <select
                value={kitId}
                onChange={(event) => setKitId(event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-accent"
              >
                {kits.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            ) : null}

            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border bg-background">
              {previewUrl ? (
                // A blob URL from this session, so next/image optimisation is
                // neither possible nor wanted.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Template preview" className="h-full w-full object-contain" />
              ) : (
                <span className="flex h-full items-center justify-center px-3 text-center text-xs text-muted">
                  {draft.backdropUrl
                    ? "Composing…"
                    : "No backdrop yet. Generate one to see this design."}
                </span>
              )}
            </div>

            <p className="text-xs text-muted">
              Composed from the example values, free every time. Only the backdrop costs anything.
            </p>
          </section>
        </div>
      ) : (
        <p className="text-sm text-muted">Create a template to get started.</p>
      )}
    </div>
  );
}
