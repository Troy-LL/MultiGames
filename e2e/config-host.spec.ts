import { test, expect } from '@playwright/test';

import { resolveHost } from '../src/lib/resolveHost';

// Pure-logic checks for the "fail loudly on missing VITE_PARTYKIT_HOST" fix.
test('resolveHost: missing host in prod is a loud config error', () => {
  const r = resolveHost(undefined, true);
  expect(r.configError).toBeTruthy();
  expect(r.configError).toContain('VITE_PARTYKIT_HOST');
});

test('resolveHost: missing host in dev falls back to localhost, no error', () => {
  const r = resolveHost(undefined, false);
  expect(r.configError).toBeNull();
  expect(r.host).toBe('localhost:1999');
});

test('resolveHost: empty/whitespace host is treated as missing', () => {
  expect(resolveHost('   ', true).configError).toBeTruthy();
  expect(resolveHost('', true).configError).toBeTruthy();
});

test('resolveHost: a real host passes through with no error', () => {
  const r = resolveHost('my-app.username.partykit.dev', true);
  expect(r.host).toBe('my-app.username.partykit.dev');
  expect(r.configError).toBeNull();
});
