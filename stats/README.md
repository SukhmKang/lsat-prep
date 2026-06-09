# LSAT Stats Dashboard

A Vite + React + Tailwind dashboard for aggregations over `../combined_test_results.json`
(2,780 practice questions across 28 preptests).

## Architecture

Aggregation happens in Python so the browser never downloads the full 6.3MB dataset:

```
combined_test_results.json  ──build_stats.py──▶  src/data/stats.json  ──▶  React UI
```

## Usage

```bash
npm install
npm run stats     # rebuild src/data/stats.json from the source JSON (uses ../venv)
npm run dev       # start the dashboard at http://localhost:5173
npm run build     # production build to dist/
```

Whenever `combined_test_results.json` changes, re-run `npm run stats`.

### Fine-grained question categories (optional, uses the Claude API)

Each question can be classified into a fine-grained LSAT category (e.g. `flaw`,
`necessary_assumption`, `inference`, `function`). This calls the Claude API once
per question, so it is **opt-in** and cached:

```bash
cp .env.example .env          # then paste your ANTHROPIC_API_KEY
npm run classify              # classify all uncached questions (Haiku, ~8 min for 2,780)
npm run stats                 # rebuild stats.json (reads the cache)
# or in one step:
npm run stats:classify        # classify uncached, then rebuild
```

- Results are cached in `classifications.json`; re-runs only hit the API for
  questions not yet classified (resumable).
- Model defaults to `claude-haiku-4-5`. Override for the confusable pairs:
  `../venv/bin/python classify_questions.py --model claude-sonnet-4-6`.
- Dry-run a single test first: `../venv/bin/python classify_questions.py --source lsac_preptest_101`.
- The model's output is coerced to a Pydantic Enum, so any off-list label raises
  rather than being silently stored.

## What it shows

- Overall accuracy, incorrect count, flagged count, preptest count
- Accuracy by preptest (timeline)
- Accuracy by question # within a section, and by global question # across the whole test
- Accuracy by question type (LR vs RC) and by section position
- Accuracy by fine-grained LR/RC category (after running the classifier)
- Answer-letter distribution: correct key vs. selected
- Per-letter accuracy
- RC error concentration (are misses clustered within a passage or spread across passages?)
- Flagging insight (flagged vs. unflagged accuracy)
