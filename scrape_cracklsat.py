import requests
import re
import json
import time
import sys

BASE_URL = "https://r.jina.ai/https://www.cracklsat.net/lsat/logical-reasoning/question-{n}.html"
OUTPUT_FILE = "cracklsat_questions.json"
DELAY = 0.5  # seconds between requests


def fetch(n):
    url = BASE_URL.format(n=n)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.text


def parse(text, n):
    # Find start of the question block
    q_start = re.search(r'\*\*Question: \d+\*\*', text)
    if not q_start:
        return None

    content = text[q_start.end():]

    # ── choices ────────────────────────────────────────────────────────────
    choices = {}
    for m in re.finditer(r'^([A-E])\. (.+)', content, re.MULTILINE):
        choices[m.group(1)] = m.group(2).strip()

    first_choice = re.search(r'^[A-E]\. ', content, re.MULTILINE)
    if not first_choice or len(choices) < 5:
        return None

    pre_choice = content[:first_choice.start()].strip()

    # ── stimulus = everything except last paragraph; question = last paragraph
    # First paragraph is always a nav artifact ("Standardized & Admissions Tests")
    paragraphs = [p.strip() for p in re.split(r'\n\n+', pre_choice) if p.strip()]
    if paragraphs and paragraphs[0] == 'Standardized & Admissions Tests':
        paragraphs = paragraphs[1:]
    if len(paragraphs) >= 2:
        stimulus      = '\n\n'.join(paragraphs[:-1])
        question_stem = paragraphs[-1]
    else:
        stimulus      = ''
        question_stem = paragraphs[0] if paragraphs else ''

    # ── answer ─────────────────────────────────────────────────────────────
    answer = ''
    m = re.search(r'\*\*Correct Answer:\*\*([A-E])', content)
    if m:
        answer = m.group(1)

    # ── question type ──────────────────────────────────────────────────────
    lsat_type = ''
    m = re.search(r'\*\*Question Type:\*\*(.*)', content)
    if m:
        lsat_type = m.group(1).strip()

    # ── source ref ─────────────────────────────────────────────────────────
    source_ref = ''
    m = re.search(r'\*\*Question Source:\*\*(.*)', content)
    if m:
        source_ref = m.group(1).strip()

    # ── explanation ────────────────────────────────────────────────────────
    explanation = ''
    m = re.search(r'\*\*Explanation:\*\*\s*\n+(.*?)(?=\*\s+\[Previous\]|\Z)', content, re.DOTALL)
    if m:
        expl = m.group(1).strip()
        # Strip leading bold choice header e.g. "**D. Christie's states...**"
        expl = re.sub(r'^\*\*[A-E]\..+?\*\*\s*\n*', '', expl, flags=re.DOTALL).strip()
        explanation = expl

    return {
        'id':          f'cracklsat_{n:04d}',
        'stimulus':    stimulus,
        'question':    question_stem,
        'choices':     choices,
        'answer':      answer,
        'explanation': explanation,
        'lsat_type':   lsat_type,
        'category':    '',
        'source':      'cracklsat',
        'source_ref':  source_ref,
    }


def main():
    total   = 450
    results = []
    errors  = []

    for n in range(1, total + 1):
        try:
            text = fetch(n)
            q    = parse(text, n)
            if q:
                results.append(q)
                print(f"  [{n:3d}/{total}] ✓  answer={q['answer']}  source={q['source_ref']}")
            else:
                errors.append(n)
                print(f"  [{n:3d}/{total}] ✗  parse failed", file=sys.stderr)
        except Exception as e:
            errors.append(n)
            print(f"  [{n:3d}/{total}] ✗  {e}", file=sys.stderr)

        # Save checkpoint every 50 questions
        if n % 50 == 0:
            with open(OUTPUT_FILE, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"  --- checkpoint saved ({len(results)} questions) ---")

        time.sleep(DELAY)

    # Final save
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\nDone. {len(results)} questions saved to {OUTPUT_FILE}")
    if errors:
        print(f"Failed on: {errors}")


if __name__ == '__main__':
    main()
