import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ImageUploader,
  ImageUploadResult,
} from '@fitoverforty/frontend-editorjs';
import { firstValueFrom, type Observable } from 'rxjs';

interface UploadResponse {
  success: 0 | 1;
  file: { url: string; width?: number; height?: number };
}

/**
 * The app's implementation of the editor library's upload port.
 *
 * This is the piece the library deliberately does not own: it knows the app's
 * endpoint, and the library knows only that something can take a file and
 * return a URL. Swapping storage is a backend change; this stays as it is.
 */
@Injectable({ providedIn: 'root' })
export class HttpImageUploader implements ImageUploader {
  private readonly http = inject(HttpClient);

  async uploadFile(file: File): Promise<ImageUploadResult> {
    const form = new FormData();
    form.append('file', file, file.name);

    /**
     * No explicit Content-Type header. The browser has to set it, because it
     * alone knows the multipart boundary it generated — setting it by hand
     * produces a body the server cannot parse.
     */
    return this.send(
      this.http.post<UploadResponse>('/api/media', form, {
        withCredentials: true,
      }),
    );
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

  private async send(
    request: Observable<UploadResponse>,
  ): Promise<ImageUploadResult> {
    try {
      const response = await firstValueFrom(request);
      if (!response?.file?.url) {
        throw new Error('The upload did not return a URL.');
      }
      return { success: 1, file: { url: response.file.url } };
    } catch (error) {
      /**
       * The server's message is surfaced rather than replaced. These are
       * deliberate, actionable refusals — wrong format, too large — and
       * flattening them to "upload failed" would hide the one thing the author
       * needs to know.
       */
      if (error instanceof HttpErrorResponse) {
        const message =
          (error.error as { message?: string } | null)?.message ??
          'The upload failed.';
        throw new Error(message);
      }
      throw error;
    }
  }
}
