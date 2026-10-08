import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Load application modules with isolated dependencies; never connect to real services.
export function loadTs(path, mocks = {}) {
  const filename = resolve(path);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  const nativeRequire = createRequire(filename);
  const require = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) return loadTs(`./${name.slice(2)}.ts`, mocks);
    if (name.startsWith('.')) return loadTs(resolve(dirname(filename), `${name}.ts`), mocks);
    return nativeRequire(name);
  };
  runInNewContext(source, { module: loadedModule, exports: loadedModule.exports, require, process, Buffer,
    crypto: globalThis.crypto, TextEncoder, console, fetch: mocks.fetch ?? globalThis.fetch,
    URL, Request, Response, AbortSignal, setTimeout, clearTimeout }, { filename });
  return loadedModule.exports;
}
