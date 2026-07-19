import withPWAInit from 'next-pwa';
import defaultRuntimeCaching from 'next-pwa/cache.js';

const ONE_MONTH_IN_SECONDS = 30 * 24 * 60 * 60;

const runtimeCaching = [
  {
    urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*$/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'osm-map-tiles',
      expiration: {
        maxEntries: 1200,
        maxAgeSeconds: ONE_MONTH_IN_SECONDS,
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
  {
    urlPattern: /\/opencv\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'opencv-assets',
      expiration: {
        maxEntries: 8,
        maxAgeSeconds: ONE_MONTH_IN_SECONDS,
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
  ...defaultRuntimeCaching.map((cacheConfig) => {
    if (cacheConfig.options?.cacheName !== 'cross-origin') {
      return cacheConfig;
    }

    const cacheFirstOptions = { ...cacheConfig.options };
    delete cacheFirstOptions.networkTimeoutSeconds;

    return {
      ...cacheConfig,
      handler: 'CacheFirst',
      options: {
        ...cacheFirstOptions,
        expiration: {
          maxEntries: 256,
          maxAgeSeconds: ONE_MONTH_IN_SECONDS,
        },
      },
    };
  }),
];

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: false,
  clientsClaim: true,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === 'development',
  cacheStartUrl: true,
  dynamicStartUrl: false,
  runtimeCaching,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['192.168.1.7'],
  compress: true,
  productionBrowserSourceMaps: false,
  optimizeFonts: true,
  swcMinify: true,
  
  // Image optimization
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 31536000, // 1 year
  },
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'leaflet',
      'react-leaflet',
    ],
  },
  
  webpack: (config, { isServer }) => {
    // Allow Worker(new URL(..., import.meta.url)) for sketch OpenCV worker
    config.output = config.output || {};
    config.output.environment = {
      ...(config.output.environment || {}),
      asyncFunction: true,
    };
    
    // Module splitting for Leaflet
    if (!isServer) {
      config.optimization = config.optimization || {};
      config.optimization.splitChunks = {
        ...(config.optimization.splitChunks || {}),
        cacheGroups: {
          ...(config.optimization.splitChunks?.cacheGroups || {}),
          leaflet: {
            test: /[\\/]node_modules[\\/]leaflet/,
            name: 'leaflet-libs',
            priority: 30,
            reuseExistingChunk: true,
          },
          reactLeaflet: {
            test: /[\\/]node_modules[\\/]react-leaflet/,
            name: 'react-leaflet-libs',
            priority: 30,
            reuseExistingChunk: true,
          },
          icons: {
            test: /[\\/]node_modules[\\/]lucide-react/,
            name: 'icons-libs',
            priority: 20,
            reuseExistingChunk: true,
          },
        },
      };
    }
    
    return config;
  },
};

export default withPWA(nextConfig);
