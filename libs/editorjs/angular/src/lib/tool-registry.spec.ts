import { SUPPORTED_BLOCK_TYPES } from '@fitoverforty/blog-ts';
import { REJECTING_IMAGE_UPLOADER } from './image-upload.port';
import { buildTools } from './tool-registry';

/**
 * Stands in for `@editorjs/list`, whose real toolbox offers three styles —
 * including a checklist the content contract does not accept.
 */
class FakeList {
  static get toolbox() {
    return [
      { title: 'Unordered List', data: { style: 'unordered' } },
      { title: 'Ordered List', data: { style: 'ordered' } },
      { title: 'Checklist', data: { style: 'checklist' } },
    ];
  }
}

const modules = {
  Header: class Header {},
  List: FakeList,
  Quote: class Quote {},
  ImageTool: class ImageTool {},
  CodeTool: class CodeTool {},
  Table: class Table {},
  Delimiter: class Delimiter {},
};

function tools(uploader = REJECTING_IMAGE_UPLOADER) {
  return buildTools(modules, { uploader });
}

describe('buildTools', () => {
  /**
   * The invariant worth protecting. `paragraph` is the one legitimate
   * difference: Editor.js provides it as the default block, so it is a
   * supported type with no registered tool.
   */
  it('registers a tool for every supported block type except paragraph', () => {
    const expected = SUPPORTED_BLOCK_TYPES.filter((t) => t !== 'paragraph');
    expect(Object.keys(tools()).sort()).toEqual([...expected].sort());
  });

  it('offers nothing the content contract does not allow', () => {
    for (const name of Object.keys(tools())) {
      expect(SUPPORTED_BLOCK_TYPES).toContain(name);
    }
  });

  it('limits headings to h2 and h3', () => {
    // The post title is the page's h1. The write-side validator rejects any
    // other level, so offering one in the toolbar would only produce a save
    // that fails.
    expect(tools()['header']['config']).toMatchObject({
      levels: [2, 3],
      defaultLevel: 2,
    });
  });

  it('routes image uploads through the injected port, not an endpoint', () => {
    // `endpoints` would make the tool POST to a URL this library would have to
    // know, which is exactly what stops it being extractable.
    const config = tools()['image']['config'] as Record<string, unknown>;
    expect(config['endpoints']).toBeUndefined();
    expect(config['uploader']).toBeDefined();
  });

  it('passes the uploader through rather than copying its result shape', async () => {
    const uploaded: File[] = [];
    const uploader = {
      async uploadFile(file: File) {
        uploaded.push(file);
        return { success: 1 as const, file: { url: '/media/x.png' } };
      },
      async uploadByUrl(url: string) {
        return { success: 1 as const, file: { url } };
      },
    };

    const config = tools(uploader)['image']['config'] as {
      uploader: {
        uploadByFile(file: File): Promise<unknown>;
        uploadByUrl(url: string): Promise<unknown>;
      };
    };

    const file = new File(['x'], 'x.png', { type: 'image/png' });
    await expect(config.uploader.uploadByFile(file)).resolves.toEqual({
      success: 1,
      file: { url: '/media/x.png' },
    });
    expect(uploaded).toEqual([file]);

    await expect(
      config.uploader.uploadByUrl('https://example.com/y.png'),
    ).resolves.toEqual({
      success: 1,
      file: { url: 'https://example.com/y.png' },
    });
  });

  it('the default uploader refuses rather than silently dropping the file', async () => {
    await expect(
      REJECTING_IMAGE_UPLOADER.uploadFile(
        new File(['x'], 'x.png', { type: 'image/png' }),
      ),
    ).rejects.toThrow(/not configured/);
  });
});

describe('list styles', () => {
  function listToolbox() {
    const ListClass = tools()['list']['class'] as { toolbox: unknown };
    return ListClass.toolbox as { title: string; data: { style: string } }[];
  }

  /**
   * The failure this prevents is the expensive one: the author gets a
   * checklist in the toolbar, writes a post around it, and only discovers at
   * save time that the server will not take it.
   */
  it('does not offer a checklist', () => {
    expect(listToolbox().map((e) => e.data.style)).not.toContain('checklist');
  });

  it('still offers both styles the contract allows', () => {
    expect(
      listToolbox()
        .map((e) => e.data.style)
        .sort(),
    ).toEqual(['ordered', 'unordered']);
  });

  it('excludes any new style by default rather than letting it through', () => {
    // An upgrade that adds a fourth style should be opted in, not inherited.
    class FutureList {
      static get toolbox() {
        return [
          { title: 'Unordered List', data: { style: 'unordered' } },
          { title: 'Definition List', data: { style: 'definition' } },
        ];
      }
    }
    const ListClass = buildTools(
      { ...modules, List: FutureList },
      { uploader: REJECTING_IMAGE_UPLOADER },
    )['list']['class'] as { toolbox: { data: { style: string } }[] };

    expect(ListClass.toolbox.map((e) => e.data.style)).toEqual(['unordered']);
  });
});
