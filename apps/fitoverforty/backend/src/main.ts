// Angular libraries resolved from node_modules are partially compiled, and this
// bundle loads them outside Angular's AOT build, so the JIT compiler must be
// present before anything pulls in @angular/*. Matches the community
// nest-angular-ssr fixtures, which import this at their server entry.
import '@angular/compiler';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { bootstrapNestAngularSsr } from '@anarchitects/nest-angular-ssr';
import { AppModule } from './app/app.module';
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
async function registerSsr(app: NestFastifyApplication): Promise<boolean> {
  const serverEntry = process.env.WEB_SERVER_ENTRY;
  const browserAssetsDir = process.env.WEB_BROWSER_ASSETS_DIR;

  if (!serverEntry || !browserAssetsDir) {
    return false;
  }

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
    exclude: ['blog/feed.xml', 'sitemap.xml', 'robots.txt'],
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
