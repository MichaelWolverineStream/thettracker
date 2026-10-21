import { expect, it, vi } from 'vitest';

it('uses jsdom Web Storage that storage tests can observe through Storage.prototype', () => {
  // Node 25+ ships its own localStorage/sessionStorage globals; storage tests rely on jsdom's.
  const { window: dom } = (globalThis as unknown as { jsdom: { window: typeof window } }).jsdom;
  expect(Storage).toBe(dom.Storage);
  expect(window.localStorage).toBe(dom.localStorage);
  expect(window.sessionStorage).toBe(dom.sessionStorage);

  const writes = vi.spyOn(Storage.prototype, 'setItem');
  window.localStorage.setItem('environment-probe', '1');
  expect(writes).toHaveBeenCalledWith('environment-probe', '1');
  window.localStorage.clear();
});
