/**
 * Node 21+ can expose `globalThis.localStorage` before a valid `--localstorage-file` path is set.
 * That object may omit `getItem`, which breaks any code (including dependencies) that reads
 * `localStorage` during SSR. Replace it with a harmless in-memory no-op Storage surface.
 */
export function register() {
  const g = globalThis as typeof globalThis & { localStorage?: unknown };
  const ls = g.localStorage;
  if (!ls || typeof (ls as Storage).getItem !== "function") {
    const noop: Storage = {
      get length() {
        return 0;
      },
      clear() {},
      getItem() {
        return null;
      },
      key() {
        return null;
      },
      removeItem() {},
      setItem() {},
    };
    Object.defineProperty(g, "localStorage", {
      value: noop,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }
}
