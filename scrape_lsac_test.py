"""
Scrapes completed LawHub/LSAC tests from testComplete review pages.

Launch Chrome first:
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug

Open the LawHub full tests library page:
  https://app.lawhub.org/library/fulltests

Then run:
  python scrape_lsac_test.py

The script will open the lowest-scored completed testComplete page for each PrepTest
before scraping. It can also scrape testComplete tabs you already have open.

Each test is auto-named from its title and written into ./scraped_tests/
(e.g. scraped_tests/lsac_preptest_140.json).
To scrape a single specific tab to an exact path:
  python scrape_lsac_test.py output.json
"""

import asyncio
import json
import os
import re
import sys
from playwright.async_api import async_playwright

QUESTION_DELAY = 0.8
OUTPUT_DIR = "scraped_tests"
LAWHUB_BASE_URL = "https://app.lawhub.org"
FULL_TESTS_URL = f"{LAWHUB_BASE_URL}/library/fulltests"
AUTO_OPEN_CONCURRENCY = 4


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


async def is_question_flagged(page, q_num: int) -> bool:
    return await page.evaluate("""(qNum) => {
        const buttons = [...document.querySelectorAll(`[data-testid="answerSelection.${qNum}"]`)];
        return buttons.some(button => {
            const label = button.getAttribute('aria-label') || '';
            return /\\bMarked for Review\\b/i.test(label) && !/\\bNot Marked for Review\\b/i.test(label);
        });
    }""", q_num)


def output_filename_from_title(title: str) -> str:
    """Turn 'The Official LSAT PrepTest 140' → 'lsac_preptest_140.json'"""
    m = re.search(r'PrepTest\s+(\d+)', title, re.IGNORECASE)
    if m:
        return f"lsac_preptest_{m.group(1)}.json"
    slug = re.sub(r'[^a-z0-9]+', '_', title.lower()).strip('_')
    return f"{slug}.json"


async def get_library_tests(page):
    print("[auto] Reading full tests library")
    await page.goto(FULL_TESTS_URL, wait_until="domcontentloaded")
    await page.wait_for_selector('[data-testid="library-item-accordion-module"]', timeout=20000)
    tests = await page.evaluate("""() => {
        return [...document.querySelectorAll('[data-testid="library-item-accordion-module"]')]
            .map(el => {
                const code = el.id?.match(/LSAC\\d+/i)?.[0]?.toUpperCase() || '';
                const title = el.querySelector('[data-testid="moduleName"]')?.innerText?.trim()
                    || el.innerText?.split('\\n')?.[0]?.trim()
                    || '';
                return { code, title };
            })
            .filter(item => item.code && /PrepTest\\s+\\d+/i.test(item.title));
    }""")

    seen = set()
    unique = []
    for item in tests:
        if item["code"] not in seen:
            seen.add(item["code"])
            unique.append(item)
    print(f"[auto] Found {len(unique)} PrepTest(s) in library")
    return unique


async def find_lowest_completed_attempt(page, test):
    code = test["code"]
    await page.goto(f"{LAWHUB_BASE_URL}/history/{code}", wait_until="domcontentloaded")

    try:
        await page.wait_for_selector('[data-testid="history-item-result"], main', timeout=15000)
    except Exception:
        print(f"[auto] {code}: history did not load")
        return None

    attempts = await page.evaluate("""() => {
        return [...document.querySelectorAll('[data-testid="history-item-result"]')]
            .map((el, index) => {
                const convertedText = el.querySelector('[data-testid="converted-score"]')?.innerText || '';
                const rawText = el.querySelector('[data-testid="history-item-result-score"]')?.innerText || '';
                const scaled = Number.parseInt(convertedText.replace(/[^0-9]/g, ''), 10);
                const raw = Number.parseInt(rawText.replace(/[^0-9]/g, ''), 10);
                return {
                    index,
                    scaled: Number.isNaN(scaled) ? null : scaled,
                    raw: Number.isNaN(raw) ? null : raw,
                    text: el.innerText?.trim() || ''
                };
            })
            .filter(item => item.scaled !== null && /Complete/i.test(item.text));
    }""")

    if not attempts:
        print(f"[auto] {code}: no completed scored attempts")
        return None

    lowest = min(attempts, key=lambda item: item["scaled"])
    print(f"[auto] {code}: lowest scaled score {lowest['scaled']}")
    return lowest


