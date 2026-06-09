// Small shared presentational pieces used across the dashboard.

export function Card({ title, subtitle, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/20 ${className}`}
    >
      {title && (
        <header className="mb-4">
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatCard({ label, value, sub, accent = 'text-indigo-400' }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

// Accuracy bar with a points-lost badge on the right.
export function PointsLostRow({ label, accuracy, total, pointsLost }) {
  const color =
    accuracy >= 85 ? 'bg-emerald-500' : accuracy >= 70 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 shrink-0 truncate text-xs text-slate-300" title={label}>
        {label}
      </div>
      <div className="relative h-5 flex-1 overflow-hidden rounded bg-slate-800">
        <div className={`h-full ${color} transition-all`} style={{ width: `${accuracy}%` }} />
      </div>
      <div className="w-14 shrink-0 text-right text-xs tabular-nums text-slate-300">
        {accuracy}%
      </div>
      <div className="w-16 shrink-0 text-right text-xs tabular-nums font-semibold text-rose-400">
        -{pointsLost} pts
      </div>
      <div className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-600">
        n={total}
      </div>
    </div>
  )
}

// Bar scaled to the list maximum, showing wrong-but-unflagged count.
export function WrongUnflaggedRow({ label, wrongUnflagged, total, maxCount }) {
  const barPct = maxCount > 0 ? (wrongUnflagged / maxCount) * 100 : 0
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 shrink-0 truncate text-xs text-slate-300" title={label}>
        {label}
      </div>
      <div className="relative h-5 flex-1 overflow-hidden rounded bg-slate-800">
        <div className="h-full bg-orange-500 transition-all" style={{ width: `${barPct}%` }} />
      </div>
      <div className="w-16 shrink-0 text-right text-xs tabular-nums font-semibold text-orange-400">
        {wrongUnflagged}
      </div>
      <div className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-600">
        n={total}
      </div>
    </div>
  )
}

// Horizontal accuracy bar with label + percentage, color-graded by score.
export function AccuracyRow({ label, accuracy, total }) {
  const color =
    accuracy >= 85 ? 'bg-emerald-500' : accuracy >= 70 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 shrink-0 truncate text-xs text-slate-300" title={label}>
        {label}
      </div>
      <div className="relative h-5 flex-1 overflow-hidden rounded bg-slate-800">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${accuracy}%` }}
        />
      </div>
      <div className="w-14 shrink-0 text-right text-xs tabular-nums text-slate-300">
        {accuracy}%
      </div>
      <div className="w-12 shrink-0 text-right text-[11px] tabular-nums text-slate-600">
        n={total}
      </div>
    </div>
  )
}
