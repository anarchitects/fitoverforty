import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { MediaEntity } from '../blog/entities';
import { inspectImage } from './image-rules';
import { MEDIA_STORAGE, type MediaStoragePort } from './media-storage.port';

export interface UploadedMedia {
  id: string;
  url: string;
  width: number;
  height: number;
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStoragePort,
    @InjectRepository(MediaEntity)
    private readonly media: Repository<MediaEntity>,
  ) {}

  async store(buffer: Buffer): Promise<UploadedMedia> {
    const image = inspectImage(buffer);

    /**
     * The key is generated here and owes nothing to the uploaded filename.
     *
     * A client-supplied name is an attacker-supplied path: `../../etc/cron.d/x`
     * is a filename. Sanitising one is a game you can lose; not using one is
     * not. It also sidesteps duplicate names and awkward characters entirely.
     */
    const key = `${randomUUID()}.${image.extension}`;
    const stored = await this.storage.put(key, buffer, image.mime);

    const row = this.media.create({
      storageKey: stored.key,
      url: stored.url,
      mime: image.mime,
      bytes: String(image.bytes),
      width: image.width,
      height: image.height,
      /**
       * Empty at upload, and that is not an oversight.
       *
       * Editor.js uploads the file first and the author writes the caption
       * afterwards, so there is no alt text in existence at this moment. For
       * inline images it does not matter: the renderer takes alt from the
       * block's caption, not from this row. This column is what a hero image
       * or an author avatar would use, and those are chosen from an existing
       * asset — the point at which alt should be required.
       */
      alt: '',
    });
    const saved = await this.media.save(row);

    return {
      id: saved.id,
      url: saved.url,
      width: saved.width,
      height: saved.height,
    };
  }

  fetch(key: string): Promise<Buffer | null> {
    return this.storage.get(key);
  }

  async mimeFor(key: string): Promise<string | null> {
    const row = await this.media.findOne({ where: { storageKey: key } });
    return row?.mime ?? null;
  }
}
