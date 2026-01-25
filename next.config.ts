import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow larger request bodies for video uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // Turbopack config (empty to silence warning, Remotion uses webpack directly)
  turbopack: {},
  // Headers for cross-origin isolation (required for SharedArrayBuffer / FFmpeg.wasm)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
    ];
  },
  // Externalize Remotion packages for server-side rendering
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "remotion",
    "esbuild",
  ],
  // Webpack config for Remotion compatibility (used when building with --webpack)
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Disable platform-specific compositor packages
      "@remotion/compositor": false,
      "@remotion/compositor-darwin-arm64": false,
      "@remotion/compositor-darwin-x64": false,
      "@remotion/compositor-linux-x64": false,
      "@remotion/compositor-linux-arm64": false,
      "@remotion/compositor-win32-x64-msvc": false,
      "@remotion/compositor-windows-x64": false,
    };

    // Externalize Remotion packages on the server side
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push(
          "@remotion/bundler",
          "@remotion/renderer",
          "esbuild"
        );
      }
    }

    return config;
  },
};

export default nextConfig;
