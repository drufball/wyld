import { describe, expect, it } from 'vitest';

import { rewriteEmbeds } from './embeds.js';

const rewrite = (tag: string) => rewriteEmbeds(`<main>${tag}</main>`);

describe('rewriteEmbeds', () => {
  it('allows a play path and forces debug=1', () => {
    expect(rewrite('<iframe data-wyld-demo src="/play/fw-2d/"></iframe>')).toMatchObject({
      ok: true,
      html: expect.stringContaining('src="/play/fw-2d/?debug=1"'),
    });
  });
  it('overwrites an existing debug parameter', () => {
    expect(rewrite('<iframe data-wyld-demo src="/play/fw/?debug=0&x=2">')).toMatchObject({
      ok: true,
      html: expect.stringContaining('/play/fw/?debug=1&x=2'),
    });
  });
  it('preserves other query parameters and the fragment', () => {
    expect(rewrite('<iframe data-wyld-demo src="/play/fw/?a=1&b=2#here">')).toMatchObject({
      ok: true,
      html: expect.stringContaining('/play/fw/?a=1&b=2&debug=1#here'),
    });
  });
  it('normalises a bare data-wyld-demo to landscape', () => {
    expect(rewrite('<iframe data-wyld-demo src=/play/fw/>')).toMatchObject({
      ok: true,
      html: expect.stringContaining('data-wyld-demo="landscape"'),
    });
  });
  it('keeps an explicit portrait hint', () => {
    expect(rewrite('<iframe data-wyld-demo="portrait" src="/play/fw/">')).toMatchObject({
      ok: true,
      html: expect.stringContaining('data-wyld-demo="portrait"'),
    });
  });
  it('rejects an iframe without data-wyld-demo', () => {
    expect(rewrite('<iframe src="/play/fw/">')).toMatchObject({ ok: false });
  });
  it.each(['https://x.test/', 'http://x.test/', 'javascript:x', 'data:text/html,x', 'about:blank'])(
    'rejects an absolute url: %s',
    (src) => expect(rewrite(`<iframe data-wyld-demo src="${src}">`)).toMatchObject({ ok: false }),
  );
  it('rejects a protocol-relative url', () => {
    expect(rewrite('<iframe data-wyld-demo src="//host/x">')).toMatchObject({ ok: false });
  });
  it('allows an allow-listed pak route and forces embed=1', () => {
    expect(rewrite('<iframe data-wyld-demo src="/workshop?tab=all">')).toEqual({
      ok: true,
      html: '<main><iframe data-wyld-demo="landscape" src="/workshop?tab=all&embed=1"></main>',
    });
  });
  it('rejects a pak route that is not on the allow-list', () => {
    expect(rewrite('<iframe data-wyld-demo src="/artifacts/x/">')).toMatchObject({ ok: false });
  });
  it('rejects an explainer embedding an explainer', () => {
    for (const src of ['/explain/x', '/roadmap', '/']) {
      expect(rewrite(`<iframe data-wyld-demo src="${src}">`)).toEqual({
        ok: false,
        error: `Embed src not allowed: "${src}" (an explainer cannot embed the Pak's own explainer views)`,
      });
    }
  });
  it('rejects a play path containing dot segments', () => {
    expect(rewrite('<iframe data-wyld-demo src="/play/fw/../x">')).toMatchObject({ ok: false });
  });
  it('rejects an iframe with srcdoc', () => {
    expect(rewrite('<iframe data-wyld-demo src="/play/fw/" srcdoc="x">')).toMatchObject({
      ok: false,
    });
  });
  it('rejects an unknown data-wyld-demo value', () => {
    expect(rewrite('<iframe data-wyld-demo="square" src="/play/fw/">')).toMatchObject({
      ok: false,
    });
  });
  it('leaves html without embeds untouched', () => {
    expect(rewriteEmbeds('<p>hello</p>')).toEqual({ ok: true, html: '<p>hello</p>' });
  });
  it('rewrites every embed when there are several', () => {
    const result = rewriteEmbeds(
      '<iframe data-wyld-demo src="/play/a/"><iframe data-wyld-demo src="/play/b/">',
    );
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.html.match(/debug=1/g)).toHaveLength(2);
  });
});
