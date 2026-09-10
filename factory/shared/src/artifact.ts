import { z } from 'zod';

import { Id, Timestamp } from './ids.js';

export const ARTIFACT_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const ARTIFACT_HTML_MAX_BYTES = 512 * 1024;
const EXTERNAL_REFERENCE = /(?:\b(?:src|href)\s*=\s*|url\(\s*)['"]?\s*(?:https?:)?\/\//i;

export const ArtifactSlug = z.string().regex(ARTIFACT_SLUG);
export type ArtifactSlug = z.infer<typeof ArtifactSlug>;
export const ARTIFACT_KINDS = ['quest', 'roadmap', 'concept'] as const;
export const ArtifactKind = z.enum(ARTIFACT_KINDS);
export type ArtifactKind = z.infer<typeof ArtifactKind>;
export function defaultArtifactKind(slug: string, questId: string | null): ArtifactKind {
  if (slug === 'roadmap') return 'roadmap';
  return questId === null ? 'concept' : 'quest';
}
export const Artifact = z.object({
  slug: ArtifactSlug,
  questId: Id.nullable(),
  kind: ArtifactKind,
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(200),
  version: z.number().int().positive(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Artifact = z.infer<typeof Artifact>;
export const ArtifactWithHtml = Artifact.extend({ html: z.string().min(1) });
export type ArtifactWithHtml = z.infer<typeof ArtifactWithHtml>;

export function externalReference(html: string): string | null {
  return html.match(EXTERNAL_REFERENCE)?.[0] ?? null;
}

// TextEncoder is only typed by lib.dom, and @wyld/shared stays DOM-free for its Node consumers.
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export const NewArtifact = z
  .object({
    slug: ArtifactSlug,
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(200),
    html: z.string().min(1),
    questId: Id.optional(),
    kind: ArtifactKind.optional(),
  })
  .strict()
  .superRefine(({ html }, context) => {
    if (!/<html\b/i.test(html))
      context.addIssue({
        code: 'custom',
        path: ['html'],
        message: 'html must be a complete HTML document',
      });
    if (utf8ByteLength(html) > ARTIFACT_HTML_MAX_BYTES)
      context.addIssue({ code: 'custom', path: ['html'], message: 'html must be at most 512 KB' });
    if (externalReference(html) !== null)
      context.addIssue({
        code: 'custom',
        path: ['html'],
        message: 'html must not reference external URLs',
      });
  });
export type NewArtifact = z.infer<typeof NewArtifact>;
