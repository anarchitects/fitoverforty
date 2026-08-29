import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import type { MediaStoragePort, StoredMedia } from './media-storage.port';

/**
 * Where uploads land in development.
 *
 * Outside `dist/` and outside the frontend's assets on purpose: a rebuild must
 * not delete what authors have uploaded, and nothing under this directory is
 * served by a static file handler. Everything leaves through the media
 * controller, which is what lets the content-type and `nosniff` header be
 * controlled rather than inferred by whatever is serving files.
 */
export const DEFAULT_MEDIA_ROOT = '.data/media';

export function mediaRoot(): string {
  const configured = process.env['MEDIA_ROOT'] ?? DEFAULT_MEDIA_ROOT;
  return isAbsolute(configured)
    ? configured
    : resolve(process.cwd(), configured);
}

/**
 * The local-disk implementation of {@link MediaStoragePort}.
 *
 * Fine for one machine and honest about it. The production target is an object
 * store, and swapping it is a provider change in `MediaModule` rather than an
 * edit to anything that calls this — which is the whole reason the port exists.
 */
@Injectable()
export class LocalDiskMediaStorage implements MediaStoragePort {
  private readonly logger = new Logger(LocalDiskMediaStorage.name);
  private readonly root = mediaRoot();

  /**
   * Resolves a key to a path, refusing anything that escapes the root.
   *
   * Keys are generated server-side and are already constrained, so this should
   * be unreachable — which is exactly why it is here. Path traversal is a
   * single missing check away at all times, and the cost of the check is
   * nothing compared to serving `/etc/passwd`.
   */
  private pathFor(key: string): string {
    const full = resolve(join(this.root, key));
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`Refusing a media key that escapes the root: ${key}`);
    }
    return full;
  }

  /**
   * The port's third argument, `mime`, is deliberately not declared here.
   *
   * A disk has nowhere to record it — an object store would attach it as
   * Content-Type metadata — and the mime is already persisted on the
   * `blog.media` row, which is what the serving route reads. Omitting an
   * unused trailing parameter still satisfies the interface.
   */
  async put(key: string, bytes: Buffer): Promise<StoredMedia> {
    const path = this.pathFor(key);
    await mkdir(this.root, { recursive: true });
    await writeFile(path, bytes, { flag: 'wx' });
    this.logger.log(`Stored ${key} (${bytes.byteLength} bytes)`);
    return { key, url: `/media/${key}` };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
}
