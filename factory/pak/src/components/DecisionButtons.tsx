import { Button } from './ui/button.js';

export function DecisionButtons({
  id,
  options,
  deciding,
  failed,
  decide,
}: {
  id: string;
  options: string[];
  deciding: boolean;
  failed: string | null;
  decide: (id: string, chosen: string) => void;
}) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <Button
            className="w-full wrap-anywhere"
            variant="retro"
            key={option}
            type="button"
            disabled={deciding}
            onClick={() => decide(id, option)}
          >
            {option}
          </Button>
        ))}
      </div>
      {failed !== null && (
        <p className="m-0 text-muted-foreground">
          That didn't go through.{' '}
          <Button variant="ghost" type="button" onClick={() => decide(id, failed)}>
            Retry
          </Button>
        </p>
      )}
    </>
  );
}
