import { useState, useRef, useEffect } from 'react'
import GameHeader from '../components/GameHeader'

const TOTAL_ROUNDS = 20
const FEEDBACK_MS  = 900

const SYMS = ['circle', 'star', 'triangle', 'square', 'diamond', 'cross']
const SYM_CLR = {
  circle: '#60a5fa', star: '#fbbf24', triangle: '#f87171',
  square: '#34d399',  diamond: '#c084fc', cross: '#fb923c',
}

const iconCount = d => d < 3 ? 2 : d < 6 ? 3 : d < 9 ? 4 : 5
const cubeCount = d => d < 7 ? 4 : 6
const roundSecs = d => Math.max(8, 18 - d)
const wobbleSec = d => d < 3 ? 0 : d < 6 ? 5 : d < 9 ? 3 : 2

function mkPat(n) {
  return Array.from({ length: n }, () => SYMS[~~(Math.random() * SYMS.length)]).sort()
}
function patEq(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]) }

function genRound(diff) {
  const n  = iconCount(diff)
  const k  = cubeCount(diff)
  const mp = mkPat(n)

  const dists = []
  for (let t = 0; dists.length < k - 2 && t < 500; t++) {
    const p = mkPat(n)
    if (!patEq(p, mp) && !dists.some(d => patEq(d, p))) dists.push(p)
  }

  const pos = Array.from({ length: k }, (_, i) => i).sort(() => Math.random() - 0.5)
  const [a1, a2] = [pos[0], pos[1]].sort((a, b) => a - b)

  const pats = Array.from({ length: k }, (_, i) => {
    if (i === a1 || i === a2) return [...mp]
    const d = dists.shift()
    return d ?? mkPat(n)
  })

  return { pats, answer: [a1, a2], wobble: wobbleSec(diff) }
}

// SVG icon placed at (cx,cy) in a 100×100 viewbox
function Sym({ name, cx, cy, sz = 18 }) {
  const r = sz * 0.42
  const c = SYM_CLR[name]
  if (name === 'circle')   return <circle cx={cx} cy={cy} r={r} fill={c} />
  if (name === 'square')   return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={c} rx={2} />
  if (name === 'triangle') return <polygon points={`${cx},${cy - r} ${cx + r * .87},${cy + r * .5} ${cx - r * .87},${cy + r * .5}`} fill={c} />
  if (name === 'diamond')  return <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={c} />
  if (name === 'star')     return <polygon fill={c} points={Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5 - Math.PI / 2, rad = i % 2 === 0 ? r : r * .4; return `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}` }).join(' ')} />
  if (name === 'cross')    return <g fill={c}><rect x={cx - r * .25} y={cy - r} width={r * .5} height={r * 2} rx={1} /><rect x={cx - r} y={cy - r * .25} width={r * 2} height={r * .5} rx={1} /></g>
  return null
}

const ICON_POS = {
  2: [[34, 50], [66, 50]],
  3: [[50, 28], [30, 68], [70, 68]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [66, 26], [46, 52], [26, 76], [68, 76]],
}

