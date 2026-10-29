// Node-only build adapter. Expo receives only explicitly public settings.
const fs = require('node:fs');
const path = require('node:path');
const { readConfiguration, publicConfiguration } = require('@vocespace/config-node');
module.exports = ({ config }) => {
  const artifact = path.join(__dirname, 'vocespace.public.json');
  const source = fs.existsSync(artifact)
    ? JSON.parse(fs.readFileSync(artifact, 'utf8'))
    : publicConfiguration(readConfiguration({ optional: true }));
  return { ...config, extra: { ...config.extra, vocespace: {
    mobile: { apiUrl: source.mobile.apiUrl, meetingUiPreview: source.mobile.meetingUiPreview },
    analytics: { enabled: source.analytics.enabled, url: source.analytics.url, websiteId: source.analytics.websiteId },
  } } };
};
