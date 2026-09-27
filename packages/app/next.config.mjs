import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // ── Bundle analysis (run: ANALYZE=true next build) ──────────────────────────
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config, { isServer }) => {
      if (!isServer) {
        config.resolve.fallback = { ...config.resolve.fallback, "sodium-native": false };
      }
      return config;
    },
  }),

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, "sodium-native": false };
    }
    return config;
  },

  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=0, must-revalidate'
        },
        {
          key: 'Service-Worker-Allowed',
          value: '/'
        }
      ]
    },
    {
      source: '/manifest.json',
      headers: [
        {
          key: 'Content-Type',
          value: 'application/manifest+json'
        }
      ]
    },
    {
      source: '/offline.html',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=0, must-revalidate'
        }
      ]
    }
  ]
};

export default withNextIntl(nextConfig);
