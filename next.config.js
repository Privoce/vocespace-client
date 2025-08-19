/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  productionBrowserSourceMaps: true,
  experimental: {
    // 确保自定义服务器依赖被包含在 standalone 构建中
    outputFileTracingIncludes: {
      '*': ['./server.js', './vocespace.default.conf.json'],
    },
  },
  webpack: (config, { isServer }) => {
    // 处理 face-api.js 的 Node.js 模块依赖
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        encoding: false,
        'node-fetch': false,
      };
    }

    // 忽略 face-api.js 中的 Node.js 特定模块
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/face-api\.js/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
          plugins: [
            ['@babel/plugin-transform-runtime', { regenerator: true }]
          ]
        }
      }
    });

    return config;
  },
};

module.exports = nextConfig;
