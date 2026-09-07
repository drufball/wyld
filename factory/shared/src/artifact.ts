import { z } from 'zod';

import { Id, Timestamp } from './ids.js';

export const ARTIFACT_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const ARTIFACT_HTML_MAX_BYTES = 512 * 1024;
const EXTERNAL_REFERENCE = /(?:\b(?:src|href)\s*=\s*|url\(\s*)['"]?\s*(?:https?:)?\/\//i;

export const ArtifactSlug = z.string().regex(ARTIFACT_SLUG);
export type ArtifactSlug = z.infer<typeof ArtifactSlug>;
export const Artifact = z.object({
  slug: ArtifactSlug,
  questId: Id.nullable(),
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

export const NewArtifact = z
  .object({
    slug: ArtifactSlug,
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(200),
    html: z.string().min(1),
    questId: Id.optional(),
  })
  .strict()
  .superRefine(({ html }, context) => {
    if (!/<html\b/i.test(html))
      context.addIssue({
        code: 'custom',
        path: ['html'],
        message: 'html must be a complete HTML document',
      });
    if (new TextEncoder().encode(html).length > ARTIFACT_HTML_MAX_BYTES)
      context.addIssue({ code: 'custom', path: ['html'], message: 'html must be at most 512 KB' });
    if (externalReference(html) !== null)
      context.addIssue({
        code: 'custom',
        path: ['html'],
        message: 'html must not reference external URLs',
      });
  });
export type NewArtifact = z.infer<typeof NewArtifact>;
