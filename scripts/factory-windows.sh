# shellcheck shell=bash
# Sourced by factory-up.sh and factory-doctor.sh after .factory/env is loaded.
# Expects WAKE_PORT and PLANNER_MODE to be set.

factory_window_names() {
  printf '%s\n' server wake pak ops webhook planner
  if [[ "$(uname -s)" == Darwin ]]; then
    printf '%s\n' caffeinate
  fi
}

factory_window_command() {
  case "$1" in
    server) printf '%s' 'pnpm --filter @wyld/server dev' ;;
    wake) printf '%s' 'pnpm --filter @wyld/wake dev' ;;
    pak) printf '%s' 'pnpm --filter @wyld/pak dev' ;;
    ops) printf '%s' 'pnpm --filter @wyld/ops dev' ;;
    webhook)
      printf '%s' "until gh webhook forward --repo drufball/wyld --events '*' --url 'http://localhost:${WAKE_PORT}/gh' --secret \"\$GH_WEBHOOK_SECRET\"; do echo 'webhook forward exited; restarting in 5s'; sleep 5; done"
      ;;
    planner)
      if [[ "$PLANNER_MODE" == host ]]; then
        printf '%s' "set -a; . .factory/env; set +a; until node factory/planner-host/dist/main.js; do echo 'planner host exited; restarting in 5s'; sleep 5; done"
      else
        printf '%s' 'claude --dangerously-load-development-channels server:wake'
      fi
      ;;
    caffeinate) printf '%s' 'caffeinate -s' ;;
    *) return 1 ;;
  esac
}
