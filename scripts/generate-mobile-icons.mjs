import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const output = new URL('apps/mobile/assets/icons/', root);
const { expo } = JSON.parse(await readFile(new URL('apps/mobile/app.json', root), 'utf8'));
const background = expo.android.adaptiveIcon.backgroundColor;

// Bundle the actual shared resource, so future logo changes have one source of truth.
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('packages/ui/src/svg-resource.ts', root))],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { svgResource } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
);
const logo = svgResource({ type: 'logo', svgSize: 32 });
const xmlEscape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]);
const attributeNames = {
  fillRule: 'fill-rule', clipRule: 'clip-rule', stopColor: 'stop-color',
};
function serialize(node, monochrome) {
  if (typeof node === 'string') return xmlEscape(node);
  if (monochrome && node.tag === 'defs') return '';
  const attrs = Object.entries(node.attrs).map(([name, value]) => {
    if (monochrome && name === 'fill' && String(value).startsWith('url(')) value = '#ffffff';
    return `${attributeNames[name] ?? name}="${xmlEscape(value)}"`;
  }).join(' ');
  return `<${node.tag} ${attrs}>${node.children.map((child) => serialize(child, monochrome)).join('')}</${node.tag}>`;
}

// The original artwork occupies a circle from (2,2) to (30,30) in its 32px viewBox.
// Android: 60dp artwork within a 108dp layer, inside the 66dp safe zone.
function svg(artworkDiameter, monochrome = false) {
  const scale = artworkDiameter / 28;
  const offset = 512 - 16 * scale;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g transform="translate(${offset} ${offset}) scale(${scale})">${logo.children.map((child) => serialize(child, monochrome)).join('')}</g></svg>`);
}

await mkdir(output, { recursive: true });
await sharp(svg(768)).flatten({ background }).removeAlpha().png()
  .toFile(fileURLToPath(new URL('icon.png', output)));
await sharp(svg(1024 * 60 / 108)).png()
  .toFile(fileURLToPath(new URL('adaptive-foreground.png', output)));
await sharp(svg(1024 * 60 / 108, true)).png()
  .toFile(fileURLToPath(new URL('adaptive-monochrome.png', output)));
console.log('Generated iOS and Android icons in apps/mobile/assets/icons');
