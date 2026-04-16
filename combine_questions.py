import argparse
import json
from pathlib import Path
from typing import List


DEFAULT_INPUTS = [
    "powerscore_all_questions.json",
    "cracklsat_questions.json",
    "lsac_questions.json",
]
DEFAULT_OUTPUT = "questions.json"


def load_questions(path: Path) -> list:
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError(f"{path} does not contain a top-level JSON list")

    return data


def combine_files(input_paths: List[Path]) -> list:
    combined = []

    for path in input_paths:
        questions = load_questions(path)
        combined.extend(questions)
        print(f"Loaded {len(questions)} questions from {path}")

    return combined


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Combine LSAT question JSON files into one JSON file."
    )
    parser.add_argument(
        "inputs",
        nargs="*",
        default=DEFAULT_INPUTS,
        help="Input JSON files to combine.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=DEFAULT_OUTPUT,
        help="Output JSON filename.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_paths = [Path(path) for path in args.inputs]
    output_path = Path(args.output)

    combined = combine_files(input_paths)

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(combined, file, indent=2)

    print(f"Wrote {len(combined)} total questions to {output_path}")


if __name__ == "__main__":
    main()
