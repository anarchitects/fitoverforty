import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@fitoverforty/auth-nest';
import { PostAdminController, PostAdminService } from './admin';
import { BlogController } from './blog.controller';
import { SyndicationController } from './syndication.controller';
import { CONTENT_SOURCE } from './content-source.token';
import {
  AuthorEntity,
  MediaEntity,
  PillarEntity,
  PostEntity,
  TagEntity,
} from './entities';
import { TypeOrmContentSource } from './typeorm-content-source';
import { NoIndexHeader } from './indexing';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PostEntity,
      PillarEntity,
      TagEntity,
      AuthorEntity,
      MediaEntity,
    ]),
    // For AdminGuard, which PostAdminController is wrapped in.
    AuthModule,
  ],
  controllers: [BlogController, SyndicationController, PostAdminController],
  providers: [
    TypeOrmContentSource,
    PostAdminService,
    // Registers a Fastify hook on init; nothing injects it. Provided here
    // rather than in main.ts so the e2e suite, which builds AppModule
    // directly, can reach it — see the note on the class.
    NoIndexHeader,
    { provide: CONTENT_SOURCE, useExisting: TypeOrmContentSource },
  ],
  exports: [CONTENT_SOURCE],
})
export class BlogModule {}
