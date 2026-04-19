"""
Scrapes completed LawHub/LSAC tests from testComplete review pages.

Launch Chrome first:
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug

Open all your testComplete pages in separate tabs, then run:
  python scrape_lsac_test.py

Each test is auto-named from its title (e.g. lsac_preptest_140.json).
To scrape a single specific tab:
  python scrape_lsac_test.py output.json
"""

import asyncio
import json
import re
import sys
from playwright.async_api import async_playwright

QUESTION_DELAY = 0.8


async def wait_for_question_page(page):
    await page.wait_for_selector(".stimulus, .stemText, .drillSetRationale", timeout=10000)
    await asyncio.sleep(0.4)


async def parse_question_page(page) -> dict:
    return await page.evaluate("""() => {
        const getText = sel => document.querySelector(sel)?.innerText?.trim() || '';

        const stimulus = getText('.stimulus');
        const stem     = getText('.stemText').replace(/^\\d+\\.\\s*/, '').trim();

        const hints = [...document.querySelectorAll('span.hidden')];
        let correctLetter = '';
        for (const h of hints) {
            const m = h.innerText.match(/correct answer option is ([A-E])/i);
            if (m) { correctLetter = m[1]; break; }
        }

        const choices = [];
        document.querySelectorAll('.drillSetRationale').forEach(el => {
            const fullText = el.innerText.trim();
            const letter   = fullText.match(/^([A-E])\\n/)?.[1] || '';
            const statusEl = el.querySelector('.correctText, .unselectedIncorrectAnswer, [class*="Incorrect"], [class*="incorrect"]');
            const status   = statusEl?.innerText?.trim() || '';
            const optEl    = el.querySelector('.HighlightableText__TextContainer-sc-1ea7h6s-0');
            const text     = optEl?.innerText?.trim() || '';
            const rationale= el.querySelector('.rationaleParagraph')?.innerText?.trim() || '';
            choices.push({ letter, status, text, rationale });
        });

        let result = 'unknown';
        for (const c of choices) {
            const s = c.status.toUpperCase();
            if (s.includes('INCORRECT') && s.includes('SELECTED')) { result = 'wrong'; break; }
            if (s.includes('CORRECT') && s.includes('SELECTED'))   { result = 'correct'; break; }
        }

        return { stimulus, stem, correctLetter, choices, result };
    }""")


async def get_question_buttons(page):
    buttons = await page.query_selector_all("button.answerSelectionBox")
    result = []
    for b in buttons:
        txt = (await b.inner_text()).strip()
        if txt.isdigit():
            visible = await b.evaluate("el => el.offsetParent !== null")
            if visible:
                result.append(b)
    return result


def output_filename_from_title(title: str) -> str:
    """Turn 'The Official LSAT PrepTest 140' → 'lsac_preptest_140.json'"""
    m = re.search(r'PrepTest\s+(\d+)', title, re.IGNORECASE)
    if m:
        return f"lsac_preptest_{m.group(1)}.json"
    slug = re.sub(r'[^a-z0-9]+', '_', title.lower()).strip('_')
    return f"{slug}.json"


async def scrape_page(page, output_file: str, label: str):
    print(f"[{label}] Starting → {output_file}")

    await page.wait_for_selector(".answers-panel-section-title", timeout=8000)
    tabs = await page.query_selector_all(
        ".answers-panel-section-title, .answers-panel-section-title-unselected"
    )
    num_sections = len(tabs)
    all_results = []

    for sec_idx in range(num_sections):
        if sec_idx > 0:
            crumb = await page.query_selector("a[href*='testComplete']")
            if crumb:
                await crumb.click()
            else:
                await page.go_back()
            await page.wait_for_selector(".answers-panel-section-title", timeout=10000)
            await asyncio.sleep(0.5)

        tabs = await page.query_selector_all(
            ".answers-panel-section-title, .answers-panel-section-title-unselected"
        )
        tab_label = (await tabs[sec_idx].inner_text()).strip()
        is_variable = "(*)" in tab_label
        print(f"[{label}] Section {sec_idx + 1}: {tab_label}")

        await tabs[sec_idx].click()
        await page.wait_for_selector("button.section-result-review-section-button", timeout=8000)
        await asyncio.sleep(0.4)

        review_btn = await page.query_selector("button.section-result-review-section-button")
        await review_btn.click()
        await wait_for_question_page(page)
        await page.wait_for_selector("button.answerSelectionBox", state="attached", timeout=10000)
        await asyncio.sleep(0.5)

        q_buttons = await get_question_buttons(page)
        total_q = len(q_buttons)
        print(f"[{label}]    {total_q} questions")

        for q_i in range(1, total_q + 1):
            q_buttons = await get_question_buttons(page)
            await q_buttons[q_i - 1].click()
            await wait_for_question_page(page)
            await asyncio.sleep(QUESTION_DELAY)

            q_data = await parse_question_page(page)
            q_data.update({
                "section":       sec_idx + 1,
                "section_label": tab_label,
                "is_variable":   is_variable,
                "q_num":         q_i,
            })
            all_results.append(q_data)

            icon = "✓" if q_data["result"] == "correct" else (
                   "✗" if q_data["result"] == "wrong" else "?")
            print(f"[{label}]    [{q_i:>2}/{total_q}] {icon}")

    with open(output_file, "w") as f:
        json.dump(all_results, f, indent=2)

    scored  = [r for r in all_results if not r.get("is_variable")]
    correct = sum(1 for r in scored if r["result"] == "correct")
    total   = len(scored)
    pct     = f"{correct/total*100:.1f}%" if total else "n/a"
    print(f"[{label}] Done! {correct}/{total} ({pct}) → {output_file}")


async def main(single_output: str = None):
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        context = browser.contexts[0]

        test_pages = [pg for pg in context.pages if "testComplete" in pg.url]

        if not test_pages:
            print("No testComplete tabs found. Open your test results in Chrome and try again.")
            return

        if single_output:
            # Single-file mode (explicit output path given)
            await scrape_page(test_pages[0], single_output, label="1/1")
        else:
            # Parallel mode: scrape all testComplete tabs at once
            print(f"Found {len(test_pages)} testComplete tab(s) — running in parallel\n")
            tasks = []
            for i, pg in enumerate(test_pages):
                body = await pg.evaluate("document.body.innerText")
                m    = re.search(r'The Official LSAT PrepTest (\d+)', body)
                out  = f"lsac_preptest_{m.group(1)}.json" if m else f"lsac_test_{i+1}.json"
                label = f"{i+1}/{len(test_pages)}"
                tasks.append(scrape_page(pg, out, label))
            await asyncio.gather(*tasks)
            print("\nAll done!")


if __name__ == "__main__":
    single = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(main(single))
