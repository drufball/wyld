# Claude Code channels — verified contract

Verified 2026-09-05 against Claude Code **v2.1.223** (local) and the official docs.

Sources:

- <https://code.claude.com/docs/en/channels-reference> — the build-your-own contract
- <https://code.claude.com/docs/en/channels> — install/enable, `--channels`, security, org controls

Channels are a **research preview**. The docs state plainly: "the `--channels` flag syntax and
protocol contract may change based on feedback." Re-verify this file whenever Wake misbehaves.

## The short version

1. A channel is an **MCP server over stdio** that Claude Code **spawns as a subprocess**.
2. It declares `capabilities.experimental['claude/channel'] = {}`.
3. It pushes events with `mcp.notification({ method: 'notifications/claude/channel', params: { content, meta } })`.
4. The user opts the server in **per session** with a CLI flag. Being in `.mcp.json` is not enough.

## Registration and naming

Register like any MCP server — project `.mcp.json`, user `~/.claude.json`, or `--mcp-config <file>`:

```json
{
  "mcpServers": {
    "wake": { "command": "node", "args": ["./factory/wake/dist/channel.js"] }
  }
}
```

The key (`wake`) is the server name. It becomes the `source` attribute on the `<channel>` tag and
the identifier used by the CLI flags.

Claude Code reads MCP config at startup and spawns each server. On first run in a project it asks
for consent: "New MCP server found in this project: wake" → **Use this MCP server**.

## Starting the session — IMPORTANT deviation from factory-spec.md §2.2

The spec says `claude --channels wake`. **That does not work for Wake during the research preview.**

`--channels` only accepts **plugins on an Anthropic-curated allowlist** (currently the channel
plugins in `claude-plugins-official`: telegram, discord, imessage, fakechat), or an org's
`allowedChannelPlugins` list on Team/Enterprise. A bare `.mcp.json` server like Wake is not on it,
so `--channels wake` starts the session normally but the channel silently never registers.

For a custom channel, use the development flag with a `server:` or `plugin:` prefixed entry:

```bash
# Wake, as a bare .mcp.json server — this is what factory-up.sh runs
claude --dangerously-load-development-channels server:wake
```

Notes:

- The bypass is **per entry**. Combining it with `--channels` does not extend the bypass to the
  `--channels` entries.
- Interactive sessions show a full-screen warning listing the development channels; choose
  "I am using this for local development".
- A dim startup notice confirms registration:
  `Channels (experimental) messages from server:wake inject directly in this session · restart without --dangerously-load-development-channels to stop`.
- Neither `--channels` nor `--dangerously-load-development-channels` appears in `claude --help`
  while the feature is in preview. **Verified locally on v2.1.223**: both are accepted by the
  argument parser (an invented flag errors with `unknown option`), so the flags are real and hidden.
- To get off the development flag later, package Wake as a plugin in a marketplace — but a plugin
  on your own marketplace still needs the development flag unless Anthropic lists it officially or
  an admin adds it to `allowedChannelPlugins`. For a single-founder Pro/Max account there is no
  such admin path, so **expect to stay on `--dangerously-load-development-channels` indefinitely.**

## Availability gates

- Requires Anthropic auth via claude.ai or a Console API key. **Not available on Bedrock, Vertex
  (Agent Platform), or Microsoft Foundry.**
- Pro/Max users with no organization: available, opt in per session. This is Dru's case.
- Team/Enterprise: blocked until an Owner enables `channelsEnabled`.
- If `MCP_PROTOCOL_NEGOTIATION=auto` on the v2 MCP client runtime, a server negotiating protocol
  revision `2026-07-28` is **not** registered as a channel. Do not set that env var for the Planner.

## Server options

```ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const mcp = new Server(
  { name: 'wake', version: '0.0.1' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} }, // required, always {}; presence registers the listener
      tools: {}, // only if the server exposes tools (Wake does: pak.*)
    },
    instructions: '…delivered to Claude as context when the server connects…',
  },
);
```

| Field                                                    | Type              | Notes                                                                              |
| -------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| `capabilities.experimental['claude/channel']`            | `object`          | Required. Always `{}`.                                                             |
| `capabilities.experimental['claude/channel/permission']` | `object`\|`false` | Optional; opts into permission relay. Omit it. (Before v2.1.234 `false` counted as declared — so **omit the key entirely**, do not set `false`, on our v2.1.223.) |
| `capabilities.tools`                                     | `object`          | Standard MCP. `{}` to expose tools.                                                |
| `instructions`                                           | `string`          | Injected as context on connect. Tell the Planner what the tag attributes mean.      |

