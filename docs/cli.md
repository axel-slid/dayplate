# CLI

Run `node cli.cjs help` from the project directory. `dayplate` and `openplate` are equivalent aliases if the package is linked locally. Commands return JSON.

```sh
node cli.cjs day --date 2026-10-01
node cli.cjs list --search chicken
node cli.cjs food --id oats --name Oats --unit portion --calories 350 --protein 12 --carbs 55 --fat 9 --source 'Package label'
node cli.cjs log --meal oats --date 2026-10-01 --servings 0.5 --category Breakfast --id oats-20261001
node cli.cjs add --date 2026-10-01 --item 'food-eggs=2@Breakfast' --item 'food-milk@Breakfast' --id breakfast-20261001 --dry-run
node cli.cjs export
```

Dates use the local calendar. Nutrition values are per ingredient unit; ingredient amounts and logged servings multiply them. Missing macros remain null. Reusing a log ID with different data is an error.

`add` accepts repeated `--item ID_OR_EXACT_NAME[=SERVINGS][@CATEGORY]` arguments. A command-wide `--category` supplies the default category. Stable batch IDs assign entry IDs ending in `-1`, `-2`, etc.

## Atomic batches

`apply` accepts an operations array or an object containing `operations`, through `--file` or `--stdin`. Validate first, then apply the same file:

```sh
node cli.cjs apply --file changes.json --dry-run
node cli.cjs apply --file changes.json
```

```json
{"operations":[
  {"type":"meal.put","item":{"id":"eggs-toast","name":"Eggs & toast","category":"Breakfast","source":"Example estimate","ingredients":[{"name":"Eggs","amount":2,"unit":"egg","calories":72,"protein":6,"carbs":0.4,"fat":5}]}},
  {"type":"log","meal":"eggs-toast","date":"2026-10-01","servings":1,"id":"breakfast-20261001"},
  {"type":"goals.set","calories":2500,"protein":150},
  {"type":"weight.set","date":"2026-10-01","value":170,"unit":"lb"},
  {"type":"workout.put","item":{"id":"training-20261001","name":"Upper body","date":"2026-10-01","type":"Strength","minutes":45,"notes":"","exercises":[{"name":"Bench press","sets":3,"reps":8,"weight":95,"unit":"lb"}]}}
]}
```

Other operations include `food.put`, `entry.update`, `macros.fill`, and `workout.remove` (with `id`). `entry.update` takes an entry `id` and updated `date`, `servings`, `category`, or full `meal` snapshot.

`macros.fill` uses exact ingredient names and units, optionally narrowed by `calories` and `existingProtein`. It fills missing values unless `overwrite:true`. Set `library:false` to leave saved recipes alone; use `dates` to scope historical updates.

```json
{"operations":[{"type":"macros.fill","library":false,"dates":["2026-10-01"],"rules":[{"name":"Milk","unit":"glass (8 fl oz)","carbs":12,"fat":8,"source":"Example label"}]}]}
```

Workout types are `Strength`, `Cardio`, `Sport`, `Walking`, and `Other`. Duration, notes, and exercises are optional. Exercise sets and reps are positive integers; load can be zero and uses `lb` or `kg`.

## Storage

The CLI and Mac app share `journal.json`. Revision checks prevent stale edits; writes use a lock, a temporary file, an atomic rename, and a `.backup`. A crashed writer can leave `journal.lock`; remove it only after confirming no writer is active.

For isolated work, use `--data-dir PATH` or `DAYPLATE_DATA_DIR`. Tests use `DAYPLATE_TEST_DATA`. Do not edit the real journal directly or modify Electron browser storage.
