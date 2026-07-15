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
  // Moved out of experimental to the root level!
  allowedDevOrigins: ['192.168.1.7'],
};

export default withPWA(nextConfig);
