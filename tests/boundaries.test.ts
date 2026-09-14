// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkBoundaries } from '../scripts/check-boundaries.mjs';

describe('architecture boundary checks', () => {
  it('allows client UI to consume neutral types, utilities and LiveKit adapters', () => {
    expect(checkBoundaries({
      'app/page.tsx': "'use client'; export { View } from '@/features/room/view';",
      'features/room/view.tsx': "export { View } from '@/lib/livekit/view';",
      'lib/livekit/view.tsx': "import { Room } from 'livekit-client'; export const View = Room;",
      'lib/utils/size.ts': "import type { Size } from '../types/common'; export const area = (s: Size) => s.width * s.height;",
      'lib/types/common.ts': 'export type Size = { width: number; height: number };',
    }).errors).toEqual([]);
  });

  it.each(['@/features/room/store', '../../features/room/store'])(
    'rejects business imports from lib via %s', (specifier) => {
      const result = checkBoundaries({
        'lib/hooks/use-room.ts': `export { store } from '${specifier}';`,
        'features/room/store.ts': 'export const store = {};',
      });
      expect(result.errors.some((error) => error.includes('lib must not depend'))).toBe(true);
    },
  );

  it('follows neutral re-exports to a server implementation', () => {
    const result = checkBoundaries({
      'app/page.tsx': "'use client'; export { config } from './shared';",
      'app/shared.ts': "export { config } from '../server/config';",
      'server/config.ts': "import 'server-only'; export const config = {};",
    });
    expect(result.errors).toContain('app/page.tsx -> app/shared.ts: client/shared runtime reaches server/config.ts');
  });

  it.each(["import('node:fs')", "require('ioredis')", "import('server-only')"])(
    'rejects server dependencies reached through %s', (expression) => {
      expect(checkBoundaries({ 'lib/browser/read.ts': `export const read = () => ${expression};` }).errors.length).toBeGreaterThan(0);
    },
  );

  it('erases type-only server imports in API consumers but rejects them in lib', () => {
    const sources = {
      'features/room/types.ts': "import type { Result } from '../../server/types'; export type Value = Result;",
      'server/types.ts': 'export type Result = { ok: boolean };',
    };
    expect(checkBoundaries(sources).errors).toEqual([]);
    expect(checkBoundaries({ ...sources, 'lib/types/result.ts': sources['features/room/types.ts'] }).errors.length).toBeGreaterThan(0);
  });

  it('rejects DOM access in pure utilities and unresolved source paths', () => {
    const result = checkBoundaries({
      'lib/utils/width.ts': 'export const width = () => window.innerWidth;',
      'features/room/old.ts': "export * from '@/lib/store/room';",
    });
    expect(result.errors).toHaveLength(2);
    expect(result.errors.join('\n')).toContain('unresolved source import');
  });

  it('reports computed module paths rather than silently skipping them', () => {
    expect(checkBoundaries({ 'lib/browser/plugin.ts': 'export const load = (name: string) => import(name);' }).errors.length).toBeGreaterThan(0);
  });
});
