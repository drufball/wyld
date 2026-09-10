import { describe, expect, it } from 'vitest';

import {
  ARTIFACT_HTML_MAX_BYTES,
  ArtifactSlug,
  NewArtifact,
  defaultArtifactKind,
  externalReference,
} from './artifact.js';

const artifact = (html: string) => ({
  slug: 'roadmap-1',
  title: 'Roadmap',
  summary: 'One line',
  html,
});

describe('artifacts', () => {
  it('derives a default kind from the slug and quest', () => {
    expect(defaultArtifactKind('roadmap', 'quest-id')).toBe('roadmap');
    expect(defaultArtifactKind('other', 'quest-id')).toBe('quest');
    expect(defaultArtifactKind('other', null)).toBe('concept');
  });
  it.each(['a', 'a-1', '0-roadmap'])('accepts slug %s', (slug) =>
    expect(ArtifactSlug.safeParse(slug).success).toBe(true),
  );
  it.each(['', '-a', 'A', 'a_1', 'a'.repeat(65)])('rejects slug %s', (slug) =>
    expect(ArtifactSlug.safeParse(slug).success).toBe(false),
  );
  it('accepts a complete inline document and safe references', () => {
    const html =
      '<!doctype html><html><style>x{color:red}</style><body><img src="data:image/png;base64,x"><a href="#top">x</a><a href="/quests">q</a><script>1</script></body></html>';
    expect(NewArtifact.safeParse(artifact(html)).success).toBe(true);
  });
  it('rejects fragments and UTF-8 documents over the byte limit', () => {
    expect(NewArtifact.safeParse(artifact('<p>fragment</p>')).success).toBe(false);
    expect(
      NewArtifact.safeParse(artifact(`<html>${'a'.repeat(ARTIFACT_HTML_MAX_BYTES)}</html>`))
        .success,
    ).toBe(false);
  });
  it.each([
    '<html><img src="https://example.test/x"></html>',
    "<html><a href='http://example.test'>x</a></html>",
    '<html><style>x{background:url(//cdn.test/x)}</style></html>',
    '<html><style>x{background:url( "https://cdn.test/x" )}</style></html>',
  ])('rejects external reference %s', (html) => {
    expect(externalReference(html)).not.toBeNull();
    expect(NewArtifact.safeParse(artifact(html)).success).toBe(false);
  });
});
