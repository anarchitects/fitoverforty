// Angular libraries resolved from node_modules are partially compiled, and this
// bundle loads them outside Angular's AOT build, so the JIT compiler must be
// present before anything pulls in @angular/*. Matches the community
// nest-angular-ssr fixtures, which import this at their server entry.
import '@angular/compiler';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { bootstrapNestAngularSsr } from '@anarchitects/nest-angular-ssr';
import multipart from '@fastify/multipart';
import { AppModule } from './app/app.module';
import { MAX_UPLOAD_BYTES } from '@fitoverforty/media-nest';
import { loadAngularAppEngine } from './ssr/angular-ssr.registration';

/**
 * SSR is wired here rather than in AppModule on purpose.
 *
 * The frontend and backend are deliberately separate Nx projects, so hosting
 * the Angular bundle is a deployment concern of this process, not a property of
 * the application module. Keeping it out of AppModule also keeps the e2e suite,
 * which builds AppModule directly under ts-jest, free of the ESM-only SSR
 * package and the Angular runtime.
 */
/**
 * Fails a misconfigured SSR path here, rather than several frames deeper.
 *
 * Setting the variable is what asks for SSR, so a path that does not resolve
 * is a configuration error and stays fatal: in development the Vite dev server
 * renders the frontend regardless, so degrading silently would hide it, and in
 * production this process *is* the web server, where coming up "healthy" while
 * serving no HTML is worse than refusing to start.
 *
 * What was wrong was the diagnosis, not the severity. The failure used to
 * surface as `Cannot find module` from inside a dynamic ESM import, naming
 * neither the variable nor `.env` - and because this runs before `listen`, the
 * only symptom was every /api call answering ECONNREFUSED, which reads as a
 * slow start. A stale absolute path left behind by a moved checkout is the way
 * this happens; see CLAUDE.md.
 */
function assertSsrPath(variable: string, value: string): void {
  if (existsSync(value)) {
    return;
  }

  throw new Error(
    `${variable} is set to "${value}", which does not exist (resolved to ` +
      `${resolve(value)}). SSR is requested by setting it, so this is a ` +
      `configuration error rather than a reason to serve API-only. Fix the ` +
      `path in the workspace-root .env, or unset both WEB_SERVER_ENTRY and ` +
      `WEB_BROWSER_ASSETS_DIR to run API-only deliberately. Relative paths ` +
      `resolve against the working directory (${process.cwd()}).`,
  );
}

async function registerSsr(app: NestFastifyApplication): Promise<boolean> {
  const serverEntry = process.env.WEB_SERVER_ENTRY;
  const browserAssetsDir = process.env.WEB_BROWSER_ASSETS_DIR;

  if (!serverEntry || !browserAssetsDir) {
    return false;
  }

  assertSsrPath('WEB_SERVER_ENTRY', serverEntry);
  assertSsrPath('WEB_BROWSER_ASSETS_DIR', browserAssetsDir);

  await bootstrapNestAngularSsr(app, {
    integration: {
      rendererOptions: {
        // cast: see AngularAppEngineLike - the real type is not importable
        // under this project's node10 module resolution.
        engine: (await loadAngularAppEngine(serverEntry)) as never,
      },
    },
    routing: { browserAssetsDir },
  });

  return true;
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const globalPrefix = 'api';
  // The feed, sitemap and robots.txt are public documents at conventional,
  // fixed URLs. Prefixing them with /api would put them where nothing looks.
  app.setGlobalPrefix(globalPrefix, {
    // Uploaded images are excluded for the same reason the feed is: they are
    // linked from published posts and from OpenGraph tags, where /api would be
    // a strange and permanent part of the URL. Uploading stays under /api.
    exclude: ['blog/feed.xml', 'sitemap.xml', 'robots.txt', 'media/:key'],
  });

  /**
   * Fastify parses nothing multipart without this, so an upload arrives with
   * an empty body and no error worth reading.
   */
  await app.register(multipart, {
    limits: { files: 1, fileSize: MAX_UPLOAD_BYTES },
  });

  const ssrEnabled = await registerSsr(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(
    ssrEnabled
      ? '🅰️  Angular SSR enabled'
      : '🅰️  Angular SSR disabled (WEB_SERVER_ENTRY / WEB_BROWSER_ASSETS_DIR unset)',
  );
}

bootstrap();
