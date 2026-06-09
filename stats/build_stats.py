"""Aggregate combined_test_results.json into a compact stats.json for the dashboard.

Run from the repo root with the project venv:
    ./venv/bin/python stats/build_stats.py             # uses cached classifications
    ./venv/bin/python stats/build_stats.py --classify  # (re)run the Claude classifier first

Reads:  combined_test_results.json   (repo root, ~6.3MB, 2780 questions)
        stats/classifications.json   (optional — fine-grained categories, if present)
Writes: stats/src/data/stats.json    (small, precomputed aggregations)

Keeping aggregation in Python means the browser never downloads the full
question set -- it only loads the rolled-up numbers it needs to render.

Per-question category classification is an opt-in step (it calls the Claude API,
one request per question). Without --classify, this script just reads whatever is
already in stats/classifications.json; with --classify it tops up the cache first.
"""
import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "combined_test_results.json"
OUT = ROOT / "stats" / "src" / "data" / "stats.json"
CLASSIFICATIONS = ROOT / "stats" / "classifications.json"

LETTERS = ["A", "B", "C", "D", "E"]


def pct(n, d):
    return round(100 * n / d, 1) if d else 0.0


def section_of(qid):
    m = re.search(r"_s(\d+)_q", qid)
    return f"Section {m.group(1)}" if m else "Unknown"


def question_num_of(qid):
    m = re.search(r"_q(\d+)", qid)
    return int(m.group(1)) if m else None


def normalize_stimulus(s):
    """Collapse whitespace / drop the boilerplate prefix so questions sharing a
    passage group together."""
    s = re.sub(r"^Question Prompt Passage", "", s, flags=re.I)
    return re.sub(r"\s+", " ", s).strip().lower()


def preptest_label(source):
    m = re.search(r"(\d+)$", source)
    return f"PT {m.group(1)}" if m else source


def acc_block(rows):
    """{total, correct, accuracy} for a list of question dicts."""
    total = len(rows)
    correct = sum(1 for r in rows if r.get("correct"))
    return {"total": total, "correct": correct, "accuracy": pct(correct, total)}


def grouped_accuracy(data, key):
    groups = defaultdict(list)
    for r in data:
        groups[key(r)].append(r)
    out = []
    for k, rows in groups.items():
        b = acc_block(rows)
        b["label"] = k
        b["flagged"] = sum(1 for r in rows if r.get("flagged"))
        out.append(b)
    return out


def assign_global_numbers(data):
    """Tag each question with its position across the whole test (1..N), where
    sections are laid out in order: section 1 q1..qN, then section 2 continues
    the count, and so on. Computed per source."""
    by_src = defaultdict(list)
    for r in data:
        by_src[r["source"]].append(r)
    for rows in by_src.values():
        rows.sort(key=lambda r: (section_of(r["id"]), question_num_of(r["id"])))
        for i, r in enumerate(rows, 1):
            r["_global_num"] = i


def category_breakdown(data, classifications, lsat_type):
    """Accuracy per fine-grained category for one LSAT type, sorted by volume.
    Returns [] if nothing in this type has been classified yet."""
    rows = [
        {**r, "_category": classifications[r["id"]]["category"]}
        for r in data
        if r.get("lsat_type") == lsat_type and r["id"] in classifications
    ]
    if not rows:
        return []
    out = grouped_accuracy(rows, lambda r: r["_category"])
    cat_rows_map = defaultdict(list)
    for r in rows:
        cat_rows_map[r["_category"]].append(r)
    for b in out:
        b["points_lost"] = b["total"] - b["correct"]
        b["wrong_unflagged"] = sum(
            1 for r in cat_rows_map[b["label"]]
            if not r.get("correct") and not r.get("flagged")
        )
        b["wrong_unflagged_rate"] = pct(b["wrong_unflagged"], b["total"])
    out.sort(key=lambda b: -b["total"])
    return out


