import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build separata per i test end-to-end: le variabili NEXT_PUBLIC_* vengono incorporate alla build.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  outputFileTracingIncludes: {
    "/api/associazione/ricevute": ["./lib/receipt-assets/**/*"],
    "/api/questionari/[...path]": ["./lib/receipt-assets/DejaVuSans*.ttf"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
