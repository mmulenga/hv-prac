import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getMetric, normalise } from '../hooks/useScores'

const GAME_META = [
  { id: 'numerosity', title: 'Numerosity', color: '#3b82f6', metricLabel: 'Correct', unit: '' },
  { id: 'digitspan',  title: 'Digit Span',  color: '#8b5cf6', metricLabel: 'Max Span', unit: '' },
  { id: 'puzzle',     title: 'Puzzle',      color: '#10b981', metricLabel: 'Correct', unit: '/12' },
  { id: 'flashback',  title: 'Flashback',   color: '#f59e0b', metricLabel: 'Accuracy', unit: '%' },
  { id: 'shapedance', title: 'Shape Dance', color: '#ef4444', metricLabel: 'Hit Rate', unit: '%' },
]

// ── Activity heatmap (last 84 days = 12 weeks) ────────────────────────────
function ActivityHeatmap({ activityMap }) {
  const days = 84
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cells = Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (days - 1 - i))
    const key = d.toISOString().slice(0, 10)
    const count = activityMap[key] || 0
    return { key, count, day: d.getDate(), month: d.getMonth() }
  })

  const maxCount = Math.max(...cells.map(c => c.count), 1)

  function cellColor(count) {
    if (count === 0) return 'bg-hv-border'
    const intensity = count / maxCount
    if (intensity < 0.25) return 'bg-amber-900'
    if (intensity < 0.5)  return 'bg-amber-700'
    if (intensity < 0.75) return 'bg-amber-500'
    return 'bg-amber-400'
  }

  // Group into weeks (columns of 7)
  const weeks = []
  for (let i = 0; i < days; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div>
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map(cell => (
              <div
                key={cell.key}
                title={`${cell.key}: ${cell.count} game${cell.count !== 1 ? 's' : ''}`}
                className={`w-3 h-3 rounded-sm ${cellColor(cell.count)} transition-colors`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-hv-muted">
        <span>Less</span>
        {['bg-hv-border','bg-amber-900','bg-amber-700','bg-amber-500','bg-amber-400'].map(c => (
          <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

// ── Custom chart tooltip ──────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-hv-card border border-hv-border rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-hv-muted text-xs mb-1">{label}</p>
      <p className="text-white font-bold">{payload[0].value}{unit}</p>
    </div>
  )
}

// ── Main Profile component ────────────────────────────────────────────────
export default function Profile({ onBack }) {
  const { user, signOut } = useAuth()
  const [allScores, setAllScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeGameId, setActiveGameId] = useState('numerosity')
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!user || !supabase) { setLoading(false); return }

    Promise.all([
      supabase.from('game_scores').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('profiles').select('display_name').eq('user_id', user.id).single(),
    ]).then(([scoresRes, profileRes]) => {
      setAllScores(scoresRes.data || [])
      setDisplayName(profileRes.data?.display_name || user.email?.split('@')[0] || 'Player')
      setLoading(false)
    })
  }, [user?.id])

  async function saveName() {
    if (!supabase || !user) return
    await supabase.from('profiles').upsert({ user_id: user.id, display_name: nameInput })
    setDisplayName(nameInput)
    setEditingName(false)
  }

  // ── Per-game derived data ──────────────────────────────────────────────
  const activeGame = GAME_META.find(g => g.id === activeGameId)
  const gameScores = allScores.filter(s => s.game_id === activeGameId)

  const trendData = gameScores.slice(-20).map(s => ({
    date: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: getMetric(activeGameId, s.score_data),
  }))

  const personalBest = gameScores.reduce(
    (best, s) => {
      const v = getMetric(activeGameId, s.score_data)
      return v > best.value ? { value: v, display: s.score_data.display } : best
    },
    { value: 0, display: null }
  )

  // ── Radar data (all 5 games, best score each normalised 0–100) ─────────
  const radarData = GAME_META.map(g => {
    const scores = allScores.filter(s => s.game_id === g.id)
    const best = scores.reduce((max, s) => Math.max(max, getMetric(g.id, s.score_data)), 0)
    return { game: g.title, score: normalise(g.id, best), fullMark: 100 }
  })
  const hasAnyScore = radarData.some(d => d.score > 0)

  // ── Activity map ──────────────────────────────────────────────────────
  const activityMap = {}
  allScores.forEach(s => {
    const date = s.created_at.slice(0, 10)
    activityMap[date] = (activityMap[date] || 0) + 1
  })

  // ── Summary stats ─────────────────────────────────────────────────────
  const totalGames = allScores.length
  const sevenDaysAgo = useMemo(() => new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(), [allScores])
  const thisWeek = allScores.filter(s => s.created_at > sevenDaysAgo).length
  const mostPlayed = GAME_META.reduce(
    (top, g) => {
      const n = allScores.filter(s => s.game_id === g.id).length
      return n > top.n ? { title: g.title, n } : top
    },
    { title: '—', n: 0 }
  )

  const initials = displayName.slice(0, 2).toUpperCase()

  if (loading) {
    return (
      <div className="min-h-screen bg-hv-bg flex items-center justify-center">
        <div className="text-hv-muted text-sm">Loading profile…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hv-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-hv-border px-5 py-4 bg-hv-card flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-hv-muted hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-white font-semibold">Profile</h1>
        <button
          onClick={signOut}
          className="text-hv-muted hover:text-white transition-colors text-sm"
        >
          Sign out
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          {/* ── User identity ─────────────────────────────────────────── */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-hv-accent flex items-center justify-center text-white text-xl font-bold shrink-0">
              {initials}
            </div>
            <div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                    className="bg-hv-card border border-hv-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-hv-accent"
                    maxLength={32}
                  />
                  <button onClick={saveName} className="text-hv-accent text-sm hover:text-hv-accent-light">Save</button>
                  <button onClick={() => setEditingName(false)} className="text-hv-muted text-sm hover:text-white">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-lg">{displayName}</span>
                  <button
                    onClick={() => { setNameInput(displayName); setEditingName(true) }}
                    className="text-hv-muted hover:text-white transition-colors"
                    title="Edit display name"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              )}
              <p className="text-hv-muted text-sm mt-0.5">{user?.email}</p>
            </div>
          </div>

          {/* ── Summary cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total games', value: totalGames },
              { label: 'This week', value: thisWeek },
              { label: 'Most played', value: mostPlayed.title },
            ].map(stat => (
              <div key={stat.label} className="bg-hv-card border border-hv-border rounded-xl p-4 text-center">
                <p className="text-white font-bold text-xl leading-tight">{stat.value}</p>
                <p className="text-hv-muted text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* ── Radar chart ───────────────────────────────────────────── */}
          <div className="bg-hv-card border border-hv-border rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Performance Overview</h2>
            {hasAnyScore ? (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="#1e3a5f" />
                  <PolarAngleAxis
                    dataKey="game"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickCount={4}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-hv-muted text-sm">
                Play some games to see your overview
              </div>
            )}
          </div>

          {/* ── Per-game panels ───────────────────────────────────────── */}
          <div className="bg-hv-card border border-hv-border rounded-2xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-hv-border overflow-x-auto scrollbar-none">
              {GAME_META.map(g => (
                <button
                  key={g.id}
                  onClick={() => setActiveGameId(g.id)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    g.id === activeGameId
                      ? 'border-hv-accent text-white'
                      : 'border-transparent text-hv-muted hover:text-white'
                  }`}
                >
                  {g.title}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-6">
              {/* Personal best + play count */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-hv-muted text-xs uppercase tracking-widest">Personal best</p>
                  <p className="text-white text-3xl font-bold mt-1">
                    {personalBest.display ?? '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-hv-muted text-xs uppercase tracking-widest">Plays</p>
                  <p className="text-white text-3xl font-bold mt-1">{gameScores.length}</p>
                </div>
              </div>

              {/* Score trend */}
              {trendData.length > 1 ? (
                <div>
                  <p className="text-hv-muted text-xs uppercase tracking-widest mb-3">
                    Score trend · last {trendData.length} runs
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<ChartTooltip unit={activeGame.unit} />} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={activeGame.color}
                        strokeWidth={2}
                        dot={{ fill: activeGame.color, r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-hv-muted text-sm border border-dashed border-hv-border rounded-xl">
                  {gameScores.length === 0
                    ? 'No plays yet — start a game!'
                    : 'Play at least 2 rounds to see a trend'}
                </div>
              )}
            </div>
          </div>

          {/* ── Activity heatmap ──────────────────────────────────────── */}
          <div className="bg-hv-card border border-hv-border rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Activity · last 12 weeks</h2>
            <ActivityHeatmap activityMap={activityMap} />
          </div>

        </div>
      </div>
    </div>
  )
}
