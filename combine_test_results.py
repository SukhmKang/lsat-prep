import json
import os
import glob

TEST_RESULTS_DIR = os.path.join(os.path.dirname(__file__), "test_results")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "combined_test_results.json")


def get_selected_letter(choices):
    for choice in choices:
        if "SELECTED" in choice.get("status", ""):
            return choice["letter"]
    return None


RC_STIMULUS_THRESHOLD = 1000  # chars; sections averaging above this are RC


def classify_sections(questions):
    """Return a set of section numbers that are RC based on avg stimulus length."""
    from collections import defaultdict
    section_lengths = defaultdict(list)
    for q in questions:
        section_lengths[q.get("section")].append(len(q.get("stimulus", "")))
    return {
        sec for sec, lengths in section_lengths.items()
        if (sum(lengths) / len(lengths)) > RC_STIMULUS_THRESHOLD
    }


def convert_question(q, source, rc_sections):
    choices_obj = {c["letter"]: c["text"] for c in q.get("choices", [])}
    correct_letter = q.get("correctLetter", "")
    selected_letter = get_selected_letter(q.get("choices", []))
    is_correct = q.get("result", "").lower() == "correct"

    q_num = q.get("q_num", 0)
    section = q.get("section", 1)
    question_id = f"{source}_s{section}_q{q_num:02d}"
    lsat_type = "reading_comprehension" if section in rc_sections else "logical_reasoning"

    return {
        "id": question_id,
        "stimulus": q.get("stimulus", ""),
        "question": q.get("stem", ""),
        "choices": choices_obj,
        "answer": correct_letter,
        "selected_answer": selected_letter,
        "correct": is_correct,
        "explanation": "",
        "lsat_type": lsat_type,
        "category": lsat_type,
        "source": source,
    }


def main():
    combined = []

    result_files = sorted(glob.glob(os.path.join(TEST_RESULTS_DIR, "*.json")))

    for filepath in result_files:
        source = os.path.splitext(os.path.basename(filepath))[0]
        with open(filepath, "r", encoding="utf-8") as f:
            questions = json.load(f)

        rc_sections = classify_sections(questions)
        for q in questions:
            combined.append(convert_question(q, source, rc_sections))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)

    print(f"Combined {len(combined)} questions from {len(result_files)} files into {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
