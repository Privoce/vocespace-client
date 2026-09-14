import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Read tracked and new source in the current worktree, including P1 features.
// Never import application modules or read private config/upload state.
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((file) => /^(app\/|features\/|lib\/|server\/|styles\/|server\.js$)/.test(file))
  .filter((file) => !file.startsWith('lib/uploads/'))
  .filter((file) => /\.(tsx?|jsx?|s?css)$/.test(file) && fs.existsSync(file))
  .sort();
const imports = [];
const socketCalls = [];
const roomEvents = [];
const envReads = [];
const modules = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  modules.push({ file, lines: text.split('\n').length, area: file.split('/').slice(0, 3).join('/') });
  if (/\.s?css$/.test(file)) continue;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  function visit(node) {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      imports.push({ file, line, specifier, typeOnly: !!(node.isTypeOnly || node.importClause?.isTypeOnly) });
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression.getText(source);
      const method = node.expression.name.text;
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument) && /^(on|off|once|emit)$/.test(method) && /^(socket|io)(\.|$)/.test(receiver)) {
        socketCalls.push({ file, line, receiver, method, event: argument.text, argumentCount: node.arguments.length });
      }
      if (argument && /^(on|off)$/.test(method) && argument.getText(source).startsWith('RoomEvent.')) {
        roomEvents.push({ file, line, receiver, method, event: argument.getText(source), argumentCount: node.arguments.length });
      }
    }
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(source) === 'process.env') {
      envReads.push({ file, line, name: node.name.text });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

const reversePageImports = imports.filter(({ specifier }) => specifier.includes('PageClientImpl'));
const libToApp = imports.filter(({ file, specifier }) => file.startsWith('lib/') &&
  (specifier.startsWith('@/app/') || (specifier.startsWith('.') && path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)).startsWith('app/'))));
const routes = modules.filter(({ file }) => /^app\/.*(?:page|route)\.[jt]sx?$/.test(file)).map(({ file }) => file);
console.log(JSON.stringify({
  schemaVersion: 2,
  sourceScope: 'Tracked and untracked source in app, features, lib, server and styles; upload state excluded.',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  limitations: 'Static import/export and named socket/io calls only; dynamic aliases and payload validation require manual review. Does not execute code or read credentials.',
  counts: { sourceAndStyleFiles: modules.length, imports: imports.length, reversePageImports: reversePageImports.length, libToApp: libToApp.length },
  modules, routes, reversePageImports, libToApp, imports, socketCalls, roomEvents, envReads,
}, null, 2));
