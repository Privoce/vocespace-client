// Node-only build adapter. Expo receives only explicitly public settings.
const fs = require('node:fs');
const path = require('node:path');
const { configPath, readConfiguration, publicConfiguration } = require('@vocespace/config-node');
module.exports = ({ config }) => {
  const artifact = path.join(__dirname, 'vocespace.public.json');
  // Local builds use the current source; cloud builds use the exported public artifact.
  // Never let an old artifact silently override a changed deployment configuration.
  const source = fs.existsSync(configPath())
    ? publicConfiguration(readConfiguration())
    : JSON.parse(fs.readFileSync(artifact, 'utf8'));
  return { ...config, extra: { ...config.extra, vocespace: {
    mobile: { apiUrl: source.mobile.apiUrl, meetingUiPreview: source.mobile.meetingUiPreview },
    analytics: { enabled: source.analytics.enabled, url: source.analytics.url, websiteId: source.analytics.websiteId },
  } } };
};
