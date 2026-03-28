/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // sodium-native is a Node.js native module — exclude from browser bundle
      config.resolve.fallback = { ...config.resolve.fallback, "sodium-native": false };
    }
    return config;
  },
};

export default nextConfig;
