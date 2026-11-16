import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { loadTs } from './load-ts.mjs';

// Render the component tree without a DOM; lifecycle and native dialog methods
// are controlled so dismissal can be checked independently of server requests.
function loadComponent(path, mocks = {}) {
  const filename = resolve(path);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  const nativeRequire = createRequire(filename);
  const jsx = (type, props) => ({ type, props });
  runInNewContext(source, {
    module: loadedModule, exports: loadedModule.exports, fetch: mocks.fetch,
    document: mocks.document || { activeElement: null }, sessionStorage: mocks.sessionStorage,
    require: name => name in mocks ? mocks[name] : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : nativeRequire(name),
  }, { filename });
  return loadedModule.exports;
}

function findNodes(node, predicate, ancestors = []) {
  if (Array.isArray(node)) return node.flatMap(child => findNodes(child, predicate, ancestors));
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [
    ...(predicate(node) ? [{ node, ancestors }] : []),
    ...findNodes(node.props.children, predicate, [...ancestors, node]),
  ];
}

test('navbar mounts exactly one notification owner outside responsive hidden containers', () => {
  const NotificationBell = () => null;
  const { Navbar } = loadComponent('components/Navbar.tsx', {
    react: { useState: value => [value, () => {}], useEffect: () => {} },
    '@/components/NotificationBell': { NotificationBell },
    '@/components/icons/BrandIcons': { StravaIcon: () => null, InstagramIcon: () => null },
    '@/lib/utils/avatar': { isValidAvatarUrl: () => false },
  });
  const tree = Navbar({ club: { assets: {}, name: 'Dorfdüsen' }, currentUser: { id: 'a', firstname: 'Erik' } });
  const bells = findNodes(tree, node => node.type === NotificationBell);
  assert.equal(bells.length, 1, 'hidden native modals must never be opened by a second bell');
  assert.ok(bells[0].ancestors.every(node => !/(?:^|\s)(?:hidden|\S+:hidden)(?:\s|$)/.test(node.props.className || '')));
});

test('shared dialog opens modally and dismisses via Escape or backdrop, but not content', () => {
  let effect;
  const calls = [];
  const element = { showModal: () => calls.push('open'), close: () => calls.push('close') };
  const { ModalDialog } = loadComponent('components/ModalDialog.tsx', {
    react: { useRef: () => ({ current: element }), useEffect: callback => { effect = callback; } },
  });
  const tree = ModalDialog({ children: 'Inhalt', onClose: () => calls.push('dismiss'), label: 'Details' });
  const cleanup = effect();
  assert.deepEqual(calls, ['open']);
  tree.props.onClick({ target: {}, currentTarget: element });
  assert.deepEqual(calls, ['open']);
  tree.props.onClick({ target: element, currentTarget: element });
  assert.deepEqual(calls.slice(-2), ['close', 'dismiss']);
  tree.props.onCancel({ preventDefault: () => calls.push('prevent') });
  assert.deepEqual(calls.slice(-3), ['prevent', 'close', 'dismiss']);
  cleanup();
  assert.equal(calls.at(-1), 'close');
});

test('every weekly recap action closes immediately, including its navigation link', () => {
  let closed = 0;
  const Link = () => null;
  const { WeeklyRecapDialog } = loadComponent('components/WeeklyRecapDialog.tsx', {
    'next/link': { default: Link },
    '@/components/ModalDialog': { ModalDialog: () => null },
  });
  for (const outcome of ['motivation', 'celebration']) {
    const tree = WeeklyRecapDialog({
      notification: { title: 'Neue Woche', message: 'Los geht’s', metadata: { outcome } },
      onClose: () => { closed++; },
    });
    const actions = findNodes(tree, node => node.type === 'button' || node.type === Link);
    assert.equal(actions.length, 3);
    for (const { node } of actions) node.props.onClick();
  }
  assert.equal(closed, 6);
});


test('notification alert dismisses even while marking it read never resolves', () => {
  const states = [];
  let stateIndex = 0;
  const { NotificationToast } = loadComponent('components/NotificationToast.tsx', {
    react: {
      Suspense: 'suspense', useEffect: () => {},
      useState: initial => {
        const index = stateIndex++;
        const value = index === 1 ? { id: 'lost-title', title: 'Titel verloren', message: 'Weiter geht’s', link: '/arena' } : initial;
        return [value, next => { states[index] = next; }];
      },
    },
    'next/navigation': { useSearchParams: () => ({ get: () => null }), useRouter: () => ({}) },
    fetch: () => new Promise(() => {}),
  });
  const content = NotificationToast().props.children;
  const tree = content.type();
  const close = findNodes(tree, node => node.props['aria-label'] === 'Schließen');
  assert.equal(close.length, 1);
  close[0].node.props.onClick();
  assert.equal(states[0], true);
  assert.equal(states[1], null);
});


test('automatic recap can only be claimed once even when browser storage is unavailable', () => {
  const { claimWeeklyRecap } = loadTs('lib/notifications/recap-session.ts');
  assert.equal(claimWeeklyRecap('week-a'), true);
  assert.equal(claimWeeklyRecap('week-a'), false);
  assert.equal(claimWeeklyRecap('week-b'), true);
});


test('recap stays dismissed after a remount or reload while its read receipt is pending', () => {
  const values = new Map();
  const sessionStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const first = loadComponent('lib/notifications/recap-session.ts', { sessionStorage });
  assert.equal(first.claimWeeklyRecap('week-a'), true);
  const reloaded = loadComponent('lib/notifications/recap-session.ts', { sessionStorage });
  assert.equal(reloaded.claimWeeklyRecap('week-a'), false);
  assert.equal(reloaded.claimWeeklyRecap('week-b'), true);
});
