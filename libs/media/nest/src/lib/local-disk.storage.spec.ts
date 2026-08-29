import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDiskMediaStorage } from './local-disk.storage';

describe('LocalDiskMediaStorage', () => {
  let root: string;
  let storage: LocalDiskMediaStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fof-media-'));
    process.env['MEDIA_ROOT'] = root;
    // The root is read in the constructor, so the env has to be set first.
    storage = new LocalDiskMediaStorage();
  });

  afterEach(async () => {
    delete process.env['MEDIA_ROOT'];
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips bytes and returns a site-relative URL', async () => {
    const stored = await storage.put('a.png', Buffer.from('hello'));

    expect(stored).toEqual({ key: 'a.png', url: '/media/a.png' });
    await expect(readFile(join(root, 'a.png'), 'utf8')).resolves.toBe('hello');
    await expect(storage.get('a.png')).resolves.toEqual(Buffer.from('hello'));
  });

  it('returns null for a missing key rather than throwing', async () => {
    // A missing object is a 404, and making the caller catch to find that out
    // would invert the normal case.
    await expect(storage.get('nope.png')).resolves.toBeNull();
  });

  it('refuses to write outside its root', async () => {
    await expect(
      storage.put('../escaped.png', Buffer.from('x')),
    ).rejects.toThrow(/escapes the root/);
  });

  it('refuses to read outside its root', async () => {
    await expect(storage.get('../../etc/passwd')).rejects.toThrow(
      /escapes the root/,
    );
  });

  it('will not silently overwrite an existing key', async () => {
    // Keys are UUIDs, so a collision means something has gone wrong upstream
    // and clobbering someone else's image is the worst available response.
    await storage.put('b.png', Buffer.from('first'));
    await expect(storage.put('b.png', Buffer.from('second'))).rejects.toThrow();
    await expect(readFile(join(root, 'b.png'), 'utf8')).resolves.toBe('first');
  });
});
