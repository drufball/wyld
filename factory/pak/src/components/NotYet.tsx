import { Panel } from './Panel.js';

type NotYetProps = {
  name: string;
  purpose: string;
};

export function NotYet({ name, purpose }: NotYetProps) {
  return (
    <Panel>
      <h1>{name}</h1>
      <p>{purpose}</p>
      <p className="pak-dim">This part of the Pak is resting for now.</p>
    </Panel>
  );
}
