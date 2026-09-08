import { DEMO_SLUG } from './builder.js';

export type RewriteEmbedsResult = { ok: true; html: string } | { ok: false; error: string };

const attribute = (name: string) =>
  new RegExp(`\\s${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+)))?`, 'gi');

const values = (tag: string, name: string) =>
  [...tag.matchAll(attribute(name))].map((match) => ({
    match: match[0],
    value: match[1] ?? match[2] ?? match[3],
    index: match.index,
  }));

const deniedSrc = (src: string) => ({
  ok: false as const,
  error: `Embed src not allowed: "${src}" (only /play/<slug>/... embeds are permitted)`,
});

export const PAK_EMBED_ROUTES = ['/workshop'] as const;

const deniedPakView = (src: string) => ({
  ok: false as const,
  error: `Embed src not allowed: "${src}" (an explainer cannot embed the Pak's own explainer views)`,
});

export function rewriteEmbeds(html: string): RewriteEmbedsResult {
  let error: RewriteEmbedsResult | undefined;
  const rewritten = html.replace(/<iframe\b[^>]*>/gi, (tag) => {
    const demoAttributes = values(tag, 'data-wyld-demo');
    if (demoAttributes.length !== 1) {
      error = { ok: false, error: 'Embed missing data-wyld-demo attribute' };
      return tag;
    }
    const demo = demoAttributes[0]?.value ?? '';
    if (demo !== '' && demo !== 'landscape' && demo !== 'portrait') {
      error = { ok: false, error: `Embed data-wyld-demo not allowed: "${demo}"` };
      return tag;
    }
    if (values(tag, 'srcdoc').length > 0) {
      error = { ok: false, error: 'Embed srcdoc not allowed' };
      return tag;
    }
    const srcAttributes = values(tag, 'src');
    const src = srcAttributes[0]?.value;
    if (srcAttributes.length !== 1 || src === undefined) {
      error = deniedSrc('');
      return tag;
    }

    const hashAt = src.indexOf('#');
    const beforeHash = hashAt < 0 ? src : src.slice(0, hashAt);
    const fragment = hashAt < 0 ? '' : src.slice(hashAt);
    const queryAt = beforeHash.indexOf('?');
    const pathname = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
    const query = queryAt < 0 ? '' : beforeHash.slice(queryAt + 1);
    const slugMatch = /^\/play\/([^/]+)\//.exec(pathname);
    const pakRoute = PAK_EMBED_ROUTES.some((route) => route === pathname);
    if (pathname === '/' || pathname === '/roadmap' || pathname.startsWith('/explain/')) {
      error = deniedPakView(src);
      return tag;
    }
    if (
      pathname.includes('..') ||
      (!pakRoute && (slugMatch === null || !DEMO_SLUG.test(slugMatch[1] ?? '')))
    ) {
      error = deniedSrc(src);
      return tag;
    }

    const parameters = new URLSearchParams(query);
    parameters.set(pakRoute ? 'embed' : 'debug', '1');
    const nextSrc = `${pathname}?${parameters.toString()}${fragment}`;
    let next = tag.replace(srcAttributes[0]!.match, ` src="${nextSrc}"`);
    next = next.replace(demoAttributes[0]!.match, ` data-wyld-demo="${demo || 'landscape'}"`);
    return next;
  });
  return error ?? { ok: true, html: rewritten };
}
