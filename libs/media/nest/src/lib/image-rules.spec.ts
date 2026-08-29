import {
  MAX_UPLOAD_BYTES,
  RejectedUploadError,
  inspectImage,
} from './image-rules';

/** A 1x1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** A 1x1 GIF. */
const GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
    '<script>alert(1)</script></svg>',
);

describe('inspectImage', () => {
  it('accepts a PNG and reports its dimensions', () => {
    expect(inspectImage(PNG)).toMatchObject({
      mime: 'image/png',
      extension: 'png',
      width: 1,
      height: 1,
    });
  });

  it('accepts a GIF', () => {
    expect(inspectImage(GIF)).toMatchObject({ mime: 'image/gif' });
  });

  /**
   * The one that matters. An SVG is a document that can carry script; served
   * from this origin and navigated to directly, it runs. Raster only.
   */
  it('rejects SVG, which is a script vector rather than a picture', () => {
    expect(() => inspectImage(SVG)).toThrow(RejectedUploadError);
  });

  it('rejects a file that is not an image at all', () => {
    expect(() => inspectImage(Buffer.from('#!/bin/sh\nrm -rf /\n'))).toThrow(
      RejectedUploadError,
    );
  });

  /**
   * A PNG header with a shell script after it still is not something to run,
   * but the point is that the type recorded comes from the bytes rather than
   * from anything the client claimed.
   */
  it('derives the type from the bytes, not from a declared content-type', () => {
    expect(inspectImage(PNG).mime).toBe('image/png');
  });

  it('rejects an empty file', () => {
    expect(() => inspectImage(Buffer.alloc(0))).toThrow(/empty/i);
  });

  it('rejects anything over the size cap', () => {
    const huge = Buffer.concat([PNG, Buffer.alloc(MAX_UPLOAD_BYTES)]);
    expect(() => inspectImage(huge)).toThrow(/MB or smaller/);
  });

  it('accepts a file exactly at the cap', () => {
    // Off-by-one on a limit is the classic way to reject valid input.
    const padded = Buffer.alloc(MAX_UPLOAD_BYTES);
    PNG.copy(padded);
    expect(() => inspectImage(padded)).not.toThrow();
  });
});
