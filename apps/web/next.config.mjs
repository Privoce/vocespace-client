import path from 'node:path';
import { existsSync } from 'node:fs';
import { readConfiguration } from '@vocespace/config-node';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
// Only public build constants are emitted; private configuration stays on the server.
const buildFile = path.join(directory, 'vocespace.build.json');
const deployment = readConfiguration({ file: existsSync(buildFile) ? buildFile : undefined, optional: true }).deployment;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  basePath: deployment.basePath,
  experimental: { externalDir: true },
  outputFileTracingRoot: path.resolve(directory, '../..'),
  transpilePackages: [
    '@vocespace/i18n',
    '@vocespace/contracts',
    '@vocespace/domain',
    '@vocespace/client-sdk',
    '@vocespace/ui',
    '@vocespace/meeting-core',
    'react-native-web',
  ],
  productionBrowserSourceMaps: true,
  webpack: (config, { isServer, webpack }) => {
    config.plugins.push(new webpack.DefinePlugin({ __VOCESPACE_BASE_PATH__: JSON.stringify(deployment.basePath) }));
    config.resolve.alias = { ...config.resolve.alias, 'react-native$': 'react-native-web' };
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
          plugins: [['@babel/plugin-transform-runtime', { regenerator: true }]],
        },
      },
    });

    return config;
  },
};

export default nextConfig;
