/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Allow useSearchParams without Suspense boundary during SSG
    missingSuspenseWithCSRBailout: false,
  },
  images: {
    unoptimized: true, // 禁用图片优化，解决 standalone 模式下的图片问题
  },
  // 确保 matrix-js-sdk 只在客户端加载
  transpilePackages: ['matrix-js-sdk'],
  webpack: (config, { isServer }) => {
    // matrix-js-sdk 只在客户端使用，避免 SSR 问题
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('matrix-js-sdk');
    }
    
    // 解决 matrix-js-sdk 多入口点问题
    config.resolve.alias = {
      ...config.resolve.alias,
      'matrix-js-sdk': require.resolve('matrix-js-sdk'),
    };
    
    return config;
  },
};

module.exports = nextConfig;
