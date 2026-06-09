import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const AXIS = { fontSize: 11, fill: '#94a3b8' }
const GRID = '#1e293b'

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  fontSize: 12,
}

// Accuracy across preptests, read left-to-right as a timeline.
export function TrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} interval={2} tickLine={false} />
        <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={(v, _n, p) => [`${v}% (${p.payload.correct}/${p.payload.total})`, 'Accuracy']}
        />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke="#818cf8"
          strokeWidth={2}
          dot={{ r: 2, fill: '#818cf8' }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Accuracy by question position within a section (q01..qNN).
export function QuestionPositionChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} interval={1} tickLine={false} />
        <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: '#e2e8f0' }}
          itemStyle={{ color: '#e2e8f0' }}
          formatter={(v, _n, p) => [`${v}% (${p.payload.correct}/${p.payload.total})`, 'Accuracy']}
        />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke="#38bdf8"
          strokeWidth={2}
          dot={{ r: 2, fill: '#38bdf8' }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Accuracy by global question position across the whole test (#1..#101).
export function GlobalPositionChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} interval={9} tickLine={false} />
        <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: '#e2e8f0' }}
          itemStyle={{ color: '#e2e8f0' }}
          formatter={(v, _n, p) => [`${v}% (${p.payload.correct}/${p.payload.total})`, 'Accuracy']}
        />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke="#a78bfa"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Grouped bars: how often each letter is the key vs how often it was picked.
export function AnswerDistChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="letter" tick={AXIS} tickLine={false} />
        <YAxis tick={AXIS} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#e2e8f0' }} cursor={{ fill: '#1e293b55' }} />
        <Bar dataKey="correctKey" name="Correct key" fill="#34d399" radius={[3, 3, 0, 0]} />
        <Bar dataKey="selected" name="Selected" fill="#818cf8" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// RC error concentration: how many passages had 0, 1, 2... misses.
export function RcConcentrationChart({ data }) {
  const chart = data.map((d) => ({
    label: d.errors === 0 ? 'clean' : `${d.errors} miss${d.errors > 1 ? 'es' : ''}`,
    passages: d.passages,
    errors: d.errors,
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chart} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} />
        <YAxis tick={AXIS} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: '#e2e8f0' }}
          itemStyle={{ color: '#e2e8f0' }}
          cursor={{ fill: '#1e293b55' }}
          formatter={(v) => [`${v} passages`, 'Count']}
        />
        <Bar dataKey="passages" radius={[3, 3, 0, 0]}>
          {chart.map((d) => (
            <Cell key={d.label} fill={d.errors === 0 ? '#334155' : d.errors === 1 ? '#fbbf24' : '#fb7185'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Per-letter accuracy bars, color-graded.
export function LetterAccuracyChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} />
        <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: '#e2e8f0' }}
          itemStyle={{ color: '#e2e8f0' }}
          cursor={{ fill: '#1e293b55' }}
          formatter={(v, _n, p) => [`${v}% (${p.payload.correct}/${p.payload.total})`, 'Accuracy']}
        />
        <Bar dataKey="accuracy" radius={[3, 3, 0, 0]}>
          {data.map((d) => (
            <Cell
              key={d.label}
              fill={d.accuracy >= 85 ? '#34d399' : d.accuracy >= 70 ? '#fbbf24' : '#fb7185'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
