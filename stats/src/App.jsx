import { useRef } from 'react'
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'
import stats from './data/stats.json'
import { Card, StatCard, AccuracyRow, PointsLostRow, WrongUnflaggedRow } from './components/primitives.jsx'
import { TrendChart, QuestionPositionChart, GlobalPositionChart, AnswerDistChart, LetterAccuracyChart, RcConcentrationChart } from './components/Charts.jsx'

const TYPE_LABELS = {
  logical_reasoning: 'Logical Reasoning',
  reading_comprehension: 'Reading Comprehension',
}

// snake_case category id -> human label, e.g. "must_be_true" -> "Must Be True".
const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function App() {
  const {
    overall, byType, bySource, bySection, byQuestion, byGlobalQuestion,
    answerDistribution, byCorrectLetter, rcConcentration, flagBreakdown,
    categoryMeta, byLrCategory, byRcCategory,
    byLrCategoryByPointsLost, byRcCategoryByPointsLost,
    byLrCategoryWrongUnflagged, byRcCategoryWrongUnflagged,
  } = stats

  const hasCategories = categoryMeta && categoryMeta.classified > 0
  const partial = hasCategories && categoryMeta.classified < categoryMeta.total

  const flaggedAcc = flagBreakdown.flagged.accuracy
  const unflaggedAcc = flagBreakdown.unflagged.accuracy

  const contentRef = useRef(null)

  const handleExport = async () => {
    const element = contentRef.current
    if (!element) return
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#020617',
      useCORS: true,
      ignoreElements: (el) => el.classList?.contains('no-print'),
    })
    const imgData = canvas.toDataURL('image/jpeg', 0.98)
    const pdf = new jsPDF({
      unit: 'px',
      format: [canvas.width, canvas.height],
      orientation: 'portrait',
      hotfixes: ['px_scaling'],
    })
    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
    pdf.save('lsat-stats.pdf')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div ref={contentRef} className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">LSAT Practice Stats</h1>
            <p className="mt-1 text-sm text-slate-500">
              {overall.total.toLocaleString()} questions across {overall.sources} preptests
            </p>
          </div>
          <button
            className="no-print shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 active:scale-95"
            onClick={handleExport}
          >
            Export to PDF
          </button>
        </header>

        {/* Headline numbers */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Overall accuracy" value={`${overall.accuracy}%`} sub={`${overall.correct}/${overall.total} correct`} />
          <StatCard label="Incorrect" value={overall.incorrect} sub="missed questions" accent="text-rose-400" />
          <StatCard label="Flagged" value={overall.flagged} sub={`${((overall.flagged / overall.total) * 100).toFixed(1)}% of all`} accent="text-amber-400" />
          <StatCard label="Preptests" value={overall.sources} sub="distinct sources" accent="text-sky-400" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Accuracy over time */}
          <Card className="lg:col-span-2" title="Accuracy by preptest" subtitle="Ordered by preptest number">
            <TrendChart data={bySource} />
          </Card>

          {/* Accuracy by question position within a section */}
          <Card className="lg:col-span-2" title="Accuracy by question # (within section)" subtitle="Position within a section (q01 → end); fewer sections run past q24">
            <QuestionPositionChart data={byQuestion} />
          </Card>

          {/* Accuracy by global question position across the whole test */}
          <Card className="lg:col-span-2" title="Accuracy by question # (whole test)" subtitle="Global position across all sections in order (#1 → end); fewer tests run past ~#98">
            <GlobalPositionChart data={byGlobalQuestion} />
          </Card>

          {/* By type */}
          <Card title="By question type">
            {byType.map((t) => (
              <AccuracyRow key={t.label} label={TYPE_LABELS[t.label] || t.label} accuracy={t.accuracy} total={t.total} />
            ))}
          </Card>

          {/* By section */}
          <Card title="By section position">
            {bySection.map((s) => (
              <AccuracyRow key={s.label} label={s.label} accuracy={s.accuracy} total={s.total} />
            ))}
          </Card>

          {/* Answer distribution */}
          <Card title="Answer distribution" subtitle="Correct key vs. what was selected">
            <AnswerDistChart data={answerDistribution} />
          </Card>

          {/* Per-letter accuracy */}
          <Card title="Accuracy when key is each letter" subtitle="Do you miss more on certain answer letters?">
            <LetterAccuracyChart data={byCorrectLetter} />
          </Card>

          {/* RC error concentration */}
          <Card title="RC error concentration" subtitle="Per passage: are misses clustered or spread out?">
            <RcConcentrationChart data={rcConcentration.distribution} />
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Of {rcConcentration.totalErrors} RC errors across {rcConcentration.totalPassages} passages,{' '}
              <span className="text-slate-300">{rcConcentration.pctErrorsClustered}%</span> came in passages
              with 2+ misses. {rcConcentration.lonePassages} passages had a lone error;{' '}
              {rcConcentration.multiPassages} had multiple — {' '}
              {rcConcentration.pctErrorsClustered >= 50
                ? 'misses lean toward clustering, pointing at whole-passage comprehension.'
                : 'misses are mostly isolated one-offs.'}
            </p>
          </Card>

          {/* Fine-grained categories (only when questions have been classified) */}
          {hasCategories && (
            <>
              <Card
                title="By LR question category"
                subtitle={`Accuracy per type${partial ? ` · ${categoryMeta.classified}/${categoryMeta.total} classified so far` : ''}`}
              >
                {byLrCategory.map((c) => (
                  <AccuracyRow key={c.label} label={titleCase(c.label)} accuracy={c.accuracy} total={c.total} />
                ))}
              </Card>

              <Card
                title="By RC question category"
                subtitle={`Accuracy per type${partial ? ` · ${categoryMeta.classified}/${categoryMeta.total} classified so far` : ''}`}
              >
                {byRcCategory.map((c) => (
                  <AccuracyRow key={c.label} label={titleCase(c.label)} accuracy={c.accuracy} total={c.total} />
                ))}
              </Card>

              {/* Points lost by category — sorted by absolute missed questions, not accuracy */}
              <Card
                title="Points lost by LR category"
                subtitle="Sorted by raw missed questions — high accuracy doesn't mean low cost if volume is large"
              >
                {byLrCategoryByPointsLost.map((c) => (
                  <PointsLostRow key={c.label} label={titleCase(c.label)} accuracy={c.accuracy} total={c.total} pointsLost={c.points_lost} />
                ))}
              </Card>

              <Card
                title="Points lost by RC category"
                subtitle="Sorted by raw missed questions — high accuracy doesn't mean low cost if volume is large"
              >
                {byRcCategoryByPointsLost.map((c) => (
                  <PointsLostRow key={c.label} label={titleCase(c.label)} accuracy={c.accuracy} total={c.total} pointsLost={c.points_lost} />
                ))}
              </Card>

              {/* Wrong but unflagged — false confidence indicator */}
              {(() => {
                const lrMax = Math.max(...byLrCategoryWrongUnflagged.map((c) => c.wrong_unflagged), 1)
                const rcMax = Math.max(...byRcCategoryWrongUnflagged.map((c) => c.wrong_unflagged), 1)
                return (
                  <>
                    <Card
                      title="Wrong but unflagged — LR"
                      subtitle="Incorrect answers you didn't flag: false confidence, not just hard questions"
                    >
                      {byLrCategoryWrongUnflagged.map((c) => (
                        <WrongUnflaggedRow key={c.label} label={titleCase(c.label)} wrongUnflagged={c.wrong_unflagged} total={c.total} maxCount={lrMax} />
                      ))}
                    </Card>

                    <Card
                      title="Wrong but unflagged — RC"
                      subtitle="Incorrect answers you didn't flag: false confidence, not just hard questions"
                    >
                      {byRcCategoryWrongUnflagged.map((c) => (
                        <WrongUnflaggedRow key={c.label} label={titleCase(c.label)} wrongUnflagged={c.wrong_unflagged} total={c.total} maxCount={rcMax} />
                      ))}
                    </Card>
                  </>
                )
              })()}
            </>
          )}

          {/* Flag insight */}
          <Card title="Flagging insight" subtitle="Does flagging track uncertainty?">
            <div className="space-y-4">
              <AccuracyRow label="Flagged" accuracy={flaggedAcc} total={flagBreakdown.flagged.total} />
              <AccuracyRow label="Unflagged" accuracy={unflaggedAcc} total={flagBreakdown.unflagged.total} />
              <p className="text-xs leading-relaxed text-slate-500">
                {flaggedAcc < unflaggedAcc
                  ? `Flagged questions score ${(unflaggedAcc - flaggedAcc).toFixed(1)} pts lower — flagging is tracking genuine uncertainty.`
                  : `Flagged questions score about the same as unflagged — flags may not be tracking difficulty.`}
              </p>
            </div>
          </Card>
        </div>

        <footer className="mt-10 text-center text-xs text-slate-600">
          Generated from {stats.generatedFrom} · rebuild with{' '}
          <code className="rounded bg-slate-900 px-1.5 py-0.5 text-slate-400">npm run stats</code>
        </footer>
      </div>
    </div>
  )
}
