/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Allow useSearchParams without Suspense boundary during SSG
    missingSuspenseWithCSRBailout: false,
  },
};

module.exports = nextConfig;