## Notification format

```ts
await mcp.notification({
  method: 'notifications/claude/channel',
  params: {
    content: 'Codex pushed 6 commits to PR #12',
    meta: { severity: 'high', run_id: '1234' },
  },
});
```

- `content: string` — becomes the body of the `<channel>` tag.
- `meta: Record<string, string>` — optional; each entry becomes an attribute.
  **Keys must be identifiers: letters, digits, underscores only. Keys with hyphens or other
  characters are silently dropped.** (So: `quest`, `issue`, `pr`, `url`, `ts`, `kind` — never
  `quest-id`.) Values must be strings.

Arrives in the Planner's context as:

```text
<channel source="wake" severity="high" run_id="1234">
Codex pushed 6 commits to PR #12
</channel>
```

`source` is set automatically from the server's configured name. (A plugin-scoped server uses a
scoped name, e.g. `plugin:fakechat:fakechat`; a bare `.mcp.json` server uses its plain key.) The
terminal renders a one-line summary `← wake: …`, not the raw tag.

### Delivery semantics — read this before designing the queue

- **There is no acknowledgement.** `await mcp.notification()` resolves when the message is written
  to the transport, not when Claude has processed it.
- If the session did not load the server as a channel, or org policy blocks it, **events are dropped
  silently with no error to the server**. A "successful" send proves nothing.
- Events queue into the session and are **processed in order**; several arriving while Claude is
  busy are delivered together on the next turn and handled as a group.
- Concurrency is per session: to process independent streams concurrently, run separate sessions.

Consequence for Wake: the durable SQLite queue must live in a **separate long-lived daemon**, not in
the process Claude Code spawns. The channel adapter marks a message delivered on a best-effort
basis; delivery confirmation, if we ever need it, must come from the Planner calling a tool back.

Known upstream bugs to be aware of (channel notifications not surfacing in a session):
[#36827](https://github.com/anthropics/claude-code/issues/36827),
[#45563](https://github.com/anthropics/claude-code/issues/45563),
[#61797](https://github.com/anthropics/claude-code/issues/61797) (idle-session delivery).

## Reply tools (two-way)

Nothing channel-specific: add `tools: {}` to capabilities and register
`ListToolsRequestSchema` / `CallToolRequestSchema` handlers as with any MCP server. Use
`instructions` to tell Claude when to call them and which tag attribute to pass back.

## Sender gating

The docs are explicit: "An ungated channel is a prompt injection vector. Anyone who can reach your
endpoint can put text in front of Claude." Check the sender **before** calling `mcp.notification()`
and **drop silently** — never return a distinguishable error. Gate on sender identity, not room or
channel identity.

For Wake: GitHub HMAC `X-Hub-Signature-256` (constant-time compare) and the Pak server's
`X-Wake-Secret`. Everything else → 204, debug log, no delivery.

## Permission relay (not used by Wake)

`notifications/claude/channel/permission_request` forwards tool approval prompts to a channel that
declares `capabilities.experimental['claude/channel/permission']`. Wake does **not** declare it: the
Planner runs on the same machine as the founder, and relay would let anyone who can reach Wake's
HTTP port approve tool use. Revisit only if the Planner ever runs headless behind Tailscale.

## Requirements

`@modelcontextprotocol/sdk` (verified against **1.30.0**) on any Node-compatible runtime. The
official plugins use Bun; Wake uses Node 22 per `AGENTS.md`. Bun is **not** required for a custom
channel.

## What was verified locally vs. read from docs

| Claim                                                            | How verified                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `--channels` / `--dangerously-load-development-channels` exist    | Accepted by v2.1.223's parser; a bogus flag errors. Not in `--help`. |
| Claude Code spawns the stdio server and it connects               | Probe server logged `connected` when launched via `--mcp-config` + dev flag |
| Capability key, notification method, `content`/`meta` shape       | Docs only (verbatim from the reference page)                    |
| A `<channel>` tag actually reaching the model's context           | **Not verified** — the probe `claude -p` run failed with `Failed to authenticate: OAuth session expired` (a nested-session auth artifact, unrelated to channels). Confirm on the first real Planner restart. |
