import { pathToFileURL } from 'node:url';
/**
 * Structural stand-in for AngularNodeAppEngine.
 *
 * The backend compiles with `moduleResolution: node` (node10), which cannot
 * resolve the `@angular/ssr/node` subpath export, so the real type is not
 * importable here without changing the backend's module resolution.
 */
export interface AngularAppEngineLike {
  handle(...args: never[]): unknown;
}

/**
 * Loads the Angular SSR engine from the separately-built frontend bundle.
 *
 * Two constraints drive this shape:
 *
 * 1. The frontend is its own Nx project, so its server bundle exists only as
 *    built output under dist/ and cannot be imported statically from here.
 *
 * 2. The engine must be constructed *inside* the Angular bundle. Creating an
 *    AngularNodeAppEngine on this side would resolve a second copy of
 *    @angular/core from node_modules, and DI fails with "No provider found for
 *    InjectionToken" because token identities differ between the two copies.
 *
 * `import()` is built at runtime via `new Function` because the backend
 * compiles with `module: commonjs`, where TypeScript downlevels a literal
 * `import()` into `require()` - which cannot load Angular's ESM output. This is
 * the same technique TypeORM uses in its own `importOrRequireFile`.
 */
const importEsm = new Function('specifier', 'return import(specifier);') as (
  specifier: string,
) => Promise<Record<string, unknown>>;

export async function loadAngularAppEngine(
  serverEntryPath: string,
): Promise<AngularAppEngineLike> {
  const serverEntry = await importEsm(pathToFileURL(serverEntryPath).href);
  const engine = serverEntry['angularAppEngine'] ?? serverEntry['default'];

  if (
    !engine ||
    typeof (engine as AngularAppEngineLike).handle !== 'function'
  ) {
    throw new Error(
      `Angular server entry at ${serverEntryPath} does not export an AngularNodeAppEngine`,
    );
  }

  return engine as AngularAppEngineLike;
}
