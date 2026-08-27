import imageSize from 'image-size';

export class RejectedUploadError extends Error {}

/**
 * The largest upload accepted, in bytes.
 *
 * Generous for a photograph, small enough that a handful of concurrent
 * uploads cannot exhaust memory — the whole file is buffered to be parsed and
 * hashed, so this is a real memory bound rather than a policy preference.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Image formats accepted, keyed by what the *bytes* turn out to be.
 *
 * Notably absent: SVG. An SVG is a document, not a picture — it can carry
 * script, and while `<img src>` will not execute it, anything that navigates
 * straight to the file URL runs it in this site's origin. That is a stored XSS
 * with extra steps. Raster only until there is a reason to solve it properly.
 *
 * Also absent: anything relying on the declared `Content-Type`. The browser
 * sends whatever it likes and an attacker sends whatever they like, so the
 * type recorded here is the one derived from the file's own header.
 */
const ACCEPTED: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

export interface InspectedImage {
  mime: string;
  extension: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Decides whether some bytes are an image this app will store.
 *
 * Parsing the header does double duty: it yields the dimensions `blog.media`
 * requires, and it is the type check. A file that cannot be parsed as one of
 * the accepted formats is not one, whatever it claims to be.
 */
export function inspectImage(buffer: Buffer): InspectedImage {
  if (buffer.byteLength === 0) {
    throw new RejectedUploadError('The file is empty.');
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new RejectedUploadError(
      `Images must be ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB or smaller.`,
    );
  }

  let dimensions: { width?: number; height?: number; type?: string };
  try {
    dimensions = imageSize(buffer);
  } catch {
    throw new RejectedUploadError('That file is not an image.');
  }

  const type = dimensions.type ?? '';
  const mime = ACCEPTED[type];
  if (!mime) {
    throw new RejectedUploadError(
      `Images must be PNG, JPEG, WebP or GIF. That file is ${type || 'unrecognised'}.`,
    );
  }

  const { width, height } = dimensions;
  if (!width || !height || width < 1 || height < 1) {
    // blog.media has a CHECK constraint requiring positive dimensions, so a
    // zero here would fail at insert with a far less helpful message.
    throw new RejectedUploadError('That image has no usable dimensions.');
  }

  return { mime, extension: type, width, height, bytes: buffer.byteLength };
}
