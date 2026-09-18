# wyld

## Running the factory

Prepare a fresh checkout, generate the local factory secrets, and install dependencies:

```bash
./scripts/bootstrap.sh
```

Start the factory with `pnpm factory:up`. It creates a `wyld` tmux session containing windows for
the Pak API server (`server`), Wake daemon (`wake`), Pak UI (`pak`), operations watchdog (`ops`),
GitHub webhook forwarder (`webhook`), Planner (`planner`), and macOS sleep prevention
(`caffeinate`). The Planner uses the SDK host by default; set `PLANNER_MODE=cli` in `.factory/env`
to run it directly in Claude Code instead. Attach with `tmux attach -t wyld`.

Run `pnpm factory:doctor` to diagnose dependencies, credentials, services, ports, and tmux windows.
Restart exactly one window with the command `factory-up.sh` would use by running
`pnpm factory:restart <window>`; valid names are `server`, `wake`, `pak`, `ops`, `webhook`, and
`planner` (plus `caffeinate` on macOS). Pass `--dry-run` to preview the preparation and respawn
commands without running them. Restarting `planner` also takes down Wake, so no leads may be
running; the planner window is rebuilt before it is respawned. The `ops` process now runs under
`tsx watch` in development, so merged ops changes are picked up without a restart.
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

| Message                              | Direction         | Purpose                                                                                                                                              |
| ------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wyld:pin:hello`                     | viewer → artifact | Asks the bridge to announce itself; sent when the viewer attaches and on every frame load.                                                           |
| `wyld:pin:ready`                     | artifact → viewer | Announces that the bridge is ready.                                                                                                                  |
| `wyld:pin:key`                       | artifact → viewer | Reports whether the pin modifier (⌘ on Mac, Ctrl elsewhere) is held.                                                                                 |
| `wyld:pin:mode`                      | viewer → artifact | Enables or disables picking.                                                                                                                         |
| `wyld:pin:pick`                      | artifact → viewer | Reports the selected element, label, and rectangle.                                                                                                  |
| `wyld:pin:locate` / `wyld:pin:rects` | viewer ↔ artifact | Requests and returns marker rectangles.                                                                                                              |
| `wyld:pin:capture`                   | viewer → artifact | Asks for a capture of the embedded demo (`iframe[data-wyld-demo]`) inside the named element; the artifact forwards `wyld:demo:capture` to the embed. |
| `wyld:pin:capture:result`            | artifact → viewer | Returns `{ screenshot, state }` for the capture id, or `null` when there is no embed or it does not answer in time.                                  |
