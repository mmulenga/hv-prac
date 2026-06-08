import { useState, useEffect, useRef, useCallback } from 'react'
import GameHeader from '../components/GameHeader'

const TOTAL_TRIALS = 30
const SHOW_MS = 900    // shape visible
const BLANK_MS = 350   // gap between
const TARGET_RATIO = 0.35  // ~35% target trials

const ALL_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross', 'pentagon']
const SHAPE_COLORS = {
  circle: '#3b82f6',
  square: '#8b5cf6',
  triangle: '#f59e0b',
  diamond: '#10b981',
  star: '#ef4444',
  cross: '#ec4899',
  pentagon: '#06b6d4',
}

function generateTrials(target) {
  const targetCount = Math.round(TOTAL_TRIALS * TARGET_RATIO)
  const nontargetCount = TOTAL_TRIALS - targetCount
  const nonTargets = ALL_SHAPES.filter(s => s !== target)

  const trials = [
    ...Array(targetCount).fill(target),
    ...Array.from({ length: nontargetCount }, () => nonTargets[Math.floor(Math.random() * nonTargets.length)]),
  ]

  // Shuffle with constraint: not too many targets in a row
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trials[i], trials[j]] = [trials[j], trials[i]]
  }
  return trials
}

function ShapeSVG({ shape, color, size = 120 }) {
  const c = size / 2
  const r = size * 0.36
  const sw = 3

  switch (shape) {
    case 'circle':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={c} cy={c} r={r} fill={color} />
        </svg>
      )
    case 'square':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <rect x={c - r} y={c - r} width={r * 2} height={r * 2} fill={color} rx={4} />
        </svg>
      )
    case 'triangle':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`${c},${c - r} ${c + r * 0.87},${c + r * 0.5} ${c - r * 0.87},${c + r * 0.5}`}
            fill={color}
          />
        </svg>
      )
    case 'diamond':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon points={`${c},${c - r} ${c + r},${c} ${c},${c + r} ${c - r},${c}`} fill={color} />
        </svg>
      )
    case 'star':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={Array.from({ length: 10 }, (_, i) => {
              const angle = (i * Math.PI) / 5 - Math.PI / 2
              const rad = i % 2 === 0 ? r : r * 0.42
              return `${c + rad * Math.cos(angle)},${c + rad * Math.sin(angle)}`
            }).join(' ')}
            fill={color}
          />
        </svg>
      )
    case 'cross':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <rect x={c - r * 0.28} y={c - r} width={r * 0.56} height={r * 2} fill={color} rx={3} />
          <rect x={c - r} y={c - r * 0.28} width={r * 2} height={r * 0.56} fill={color} rx={3} />
        </svg>
      )
    case 'pentagon':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={Array.from({ length: 5 }, (_, i) => {
              const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2
              return `${c + r * Math.cos(angle)},${c + r * Math.sin(angle)}`
            }).join(' ')}
            fill={color}
          />
        </svg>
      )
    default:
      return null
  }
}

