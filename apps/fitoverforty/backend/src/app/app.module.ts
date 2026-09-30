import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CommonMailerModule,
  mailerConfig,
} from '@anarchitects/common-nest-mailer';
import { FormsModule } from '@anarchitects/forms-nest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppDataSource } from '../data-source';
import { BlogModule } from '@fitoverforty/blog-nest';
import { NewsletterModule } from '@fitoverforty/newsletter-nest';
import { AuthModule } from '@fitoverforty/auth-nest';
import { MediaModule } from '@fitoverforty/media-nest';
import { OgModule } from '@fitoverforty/og-nest';
import { SiteIdentityModule } from './site-identity.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [mailerConfig],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: async () => ({
        ...AppDataSource.options,
      }),
    }),
    CommonMailerModule.forRootFromConfig(),
    FormsModule.forRootFromConfig(),
    // Global, and before the modules that inject it: every library that
    // renders the site's name reads it from here rather than holding it.
    SiteIdentityModule,
    AuthModule,
    BlogModule,
    MediaModule,
    NewsletterModule,
    OgModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
