import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { BlogModule } from '@fitoverforty/blog-nest';
import { OgController } from './og.controller';
import { OgService } from './og.service';
import { OgRenderer } from './og-renderer';
import { OG_ASSET_DIR } from './og-assets.token';

/**
 * `BlogModule` for `CONTENT_SOURCE`: a card is a rendering of a post, so this
 * reads the same published content the blog API does rather than reaching for
 * the database itself.
 */
@Module({
  imports: [BlogModule],
  controllers: [OgController],
  providers: [
    OgService,
    OgRenderer,
    {
      provide: OG_ASSET_DIR,
      /**
       * Beside the bundle. `__dirname` is the directory of the running
       * `main.js`, which is where `webpack.config.js` copies the fonts and the
       * WASM. A suite that has no artefact overrides this provider.
       */
      useValue: join(__dirname, 'assets'),
    },
  ],
})
export class OgModule {}
