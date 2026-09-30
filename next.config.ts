import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit, under @react-pdf/renderer, pulls its built-in fonts in with a
  // dynamic require. Bundling it hides that from the tracer, so the font files
  // are left out of the deployed function and rendering fails at runtime.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/reports/individual/[id]": [
      "./node_modules/pdfkit/js/standard-fonts/**",
    ],
    // Read from disk at runtime, so the tracer cannot see them in the bundle.
    // Without these the composer falls back to next/og's single regular face
    // and every bold weight in a template renders thin. Every route that
    // composes needs them, not just the one that stores the result.
    "/api/creative/{render,preview}": [
      "./node_modules/@fontsource/inter/files/inter-latin-{400,700,900}-normal.woff",
      "./node_modules/@fontsource/anton/files/anton-latin-400-normal.woff",
    ],
  },
};

export default nextConfig;