function Cube({ pat, idx, selected, answer, result, wobble, onClick, disabled }) {
  const pos   = ICON_POS[pat.length] || ICON_POS[2]
  const isSel = selected.includes(idx)
  const isAns = answer.includes(idx)

  let border = 'border-hv-border'
  let bg     = 'bg-hv-card'

  if (result !== null) {
    if (isAns)      { border = 'border-emerald-500'; bg = 'bg-emerald-950/30' }
    else if (isSel) { border = 'border-red-500';     bg = 'bg-red-950/30' }
  } else if (isSel) {
    border = 'border-blue-400'; bg = 'bg-blue-950/30'
  } else if (!disabled) {
    border = 'border-hv-border hover:border-slate-400'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-36 h-36 rounded-2xl border-2 flex items-center justify-center
        transition-all duration-100 active:scale-95 ${border} ${bg}`}
      style={wobble > 0 ? { animation: `cubeWobble ${wobble}s ease-in-out infinite` } : undefined}
    >
      <svg width={96} height={96} viewBox="0 0 100 100">
        {pos.map(([px, py], i) => <Sym key={i} name={pat[i]} cx={px} cy={py} />)}
      </svg>
      {isSel && result === null && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">{selected.indexOf(idx) + 1}</span>
        </div>
      )}
    </button>
  )
}

// phase: 'start' | 'playing' | 'results'
export default function ShapeDance({ onEnd, onBack }) {
  const [phase,    setPhase]    = useState('start')
  const [round,    setRound]    = useState(null)
  const [selected, setSelected] = useState([])
  const [result,   setResult]   = useState(null)  // null | true | false
  const [score,    setScore]    = useState(0)
  const [roundNum, setRoundNum] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)

  const diffRef     = useRef(0)
  const roundNumRef = useRef(0)
  const resultRef   = useRef(null)
  const answerRef   = useRef([])
  const selectedRef = useRef([])
  const timeLeftRef = useRef(0)
  const timerRef    = useRef(null)
  const fbTimerRef  = useRef(null)

  function clearAll() {
    clearInterval(timerRef.current)
    clearTimeout(fbTimerRef.current)
  }

  function startRound(diff, num) {
    clearAll()
    const r = genRound(diff)
    const t = roundSecs(diff)

    roundNumRef.current = num
    resultRef.current   = null
    answerRef.current   = r.answer
    selectedRef.current = []
    timeLeftRef.current = t

    setRound(r)
    setSelected([])
    setResult(null)
    setRoundNum(num)
    setTimeLeft(t)

    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1
      setTimeLeft(timeLeftRef.current)
      if (timeLeftRef.current <= 0) {
        clearInterval(timerRef.current)
        if (resultRef.current === null) finishRound(false)
      }
    }, 1000)
  }

  function finishRound(correct) {
    clearAll()
    resultRef.current = correct
    setResult(correct)
    if (correct) setScore(s => s + 1)

    fbTimerRef.current = setTimeout(() => {
      const next = roundNumRef.current + 1
      if (next >= TOTAL_ROUNDS) { setPhase('results'); return }
      if (correct) diffRef.current = Math.min(12, diffRef.current + 1)
      else         diffRef.current = Math.max(0,  diffRef.current - 1)
      startRound(diffRef.current, next)
    }, FEEDBACK_MS)
  }

  function handleCubeClick(idx) {
    if (resultRef.current !== null) return
    if (selectedRef.current.length >= 2) return

    let next
    if (selectedRef.current.includes(idx)) {
      next = selectedRef.current.filter(i => i !== idx)
    } else {
      next = [...selectedRef.current, idx]
    }

    selectedRef.current = next
    setSelected([...next])

    if (next.length === 2) {
      const ans = answerRef.current
      const ok  = ans.includes(next[0]) && ans.includes(next[1])
      finishRound(ok)
    }
  }

  function startGame() {
    diffRef.current = 0
    setScore(0)
    setPhase('playing')
    startRound(0, 0)
  }

  useEffect(() => () => clearAll(), [])

  // ── Start screen ──────────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Shape Dance" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-fade-in">
            <div className="text-6xl">🎲</div>
            <h2 className="text-white text-2xl font-bold">Shape Dance</h2>
            <p className="text-slate-400 leading-relaxed">
              Four cubes appear on screen — each face shows a unique arrangement of symbols.
              Two cubes share an identical pattern. Find the matching pair before time runs out.
              Cubes wobble as difficulty increases, making patterns harder to read.
            </p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• {TOTAL_ROUNDS} rounds · adaptive difficulty</li>
              <li>• More symbols &amp; motion at higher levels</li>
              <li>• Tap the 2 matching cubes to score</li>
            </ul>
            <button
              onClick={startGame}
              className="w-full py-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold transition-colors"
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Results screen ────────────────────────────────────────────────────────
  if (phase === 'results') {
    const pct = Math.round((score / TOTAL_ROUNDS) * 100)
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Shape Dance" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-scale-in">
            <div className="w-24 h-24 mx-auto rounded-full bg-hv-card border-4 border-rose-600 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{score}</span>
            </div>
            <div>
              <h2 className="text-white text-2xl font-bold">
                {pct >= 80 ? 'Sharp Eye' : pct >= 60 ? 'Good' : 'Keep Practicing'}
              </h2>
              <p className="text-slate-400 mt-1">{score} / {TOTAL_ROUNDS} correct</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={startGame}
                className="py-3 rounded-xl bg-hv-card border border-hv-border text-white font-semibold hover:border-rose-600 transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={() => onEnd({ score, total: TOTAL_ROUNDS, display: `${score}/${TOTAL_ROUNDS}` })}
                className="py-3 rounded-xl bg-rose-700 text-white font-semibold hover:bg-rose-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Playing screen ────────────────────────────────────────────────────────
  if (!round) return null

  const maxSecs  = roundSecs(diffRef.current)
  const timerPct = Math.max(0, (timeLeft / maxSecs) * 100)

  return (
    <div className="min-h-screen bg-hv-bg flex flex-col">
      <GameHeader
        title="Shape Dance"
        onBack={onBack}
        round={roundNum + 1}
        totalRounds={TOTAL_ROUNDS}
        score={score}
      />

      <div className="h-1.5 bg-hv-border">
        <div
          className={`h-1.5 transition-all duration-1000 ${timeLeft > 8 ? 'bg-rose-600' : timeLeft > 4 ? 'bg-amber-500' : 'bg-red-400'}`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        {/* Status row */}
        <div className="flex items-center gap-4">
          <p className={`text-sm font-semibold ${
            result === null ? 'text-hv-muted' :
            result ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {result === null
              ? selected.length === 0 ? 'Find the matching pair' : `${selected.length}/2 selected`
              : result ? '✓ Correct!' : '✗ Wrong pair'
            }
          </p>
          <span className={`font-bold tabular-nums text-sm ${timeLeft <= 4 ? 'text-red-400' : 'text-hv-muted'}`}>
            {timeLeft}s
          </span>
        </div>

        {/* Cube grid */}
        <div className={`grid gap-3 ${round.pats.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {round.pats.map((pat, idx) => (
            <Cube
              key={idx}
              idx={idx}
              pat={pat}
              selected={selected}
              answer={result !== null ? round.answer : []}
              result={result}
              wobble={round.wobble}
              onClick={() => handleCubeClick(idx)}
              disabled={result !== null}
            />
          ))}
        </div>

        <p className="text-hv-muted text-xs">Level {diffRef.current + 1}</p>
      </div>
    </div>
  )
}
