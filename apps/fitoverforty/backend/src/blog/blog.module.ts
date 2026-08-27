import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth';
import { PostAdminController, PostAdminService } from './admin';
import { BlogController } from './blog.controller';
import { SyndicationController } from './syndication.controller';
import { CONTENT_SOURCE } from './content-source.token';
import { AuthorEntity, MediaEntity, PostEntity, TagEntity } from './entities';
import { TypeOrmContentSource } from './typeorm-content-source';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PostEntity,
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
    { provide: CONTENT_SOURCE, useExisting: TypeOrmContentSource },
  ],
  exports: [CONTENT_SOURCE],
})
export class BlogModule {}
