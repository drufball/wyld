import type { Artifact } from '@wyld/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listArtifacts } from '../api/client.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';

const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

export function Concepts() {
  const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
  useEffect(() => {
    void listArtifacts({ kind: 'concept' })
      .then(setArtifacts)
      .catch(() => setArtifacts([]));
  }, []);
  return (
    <section className="grid min-w-0 gap-5">
      <div>
        <h1 className="m-0">Concepts</h1>
        <p>Explainers for how the important parts of the app work.</p>
      </div>
      {artifacts?.length === 0 ? (
        <p>No concept explainers yet.</p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {artifacts?.map((artifact) => (
            <li key={artifact.slug}>
              <Card variant="bevel" asChild>
                <Link
                  className="grid min-h-11 gap-1 p-4 no-underline"
                  to={`/explain/${encodeURIComponent(artifact.slug)}`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <strong className="wrap-anywhere text-foreground">{artifact.title}</strong>
                    <time
                      className="shrink-0 text-sm text-muted-foreground"
                      dateTime={artifact.updatedAt}
                    >
                      {shortDate.format(new Date(artifact.updatedAt))}
                    </time>
                  </span>
                  <span className="text-sm text-muted-foreground">{artifact.summary}</span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="retro" asChild>
          <Link to="/roadmap">Back</Link>
        </Button>
      </div>
    </section>
  );
}
