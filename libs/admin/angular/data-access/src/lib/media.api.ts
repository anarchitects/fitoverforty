import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface UploadedImage {
  /** The `blog.media` row id, which is what a hero refers to. */
  mediaId: string;
  url: string;
  width: number;
  height: number;
}

interface UploadResponse {
  success: 0 | 1;
  mediaId?: string;
  file?: { url?: string; width?: number; height?: number };
}

/**
 * The one place that knows where images are posted.
 *
 * Both callers go through here — the Editor.js upload port for body images and
 * the hero picker — so there is a single answer to "which endpoint, and what
 * does a failure mean", rather than two that drift.
 */
@Injectable({ providedIn: 'root' })
export class MediaApi {
  private readonly http = inject(HttpClient);

  async upload(file: File): Promise<UploadedImage> {
    const form = new FormData();
    form.append('file', file, file.name);

    try {
      /**
       * No explicit Content-Type header. The browser has to set it, because it
       * alone knows the multipart boundary it generated — setting it by hand
       * produces a body the server cannot parse.
       */
      const response = await firstValueFrom(
        this.http.post<UploadResponse>('/api/media', form, {
          withCredentials: true,
        }),
      );

      const url = response?.file?.url;
      const mediaId = response?.mediaId;
      if (!url || !mediaId) {
        throw new Error('The upload did not return a stored image.');
      }

      return {
        mediaId,
        url,
        width: response.file?.width ?? 0,
        height: response.file?.height ?? 0,
      };
    } catch (error) {
      throw new Error(uploadFailureMessage(error));
    }
  }
}

/**
 * The server's own message, when there is one.
 *
 * These are deliberate, actionable refusals — wrong format, too large — and
 * flattening them to "upload failed" would hide the one thing the author needs
 * to know in order to fix it.
 */
export function uploadFailureMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return (
      (error.error as { message?: string } | null)?.message ??
      'The upload failed.'
    );
  }
  return error instanceof Error ? error.message : 'The upload failed.';
}