def main(run_classifier=False):
    data = json.loads(SRC.read_text())
    assign_global_numbers(data)

    # Fine-grained per-question categories are optional. With --classify we top up
    # the cache via the Claude classifier first; otherwise we read whatever exists.
    if run_classifier:
        import classify_questions

        classify_questions.classify_all()
    classifications = (
        json.loads(CLASSIFICATIONS.read_text()) if CLASSIFICATIONS.exists() else {}
    )

    overall = acc_block(data)
    overall["flagged"] = sum(1 for r in data if r.get("flagged"))
    overall["incorrect"] = overall["total"] - overall["correct"]
    overall["sources"] = len(set(r["source"] for r in data))

    # By LSAT type (logical_reasoning vs reading_comprehension)
    by_type = sorted(
        grouped_accuracy(data, lambda r: r.get("lsat_type", "unknown")),
        key=lambda b: -b["total"],
    )

    # By preptest source, sorted by the trailing number so it reads as a timeline.
    by_source = grouped_accuracy(data, lambda r: preptest_label(r["source"]))
    by_source.sort(key=lambda b: int(re.search(r"(\d+)", b["label"]).group(1)))

    # By section position within a test.
    by_section = sorted(
        grouped_accuracy(data, lambda r: section_of(r["id"])),
        key=lambda b: b["label"],
    )

    # By question number within its section (q01, q02, ...). Shows whether
    # accuracy drifts deeper into a section. Sample sizes shrink past q24
    # since not every section runs that long.
    by_question = grouped_accuracy(data, lambda r: question_num_of(r["id"]))
    by_question = [b for b in by_question if b["label"] is not None]
    by_question.sort(key=lambda b: b["label"])
    for b in by_question:
        b["label"] = f"q{b['label']:02d}"

    # By global question number across the whole test (section order). Captures
    # fatigue/pacing over the full ~101-question test. Sample sizes shrink past
    # the typical test length.
    by_global = grouped_accuracy(data, lambda r: r["_global_num"])
    by_global.sort(key=lambda b: b["label"])
    for b in by_global:
        b["label"] = f"#{b['label']}"

    # Answer key distribution vs what was selected.
    correct_key = Counter(r["answer"] for r in data if r.get("answer") in LETTERS)
    selected = Counter(
        r["selected_answer"] for r in data if r.get("selected_answer") in LETTERS
    )
    answer_distribution = [
        {
            "letter": L,
            "correctKey": correct_key.get(L, 0),
            "selected": selected.get(L, 0),
        }
        for L in LETTERS
    ]

    # Per-letter accuracy: when the correct answer is L, how often is it picked?
    by_correct_letter = []
    for L in LETTERS:
        rows = [r for r in data if r.get("answer") == L]
        b = acc_block(rows)
        b["label"] = L
        by_correct_letter.append(b)

    # RC error concentration: are misses clustered within a passage, or spread
    # thin across many passages? Group RC questions by (source, passage text).
    rc = [r for r in data if r.get("lsat_type") == "reading_comprehension"]
    passages = defaultdict(list)
    for r in rc:
        passages[(r["source"], normalize_stimulus(r["stimulus"]))].append(r)
    errors_per_passage = Counter()
    for rows in passages.values():
        errors_per_passage[sum(1 for r in rows if not r.get("correct"))] += 1
    max_err = max(errors_per_passage) if errors_per_passage else 0
    rc_error_dist = [
        {"errors": e, "passages": errors_per_passage.get(e, 0)}
        for e in range(max_err + 1)
    ]
    total_rc_errors = sum(e * c for e, c in errors_per_passage.items())
    errors_clustered = sum(e * c for e, c in errors_per_passage.items() if e >= 2)
    rc_concentration = {
        "totalPassages": len(passages),
        "passagesWithError": sum(c for e, c in errors_per_passage.items() if e > 0),
        "lonePassages": errors_per_passage.get(1, 0),
        "multiPassages": sum(c for e, c in errors_per_passage.items() if e >= 2),
        "totalErrors": total_rc_errors,
        "errorsLone": errors_per_passage.get(1, 0),  # 1 error == 1 lone error
        "errorsClustered": errors_clustered,
        "pctErrorsClustered": pct(errors_clustered, total_rc_errors),
        "distribution": rc_error_dist,
    }

    # Flagged vs unflagged accuracy -- does flagging track uncertainty?
    flagged_rows = [r for r in data if r.get("flagged")]
    unflagged_rows = [r for r in data if not r.get("flagged")]
    flag_breakdown = {
        "flagged": acc_block(flagged_rows),
        "unflagged": acc_block(unflagged_rows),
    }

    # Fine-grained category accuracy (only populated once questions are classified).
    by_lr_category = category_breakdown(data, classifications, "logical_reasoning")
    by_rc_category = category_breakdown(data, classifications, "reading_comprehension")
    category_meta = {
        "classified": len(classifications),
        "total": overall["total"],
    }

    result = {
        "generatedFrom": SRC.name,
        "overall": overall,
        "byType": by_type,
        "bySource": by_source,
        "bySection": by_section,
        "byQuestion": by_question,
        "byGlobalQuestion": by_global,
        "answerDistribution": answer_distribution,
        "byCorrectLetter": by_correct_letter,
        "rcConcentration": rc_concentration,
        "flagBreakdown": flag_breakdown,
        "categoryMeta": category_meta,
        "byLrCategory": by_lr_category,
        "byRcCategory": by_rc_category,
        "byLrCategoryByPointsLost": sorted(by_lr_category, key=lambda b: -b["points_lost"]),
        "byRcCategoryByPointsLost": sorted(by_rc_category, key=lambda b: -b["points_lost"]),
        "byLrCategoryWrongUnflagged": sorted(by_lr_category, key=lambda b: -b["wrong_unflagged"]),
        "byRcCategoryWrongUnflagged": sorted(by_rc_category, key=lambda b: -b["wrong_unflagged"]),
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2))
    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(
        f"  {overall['total']} questions | "
        f"{overall['accuracy']}% accuracy | "
        f"{overall['flagged']} flagged | "
        f"{overall['sources']} preptests | "
        f"{category_meta['classified']}/{category_meta['total']} categorized"
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Build stats.json for the dashboard.")
    ap.add_argument(
        "--classify",
        action="store_true",
        help="run the Claude classifier to top up stats/classifications.json first",
    )
    args = ap.parse_args()
    main(run_classifier=args.classify)
