import { withSentryConfig } from '@sentry/nextjs/config';

const distDir = 'nextjs';
// eslint-disable-next-line no-undef
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const baseConfig = {
  basePath,
  allowedDevOrigins: ['md.local'],
  output: 'standalone',
  reactStrictMode: true,
  distDir: distDir,
  poweredByHeader: false,
  productionBrowserSourceMaps: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  i18n: {
    locales: ['en', 'es', 'it', 'fr', 'id', 'pseudo'],
    defaultLocale: 'en',
    localDetection: false,
  },
  turbopack: {
    rules: {
      '*.ts': [
        {
          loaders: ['./import-rewrite-loader.cjs'],
        },
      ],
      '*.tsx': [
        {
          loaders: ['./import-rewrite-loader.cjs'],
        },
      ],
    },
  },
  experimental: {
    swcPlugins: [
      [
        '@lingui/swc-plugin',
        {
          // the same options as in .swcrc
        },
      ],
    ],
  },
};

export default withSentryConfig(baseConfig, {
  org: 'm-d',
  project: 'crosshare',
  // eslint-disable-next-line no-undef
  authToken: process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  widenClientFileUpload: true,
});
