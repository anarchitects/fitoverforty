import { InjectionToken } from '@angular/core';

/**
 * What Editor.js's image tool expects back from an upload.
 *
 * The shape is the tool's, not ours: `success: 1` and a `file.url`. Anything
 * else and the tool silently leaves an empty block behind.
 */
export interface ImageUploadResult {
  success: 0 | 1;
  file: { url: string };
}

/**
 * Somewhere to put an image.
 *
 * A port rather than a concrete uploader because the storage target is a
 * deployment choice — local disk in development, object storage in production
 * — and because this library is meant to be extractable, which it would not be
 * if it knew about this app's upload endpoint.
 */
export interface ImageUploader {
  uploadFile(file: File): Promise<ImageUploadResult>;
  uploadByUrl(url: string): Promise<ImageUploadResult>;
}

/**
 * Refuses every upload.
 *
 * Media storage is a later step, and an uploader that appeared to work while
 * dropping files would be worse than one that says it is not built. Rejecting
 * makes the image tool show its own error instead of an empty block.
 */
export const REJECTING_IMAGE_UPLOADER: ImageUploader = {
  async uploadFile() {
    throw new Error('Image upload is not configured.');
  },
  async uploadByUrl() {
    throw new Error('Image upload is not configured.');
  },
};

export const IMAGE_UPLOADER = new InjectionToken<ImageUploader>(
  'EDITORJS_IMAGE_UPLOADER',
  { providedIn: 'root', factory: () => REJECTING_IMAGE_UPLOADER },
);
