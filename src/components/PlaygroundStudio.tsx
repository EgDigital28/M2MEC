"use client";

import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";
import {
  ASPECT_RATIOS,
  IMAGE_MODELS,
  MAX_IMAGES,
  MAX_PROMPT_LENGTH,
  RESOLUTIONS,
  formatUsd,
  imageModelLabel,
  usdFromTicks,
  type AspectRatio,
  type ImageModelId,
  type Resolution,
} from "@/lib/playground/provider";
import type { PlaygroundGeneration, SpendSummary } from "@/lib/playground/history";

type PlaygroundStudioProps = {
  initialHistory: PlaygroundGeneration[];
  initialSpend: SpendSummary;
  defaultModel: ImageModelId;
  configured: boolean;
  historyError: string | null;
};

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

const ASPECT_CLASS: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "2:3": "aspect-[2/3]",
  "3:2": "aspect-[3/2]",
  "16:9": "aspect-video",
};

function chipClassName(active: boolean) {
  return `rounded-lg px-3 py-1.5 text-sm transition-colors ${
    active
      ? "bg-surface-elevated text-foreground"
      : "border border-border text-muted hover:text-foreground"
  }`;
}

/** Fold a finished generation into the running totals without a refetch. */
function addToSpend(spend: SpendSummary, generation: PlaygroundGeneration): SpendSummary {
  const ticks = generation.cost_in_usd_ticks;
  const images = generation.images.length;

  if (ticks == null || images === 0) {
    return spend;
  }

  const key = (rate: { model: string; resolution: string }) =>
    `${rate.model}|${rate.resolution}`;
  const target = key({ model: generation.model, resolution: generation.resolution });
  let matched = false;

  const rates = spend.rates.map((rate) => {
    if (key(rate) !== target) return rate;
    matched = true;
    const totalTicks = rate.ticksPerImage * rate.sampleImages + ticks;
    const sampleImages = rate.sampleImages + images;
    return { ...rate, ticksPerImage: totalTicks / sampleImages, sampleImages };
  });

  if (!matched) {
    rates.push({
      model: generation.model,
      resolution: generation.resolution,
      ticksPerImage: ticks / images,
      sampleImages: images,
    });
  }

  return {
    totalTicks: spend.totalTicks + ticks,
    todayTicks: spend.todayTicks + ticks,
    imageCount: spend.imageCount + images,
    rates,
  };
}

