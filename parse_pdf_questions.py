import pymupdf
import re
import json

pdf_path = "LSAT-Critical-Reasoning-Book.pdf"

# ── header lines to strip from pages ─────────────────────────────────────────
HEADER_PATTERNS = [
    r'^\d{1,3}$',
    r'^The PowerScore LSAT Logical Reasoning( Bible)?$',
    r'^Chapter \w+: .+$',
    r'.+Problem Set$',
    r'.+Problem Set Answer Key$',
    r'^All answer keys in this book .+$',
    r'^LSAT was originally administered.+$',
    r'^that section\. Each LSAT .+$',
    r'^designators will .+$',
    r'^number of the booklet\.$',
    r'^Each of the following questions is drawn.+$',
    r'^review the answer key and explanations.+$',
    r'^Answers on Page \d+$',
]

# ── patterns that signal the start of the question stem ──────────────────────
STEM_STARTERS = [
    r'^Which one of the following',
    r'^Which of the following',
    r'^The statements above',
    r'^The argument',
    r'^The passage',
    r'^The information above',
    r'^The stimulus',
    r'^The reasoning',
    r'^The method',
    r'^Each of the following',
    r'^\w+ and \w+ (?:are committed|disagree)',
]

# ── lsat_type from the short code in the answer key header ───────────────────
CODE_TO_TYPE = {
    'Must':       'must_be_true',
    'Main':       'main_point',
    'Weaken':     'weaken',
    'Strengthen': 'strengthen',
    'Assumption': 'necessary_assumption',
    'Flaw':       'flaw',
    'Parallel':   'parallel_reasoning',
    'Method':     'method_of_reasoning',
    'Point':      'point_of_disagreement',
    'PI':         'point_of_disagreement',
    'Resolve':    'resolve_paradox',
    'Principle':  'principle',
    'Justify':    'sufficient_assumption',
    'Cannot':     'cannot_be_true',
    'Evaluate':   'evaluate',
    'Numbers':    'numbers_percentages',
    'Sufficient': 'sufficient_necessary',
}

# ── fallback lsat_type from the problem set name ─────────────────────────────
SET_NAME_TO_TYPE = {
    'Must Be True':             'must_be_true',
    'Main Point':               'main_point',
    'Weaken':                   'weaken',
    'Weaken Question':          'weaken',
    'Strengthen':               'strengthen',
    'Assumption':               'necessary_assumption',
    'Flaw in the Reasoning':    'flaw',
    'Flaw in the Reasoning Question': 'flaw',
    'Parallel Reasoning':       'parallel_reasoning',
    'Parallel Reasoning Question': 'parallel_reasoning',
    'Method of Reasoning':      'method_of_reasoning',
    'Point at Issue':           'point_of_disagreement',
    'Resolve the Paradox':      'resolve_paradox',
    'Principle':                'principle',
    'Justify the Conclusion':   'sufficient_assumption',
    'Cannot Be True':           'cannot_be_true',
    'Cannot Be True Question':  'cannot_be_true',
    'Evaluate the Argument':    'evaluate',
    'Evaluate the Argument Question': 'evaluate',
    'Numbers and Percentages':  'numbers_percentages',
    'Sufficient and Necessary': 'sufficient_necessary',
    'Causal Reasoning':         'causal_reasoning',
}


# ─────────────────────────────────────────────────────────────────────────────
# Page scanning
# ─────────────────────────────────────────────────────────────────────────────

Q_NUMBER_RE = re.compile(r'(?m)^\d+\.\s*\n|^\d+\.\s{2,}\S')

def classify_pages(doc):
    """
    Return list of dicts with keys: page (1-indexed), type ('Q'/'A'/'N'),
    set_name (str).
    """
    info = []
    for i in range(len(doc)):
        text = doc[i].get_text()
        has_answer_key  = 'Answer Key' in text
        # "Problem Set" covers most chapters; "Question Set" covers Sufficient/Necessary
        has_problem_set = ('Problem Set' in text or 'Question Set' in text)
        has_q_numbers   = bool(Q_NUMBER_RE.search(text))

        if has_answer_key:
            ptype = 'A'
        elif has_problem_set:
            ptype = 'Q'
        else:
            ptype = 'N'

        # Extract set name from header line
        set_name = ''
        m = re.search(r'([\w ]+?)\s+(?:Question )?(?:Problem |Question )Set(?:\s+Answer Key)?', text)
        if m:
            set_name = m.group(1).strip()

        info.append({'page': i + 1, 'type': ptype, 'set_name': set_name,
                     'has_q_numbers': has_q_numbers})
    return info


