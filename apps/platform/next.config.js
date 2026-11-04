const path = require('node:path');
module.exports = {
  experimental: { outputFileTracingRoot: path.join(__dirname, '../..') },
  transpilePackages: ['@vocespace/i18n'],
  reactStrictMode: true,
  // The legacy UI retains React 18. Resolve runtime imports before the type-only
  // tsconfig aliases used to isolate it from the monorepo's React 19 declarations.
  webpack(config) {
    for (const name of ['react', 'react-dom']) {
      config.resolve.alias[name + '$'] = require.resolve(name);
      config.resolve.alias[name + '/'] = path.dirname(require.resolve(name + '/package.json')) + '/';
    }
    // Next's server import optimizer can otherwise resolve the root workspace's Ant Design 6.
    for (const name of ['antd', '@ant-design/icons']) {
      const directory = path.dirname(require.resolve(name + '/package.json'));
      const metadata = require(name + '/package.json');
      config.resolve.alias[name + '$'] = path.join(directory, metadata.module || metadata.main);
      config.resolve.alias[name] = directory;
    }
    return config;
  },
};
