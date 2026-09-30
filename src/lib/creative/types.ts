export const CREATIVE_BUCKET = "creative-assets";

export const COLOR_ROLES = [
  "primary",
  "secondary",
  "accent",
  "text",
  "onAccent",
] as const;

export type ColorRole = (typeof COLOR_ROLES)[number];

/**
 * A slot is a positioned field, not a pixel offset: x, y, w and size are
 * fractions of the canvas so one template renders at any output size, and the
 * colour is a role rather than a hex so any kit can drive any template.
 */
export type TemplateSlot = {
  key: string;
  label: string;
  kind: "text";
  x: number;
  y: number;
  w: number;
  align: "left" | "center" | "right";
  size: number;
  weight: number;
  colorRole: ColorRole;
  transform: "none" | "uppercase";
  /** Display is the condensed heavy face used for headlines. */
  font?: "display" | "body";
  /** Fraction of the font size, so tracking scales with the text. */
  tracking?: number;
  /** Example value, shown as the field's placeholder so a blank form explains
   * itself and can be filled with one click. */
  placeholder?: string;
};

/**
 * Anything drawn that is not text. Kept in the template rather than the
 * composer so the whole layout — rules, chips, the barcode — can be retuned
 * against a new backdrop by editing one row, with no deploy.
 */
export type TemplateDecoration = {
  type: "block" | "rule" | "barcode";
  /** Fractions of the canvas, anchored top-left. */
  x: number;
  y: number;
  w: number;
  h: number;
  colorRole: ColorRole;
  /** Corner radius in pixels. */
  radius?: number;
};

export type TemplateRect = { x: number; y: number; w: number; h: number };

export type CreativeTemplate = {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  backdrop_prompt: string;
  slots: TemplateSlot[];
  decorations?: TemplateDecoration[];
  logo?: TemplateRect | null;
  /** The photograph this design uses. Generated when the template is edited,
   * never when a post is made. */
  backdrop_id: string | null;
  /** A design the template was authored against, kept for the human. */
  reference_path: string | null;
  is_active: boolean;
};

export type BrandKit = {
  id: string;
  name: string;
  handle: string | null;
  is_active: boolean;
  created_at: string;
};

export type BrandKitVersion = {
  id: string;
  kit_id: string;
  version: number;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_color: string;
  logo_path: string | null;
  style_prompt: string | null;
  created_at: string;
};

export type BrandKitWithVersion = BrandKit & { version: BrandKitVersion };

export type CreativeRender = {
  id: string;
  template_id: string;
  kit_version_id: string;
  backdrop_id: string | null;
  slot_values: Record<string, string>;
  storage_path: string;
  created_at: string;
};

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

/**
 * onAccent is derived rather than stored: text sitting on the accent block has
 * to stay readable, and asking someone to pick a colour that contrasts with
 * another colour they also picked invites getting it wrong.
 */
export function resolveColor(role: ColorRole, version: BrandKitVersion) {
  switch (role) {
    case "primary":
      return version.primary_color;
    case "secondary":
      return version.secondary_color;
    case "accent":
      return version.accent_color;
    case "onAccent":
      return readableOn(version.accent_color);
    default:
      return version.text_color;
  }
}

/** Relative luminance, per WCAG, to choose black or white text on a fill. */
export function readableOn(background: string) {
  if (!isHexColor(background)) {
    return "#ffffff";
  }

  const channel = (hex: string) => {
    const value = Number.parseInt(hex, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const luminance =
    0.2126 * channel(background.slice(1, 3)) +
    0.7152 * channel(background.slice(3, 5)) +
    0.0722 * channel(background.slice(5, 7));

  return luminance > 0.45 ? "#111111" : "#ffffff";
}

export function applyTransform(value: string, transform: TemplateSlot["transform"]) {
  return transform === "uppercase" ? value.toUpperCase() : value;
}

/**
 * Bar widths for the decorative barcode, derived from the render's own values
 * so two different posts do not carry an identical strip, and the same post
 * re-rendered carries the same one.
 */
export function barcodeBars(seed: string, count = 48) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Array.from({ length: count }, (_, index) => {
    hash = Math.imul(hash ^ (index + 1), 16777619);
    return ((hash >>> 8) % 3) + 1;
  });
}

const ALIGNMENTS = ["left", "center", "right"] as const;
const TRANSFORMS = ["none", "uppercase"] as const;
const DECORATION_TYPES = ["block", "rule", "barcode"] as const;

function fraction(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function oneOf<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]) {
  return (options as readonly unknown[]).includes(value) ? (value as T[number]) : fallback;
}

/**
 * Templates are edited through the API, so what arrives is untrusted JSON that
 * the composer will later index into. Coercing every field here means a bad
 * payload produces a dull template rather than a render that throws.
 */
export function parseSlots(value: unknown): TemplateSlot[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const slot = raw as Record<string, unknown>;
    const key = typeof slot.key === "string" ? slot.key.trim() : "";
    if (!key) return [];

    return [
      {
        key,
        label: typeof slot.label === "string" && slot.label.trim() ? slot.label.trim() : key,
        kind: "text" as const,
        x: fraction(slot.x, 0.5),
        y: fraction(slot.y, 0.5),
        w: fraction(slot.w, 0.6),
        align: oneOf(slot.align, ALIGNMENTS, "center"),
        size: fraction(slot.size, 0.03),
        weight: typeof slot.weight === "number" ? slot.weight : 700,
        colorRole: oneOf(slot.colorRole, COLOR_ROLES, "text"),
        transform: oneOf(slot.transform, TRANSFORMS, "none"),
        ...(slot.font === "display" ? { font: "display" as const } : {}),
        ...(typeof slot.tracking === "number" ? { tracking: slot.tracking } : {}),
        ...(typeof slot.placeholder === "string" && slot.placeholder.trim()
          ? { placeholder: slot.placeholder.trim().slice(0, 120) }
          : {}),
      },
    ];
  });
}

export function parseDecorations(value: unknown): TemplateDecoration[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;

    return [
      {
        type: oneOf(item.type, DECORATION_TYPES, "rule"),
        x: fraction(item.x),
        y: fraction(item.y),
        w: fraction(item.w, 0.5),
        h: fraction(item.h, 0.005),
        colorRole: oneOf(item.colorRole, COLOR_ROLES, "accent"),
        ...(typeof item.radius === "number" ? { radius: item.radius } : {}),
      },
    ];
  });
}

export function parseRect(value: unknown): TemplateRect | null {
  if (!value || typeof value !== "object") return null;
  const rect = value as Record<string, unknown>;
  if (["x", "y", "w", "h"].some((key) => typeof rect[key] !== "number")) return null;
  return { x: rect.x as number, y: rect.y as number, w: rect.w as number, h: rect.h as number };
}
