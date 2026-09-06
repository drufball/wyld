# Move WYLD to a new machine

## 1. Who you are

You are the setup assistant running on the new Mac, with the human beside you.

- Never edit values in `.factory/env` unless explicitly told to. Only change `PAK_PUBLIC_URL` and `NTFY_URL`, and only after the human confirms the new hostname.
- Never print or echo secrets.
- The human performs every login themselves.

## 2. Prerequisites the human installs / logs into

- Xcode Command Line Tools and Git: run `xcode-select --install` if needed; verify with `xcode-select -p` and `git --version`.
- Node 22 is pinned in `.node-version`: use `nvm install $(cat .node-version)` or `brew install node@22`; verify with `node --version`.
- Start Rancher Desktop; verify with `PATH="$HOME/.rd/bin:$PATH" docker info`.
- Log Tailscale into the **same tailnet**; verify with `tailscale status`, then run `tailscale serve --bg 8787` and `tailscale serve --bg --https=8443 8790`.
- GitHub CLI: the human runs `gh auth login`; verify with `gh auth status`, then run `gh extension install cli/gh-webhook`.
- Codex ChatGPT login: the human runs `npx -y @openai/codex@latest login`.
- tmux: run `brew install tmux`; verify with `tmux -V`.
- `claude` itself is already logged in if this session is running.

## 3. Clone and bootstrap

```bash
git clone https://github.com/drufball/wyld.git
cd wyld
./scripts/bootstrap.sh
```

## 4. Receive the bundle

On the old machine:

```bash
./scripts/factory-export.sh
tailscale file cp <tgz> <new-host>:
```

On this machine (AirDrop is also acceptable):

```bash
tailscale file get .
pnpm factory:import <tgz>
```

## 5. Edit the two env lines

Find this machine's tailnet name and strip its trailing dot. The human must confirm it before any edit:

```bash
tailscale status --self --json | jq -r .Self.DNSName
# Fallback without jq:
tailscale status --self --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).Self.DNSName.replace(/\.$/,"\n")))'
```

After confirmation:

- Set `PAK_PUBLIC_URL=https://<name>` in `.factory/env`.
- Leave `NTFY_URL=http://localhost:8790` unless it names the old host; if it does, set it to the appropriate new-machine value.
- Set `base-url: 'https://<name>:8443'` in `factory/ntfy/server.yml`.
- Do not change or display any other `.factory/env` value.

## 6. Start and check

```bash
pnpm factory:up
pnpm factory:doctor
```

Good means the doctor ends with `Summary: N ok, ... 0 fail`, includes `ok: Planner is running as the host (...)`, and `https://<new name>` loads the Pak from the phone.

## 7. Re-subscribe the phone

In the ntfy app, add the new subscription `https://<new name>:8443/wyld-pak`. The old subscription is dead.

## 8. Handoff rule

Keep the OLD machine running until the new one is verified. Only then run `pnpm factory:down` on the old machine. Never run two factories on one tailnet at once: two Wakes both claim the queue, and two ntfy Serves fight for the same name.

## 9. Troubleshooting

- `no Planner is running`: run `pnpm factory:down && pnpm factory:up`, then check the planner window.
- `two Planners are running`: stop either the host or CLI Planner so only one claims Wake events.
- `the container runtime is not answering`: start Rancher Desktop and retry `PATH="$HOME/.rd/bin:$PATH" docker info`.
- `Tailscale Serve is not configured on port 8443`: run `tailscale serve --bg --https=8443 8790`.
- `gh webhook extension is not installed`: run `gh extension install cli/gh-webhook`.
- `.factory/pak.sqlite is missing`: obtain the old-machine bundle and run `pnpm factory:import <tgz>`.
- `Node version is ... but Node 22 is required`: install the `.node-version` release and reactivate that Node version.
