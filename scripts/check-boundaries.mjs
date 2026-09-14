import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const serverPackages = new Set([
  'server-only', 'ioredis', 'nodemailer', 'jsonwebtoken', 'sharp', 'openai',
  'livekit-server-sdk', 'socket.io', 'express', 'dotenv', 'stripe',
  '@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner', '@iarna/toml',
]);
const sourceExtension = /\.(?:[cm]?[jt]sx?)$/;

function serverDependency(specifier) {
  const packageName = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  return builtins.has(specifier.replace(/^node:/, '')) || serverPackages.has(packageName);
}

function imports(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const dependencies = [];
  function visit(node) {
    let specifier;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      specifier = node.moduleReference.expression;
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      specifier = node.arguments[0];
      if (!specifier || !ts.isStringLiteralLike(specifier)) dependencies.push('<computed import>');
    }
    if (specifier && ts.isStringLiteralLike(specifier)) dependencies.push(specifier.text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...new Set(dependencies)];
}

/** Inspect a source graph without loading application modules or private configuration. */
export function checkBoundaries(files) {
  const graph = new Map();
  const errors = new Set();
  function resolve(from, specifier) {
    if (!specifier.startsWith('@/') && !specifier.startsWith('.')) return undefined;
    const base = specifier.startsWith('@/') ? specifier.slice(2)
      : path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
    return [base, ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '/index.ts', '/index.tsx', '/index.js']
      .map((ext) => base + ext)].find((candidate) => Object.hasOwn(files, candidate));
  }
  for (const [file, source] of Object.entries(files)) {
    const all = imports(source, file);
    // Type-only imports (including implicit types in existing code) are erased by the
    // same TS compilation step; they must not be mistaken for browser runtime imports.
    const runtime = imports(ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.Preserve },
    }).outputText, file);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const client = ast.statements.some((statement) => ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) && statement.expression.text === 'use client');
    graph.set(file, { client, runtime });
    for (const dependency of all) {
      const target = resolve(file, dependency);
      if (file.startsWith('lib/') && target && /^(app|features|server)\//.test(target)) {
        errors.add(`${file}: lib must not depend on ${target}`);
      }
      if (file.startsWith('lib/utils/')) {
        if (target ? !/^lib\/(utils|types)\//.test(target) : dependency !== '<computed import>') {
          errors.add(`${file}: pure utilities must not import ${dependency}`);
        }
      }
      if (dependency === '<computed import>' && /^(lib|features)\//.test(file)) {
        errors.add(`${file}: computed imports need an explicit, inspectable module map`);
      }
      if (!target && (dependency.startsWith('@/') || dependency.startsWith('.')) &&
        !/\.(?:css|scss|sass|less|json|svg|png|jpe?g|gif|webp)$/.test(dependency)) {
        errors.add(`${file}: unresolved source import ${dependency}`);
      }
    }
    if (file.startsWith('lib/utils/')) {
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isIdentifier(node) && ['window', 'document', 'navigator', 'fetch', 'XMLHttpRequest', 'WebSocket'].includes(node.text)) {
          errors.add(`${file}: pure utilities must not access ${node.text}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
  const clientReachable = new Set();
  // Also guard neutral lib/features entry points, even before a page consumes them.
  for (const [root, entry] of graph) {
    if (!entry.client && !/^(lib|features)\//.test(root)) continue;
    const seen = new Set();
    function walk(file, chain) {
      if (seen.has(file)) return;
      seen.add(file);
      clientReachable.add(file);
      for (const dependency of graph.get(file)?.runtime ?? []) {
        const target = resolve(file, dependency);
        if (dependency === '<computed import>') {
          errors.add(`${chain.join(' -> ')}: client/shared runtime contains a computed import`);
        } else if (serverDependency(dependency) || target?.startsWith('server/') || target?.startsWith('app/api/')) {
          errors.add(`${chain.join(' -> ')}: client/shared runtime reaches ${target ?? dependency}`);
        } else if (target) walk(target, [...chain, target]);
      }
    }
    walk(root, [root]);
  }
  return { files: graph.size, clientReachable: clientReachable.size, errors: [...errors].sort() };
}

export function readSources(root) {
  const result = {};
  function walk(relative) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const file = path.posix.join(relative, entry.name);
      if (entry.isDirectory() && file !== 'lib/uploads') walk(file);
      else if (entry.isFile() && sourceExtension.test(file) && !file.endsWith('.d.ts')) {
        result[file] = fs.readFileSync(path.join(root, file), 'utf8');
      }
    }
  }
  for (const dir of ['app', 'features', 'lib', 'server']) walk(dir);
  if (fs.existsSync(path.join(root, 'server.js'))) result['server.js'] = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = checkBoundaries(readSources(process.cwd()));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.errors.length ? 1 : 0;
}
