"""Classify each LSAT question into a fine-grained category with Claude.

Logical Reasoning and Reading Comprehension use different prompts + category
enums (defined below). The model's output is coerced to a Pydantic model whose
`category` field is an Enum, so anything off-list raises during parsing — we do
not silently accept an invalid label.

This is the expensive step (one API call per question). It is NOT run as part
of the normal stats build. Results are cached per-question in
`stats/classifications.json`; only questions missing from the cache are sent to
the API, so re-runs are cheap and resumable.

Usage (from repo root, via the project venv):
    ./venv/bin/python stats/classify_questions.py            # classify uncached
    ./venv/bin/python stats/classify_questions.py --force    # re-classify all

Or through the stats build:
    ./venv/bin/python stats/build_stats.py --classify

Requires ANTHROPIC_API_KEY in stats/.env (see .env.example).
"""
import argparse
import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from enum import Enum
from pathlib import Path

import anthropic
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "combined_test_results.json"
CACHE = ROOT / "stats" / "classifications.json"
ENV_FILE = ROOT / "stats" / ".env"

# Haiku is the default: this is constrained, rubric-guided, single-label
# classification with a structured-output enum, which Haiku handles well at ~3x
# lower cost/latency than Sonnet. Override with --model for the confusable pairs.
DEFAULT_MODEL = "claude-haiku-4-5"
MAX_WORKERS = 12  # API requests run concurrently so a full run isn't serial-slow


# --- Category enums -------------------------------------------------------

class LRCategory(str, Enum):
    must_be_true = "must_be_true"
    most_strongly_supported = "most_strongly_supported"
    cannot_be_true = "cannot_be_true"
    main_point = "main_point"
    point_at_issue = "point_at_issue"
    method_of_reasoning = "method_of_reasoning"
    role_in_argument = "role_in_argument"
    necessary_assumption = "necessary_assumption"
    sufficient_assumption = "sufficient_assumption"
    strengthen = "strengthen"
    weaken = "weaken"
    evaluate = "evaluate"
    resolve_paradox = "resolve_paradox"
    flaw = "flaw"
    parallel_reasoning = "parallel_reasoning"
    parallel_flaw = "parallel_flaw"
    principle_strengthen = "principle_strengthen"
    principle_apply = "principle_apply"


class RCCategory(str, Enum):
    main_point = "main_point"
    primary_purpose = "primary_purpose"
    author_attitude = "author_attitude"
    function = "function"
    inference = "inference"
    detail = "detail"
    meaning_in_context = "meaning_in_context"
    analogy_application = "analogy_application"
    strengthen = "strengthen"
    weaken = "weaken"


class LRClassification(BaseModel):
    category: LRCategory
    stem_features: str
    alternate_categories: list[LRCategory]


class RCClassification(BaseModel):
    category: RCCategory
    stem_features: str
    is_comparative: bool
    alternate_categories: list[RCCategory]


# --- Prompts (static system text; the per-question INPUT goes in the user turn) ---

LR_SYSTEM = """You are an expert LSAT question classifier. Classify this Logical Reasoning
question into exactly one category from the enum.

RULES
- Choose only from the enum below. Never output a category not in the list.
- Use the STEM as primary evidence. Consult the stimulus or answer choices only
  when the stem alone is ambiguous (mainly: parallel_reasoning vs parallel_flaw,
  and principle_strengthen vs principle_apply).
- Always return exactly one category. If unsure, still pick the single best one
  and put the runner-up(s) in alternate_categories.

ENUM
must_be_true, most_strongly_supported, cannot_be_true, main_point,
point_at_issue, method_of_reasoning, role_in_argument, necessary_assumption,
sufficient_assumption, strengthen, weaken, evaluate, resolve_paradox, flaw,
parallel_reasoning, parallel_flaw, principle_strengthen, principle_apply

DISAMBIGUATORS (the pairs that get confused)
- must_be_true vs most_strongly_supported: MBT = the answer is guaranteed by the
  stimulus ("must be true", "properly inferred"). MSS = best-supported but allows
  uncertainty ("most strongly supported", "most reasonably concluded").
- necessary_assumption vs sufficient_assumption: necessary = the argument
  REQUIRES it ("depends on", "requires", "assumes"). sufficient/justify =
  assuming it GUARANTEES the conclusion ("if assumed, the conclusion follows",
  "justifies the conclusion").
- strengthen / weaken vs flaw: strengthen/weaken add a NEW fact that helps or
  hurts. flaw NAMES the reasoning error itself (descriptive).
- method_of_reasoning vs role_in_argument: method = technique of the WHOLE
  argument ("proceeds by", "argumentative strategy"). role = function of ONE
  specified statement ("the claim that X plays which role").
- principle_strengthen vs principle_apply: justify = a principle that SUPPORTS
  the argument's conclusion ("which principle most helps to justify"). apply = a
  specific case that CONFORMS to a stated principle ("conforms to the principle
  above", "which judgment does the principle support").
- parallel_reasoning vs parallel_flaw: both match argument STRUCTURE. Choose
  parallel_flaw when the original argument is itself flawed (stem usually says
  "flawed").
- evaluate: asks what information/question is most useful in ASSESSING the
  argument (could cut either way).
- resolve_paradox: stem flags an apparent discrepancy/paradox/conflict to explain.

Return the category, the exact stem phrase(s) that drove the decision in
stem_features, and 0-2 genuinely-close runner-ups in alternate_categories."""

