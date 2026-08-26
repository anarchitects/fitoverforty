import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
  ],
  controllers: [BlogController, SyndicationController],
  providers: [
    TypeOrmContentSource,
    { provide: CONTENT_SOURCE, useExisting: TypeOrmContentSource },
  ],
  exports: [CONTENT_SOURCE],
})
export class BlogModule {}
