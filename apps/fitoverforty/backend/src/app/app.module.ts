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
import { BlogModule } from '../blog/blog.module';
import { NewsletterModule } from '@fitoverforty/newsletter-nest';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';

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
    AuthModule,
    BlogModule,
    MediaModule,
    NewsletterModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
