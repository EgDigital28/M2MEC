import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Satori only draws weights it has been handed a file for. next/og bundles a
 * single regular Noto Sans, so every `font-weight: 800` in a template silently
 * rendered at 400 until these were loaded — which is most of the difference
 * between a designed slip and a plain one.
 *
 * The files are read from node_modules at runtime rather than imported, so
 * next.config.ts has to trace them into the deployed function.
 */
const FILES = [
  { name: "Inter", weight: 400 as const, file: "@fontsource/inter/files/inter-latin-400-normal.woff" },
  { name: "Inter", weight: 700 as const, file: "@fontsource/inter/files/inter-latin-700-normal.woff" },
  { name: "Inter", weight: 900 as const, file: "@fontsource/inter/files/inter-latin-900-normal.woff" },
  { name: "Anton", weight: 400 as const, file: "@fontsource/anton/files/anton-latin-400-normal.woff" },
];

export type LoadedFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 900;
  style: "normal";
};

let cached: Promise<LoadedFont[]> | null = null;

/** Read once per lambda instance; the files never change between renders. */
export function loadFonts() {
  cached ??= Promise.all(
    FILES.map(async ({ name, weight, file }) => {
      const buffer = await readFile(path.join(process.cwd(), "node_modules", file));
      return {
        name,
        weight,
        style: "normal" as const,
        data: buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer,
      };
    }),
  );

  return cached;
}

export const DISPLAY_FAMILY = "Anton";
export const BODY_FAMILY = "Inter";
