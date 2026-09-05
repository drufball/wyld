# Wake

Wake has two processes: a long-lived HTTP daemon with a durable SQLite queue, and a short-lived
MCP channel adapter spawned by Claude Code. The adapter only calls the daemon; it never opens SQLite.

- Pak API: `PAK_URL` (defaults to `http://localhost:8787`)
- Wake daemon: loopback port `WAKE_PORT` (defaults to `8788`)
- Authentication: `WAKE_SECRET`; GitHub ingress also uses `GH_WEBHOOK_SECRET`
- Runtime data: `FACTORY_DIR` (defaults to `.factory/`)

Build with `pnpm --filter @wyld/wake build`, then run the daemon with
`pnpm --filter @wyld/wake start`. Start a Planner session and its registered `wake` adapter with:

```bash
claude --dangerously-load-development-channels server:wake
```

With the daemon running, enqueue a test event and display the queue depth with
`pnpm --filter @wyld/wake dev:emit '{"kind":"github.pr_opened","title":"test","pr":99}'`.
This sends a signed GitHub fixture through `/gh`, producing `PR #99 opened: test`. To send a human
event through `/event`, use
`pnpm --filter @wyld/wake dev:emit '{"kind":"human.feedback","summary":"Please inspect the queue"}'`.
A bare summary string is shorthand for a `human.intent` event.
