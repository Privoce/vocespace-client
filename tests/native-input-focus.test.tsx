import { beforeAll, expect, it } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { ComponentType } from 'react';
const require = createRequire(import.meta.url);
let Input: ComponentType<any>;
let hideKeyboard: () => void;
beforeAll(async () => {
  // Run the installed Ant Design input, replacing only its platform primitives.
  const code = execFileSync(
    process.execPath,
    [
      '-e',
      `
    const {build} = require('esbuild');
    build({
      entryPoints: [${JSON.stringify(path.resolve('apps/mobile/node_modules/@ant-design/react-native/lib/input/Input.js'))}],
      bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react', 'react-dom', 'react-native-web'],
      plugins: [{ name: 'native-keyboard', setup(build) {
        build.onResolve({ filter: /^react-native$/ }, () => ({ path: 'native', namespace: 'test' }));
        build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: ${JSON.stringify(`
          export * from 'react-native-web';
          const listeners = new Set();
          globalThis.__hideTestKeyboard = () => listeners.forEach(fn => fn());
          export const Keyboard = { dismiss: () => document.activeElement?.blur(), addListener: (_, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } };
        `)}, resolveDir: process.cwd() }));
      } }],
    }).then(result => process.stdout.write(result.outputFiles[0].text));
  `,
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  Input = module.exports.default;
  hideKeyboard = (globalThis as any).__hideTestKeyboard;
});
it('keeps a length-limited input focused after keyboard visibility changes and controlled updates', () => {
  const view = render(<Input value="" maxLength={200} onChangeText={() => {}} />);
  const input = view.getByRole('textbox');
  act(() => input.focus());
  expect(document.activeElement).toBe(input);
  act(() => hideKeyboard());
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: 'mobile-test' } });
  view.rerender(<Input value="mobile-test" maxLength={200} onChangeText={() => {}} />);
  expect(view.getByRole('textbox')).toBe(input);
  expect(document.activeElement).toBe(input);
  view.unmount();
});
