import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth';
import { MediaEntity } from '../blog/entities';
import { LocalDiskMediaStorage } from './local-disk.storage';
import { MEDIA_STORAGE } from './media-storage.port';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

/**
 * Uploads and serving.
 *
 * The storage binding is the only line that changes when production moves to
 * object storage — everything else depends on the port. AuthModule is imported
 * for AdminGuard, which the upload route uses; serving is public.
 */
@Module({
  imports: [TypeOrmModule.forFeature([MediaEntity]), AuthModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    LocalDiskMediaStorage,
    { provide: MEDIA_STORAGE, useExisting: LocalDiskMediaStorage },
  ],
  exports: [MediaService],
})
export class MediaModule {}
