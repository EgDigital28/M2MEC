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
  },
};

export default nextConfig;