RC_SYSTEM = """You are an expert LSAT question classifier. Classify this Reading Comprehension
question into exactly one category from the enum.

RULES
- Choose only from the enum below. Never output a category not in the list.
- Use the STEM as primary evidence. Consult the passage only when the stem alone
  is ambiguous.
- Always return exactly one category. If unsure, still pick the single best one
  and put the runner-up(s) in alternate_categories.

ENUM
main_point, primary_purpose, author_attitude, function, inference, detail,
meaning_in_context, analogy_application, strengthen, weaken

DISAMBIGUATORS (the pairs that get confused)
- main_point vs primary_purpose: main_point = the central CLAIM of the passage.
  primary_purpose = what the author is trying to DO ("in order to", "primarily
  concerned with").
- function vs detail: function = WHY a detail/sentence/paragraph is included
  ("in order to", "serves to"). detail = what the passage EXPLICITLY states
  ("according to the passage").
- inference vs detail: inference = follows from but is not stated ("suggests",
  "implies", "most likely to agree"). detail = stated outright.
- meaning_in_context: asks what a specific word/phrase means as used in the
  passage.
- analogy_application: asks which OUTSIDE situation is most analogous to
  something in the passage.

Return the category, whether the question concerns two passages (Passage A /
Passage B) in is_comparative, the exact stem phrase(s) that drove the decision
in stem_features, and 0-2 genuinely-close runner-ups in alternate_categories."""


def load_env():
    """Minimal .env loader so we don't add a python-dotenv dependency."""
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())


def build_user_message(q):
    """The INPUT block — stem + passage/stimulus."""
    label = "passage" if q["lsat_type"] == "reading_comprehension" else "stimulus"
    return f"stem: {q['question']}\n{label}: {q['stimulus']}"


def classify_one(client, q, model):
    """Classify a single question; raises if the model's output is off-enum."""
    is_rc = q["lsat_type"] == "reading_comprehension"
    system = RC_SYSTEM if is_rc else LR_SYSTEM
    model_cls = RCClassification if is_rc else LRClassification

    resp = client.messages.parse(
        model=model,
        max_tokens=1024,
        thinking={"type": "disabled"},
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": build_user_message(q)}],
        output_format=model_cls,
    )
    parsed = resp.parsed_output
    if parsed is None:
        # Refusal or unparseable output — surface it rather than caching a guess.
        raise ValueError(f"{q['id']}: model returned no parseable classification "
                         f"(stop_reason={resp.stop_reason})")
    # parsed.category is a validated Enum member; .value is the canonical string.
    out = parsed.model_dump(mode="json")
    out["lsat_type"] = q["lsat_type"]
    return out


def classify_all(force=False, limit=None, source=None, model=DEFAULT_MODEL):
    """Classify questions, using/refreshing the cache. Returns {id: classification}.

    source: restrict to one preptest (e.g. "lsac_preptest_101") -- used for dry runs.
    model:  Claude model id (default Haiku; pass claude-sonnet-4-6 for tougher cases).
    """
    load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit(
            "ANTHROPIC_API_KEY not set. Copy stats/.env.example to stats/.env and add your key."
        )

    data = json.loads(DATA.read_text())
    if source:
        data = [q for q in data if q["source"] == source]
        if not data:
            raise SystemExit(f"No questions found for source={source!r}.")
    cache = {} if force else (json.loads(CACHE.read_text()) if CACHE.exists() else {})

    todo = [q for q in data if q["id"] not in cache]
    if limit:
        todo = todo[:limit]

    if not todo:
        print(f"All {len(data)} questions already classified (cache: {CACHE.name}).")
        return cache

    print(f"Classifying {len(todo)} questions with {model} "
          f"({len(cache)} cached, {MAX_WORKERS} workers) ...")

    client = anthropic.Anthropic()
    lock = threading.Lock()
    done = 0
    errors = []

    def worker(q):
        return q["id"], classify_one(client, q, model)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(worker, q): q for q in todo}
        for fut in as_completed(futures):
            q = futures[fut]
            try:
                qid, result = fut.result()
                with lock:
                    cache[qid] = result
                    done += 1
                    if done % 50 == 0 or done == len(todo):
                        # Flush periodically so a crash doesn't lose progress.
                        CACHE.write_text(json.dumps(cache, indent=2))
                        print(f"  {done}/{len(todo)} done")
            except Exception as e:  # noqa: BLE001 - report and keep going
                errors.append(str(e))

    CACHE.write_text(json.dumps(cache, indent=2))
    print(f"Wrote {CACHE.relative_to(ROOT)} ({len(cache)} total classifications).")
    if errors:
        print(f"\n{len(errors)} questions failed (left uncached, re-run to retry):",
              file=sys.stderr)
        for e in errors[:10]:
            print(f"  - {e}", file=sys.stderr)
    return cache


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Classify LSAT questions with Claude.")
    ap.add_argument("--force", action="store_true", help="re-classify everything, ignore cache")
    ap.add_argument("--limit", type=int, default=None, help="cap number of questions (testing)")
    ap.add_argument("--source", default=None,
                    help="restrict to one preptest, e.g. lsac_preptest_101 (dry run)")
    ap.add_argument("--model", default=DEFAULT_MODEL,
                    help=f"Claude model id (default {DEFAULT_MODEL}; e.g. claude-sonnet-4-6)")
    args = ap.parse_args()
    classify_all(force=args.force, limit=args.limit, source=args.source, model=args.model)
