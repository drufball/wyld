# Move WYLD to a new machine

## 0. Before you can point Claude at this file

The human does these steps by hand:

1. Finish macOS Setup Assistant: create an admin user and save the password. Later steps prompt for `sudo`.
2. Open Terminal and run `git --version` once. macOS offers to install the Command Line Tools; accept and wait for it to finish.
3. Install Claude Code:
   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   ```
4. Run `claude` once and complete the login.
5. Clone WYLD:
   ```bash
   git clone https://github.com/drufball/wyld.git && cd wyld
   ```
6. Start `claude` in that directory and say: **"follow NEW-MACHINE.md"**.

From here on, the assistant installs everything itself and stops only at the logins that need a human.

## 1. Who you are

You are the setup assistant running on the new Mac, with the human beside you.

- Never edit values in `.factory/env` unless explicitly told to. Only change `PAK_PUBLIC_URL`, `NTFY_URL`, and `NTFY_BASE_URL`, and only after the human confirms the new hostname.
- Never print or echo secrets.
- The human performs every login themselves.

## 2. Install tools and complete logins

The assistant installs, in this order:

1. Homebrew. This prompts for `sudo` once:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   On Apple silicon, run the follow-up `eval "$(/opt/homebrew/bin/brew shellenv)"` step printed by the installer.
2. Node 22:
   ```bash
   brew install node@22
   ```
   `node@22` is keg-only. Add the PATH line Homebrew prints, `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`, to `~/.zprofile` before `node --version` reports 22, which is what `.node-version` pins.
3. Docker runtime:
   ```bash
   brew install colima docker
   colima start --cpu 2 --memory 2
   brew services start colima
   docker info
   ```
   Any Docker-compatible runtime (Colima, Docker Desktop, OrbStack or Rancher Desktop) works; only `docker info` answering matters.
4. GitHub CLI: `brew install gh`.
5. tmux: `brew install tmux`.
6. Tailscale: `brew install --cask tailscale`.

The human does these steps; the assistant stops and waits at each:

1. Sign in to the Tailscale app from its menu-bar icon on the **same tailnet**. After sign-in, the `tailscale` CLI must be on PATH. The cask installs only the app: use the menu-bar item that installs the CLI helper, or create the same shim the old machine has at `/usr/local/bin/tailscale`:
   ```bash
   printf '#!/bin/sh\n/Applications/Tailscale.app/Contents/MacOS/tailscale "$@"\n' \
     | sudo tee /usr/local/bin/tailscale >/dev/null
   sudo chmod +x /usr/local/bin/tailscale
   tailscale status          # verify
   tailscale serve --bg 8787
   tailscale serve --bg --https=8443 8790
   ```
2. Run `gh auth login`, choose **HTTPS** when prompted for the protocol (no SSH key to manage), then verify and install the extension:
   ```bash
   gh auth status
   gh extension install cli/gh-webhook
   ```
3. Complete the ChatGPT login: `npx -y @openai/codex@latest login`.
4. Set the machine to never sleep on power: System Settings → Displays → Advanced → “Prevent automatic sleeping on power adapter when the display is off,” or use the Energy pane on older macOS. `pnpm factory:up` runs `caffeinate` for the rest.

## 3. Bootstrap

The clone was completed in step 0. From the repo root, run:

```bash
./scripts/bootstrap.sh
```

## 4. Receive the bundle

On the old machine:

```bash
./scripts/factory-export.sh
# Default output: ~/Desktop/wyld-factory-<YYYYMMDD-HHMM>.tgz
tailscale file cp ~/Desktop/wyld-factory-<YYYYMMDD-HHMM>.tgz <new-host>:
```

On this machine (AirDrop is also acceptable):

```bash
tailscale file get .
pnpm factory:import <tgz>
```

Once the import is verified, delete the `.tgz` from both machines: it contains `WAKE_SECRET`, `GH_WEBHOOK_SECRET`, and `CLAUDE_CODE_OAUTH_TOKEN`.

## 5. Edit the machine-specific env lines

Find this machine's tailnet name and strip its trailing dot. The human must confirm it before any edit:

```bash
tailscale status --self --json | jq -r .Self.DNSName
# Fallback without jq:
tailscale status --self --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).Self.DNSName.replace(/\.$/,"\n")))'
```

After confirmation:

- Set `PAK_PUBLIC_URL=https://<name>` in `.factory/env`.
- Leave `NTFY_URL=http://localhost:8790` unless it names the old host; if it does, set it to the appropriate new-machine value.
- ntfy derives its public address from this machine's tailnet name at `pnpm factory:up`; setting `NTFY_BASE_URL=https://<name>:8443` in `.factory/env` overrides it.
- `./scripts/ntfy-up.sh --render-only` renders `.factory/ntfy/server.yml` without starting the container — useful to check the address before Docker is up.
- Do not change or display any other `.factory/env` value.

## 6. Start and check

```bash
pnpm factory:up
pnpm factory:doctor
```

Good means the doctor ends with `Summary: N ok, ... 0 fail`, includes `ok: Planner is running as the host (...)`, and `https://<new name>` loads the Pak from the phone.

The Planner starts a **fresh** session on this machine. `planner-session.json` is deliberately not exported because its transcript remains in `~/.claude` on the old Mac; the new session picks up context from `factory/planner/STATE.md` and open work on GitHub.

## 7. Re-subscribe the phone

In the ntfy app, add the new subscription `https://<new name>:8443/wyld-pak`. The old subscription is dead.

## 8. Handoff rule

Keep the OLD machine running until the new one is verified. Only then run `pnpm factory:down` on the old machine. Never run two factories on one tailnet at once: two Wakes both claim the queue, and two ntfy Serves fight for the same name.

## 9. Troubleshooting

- `corepack enable` fails with a permissions error: re-run it as `sudo corepack enable`.
- `node --version` is not 22 after `brew install node@22`: the keg-only PATH line is missing from `~/.zprofile`.
- `no Planner is running`: run `pnpm factory:down && pnpm factory:up`, then check the planner window.
- `two Planners are running`: stop either the host or CLI Planner so only one claims Wake events.
- `the container runtime is not answering`: run `colima start` (or start whichever Docker-compatible runtime is installed), then retry `docker info`.
- `Tailscale Serve is not configured on port 8443`: run `tailscale serve --bg --https=8443 8790`.
- `ntfy config names ... but this machine is ...`: set `NTFY_BASE_URL` in `.factory/env` (or clear it), then run `pnpm factory:up`.
- `gh webhook extension is not installed`: run `gh extension install cli/gh-webhook`.
- `.factory/pak.sqlite is missing`: obtain the old-machine bundle and run `pnpm factory:import <tgz>`.
- `Node version is ... but Node 22 is required`: install the `.node-version` release and reactivate that Node version.
