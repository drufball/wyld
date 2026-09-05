import { OpsReport } from '@wyld/shared';
import { readConfig } from './config.js';
import { readGithubStatus } from './github.js';
import { log } from './logger.js';
import { readTokensToday } from './usage.js';

const config = readConfig();
let stopped = false;
let timer: NodeJS.Timeout | undefined;

async function cycle(): Promise<void> {
  try {
    const [github, tokensToday] = await Promise.all([
      readGithubStatus(config.repo),
      readTokensToday(config.usageDir, new Date()),
    ]);
    const report = OpsReport.parse({ ...github, ...(tokensToday === undefined ? {} : { tokensToday }) });
    const response = await fetch(`${config.pakUrl.replace(/\/$/, '')}/api/ops/report`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Pak returned HTTP ${response.status}`);
    log('info', 'ops report posted', { report });
  } catch (error) {
    log('error', 'ops report cycle failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

async function tick(): Promise<void> {
  await cycle();
  if (!stopped) timer = setTimeout(() => void tick(), config.intervalSeconds * 1000);
}
function stop(signal: string): void {
  stopped = true;
  if (timer) clearTimeout(timer);
  log('info', 'ops reporter stopped', { signal });
}
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
void tick();
