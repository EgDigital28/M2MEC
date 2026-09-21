"use client";

import Image from "next/image";
import { useMemo, useRef, useState, type FormEvent } from "react";
import type { CreativeBootstrap, StudioKit } from "@/lib/creative/queries";
import type { BrandKitVersion, CreativeTemplate } from "@/lib/creative/types";

type CreativeStudioProps = CreativeBootstrap & {
  configured: boolean;
  loadError: string | null;
};

type Render = CreativeBootstrap["renders"][number];

const COLOR_FIELDS = [
  { key: "primary_color", label: "Primary" },
  { key: "secondary_color", label: "Secondary" },
  { key: "accent_color", label: "Accent" },
  { key: "text_color", label: "Text" },
] as const;

type ColorField = (typeof COLOR_FIELDS)[number]["key"];

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/New_York",
      }).format(date)
    : "—";
}

function labelFor(kit: StudioKit) {
  return kit.handle ? `${kit.name} · ${kit.handle}` : kit.name;
}

export function CreativeStudio({
  kits: initialKits,
  templates,
  renders: initialRenders,
  configured,
  loadError,
}: CreativeStudioProps) {
  const [kits, setKits] = useState(initialKits);
  const [renders, setRenders] = useState(initialRenders);
  const [kitId, setKitId] = useState(initialKits[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [regenerateBackdrop, setRegenerateBackdrop] = useState(false);
  const [newKitName, setNewKitName] = useState("");
  const [busy, setBusy] = useState<"render" | "kit" | "save" | "logo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [latest, setLatest] = useState<Render | null>(initialRenders[0] ?? null);
  const logoInput = useRef<HTMLInputElement>(null);

  const kit = useMemo(() => kits.find((entry) => entry.id === kitId) ?? null, [kits, kitId]);
  const template = useMemo(
    () => templates.find((entry) => entry.id === templateId) ?? null,
    [templates, templateId],
  );

  /** Replaces a kit's current version in place after any edit writes a new one. */
  function applyVersion(id: string, version: BrandKitVersion, logoUrl?: string | null) {
    setKits((current) =>
      current.map((entry) =>
        entry.id === id
          ? { ...entry, version, logoUrl: logoUrl === undefined ? entry.logoUrl : logoUrl }
          : entry,
      ),
    );
  }

  function setColor(field: ColorField, value: string) {
    if (!kit) return;
    applyVersion(kit.id, { ...kit.version, [field]: value });
  }

  async function saveKit() {
    if (!kit) return;
    setBusy("save");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/creative/kits/${kit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: kit.name,
          handle: kit.handle,
          primary_color: kit.version.primary_color,
          secondary_color: kit.version.secondary_color,
          accent_color: kit.version.accent_color,
          text_color: kit.version.text_color,
          style_prompt: kit.version.style_prompt ?? "",
        }),
      });

      const data = (await response.json()) as { version?: BrandKitVersion; error?: string };

      if (!response.ok || !data.version) {
        setError(data.error ?? "Could not save the kit.");
        return;
      }

      applyVersion(kit.id, data.version);
      setNotice(`Saved as version ${data.version.version}.`);
    } catch {
      setError("Network error while saving the kit.");
    } finally {
      setBusy(null);
    }
  }

  async function createKit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("kit");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKitName }),
      });

      const data = (await response.json()) as {
        kit?: StudioKit;
        error?: string;
      };

      if (!response.ok || !data.kit) {
        setError(data.error ?? "Could not create the kit.");
        return;
      }

      const created = { ...data.kit, logoUrl: null };
      setKits((current) => [...current, created]);
      setKitId(created.id);
      setNewKitName("");
    } catch {
      setError("Network error while creating the kit.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadLogo(file: File) {
    if (!kit) return;
    setBusy("logo");
    setError(null);
    setNotice(null);

    try {
      const form = new FormData();
      form.append("logo", file);

      const response = await fetch(`/api/creative/kits/${kit.id}/logo`, {
        method: "POST",
        body: form,
      });

      const data = (await response.json()) as {
        version?: BrandKitVersion;
        logoUrl?: string | null;
        error?: string;
      };

      if (!response.ok || !data.version) {
        setError(data.error ?? "Could not upload the logo.");
        return;
      }

      applyVersion(kit.id, data.version, data.logoUrl ?? null);
      setNotice(`Logo saved as version ${data.version.version}.`);
    } catch {
      setError("Network error while uploading the logo.");
    } finally {
      setBusy(null);
      if (logoInput.current) logoInput.current.value = "";
    }
  }

  async function render(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kit || !template) return;

    setBusy("render");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/creative/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          kitVersionId: kit.version.id,
          values,
          regenerateBackdrop,
        }),
      });

      const data = (await response.json()) as { render?: Render; error?: string };

      if (!response.ok || !data.render) {
        setError(data.error ?? "Could not render the creative.");
        return;
      }

      setLatest(data.render);
      setRenders((current) => [data.render as Render, ...current].slice(0, 12));
      setRegenerateBackdrop(false);
    } catch {
      setError("Network error while rendering.");
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

      <div className="grid gap-4 lg:grid-cols-[320px_1fr_320px]">
        <section className="h-fit space-y-4 rounded-2xl border border-border bg-surface p-5">
          <div>
            <h2 className="text-sm font-semibold">Brand kit</h2>
            <p className="mt-1 text-xs text-muted">
              Every edit writes a new version, so an older creative still resolves the colours it
              was made with.
            </p>
          </div>

          {kits.length ? (
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Kit
              </span>
              <select
                value={kitId}
                onChange={(event) => setKitId(event.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
              >
                {kits.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {labelFor(entry)} (v{entry.version.version})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-muted">
              No kits yet. Name one below — colours, a logo and a style prompt come after.
            </p>
          )}

          {kit ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {COLOR_FIELDS.map((field) => (
                  <label key={field.key} className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                      {field.label}
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <input
                        type="color"
                        value={kit.version[field.key]}
                        onChange={(event) => setColor(field.key, event.target.value)}
                        className="h-9 w-9 cursor-pointer rounded border border-border bg-background"
                      />
                      <span className="text-xs tabular-nums text-muted">
                        {kit.version[field.key]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Style prompt
                </span>
                <textarea
                  value={kit.version.style_prompt ?? ""}
                  onChange={(event) =>
                    applyVersion(kit.id, { ...kit.version, style_prompt: event.target.value })
                  }
                  rows={3}
                  placeholder="Matte navy paper, soft studio light, no text"
                  className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-accent"
                />
                <span className="mt-1 block text-xs text-muted">
                  Appended to the template&apos;s backdrop prompt.
                </span>
              </label>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Logo
                </span>
                <div className="mt-2 flex items-center gap-3">
                  {kit.logoUrl ? (
                    <span className="relative h-12 w-20 overflow-hidden rounded border border-border bg-background">
                      <Image
                        src={kit.logoUrl}
                        alt={`${kit.name} logo`}
                        fill
                        unoptimized
                        sizes="80px"
                        className="object-contain"
                      />
                    </span>
                  ) : (
                    <span className="text-xs text-muted">None</span>
                  )}
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadLogo(file);
                    }}
                    className="text-xs text-muted file:mr-2 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:text-foreground"
                  />
                </div>
                <p className="mt-1 text-xs text-muted">PNG or JPEG, under 2 MB.</p>
              </div>

              <button
                type="button"
                onClick={saveKit}
                disabled={busy !== null}
                className="w-full rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
              >
                {busy === "save" ? "Saving…" : "Save new version"}
              </button>
            </>
          ) : null}

          <form onSubmit={createKit} className="space-y-2 border-t border-border pt-4">
            <label
              htmlFor="creative-kit-name"
              className="text-[10px] font-semibold uppercase tracking-widest text-muted"
            >
              New kit
            </label>
            <input
              id="creative-kit-name"
              value={newKitName}
              onChange={(event) => setNewKitName(event.target.value)}
              required
              maxLength={120}
              placeholder="M2MEC"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy !== null}
              className="w-full rounded-full border border-border px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {busy === "kit" ? "Creating…" : "Create kit"}
            </button>
          </form>
        </section>

        <form
          onSubmit={render}
          className="h-fit space-y-4 rounded-2xl border border-border bg-surface p-5"
        >
          <div>
            <h2 className="text-sm font-semibold">Creative</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted">
              <li>Pick a template and fill the fields — they are drawn onto the image as typed.</li>
              <li>
                Tick <span className="text-foreground">Generate a new backdrop</span> the first
                time. After that the backdrop is cached, so changing the copy is free.
              </li>
              <li>Render. The result appears on the right and downloads from there.</li>
            </ol>
            <p className="mt-2 text-xs text-muted">
              Only the backdrop is generated. Every figure a reader acts on comes from these
              fields, so a post can never carry a number the model invented.
            </p>
          </div>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              Template
            </span>
            <select
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value);
                setValues({});
              }}
              className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            >
              {templates.map((entry: CreativeTemplate) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.width}×{entry.height}
                </option>
              ))}
            </select>
          </label>

          {template ? (
            <>
              <button
                type="button"
                onClick={() =>
                  setValues(
                    Object.fromEntries(
                      template.slots
                        .filter((slot) => slot.placeholder)
                        .map((slot) => [slot.key, slot.placeholder as string]),
                    ),
                  )
                }
                className="text-xs text-accent underline-offset-4 hover:underline"
              >
                Fill with an example
              </button>
              <div className="grid gap-3 sm:grid-cols-2">
              {template.slots.map((slot) => (
                <label key={slot.key} className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                    {slot.label}
                  </span>
                  <input
                    value={values[slot.key] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [slot.key]: event.target.value }))
                    }
                    maxLength={120}
                    placeholder={slot.placeholder ?? ""}
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
                  />
                </label>
              ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">No templates are active.</p>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={regenerateBackdrop}
              onChange={(event) => setRegenerateBackdrop(event.target.checked)}
              className="mt-1"
            />
            <span>
              Generate a new backdrop
              <span className="block text-xs text-muted">
                This is the only step that costs money. Leave it off to re-use the cached one.
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={busy !== null || !kit || !template || !configured}
            className="w-full rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {busy === "render" ? "Rendering…" : "Render"}
          </button>

          {!configured ? (
            <p className="text-xs text-muted">
              XAI_API_KEY is not configured, so a backdrop cannot be generated.
            </p>
          ) : null}
        </form>

        <section className="h-fit space-y-3 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Preview</h2>
          {latest?.url ? (
            <a
              href={latest.url}
              target="_blank"
              rel="noreferrer"
              className="relative block aspect-[4/5] overflow-hidden rounded-xl border border-border"
            >
              <Image
                src={latest.url}
                alt="Latest creative"
                fill
                unoptimized
                sizes="320px"
                className="object-contain"
              />
            </a>
          ) : (
            <p className="text-sm text-muted">Render one to see it here.</p>
          )}
          {latest ? (
            <p className="text-xs text-muted">{formatTime(latest.created_at)}</p>
          ) : null}
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recent creatives</h2>
        {renders.length ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {renders.map((entry) => (
              <figure key={entry.id} className="space-y-1">
                {entry.url ? (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative block aspect-[4/5] overflow-hidden rounded-xl border border-border"
                  >
                    <Image
                      src={entry.url}
                      alt="Creative"
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, 16vw"
                      className="object-cover"
                    />
                  </a>
                ) : (
                  <span className="block aspect-[4/5] rounded-xl border border-border bg-background" />
                )}
                <figcaption className="text-xs text-muted">
                  {formatTime(entry.created_at)}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Nothing rendered yet.</p>
        )}
      </section>
    </div>
  );
}