export function PlaygroundStudio({
  initialHistory,
  initialSpend,
  defaultModel,
  configured,
  historyError,
}: PlaygroundStudioProps) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ImageModelId>(defaultModel);
  const [count, setCount] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [resolution, setResolution] = useState<Resolution>("1k");
  const [generations, setGenerations] = useState(initialHistory);
  const [spend, setSpend] = useState(initialSpend);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Estimated from this account's own measured rate for the selected model and
  // resolution. Unknown until that combination has been generated once.
  const estimate = useMemo(() => {
    const rate = spend.rates.find(
      (candidate) => candidate.model === model && candidate.resolution === resolution,
    );
    return rate ? { usd: usdFromTicks(rate.ticksPerImage * count), samples: rate.sampleImages } : null;
  }, [spend.rates, model, resolution, count]);

  const gallery = useMemo(
    () =>
      generations.flatMap((generation) =>
        generation.images.map((image) => ({ generation, image })),
      ),
    [generations],
  );

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setWarnings([]);

    try {
      const response = await fetch("/api/playground/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, count, aspectRatio, resolution, model }),
      });

      const data = (await response.json()) as {
        generation?: PlaygroundGeneration;
        warnings?: string[];
        error?: string;
      };

      if (!response.ok || !data.generation) {
        setError(data.error ?? "Image generation failed.");
        return;
      }

      const generation = data.generation;
      setGenerations((current) => [generation, ...current]);
      setSpend((current) => addToSpend(current, generation));
      setWarnings(data.warnings ?? []);
    } catch {
      setError("Network error while generating images.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Spent today
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {formatUsd(usdFromTicks(spend.todayTicks), 2)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Spent all time
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {formatUsd(usdFromTicks(spend.totalTicks), 2)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Images
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{spend.imageCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            This run
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {estimate ? `~${formatUsd(estimate.usd)}` : "—"}
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <form
          onSubmit={generate}
          className="h-fit space-y-4 rounded-2xl border border-border bg-surface p-5"
        >
          <div>
            <label
              htmlFor="playground-prompt"
              className="text-[10px] font-semibold uppercase tracking-widest text-muted"
            >
              Prompt
            </label>
            <textarea
              id="playground-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={MAX_PROMPT_LENGTH}
              rows={6}
              required
              placeholder="A dense city skyline at dusk, teal and amber light, shot on 35mm"
              className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1 text-right text-xs text-muted">
              {prompt.length} / {MAX_PROMPT_LENGTH}
            </p>
          </div>

          <fieldset>
            <legend className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              Model
            </legend>
            <div className="mt-2 space-y-2">
              {IMAGE_MODELS.map((option) => {
                const rate = spend.rates.find(
                  (candidate) =>
                    candidate.model === option.id && candidate.resolution === resolution,
                );

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setModel(option.id)}
                    aria-pressed={model === option.id}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      model === option.id
                        ? "border-accent bg-surface-elevated"
                        : "border-border hover:border-accent/40"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs tabular-nums text-muted">
                        {rate ? `${formatUsd(usdFromTicks(rate.ticksPerImage))}/img` : option.tier}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {rate
                        ? `Measured over ${rate.sampleImages} ${
                            rate.sampleImages === 1 ? "image" : "images"
                          } at ${resolution.toUpperCase()}.`
                        : option.note}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              Aspect
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {ASPECT_RATIOS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAspectRatio(value)}
                  aria-pressed={aspectRatio === value}
                  className={chipClassName(aspectRatio === value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-4">
            <fieldset className="flex-1">
              <legend className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Resolution
              </legend>
              <div className="mt-2 flex gap-2">
                {RESOLUTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setResolution(value)}
                    aria-pressed={resolution === value}
                    className={chipClassName(resolution === value)}
                  >
                    {value.toUpperCase()}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex-1">
              <legend className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Count
              </legend>
              <div className="mt-2 flex gap-2">
                {Array.from({ length: MAX_IMAGES }, (_, index) => index + 1).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCount(value)}
                    aria-pressed={count === value}
                    className={chipClassName(count === value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <button
            type="submit"
            disabled={busy || !configured || prompt.trim().length === 0}
            className="w-full rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {busy ? "Generating..." : `Generate ${count} ${count === 1 ? "image" : "images"}`}
          </button>

          <p className="text-center text-xs text-muted">
            {!configured
              ? "XAI_API_KEY is not configured here"
              : estimate
                ? `Estimated ~${formatUsd(estimate.usd)} from ${estimate.samples} past ${
                    estimate.samples === 1 ? "image" : "images"
                  }`
                : "No cost estimate yet for this model and resolution"}
          </p>

          {error ? (
            <p role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          {warnings.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-amber-400/30 p-3 text-xs text-amber-200">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </form>

        <div className="space-y-4">
          {historyError ? (
            <p role="alert" className="rounded-xl border border-red-400/30 p-4 text-sm text-red-300">
              {historyError}
            </p>
          ) : null}

          <section aria-labelledby="generated-images" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="generated-images" className="text-lg font-semibold">
                Your generated images
              </h2>
              <p className="text-xs text-muted">
                {gallery.length} {gallery.length === 1 ? "image" : "images"} · newest first
              </p>
            </div>

            {generations.length === 0 ? (
              <div className="rounded-2xl border border-border p-8">
                <h3 className="text-lg font-semibold">Nothing generated yet</h3>
                <p className="mt-3 text-muted">
                  Write a prompt and generate. Every image is stored privately and listed here
                  with what it cost.
                </p>
              </div>
            ) : (
              generations.map((generation) => (
                <article
                  key={generation.id}
                  className="space-y-3 rounded-2xl border border-border bg-surface p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm text-muted">
                      {formatTime(generation.created_at)} · {generation.aspect_ratio} ·{" "}
                      {generation.resolution.toUpperCase()}
                      {generation.duration_ms != null
                        ? ` · ${(generation.duration_ms / 1000).toFixed(1)}s`
                        : ""}
                    </p>
                    <span className="flex items-center gap-2">
                      <span
                        title={generation.model}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted"
                      >
                        {imageModelLabel(generation.model)}
                      </span>
                      <span className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs tabular-nums text-emerald-300">
                        {formatUsd(usdFromTicks(generation.cost_in_usd_ticks))}
                      </span>
                    </span>
                  </div>

                  <p className="text-sm">{generation.prompt}</p>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {generation.images.map((image) => (
                      <figure key={image.path} className="space-y-1">
                        <a
                          href={image.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`relative block overflow-hidden rounded-xl border border-border ${
                            ASPECT_CLASS[generation.aspect_ratio as AspectRatio] ?? "aspect-square"
                          }`}
                        >
                          <Image
                            src={image.url}
                            alt={generation.prompt}
                            fill
                            unoptimized
                            sizes="(max-width: 640px) 100vw, 25vw"
                            className="object-cover"
                          />
                        </a>
                        <figcaption className="text-right text-xs tabular-nums text-muted">
                          {formatUsd(usdFromTicks(image.costInUsdTicks))}
                        </figcaption>
                      </figure>
                    ))}
                  </div>

                  {generation.images.length === 0 ? (
                    <p className="text-sm text-muted">
                      These images are stored but their links have expired. Reload to sign new
                      ones.
                    </p>
                  ) : null}
                </article>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
