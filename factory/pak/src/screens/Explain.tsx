import type { Artifact, ArtifactWithHtml } from '@wyld/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getArtifact } from '../api/client.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { useLiveEvents } from '../live/LiveEvents.js';

type LoadedArtifact = Artifact | ArtifactWithHtml;

function ArtifactViewer({
  slug,
  missing,
  back,
}: {
  slug: string;
  missing: ReactNode;
  back: (artifact: LoadedArtifact) => ReactNode;
}) {
  const [artifact, setArtifact] = useState<LoadedArtifact | null | undefined>(undefined);
  const { subscribe } = useLiveEvents();

  useEffect(() => {
    let current = true;
    const refresh = () => {
      void getArtifact(slug)
        .then((loaded) => current && setArtifact(loaded))
        .catch(() => current && setArtifact(null));
    };
    setArtifact(undefined);
    refresh();
    const unsubscribe = subscribe('planner.artifact_published', (event) => {
      if (event.payload.slug === slug) refresh();
    });
    return () => {
      current = false;
      unsubscribe();
    };
  }, [slug, subscribe]);

  if (artifact === undefined) return null;
  if (artifact === null) return missing;

  return (
    <section className="fixed inset-x-0 top-0 bottom-[72px] z-10 flex flex-col bg-card md:static md:z-auto md:h-[calc(100dvh-180px)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        {back(artifact)}
        <h1 className="m-0 min-w-0 truncate text-base">{artifact.title}</h1>
        <p className="m-0 min-w-0 flex-1 truncate text-muted-foreground">{artifact.summary}</p>
        <Badge variant="tone">v{artifact.version}</Badge>
      </header>
      <iframe
        className="min-h-0 w-full flex-1 border-0"
        src={`/artifacts/${encodeURIComponent(slug)}/?v=${artifact.version}`}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        title={artifact.title}
        loading="eager"
      />
    </section>
  );
}

const explainMissing = (
  <Card variant="bevel" className="p-5">
    <h1>Explainer</h1>
    <p>That explainer isn't here yet.</p>
    <Button variant="retro" asChild>
      <Link to="/quests">Back to quests</Link>
    </Button>
  </Card>
);

export function Explain() {
  const { slug } = useParams();
  if (!slug) return explainMissing;
  return (
    <ArtifactViewer
      slug={slug}
      missing={explainMissing}
      back={(artifact) => (
        <Button variant="retro" asChild>
          <Link
            to={
              artifact.questId ? `/quests?quest=${encodeURIComponent(artifact.questId)}` : '/quests'
            }
          >
            Back
          </Link>
        </Button>
      )}
    />
  );
}

export function Roadmap() {
  return (
    <ArtifactViewer
      slug="roadmap"
      missing={
        <Card variant="bevel" className="p-5">
          <h1>Roadmap</h1>
          <p>The roadmap explainer isn't written yet — it arrives with the next piece.</p>
        </Card>
      }
      back={() => (
        <Button variant="retro" asChild>
          <Link to="/">Back</Link>
        </Button>
      )}
    />
  );
}
