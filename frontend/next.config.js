/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode for development
  reactStrictMode: true,

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  },

  // Image optimization
  // NOTE: place photos are served through our own backend proxy
  // (BACKEND_BASE_URL + /api/reference/photo-proxy/...) rather than directly
  // from Google, so the Places API key never reaches the browser. The
  // 'localhost' pattern below covers dev; add the real backend hostname here
  // once a production domain exists.
  images: {
    // The Next.js image optimizer fetches `src` server-side. That's fine
    // when this dev server runs natively (localhost:8000 reaches the
    // backend directly) or in production (a real shared hostname), but
    // breaks when frontend runs in its own Docker container (docker-
    // compose.yml): "localhost" there means the frontend container
    // itself, not the backend one, so every place photo 404s even though
    // the browser can fetch that same URL fine directly. Set by
    // docker-compose.yml's frontend service only — unset (client-side
    // fetch, optimized) for native/non-Docker dev and production.
    unoptimized: process.env.NEXT_PUBLIC_IMAGES_UNOPTIMIZED === '1',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Redirect old routes if needed
  async redirects() {
    return [];
  },

  // Compression
  compress: true,

  // Generate ETags for better caching
  generateEtags: true,

  // Production source maps
  productionBrowserSourceMaps: false,

  // Webpack configuration
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },

  // Experimental features
  experimental: {
    optimizePackageImports: ['lucide-react', 'zustand'],
  },
};

module.exports = nextConfig;
