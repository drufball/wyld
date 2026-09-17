# Bigger on screen verification

All measurements below are **simulated** by the viewport and HUD unit runs at a 375 × 812 viewport.
No values are labelled played because a browser executable was unavailable in this run.

| Look and URL                              | Pixel scale | Flat tile CSS size |              Grid |        Out card |    Reserve card |     Move button |
| ----------------------------------------- | ----------: | -----------------: | ----------------: | --------------: | --------------: | --------------: |
| diorama `/?scenario=arena`                | simulated 3 |    simulated 48 px |  simulated 7 × 16 | simulated 56 px | simulated 56 px | simulated 56 px |
| flat `/?look=flat&scenario=arena`         | simulated 3 |    simulated 48 px |  simulated 7 × 16 | simulated 56 px | simulated 56 px | simulated 56 px |
| diorama `/?scenario=arena&scale=2`        | simulated 2 |    simulated 32 px | simulated 11 × 22 | simulated 44 px | simulated 44 px | simulated 44 px |
| flat `/?look=flat&scenario=arena&scale=2` | simulated 2 |    simulated 32 px | simulated 11 × 22 | simulated 44 px | simulated 44 px | simulated 44 px |

The flat tile CSS sizes are the simulated `cols * 16 * scale / cols` results. The diorama rows
exercise the same shared scale, column, and row functions as flat rendering. Uptime is not recorded
because none of these measurements are labelled played.
