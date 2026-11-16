// Node-only build adapter. Expo receives only explicitly public settings.
const fs = require('node:fs');
const path = require('node:path');
const { readConfiguration, publicConfiguration } = require('@vocespace/config-node');
module.exports = ({ config }) => {
  const artifact = path.join(__dirname, 'vocespace.public.json');
  // Build from deployment settings; never let local development settings override them.
  const deployment = path.resolve(__dirname, '../../vocespace.deploy.conf.json');
  const source = fs.existsSync(deployment)
    ? publicConfiguration(readConfiguration({ file: deployment }))
    : JSON.parse(fs.readFileSync(artifact, 'utf8'));
  return { ...config, extra: { ...config.extra, vocespace: {
    mobile: { apiUrl: source.mobile.apiUrl, meetingUiPreview: source.mobile.meetingUiPreview },
    analytics: { enabled: source.analytics.enabled, url: source.analytics.url, websiteId: source.analytics.websiteId },
  } } };
};
