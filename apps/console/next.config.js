/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Allow useSearchParams without Suspense boundary during SSG
    missingSuspenseWithCSRBailout: false,
  },
  images: {
    unoptimized: true, // 禁用图片优化，解决 standalone 模式下的图片问题
  },
};

module.exports = nextConfig;
