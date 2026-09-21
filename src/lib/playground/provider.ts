import { xai } from "@ai-sdk/xai";
import { generateImage } from "ai";

/**
 * Thin adapter over the image provider. The route only speaks in these types,
 * so swapping or adding a provider is a change to this file alone.
 */

export const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "16:9"] as const;
export const RESOLUTIONS = ["1k", "2k"] as const;
export const MAX_IMAGES = 4;
export const MAX_PROMPT_LENGTH = 2000;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];

/**
 * Selectable models, cheapest first. Tiers are relative, not dollar figures —
 * xAI's console is the source of truth for per-image pricing, and hardcoding
 * numbers here would go stale silently.
 */
export const IMAGE_MODELS = [
  {
    id: "grok-imagine-image",
    label: "Imagine",
    tier: "Standard",
    note: "Lowest cost. Good default for iterating on a prompt.",
  },
  {
    id: "grok-imagine-image-2.0",
    label: "Imagine 2.0",
    tier: "Standard",
    note: "Newer generation at standard cost.",
  },
  {
    id: "grok-imagine-image-pro",
    label: "Imagine Pro",
    tier: "Pro",
    note: "Highest quality and highest cost per image.",
  },
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"];

export function isImageModelId(value: unknown): value is ImageModelId {
  return IMAGE_MODELS.some((model) => model.id === value);
}

export type GenerateImagesInput = {
  prompt: string;
  count: number;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  model: ImageModelId;
};

export type GeneratedImage = {
  bytes: Uint8Array;
  mediaType: string;
};

export type GenerateImagesOutput = {
  provider: "xai";
  model: string;
  images: GeneratedImage[];
  warnings: string[];
  /** xAI's own cost figure for the call, null when the provider omits it. */
  costInUsdTicks: number | null;
};

/**
 * xAI reports cost as integer "ticks" and documents no scale anywhere in the
 * SDK, so it was calibrated against the console: 4 requests totalling
 * 1.3e9 ticks showed as $0.13 spend, and a measured 2e8-tick call lands on a
 * round $0.02. Re-check against console spend if figures ever drift.
 */
export const TICKS_PER_USD = 10_000_000_000;

export function usdFromTicks(ticks: number | null | undefined) {
  return ticks == null ? null : ticks / TICKS_PER_USD;
}

export function formatUsd(value: number | null, fractionDigits = 3) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value);
}

export function isAspectRatio(value: unknown): value is AspectRatio {
  return (ASPECT_RATIOS as readonly unknown[]).includes(value);
}

export function isResolution(value: unknown): value is Resolution {
  return (RESOLUTIONS as readonly unknown[]).includes(value);
}

/** Overridable because xAI ships new image model ids faster than this app. */
export function defaultImageModelId(): ImageModelId {
  const configured = process.env.XAI_IMAGE_MODEL;
  return isImageModelId(configured) ? configured : "grok-imagine-image-2.0";
}

export function isImageProviderConfigured() {
  return Boolean(process.env.XAI_API_KEY);
}

export async function generateImages({
  prompt,
  count,
  aspectRatio,
  resolution,
  model,
}: GenerateImagesInput): Promise<GenerateImagesOutput> {
  const result = await generateImage({
    model: xai.image(model),
    prompt,
    n: count,
    aspectRatio,
    providerOptions: { xai: { resolution } },
  });

  // Cost rides on provider metadata, not the SDK's usage field, and a large n
  // may be split across several calls.
  const costInUsdTicks = result.calls.reduce<number | null>((total, call) => {
    const meta = call.providerMetadata?.xai as { costInUsdTicks?: unknown } | undefined;
    const ticks = typeof meta?.costInUsdTicks === "number" ? meta.costInUsdTicks : null;
    return ticks == null ? total : (total ?? 0) + ticks;
  }, null);

  return {
    provider: "xai",
    model,
    costInUsdTicks,
    images: result.images.map((image) => ({
      bytes: image.uint8Array,
      mediaType: image.mediaType || "image/png",
    })),
    // Surfaced to the UI: silently dropping an unsupported setting would look
    // like the control simply did nothing.
    warnings: result.warnings.map((warning) =>
      "message" in warning && typeof warning.message === "string"
        ? warning.message
        : JSON.stringify(warning),
    ),
  };
}

export function extensionFor(mediaType: string) {
  if (mediaType.includes("jpeg")) return "jpg";
  if (mediaType.includes("webp")) return "webp";
  return "png";
}