def extend_q_blocks(page_info):
    """
    Reclassify any 'N' page that immediately precedes a 'Q' page and
    contains question numbers (catches unlabelled first pages of a set).
    """
    for i in range(len(page_info) - 1):
        if page_info[i]['type'] == 'N' and page_info[i]['has_q_numbers']:
            if page_info[i + 1]['type'] == 'Q':
                page_info[i]['type'] = 'Q'


def group_problem_sets(page_info):
    """
    Find (Q_pages, A_pages, set_name) triples where Q_pages are consecutive
    question pages immediately followed by consecutive answer pages.
    """
    groups = []
    i = 0
    while i < len(page_info):
        if page_info[i]['type'] == 'Q':
            q_start = i
            set_name = page_info[i]['set_name']
            while i < len(page_info) and page_info[i]['type'] == 'Q':
                if page_info[i]['set_name']:
                    set_name = page_info[i]['set_name']
                i += 1
            q_end = i - 1

            if i < len(page_info) and page_info[i]['type'] == 'A':
                a_start = i
                if not set_name and page_info[i]['set_name']:
                    set_name = page_info[i]['set_name']
                while i < len(page_info) and page_info[i]['type'] == 'A':
                    if page_info[i]['set_name'] and not set_name:
                        set_name = page_info[i]['set_name']
                    i += 1
                a_end = i - 1

                q_pages = [p['page'] for p in page_info[q_start:q_end+1]]
                a_pages = [p['page'] for p in page_info[a_start:a_end+1]]
                groups.append({'q_pages': q_pages, 'a_pages': a_pages, 'set_name': set_name})
            # Q block with no following A block — skip
        else:
            i += 1
    return groups


# ─────────────────────────────────────────────────────────────────────────────
# Text utilities
# ─────────────────────────────────────────────────────────────────────────────

def get_combined_text(doc, pages):
    return '\n'.join(doc[p - 1].get_text() for p in pages)


def strip_headers(text):
    lines = text.split('\n')
    return '\n'.join(
        line for line in lines
        if not any(re.match(pat, line.strip()) for pat in HEADER_PATTERNS)
    )


def join_wrapped_lines(raw):
    """Rejoin PDF line-wrapped text into full sentences."""
    buf = ''
    out = []
    for line in raw.split('\n'):
        s = line.strip()
        if not s:
            if buf:
                out.append(buf)
                buf = ''
        else:
            buf = (buf + ' ' + s).strip() if buf else s
            if s.endswith(('.', '?', '!')):
                out.append(buf)
                buf = ''
    if buf:
        out.append(buf)
    return ' '.join(out)


# ─────────────────────────────────────────────────────────────────────────────
# Question parsing
# ─────────────────────────────────────────────────────────────────────────────

def parse_pre_choice(text):
    """Split pre-(A) text into (stimulus, question_stem)."""
    lines = text.split('\n')
    stem_start = None
    for i, line in enumerate(lines):
        s = line.strip()
        for pat in STEM_STARTERS:
            if re.match(pat, s, re.IGNORECASE):
                stem_start = i
                break
        if stem_start is not None:
            break

    if stem_start is None:
        stimulus = ' '.join(l.strip() for l in lines if l.strip())
        return stimulus, ''

    stimulus     = ' '.join(l.strip() for l in lines[:stem_start] if l.strip())
    question_stem = ' '.join(l.strip() for l in lines[stem_start:] if l.strip())
    return stimulus, question_stem


def normalize_q_numbers(text):
    """Normalize '1.     text' (inline) to '1.\ntext' for uniform parsing."""
    return re.sub(r'(?m)^(\d+)\.\s{2,}', r'\1.\n', text)


