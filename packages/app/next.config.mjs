import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

// Heavy libraries that should be split into their own chunks so they are not
// bundled into the initial/main bundle. See issue #1791.
const HEAVY_LIB_CHUNKS = [
  {
    name: 'stellar-sdk',
    test: /[\\/]node_modules[\\/](@stellar[\\/]stellar-sdk|stellar-base|stellar-sdk|soroban-client)[\\/]/,
    priority: 40,
    enforce: true,
  },
  {
    name: 'crypto-vendor',
    test: /[\\/]node_modules[\\/](sodium-native|tweetnacl|@noble[\\/][^\\/]+|crypto-browserify|browserify-sign|elliptic)[\\/]/,
    priority: 30,
    enforce: true,
  },
  {
    name: 'vendor',
    test: /[\\/]node_modules[\\/]/,
    priority: 10,
    enforce: true,
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // ── Image optimization (webp/avif, lazy loading, LCP) ──────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 420, 640, 768, 1024, 1280, 1536, 1920, 2560],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
      },
    ],
  },

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

      // ── Split heavy libraries (Stellar SDK, crypto) into dedicated chunks ──
      // This keeps the initial bundle small and lets the Stellar SDK be
      // lazy-loaded only when needed. See issue #1791.
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...(config.optimization?.splitChunks || {}),
          chunks: 'all',
          cacheGroups: {
            ...(config.optimization?.splitChunks?.cacheGroups || {}),
            ...Object.fromEntries(
              HEAVY_LIB_CHUNKS.map(({ name, test, priority, enforce }) => [
                name,
                {
                  name,
                  test,
                  priority,
                  enforce,
                  reuseExistingChunk: true,
                },
              ])
            ),
          },
        },
      };
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