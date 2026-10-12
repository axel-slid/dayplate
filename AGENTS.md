# Dayplate / Openplate

For journal tasks, use the `dayplate` CLI (`openplate` is an alias), or `node cli.cjs` from the project directory.

- Inspect `dayplate day --date YYYY-MM-DD` and `dayplate list` before logging to avoid duplicates.
- Use explicit local dates and stable `--id` values for retryable logs.
- Use `dayplate apply --file PATH --dry-run` to validate multi-item updates, then apply the same file. See docs/cli.md for operation schemas.
- Include calories, protein, carbs, fat, and source in each ingredient when known. Nutrition values are per unit; `amount` and entry `servings` multiply them. Mark portion assumptions and estimates in sources. Never turn unknown macros into zero.
- Preserve journal history and recipe snapshots. Use scoped `macros.fill` or `entry.update` for requested corrections; recipe edits alone affect future logs.
- The CLI shares journal.json with the desktop app. Do not modify Electron LevelDB/localStorage, use DevTools, or rewrite journal.json directly.
- If migration has not completed, open the upgraded desktop app once. Each device stores its own journal.
- For code changes run `npm test`. Use an isolated `--data-dir` / `DAYPLATE_TEST_DATA` for tests, never the real journal.
