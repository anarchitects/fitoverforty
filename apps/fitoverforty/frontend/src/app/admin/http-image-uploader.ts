import { Injectable, inject } from '@angular/core';
import type {
  ImageUploader,
  ImageUploadResult,
} from '@fitoverforty/frontend-editorjs';
import { MediaApi } from './media.api';

/**
 * The app's implementation of the editor library's upload port.
 *
 * This is the piece the library deliberately does not own: it knows the app's
 * endpoint, and the library knows only that something can take a file and
 * return a URL. Swapping storage is a backend change; this stays as it is.
 */
@Injectable({ providedIn: 'root' })
export class HttpImageUploader implements ImageUploader {
  private readonly media = inject(MediaApi);

  async uploadFile(file: File): Promise<ImageUploadResult> {
    // The media id is dropped on purpose. A body image is a URL in block JSON;
    // only the hero is a foreign key into blog.media.
    const { url } = await this.media.upload(file);
    return { success: 1, file: { url } };
  }

  /**
   * Not supported, and it says so rather than appearing to work.
   *
   * Editor.js offers "paste an image URL" alongside file upload. Honouring it
   * would mean the server fetching an arbitrary URL on request, which is a
   * server-side request forgery hole pointed at whatever the deployment can
   * reach. It needs its own design, not a quiet passthrough.
   */
  async uploadByUrl(): Promise<ImageUploadResult> {
    throw new Error(
      'Pasting an image URL is not supported — upload the file instead.',
    );
  }
}
