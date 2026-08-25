import { AngularNodeAppEngine } from '@angular/ssr/node';

/**
 * SSR entry for the Angular build.
 *
 * The engine is constructed here, inside the Angular bundle, so that it shares
 * a single Angular instance with the application. Constructing it on the Nest
 * side would resolve a second copy of @angular/core from node_modules and DI
 * would fail with "No provider found for InjectionToken", because token
 * identities differ between the two copies.
 *
 * Allowed hosts are read from the environment rather than baked in at build
 * time, so the same artifact can be deployed against different hostnames.
 */
const allowedHosts = (process.env['WEB_ALLOWED_HOSTS'] ?? 'localhost,127.0.0.1')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

export const angularAppEngine = new AngularNodeAppEngine({ allowedHosts });

export default angularAppEngine;
