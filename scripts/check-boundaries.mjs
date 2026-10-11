import { isBuiltin } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const rules = {
  contracts: [],
  i18n: [],
  'meeting-core': [],
  ui: ['react', 'react-native', '@vocespace/meeting-core'],
  domain: ['@vocespace/contracts', 'dayjs'],
  'client-sdk': ['@vocespace/contracts', 'socket.io-client'],
  'server-core': ['@vocespace/contracts'],
};
const errors = new Set();
const modules = new Map();
const relative = (file) => path.relative(root, file).split(path.sep).join('/');

function files(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', 'dist', '.next', '.expo', 'build'].includes(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : /\.[cm]?[jt]sx?$/.test(file) ? [file] : [];
  });
}

function readModule(file) {
  if (modules.has(file)) return modules.get(file);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports = [];
  const globals = new Set();
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
         (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) imports.push(argument.text);
    }
    if (ts.isIdentifier(node)) globals.add(node.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const client = source.statements.some((node) => ts.isExpressionStatement(node) &&
    ts.isStringLiteral(node.expression) && node.expression.text === 'use client');
  const result = { imports, globals, client };
  modules.set(file, result);
  return result;
}

for (const [name, allowed] of Object.entries(rules)) {
  const directory = path.join(root, 'packages', name, 'src');
  for (const file of files(directory)) {
    const { imports, globals } = readModule(file);
    for (const specifier of imports) {
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      const local = resolved && path.resolve(resolved.resolvedFileName).startsWith(directory + path.sep);
      if (!local && !allowed.some((name) => specifier === name || specifier.startsWith(`${name}/`))) {
        errors.add(`${relative(file)}: forbidden dependency ${specifier}`);
      }
    }
    for (const identifier of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'process']) {
      if (globals.has(identifier)) errors.add(`${relative(file)}: platform global ${identifier}`);
    }
  }
}

// Follow transitive source imports, including re-exports, from all current Web client roots.
const visited = new Set();
function visitClient(file, via) {
  const name = relative(file);
  if (name.startsWith('packages/server-core/') || name.startsWith('services/') || name.startsWith('apps/web/lib/server/')) {
    errors.add(`${relative(via)}: client reaches server-only module ${name}`);
    return;
  }
  if (visited.has(file)) return;
  visited.add(file);
  for (const specifier of readModule(file).imports) {
    if (specifier === '@vocespace/server-core') {
      errors.add(`${name}: client imports @vocespace/server-core`);
    }
    const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
    if (resolved && !resolved.isExternalLibraryImport && /\.[cm]?[jt]sx?$/.test(resolved.resolvedFileName)) {
      visitClient(path.resolve(resolved.resolvedFileName), file);
    }
  }
}
for (const directory of ['apps/web/app', 'apps/web/components', 'apps/web/lib']) {
  for (const file of files(path.join(root, directory))) {
    if (readModule(file).client || relative(file).startsWith('apps/web/lib/api/')) visitClient(file, file);
  }
}
// Native imports only its own source and explicitly shared workspace packages.
for (const file of files(path.join(root, 'apps/mobile'))) {
  for (const specifier of readModule(file).imports) {
    if (specifier.startsWith('@vocespace/') && !['@vocespace/contracts', '@vocespace/domain', '@vocespace/meeting-core', '@vocespace/client-sdk', '@vocespace/ui', '@vocespace/i18n'].includes(specifier.split('/').slice(0, 2).join('/'))) {
      errors.add(`${relative(file)}: forbidden Native dependency ${specifier}`);
    }
    const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
    if (resolved && !resolved.isExternalLibraryImport) {
      const target = relative(path.resolve(resolved.resolvedFileName));
      if (!['apps/mobile/', 'packages/contracts/', 'packages/domain/', 'packages/client-sdk/', 'packages/ui/', 'packages/meeting-core/', 'packages/i18n/'].some((prefix) => target.startsWith(prefix))) {
        errors.add(`${relative(file)}: Native reaches non-shared source ${target}`);
      }
    }
  }
}
// All backend imports (including type-only imports) stay out of the Web application.
for (const file of files(path.join(root, 'services'))) {
  for (const specifier of readModule(file).imports) {
    const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
    const target = resolved && relative(path.resolve(resolved.resolvedFileName));
    if (/^(next|react|react-dom|antd)(\/|$)/.test(specifier) || target?.startsWith('apps/') || target?.startsWith('lib/')) {
      errors.add(`${relative(file)}: backend reaches application/legacy source ${specifier}`);
    }
  }
}
// Each workspace owns its dependencies; root node_modules must not mask missing declarations.
for (const directory of ['apps/web', 'apps/mobile', 'services/api', ...Object.keys(rules).map((name) => `packages/${name}`)]) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, directory, 'package.json'), 'utf8'));
  const declared = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies };
  for (const file of files(path.join(root, directory))) {
    for (const specifier of readModule(file).imports) {
      if (specifier.startsWith('.') || specifier.startsWith('@/') || isBuiltin(specifier)) continue;
      const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
      if (!declared[name]) errors.add(`${relative(file)}: undeclared workspace dependency ${name}`);
    }
  }
}
if (errors.size) {
  console.error([...errors].join('\n'));
  process.exitCode = 1;
} else {
  console.log('Workspace boundaries and Web/Native → backend isolation passed.');
}

for (const file of files(path.join(root, 'services'))) {
  const { imports } = readModule(file);
  for (const specifier of imports) {
    if (specifier.startsWith('next') || specifier.startsWith('@/app/')) {
      throw new Error(`${relative(file)}: backend must not import Next or app routes`);
    }
  }
}