async def open_test_complete_for_attempt(page, test, attempt):
    code = test["code"]
    buttons = await page.query_selector_all('[data-testid="history-item-result"]')
    if attempt["index"] >= len(buttons):
        print(f"[auto] {code}: attempt index disappeared")
        return None

    await buttons[attempt["index"]].click()
    await page.wait_for_selector('[data-testid^="test-report-button"]', timeout=10000)
    await page.click('[data-testid^="test-report-button"]')
    await page.wait_for_url("**/testComplete/**", timeout=30000)
    await page.wait_for_selector(".answers-panel-section-title", timeout=30000)
    print(f"[auto] {code}: opened {page.url}")
    return page


async def open_lowest_test_complete_pages(context):
    library_page = next(
        (pg for pg in context.pages if "/library/fulltests" in pg.url),
        None,
    )
    if not library_page:
        library_page = await context.new_page()

    tests = await get_library_tests(library_page)
    existing_urls = {pg.url for pg in context.pages if "testComplete" in pg.url}
    opened_pages = []
    url_lock = asyncio.Lock()
    semaphore = asyncio.Semaphore(AUTO_OPEN_CONCURRENCY)

    async def open_one(test):
        async with semaphore:
            page = await context.new_page()
            try:
                attempt = await find_lowest_completed_attempt(page, test)
                if not attempt:
                    await page.close()
                    return

                opened = await open_test_complete_for_attempt(page, test, attempt)
                if not opened:
                    await page.close()
                    return

                async with url_lock:
                    if opened.url in existing_urls:
                        duplicate = True
                    else:
                        duplicate = False
                        existing_urls.add(opened.url)
                        opened_pages.append(opened)

                if duplicate:
                    print(f"[auto] {test['code']}: already open, closing duplicate tab")
                    await opened.close()
            except Exception as exc:
                print(f"[auto] {test['code']}: skipped after error: {exc}")
                if not page.is_closed():
                    await page.close()

    print(f"[auto] Opening testComplete tabs up to {AUTO_OPEN_CONCURRENCY} at a time")
    await asyncio.gather(*(open_one(test) for test in tests))

    print(f"[auto] Opened {len(opened_pages)} new testComplete tab(s)")
    return opened_pages


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
                "flagged":       await is_question_flagged(page, q_i),
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

        if single_output:
            test_pages = [pg for pg in context.pages if "testComplete" in pg.url]
            if not test_pages:
                print("No testComplete tabs found. Open a test result in Chrome and try again.")
                return
            # Single-file mode (explicit output path given)
            await scrape_page(test_pages[0], single_output, label="1/1")
        else:
            await open_lowest_test_complete_pages(context)
            test_pages = [pg for pg in context.pages if "testComplete" in pg.url]
            unique_pages = []
            seen_urls = set()
            for pg in test_pages:
                if pg.url not in seen_urls:
                    seen_urls.add(pg.url)
                    unique_pages.append(pg)
            test_pages = unique_pages

            if not test_pages:
                print("No completed testComplete pages were found to scrape.")
                return

            # Parallel mode: scrape all testComplete tabs at once
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            print(f"Found {len(test_pages)} testComplete tab(s) — running in parallel")
            print(f"Writing output to ./{OUTPUT_DIR}/\n")
            tasks = []
            for i, pg in enumerate(test_pages):
                body = await pg.evaluate("document.body.innerText")
                m    = re.search(r'The Official LSAT PrepTest (\d+)', body)
                name = f"lsac_preptest_{m.group(1)}.json" if m else f"lsac_test_{i+1}.json"
                out  = os.path.join(OUTPUT_DIR, name)
                label = f"{i+1}/{len(test_pages)}"
                tasks.append(scrape_page(pg, out, label))
            await asyncio.gather(*tasks)
            print("\nAll done!")


if __name__ == "__main__":
    single = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(main(single))
