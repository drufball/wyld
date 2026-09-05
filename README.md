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
