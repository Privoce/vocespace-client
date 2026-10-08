import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
// Next loads apps/web env first. Preserve root public build settings during migration.
for (const name of ['.env.local', `.env.${process.env.NODE_ENV || 'development'}`, '.env']) {
  dotenv.config({ path: path.resolve(directory, '../..', name) });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  experimental: { externalDir: true, outputFileTracingRoot: path.resolve(directory, '../..') },
  transpilePackages: ['@vocespace/contracts', '@vocespace/domain', '@vocespace/client-sdk'],
  productionBrowserSourceMaps: true,
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

export default nextConfig;
