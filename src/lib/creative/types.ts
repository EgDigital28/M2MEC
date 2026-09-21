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
  /** Example value, shown as the field's placeholder so a blank form explains
   * itself and can be filled with one click. */
  placeholder?: string;
};

export type CreativeTemplate = {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  backdrop_prompt: string;
  slots: TemplateSlot[];
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
