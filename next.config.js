/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["mammoth", "unpdf"],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    if (!isServer) {
      // The npm `process` polyfill pulls the native `bare-abort` addon, which has
      // no browser binary and crashes the client bundle. Use Next's safe shim instead.
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        process: require.resolve("next/dist/compiled/process/browser"),
        "bare-abort": require.resolve("./src/stubs/bare-abort.js"),
      };
    }
    return config;
  },
};

module.exports = nextConfig;