// phase: 'start' | 'playing' | 'blank' | 'results'
export default function ShapeDance({ onEnd, onBack }) {
  const [phase, setPhase] = useState('start')
  const [target, setTarget] = useState('circle')
  const [trials, setTrials] = useState([])
  const [trialIdx, setTrialIdx] = useState(0)
  const [currentShape, setCurrentShape] = useState(null)
  const [clicked, setClicked] = useState(false)
  const [results, setResults] = useState([])  // {shape, isTarget, clicked}
  const [score, setScore] = useState(0)
  const [showFeedback, setShowFeedback] = useState(null) // 'hit'|'miss'|'false-alarm'|null
  const timerRef = useRef(null)
  const clickedRef = useRef(false)

  const clear = () => clearTimeout(timerRef.current)

  const advanceTrial = useCallback((idx, trialList, tgt, prevResults, prevScore) => {
    if (idx >= TOTAL_TRIALS) {
      setPhase('results')
      return
    }
    const shape = trialList[idx]
    setCurrentShape(shape)
    setClicked(false)
    setShowFeedback(null)
    clickedRef.current = false
    setPhase('playing')

    timerRef.current = setTimeout(() => {
      // Time expired — evaluate
      const wasTarget = shape === tgt
      const didClick = clickedRef.current
      let outcome, points
      if (wasTarget && didClick) { outcome = 'hit'; points = 1 }
      else if (!wasTarget && !didClick) { outcome = 'correct-reject'; points = 0.5 }
      else if (wasTarget && !didClick) { outcome = 'miss'; points = -0.5 }
      else { outcome = 'false-alarm'; points = -0.5 }

      const newScore = Math.max(0, prevScore + points)
      const newResults = [...prevResults, { shape, isTarget: wasTarget, outcome }]
      setScore(newScore)
      setResults(newResults)
      if (outcome === 'hit') setShowFeedback('hit')
      else if (outcome === 'false-alarm') setShowFeedback('false-alarm')

      setCurrentShape(null)
      setPhase('blank')
      timerRef.current = setTimeout(() => {
        setShowFeedback(null)
        advanceTrial(idx + 1, trialList, tgt, newResults, newScore)
        setTrialIdx(idx + 1)
      }, BLANK_MS)
    }, SHOW_MS)
  }, [])

  function startGame(tgt) {
    const t = generateTrials(tgt)
    setTrials(t)
    setResults([])
    setScore(0)
    setTrialIdx(0)
    setTarget(tgt)
    advanceTrial(0, t, tgt, [], 0)
  }

  function handleClick() {
    if (phase !== 'playing') return
    clickedRef.current = true
    setClicked(true)
  }

  useEffect(() => () => clear(), [])

  function pickTarget() {
    const t = ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)]
    setTarget(t)
    return t
  }

  if (phase === 'start') {
    const tgt = target
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Shape Dance" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-fade-in">
            <div className="text-6xl">🔺</div>
            <h2 className="text-white text-2xl font-bold">Shape Dance</h2>
            <p className="text-slate-400 leading-relaxed">
              Shapes will flash one at a time. Press the button (or tap) <em>only</em> when
              you see the target shape. Ignore all other shapes.
            </p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• {TOTAL_TRIALS} trials · shapes shown for ~0.9s</li>
              <li>• Hit target: +1 · Miss or false alarm: −0.5</li>
              <li>• Stay focused — shapes move fast!</li>
            </ul>

            {/* Target selector */}
            <div className="bg-hv-card border border-hv-border rounded-xl p-4">
              <p className="text-slate-400 text-sm mb-3">Your target shape:</p>
              <div className="flex justify-center">
                <ShapeSVG shape={tgt} color={SHAPE_COLORS[tgt]} size={80} />
              </div>
              <p className="text-white font-semibold mt-2 capitalize">{tgt}</p>
              <button
                onClick={() => setTarget(ALL_SHAPES[(ALL_SHAPES.indexOf(target) + 1) % ALL_SHAPES.length])}
                className="mt-2 text-xs text-hv-muted hover:text-white transition-colors underline"
              >
                Change target
              </button>
            </div>

            <button
              onClick={() => startGame(tgt)}
              className="w-full py-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold transition-colors"
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'results') {
    const hits = results.filter(r => r.outcome === 'hit').length
    const misses = results.filter(r => r.outcome === 'miss').length
    const falseAlarms = results.filter(r => r.outcome === 'false-alarm').length
    const correctRejects = results.filter(r => r.outcome === 'correct-reject').length
    const targetTrials = results.filter(r => r.isTarget).length
    const hitRate = targetTrials > 0 ? Math.round((hits / targetTrials) * 100) : 0

    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Shape Dance" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full space-y-5 animate-scale-in">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-hv-card border-4 border-rose-600 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-white">{Math.round(score)}</span>
              </div>
              <h2 className="text-white text-2xl font-bold">
                {hitRate >= 80 ? 'Sharp Focus' : hitRate >= 60 ? 'Good' : 'Keep Practicing'}
              </h2>
            </div>

            <div className="bg-hv-card border border-hv-border rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              <div className="text-center">
                <p className="text-emerald-400 font-bold text-xl">{hits}</p>
                <p className="text-hv-muted">Hits</p>
              </div>
              <div className="text-center">
                <p className="text-red-400 font-bold text-xl">{misses}</p>
                <p className="text-hv-muted">Misses</p>
              </div>
              <div className="text-center">
                <p className="text-red-400 font-bold text-xl">{falseAlarms}</p>
                <p className="text-hv-muted">False Alarms</p>
              </div>
              <div className="text-center">
                <p className="text-blue-400 font-bold text-xl">{correctRejects}</p>
                <p className="text-hv-muted">Correct Reject</p>
              </div>
            </div>

            <p className="text-center text-hv-muted text-sm">
              Hit rate: <span className="text-white font-semibold">{hitRate}%</span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setScore(0); setTrialIdx(0); setResults([]); startGame(target) }}
                className="py-3 rounded-xl bg-hv-card border border-hv-border text-white font-semibold hover:border-rose-600 transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={() => onEnd({ score: Math.round(score), hitRate, display: `${hitRate}% hit` })}
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

  const progress = (trialIdx / TOTAL_TRIALS) * 100

  return (
    <div className="min-h-screen bg-hv-bg flex flex-col">
      <GameHeader
        title="Shape Dance"
        onBack={onBack}
        round={trialIdx + (phase === 'playing' ? 1 : 1)}
        totalRounds={TOTAL_TRIALS}
        score={Math.round(score)}
      />

      {/* Progress bar */}
      <div className="h-1 bg-hv-border">
        <div className="h-1 bg-rose-600 transition-all duration-200" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8 select-none">
        {/* Target reminder */}
        <div className="flex items-center gap-3 bg-hv-card border border-hv-border rounded-xl px-4 py-2">
          <span className="text-slate-400 text-sm">Target:</span>
          <ShapeSVG shape={target} color={SHAPE_COLORS[target]} size={32} />
          <span className="text-white font-semibold text-sm capitalize">{target}</span>
        </div>

        {/* Shape arena */}
        <div
          className={`w-48 h-48 rounded-3xl flex items-center justify-center transition-all duration-100
            ${phase === 'playing' && clicked ? 'border-2 border-rose-500 bg-rose-900/20' : 'border-2 border-hv-border bg-hv-card'}
            ${showFeedback === 'hit' ? 'border-emerald-500 bg-emerald-900/20' : ''}
            ${showFeedback === 'false-alarm' ? 'border-red-500 bg-red-900/20' : ''}
          `}
        >
          {phase === 'playing' && currentShape ? (
            <div className="animate-scale-in">
              <ShapeSVG shape={currentShape} color={SHAPE_COLORS[currentShape]} size={120} />
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full bg-hv-border opacity-40" />
          )}
        </div>

        {/* Big tap button */}
        <button
          onMouseDown={handleClick}
          onTouchStart={handleClick}
          disabled={phase !== 'playing' || clicked}
          className={`w-48 h-16 rounded-2xl font-bold text-lg transition-all duration-100
            ${phase === 'playing' && !clicked
              ? 'bg-rose-700 hover:bg-rose-600 active:scale-95 text-white shadow-lg shadow-rose-900/50'
              : 'bg-hv-card border border-hv-border text-hv-muted cursor-not-allowed'
            }
          `}
        >
          {clicked ? '✓ Pressed' : 'TAP'}
        </button>

        {/* Feedback flash */}
        {showFeedback && (
          <p className={`text-sm font-semibold animate-fade-in ${showFeedback === 'hit' ? 'text-emerald-400' : 'text-red-400'}`}>
            {showFeedback === 'hit' ? '✓ Hit!' : '✗ False alarm'}
          </p>
        )}
      </div>
    </div>
  )
}
