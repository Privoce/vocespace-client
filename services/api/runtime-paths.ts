import path from 'node:path';
import { configPath } from '@vocespace/config-node';
import { getConfig } from './lib/server/config';
export function runtimeAssetPath(kind: 'prompt' | 'preview') {
  const api = getConfig().deployment.api;
  const configured = kind === 'prompt' ? api.promptDir : api.previewAssetsDir;
  if (configured) return path.resolve(path.dirname(configPath()), configured);
  const assets = (globalThis as Record<symbol, unknown>)[Symbol.for('vocespace.assets')];
  return path.join(typeof assets === 'string' ? assets : __dirname, kind);
}
