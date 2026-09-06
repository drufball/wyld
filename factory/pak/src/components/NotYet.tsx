import { Card } from './ui/card.js';

type NotYetProps = {
  name: string;
  purpose: string;
};

export function NotYet({ name, purpose }: NotYetProps) {
  return (
    <Card variant="bevel" className="p-5">
      <h1>{name}</h1>
      <p>{purpose}</p>
      <p className="text-muted-foreground">This part of the Pak is resting for now.</p>
    </Card>
  );
}
