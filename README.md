# wyld

## Running the factory

Prepare a fresh checkout, generate the local factory secrets, and install dependencies:

```bash
./scripts/bootstrap.sh
```

Start the factory with `pnpm factory:up`. It creates a `wyld` tmux session containing windows for
the Pak API server (`server`), Wake daemon (`wake`), Pak UI (`pak`, when available), GitHub webhook
forwarder (`webhook`), Claude Code Planner (`planner`), and macOS sleep prevention (`caffeinate`).
Attach with `tmux attach -t wyld`.

Run `pnpm factory:doctor` to diagnose dependencies, credentials, services, ports, and tmux windows.
Stop every factory window with `pnpm factory:down`.

The Planner uses the channels research-preview development flag required for the local Wake MCP
server. See [`factory/planner/reference/channels.md`](factory/planner/reference/channels.md) for the
verified channel contract and why the standard allowlisted-plugin flag is not used.

## Explainer artifacts

`/artifacts/:slug/` serves an explainer as one self-contained HTML document. It may use inline CSS
and JavaScript but no external URLs. The response uses a strict CSP, and the Pak embeds it in an
`allow-scripts`-only sandbox without same-origin access.

Commentable elements use `data-pin="<id>"` and may supply a human-readable
`data-pin-label="…"`. For pins to work, the document must embed `PIN_BRIDGE_SNIPPET` from
`factory/pak/src/lib/pin-bridge.ts` immediately before `</body>`. Without it, the Pin button remains
disabled.

| Message                              | Direction         | Purpose                                             |
| ------------------------------------ | ----------------- | --------------------------------------------------- |
| `wyld:pin:ready`                     | artifact → viewer | Announces that the bridge is ready.                 |
| `wyld:pin:mode`                      | viewer → artifact | Enables or disables picking.                        |
| `wyld:pin:pick`                      | artifact → viewer | Reports the selected element, label, and rectangle. |
| `wyld:pin:locate` / `wyld:pin:rects` | viewer ↔ artifact | Requests and returns marker rectangles.             |
