# Planner host

The Planner host is the long-lived Claude Agent SDK process that claims Pak events, feeds them to
the Planner session, and reports its health. `scripts/factory-up.sh` launches it in the tmux
`wyld:planner` window when `PLANNER_MODE=host`.

`GET http://127.0.0.1:$PLANNER_HOST_PORT/health` returns `ok`, the session id, last turn time,
observed queue depth, restart count, current `model`, and (while refused) `modelLimited` with
`since`, optional `until`, and `primary`.

## Environment

| Variable                         | Meaning / default                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `PLANNER_HOST_PORT`              | Local health port (`8789`).                                                                                                                    |
| `PLANNER_HOST_HEARTBEAT_SECONDS` | Pak heartbeat interval (`120`); `0` disables it.                                                                                               |
| `PLANNER_HOST_MODEL`             | Primary SDK model (`claude-fable-5-1`).                                                                                                        |
| `PLANNER_HOST_FALLBACK_MODEL`    | Optional second model on the same account; empty disables fallback. The host, not the SDK, owns the switch so reported health matches reality. |
| `PLANNER_HOST_MODEL_RETRY_MS`    | Primary-model probe cadence while on fallback (`1800000`).                                                                                     |
| `PLANNER_HOST_POLL_MS`           | Event queue polling interval (`2000`).                                                                                                         |
| `PLANNER_HOST_IDLE_TIMEOUT_MS`   | Query watchdog timeout (`900000`).                                                                                                             |
| `PLANNER_HOST_MAX_TURNS`         | Optional SDK turn limit.                                                                                                                       |
| `PLANNER_HOST_FIRST_MESSAGE`     | Optional fresh-session opening prompt.                                                                                                         |
| `PLANNER_HOST_CLAUDE_PATH`       | Optional Claude executable path.                                                                                                               |

The host also consumes shared factory settings such as `FACTORY_DIR`, `WAKE_PORT`, `WAKE_SECRET`,
and `PAK_URL`; the table lists every variable with the `PLANNER_HOST_` prefix that it reads.