def parse_questions(doc, pages):
    text = normalize_q_numbers(strip_headers(get_combined_text(doc, pages)))
    matches = list(re.finditer(r'(?m)^(\d+)\.\n', text))
    questions = {}

    for i, m in enumerate(matches):
        num   = int(m.group(1))
        start = m.end()
        end   = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        block = text[start:end]

        parts = re.split(r'\(([A-E])\)\n', block)
        if len(parts) < 11:
            print(f"    Warning: Q{num} has only {len(parts)} parts — skipping")
            continue

        stimulus, question_stem = parse_pre_choice(parts[0])

        choices = {}
        for j in range(1, 10, 2):
            if j + 1 < len(parts):
                letter  = parts[j]
                content = ' '.join(l.strip() for l in parts[j + 1].split('\n') if l.strip())
                choices[letter] = content

        questions[num] = {
            'stimulus': stimulus,
            'question': question_stem,
            'choices':  choices,
        }

    return questions


# ─────────────────────────────────────────────────────────────────────────────
# Answer key parsing
# ─────────────────────────────────────────────────────────────────────────────

# Two formats seen in the book:
#   "Question #N. TYPE. Source. The correct answer choice is (X)"
#   "Question #N. Source. The correct answer choice is (X)"   ← type omitted
# Some headers wrap: "...The correct answer choice\nis (X)"
ANSWER_HEADER_RE = re.compile(
    r'Question #(\d+)\.'
    r'(?:\s+([\w\-#%]+)\.)?\s*'       # optional type code (may include #%)
    r'(.+?)\.'                         # source
    r'\s*The correct answer choice\s*\n?\s*is\s*\n?\s*\(([A-E])\)'
)


def parse_answer_key(doc, pages, fallback_type):
    text = strip_headers(get_combined_text(doc, pages))
    blocks = re.split(r'(?=Question #\d+\.)', text)
    answers = {}

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        m = ANSWER_HEADER_RE.match(block)
        if not m:
            continue

        num        = int(m.group(1))
        type_code  = (m.group(2) or '').split('-')[0]  # strip sub-type like "-CE"
        source_ref = m.group(3).strip()
        answer     = m.group(4)

        lsat_type  = CODE_TO_TYPE.get(type_code) or fallback_type

        expl_raw   = block[m.end():].strip()
        explanation = join_wrapped_lines(expl_raw)

        answers[num] = {
            'answer':      answer,
            'lsat_type':   lsat_type,
            'source_ref':  source_ref,
            'explanation': explanation,
        }

    return answers


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def set_name_to_type(name):
    for key, val in SET_NAME_TO_TYPE.items():
        if name.startswith(key):
            return val
    return name.lower().replace(' ', '_') if name else 'unknown'


def slugify(name):
    return re.sub(r'\W+', '_', name.lower()).strip('_')


def main():
    doc = pymupdf.open(pdf_path)

    print("Scanning pages...")
    page_info = classify_pages(doc)
    extend_q_blocks(page_info)
    groups = group_problem_sets(page_info)
    print(f"Found {len(groups)} problem set(s):\n")

    all_questions = []

    for g in groups:
        name      = g['set_name']
        q_pages   = g['q_pages']
        a_pages   = g['a_pages']
        fb_type   = set_name_to_type(name)
        slug      = slugify(name)

        print(f"  [{name}]  Q pages: {q_pages}  A pages: {a_pages}")

        questions = parse_questions(doc, q_pages)
        answers   = parse_answer_key(doc, a_pages, fb_type)

        print(f"    Parsed {len(questions)} questions, {len(answers)} answers")

        for num in sorted(questions.keys()):
            q = questions[num]
            a = answers.get(num, {})

            entry = {
                'id':          f'{slug}_{num:03d}',
                'stimulus':    q['stimulus'],
                'question':    q['question'],
                'choices':     q['choices'],
                'answer':      a.get('answer', ''),
                'explanation': a.get('explanation', ''),
                'lsat_type':   a.get('lsat_type', fb_type),
                'category':    fb_type,
                'source':      'powerscore_lsat_lr_bible',
            }
            all_questions.append(entry)

    output_path = 'powerscore_all_questions.json'
    with open(output_path, 'w') as f:
        json.dump(all_questions, f, indent=2)

    print(f"\nTotal: {len(all_questions)} questions written to {output_path}")


if __name__ == '__main__':
    main()
