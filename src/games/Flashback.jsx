import { useState, useRef, useEffect } from 'react'
import GameHeader from '../components/GameHeader'

const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star']
const COLORS = {
  circle:   '#3b82f6',
  square:   '#8b5cf6',
  triangle: '#f59e0b',
  diamond:  '#10b981',
  star:     '#ef4444',
}

const TOTAL_TRIALS = 25
const DISPLAY_MS   = 2500   // shape shown + response window
const FEEDBACK_MS  = 500    // green/red flash
const BLANK_MS     = 400    // blank between trials
const TARGET_RATE  = 0.33   // ~1/3 of trials are n-back matches

function buildSequence(nBack) {
  const shapes  = []
  const targets = []

  for (let i = 0; i < TOTAL_TRIALS; i++) {
    if (i < nBack) {
      shapes.push(SHAPES[~~(Math.random() * SHAPES.length)])
      targets.push(false)
    } else {
      const isTarget = Math.random() < TARGET_RATE
      if (isTarget) {
        shapes.push(shapes[i - nBack])
      } else {
        let s
        do { s = SHAPES[~~(Math.random() * SHAPES.length)] }
        while (s === shapes[i - nBack])
        shapes.push(s)
      }
      targets.push(isTarget)
    }
  }
  return { shapes, targets }
}

function ShapeSVG({ name, size = 110 }) {
  const c = size / 2, r = size * 0.36
  const fill = COLORS[name]
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={name}>
      {name === 'circle' && (
        <circle cx={c} cy={c} r={r} fill={fill} />
      )}
      {name === 'square' && (
        <rect x={c - r} y={c - r} width={r * 2} height={r * 2} fill={fill} rx={8} />
      )}
      {name === 'triangle' && (
        <polygon
          points={`${c},${c - r} ${c + r * 0.87},${c + r * 0.5} ${c - r * 0.87},${c + r * 0.5}`}
          fill={fill}
        />
      )}
      {name === 'diamond' && (
        <polygon
          points={`${c},${c - r} ${c + r},${c} ${c},${c + r} ${c - r},${c}`}
          fill={fill}
        />
      )}
      {name === 'star' && (
        <polygon
          fill={fill}
          points={Array.from({ length: 10 }, (_, i) => {
            const a = (i * Math.PI) / 5 - Math.PI / 2
            const rad = i % 2 === 0 ? r : r * 0.42
            return `${c + rad * Math.cos(a)},${c + rad * Math.sin(a)}`
          }).join(' ')}
        />
      )}
    </svg>
  )
}

// ── Small shape preview used in the N-back reminder ────────────────────────
function ShapeChip({ name }) {
  if (!name) {
    return (
      <div className="w-8 h-8 rounded border border-dashed border-hv-muted flex items-center justify-center">
        <span className="text-hv-muted text-xs">?</span>
      </div>
    )
  }
  return (
    <div className="w-8 h-8 flex items-center justify-center">
      <ShapeSVG name={name} size={28} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
// phase: 'start' | 'playing' | 'results'
// trialPhase: 'display' | 'feedback' | 'blank'

export default function Flashback({ onEnd, onBack }) {
  const [phase,       setPhase]       = useState('start')
  const [nBack,       setNBack]       = useState(1)
  const [trialIdx,    setTrialIdx]    = useState(0)
  const [trialPhase,  setTrialPhase]  = useState('blank')
  const [shownShape,  setShownShape]  = useState(null)
  const [feedback,    setFeedback]    = useState(null)  // 'correct' | 'wrong'
  const [timerPct,    setTimerPct]    = useState(100)
  const [results,     setResults]     = useState([])

  // Refs: values needed inside timer callbacks without stale closures
  const seqRef          = useRef({ shapes: [], targets: [] })
  const trialIdxRef     = useRef(0)
  const respondedRef    = useRef(false)
  const phaseRef        = useRef('start')
  const trialPhaseRef   = useRef('blank')
  const nBackRef        = useRef(1)
  const timersRef       = useRef([])
  const tickIntervalRef = useRef(null)

  function clearAll() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    clearInterval(tickIntervalRef.current)
  }

  function addTimer(fn, ms) {
    const id = setTimeout(fn, ms)
    timersRef.current.push(id)
  }

  // ── Submit a response (or timeout → treat as NO MATCH) ──────────────────
  function submitResponse(idx, response) {
    clearAll()
    const { shapes, targets } = seqRef.current
    const isTarget = targets[idx]
    const isMatch  = response === 'match'
    const correct  = isMatch === isTarget

    respondedRef.current = true
    trialPhaseRef.current = 'feedback'
    setFeedback(correct ? 'correct' : 'wrong')
    setTrialPhase('feedback')
    setResults(prev => [...prev, { shape: shapes[idx], isTarget, response, correct }])

    addTimer(() => {
      trialPhaseRef.current = 'blank'
      setTrialPhase('blank')
      setShownShape(null)
      addTimer(() => runTrial(idx + 1), BLANK_MS)
    }, FEEDBACK_MS)
  }

  // ── Start a trial ─────────────────────────────────────────────────────────
  function runTrial(idx) {
    if (idx >= TOTAL_TRIALS) {
      phaseRef.current = 'results'
      setPhase('results')
      return
    }

    trialIdxRef.current = idx
    respondedRef.current = false
    trialPhaseRef.current = 'display'
    setTrialIdx(idx)
    setFeedback(null)
    setTimerPct(100)
    setShownShape(seqRef.current.shapes[idx])
    setTrialPhase('display')

    // Countdown bar
    const start = Date.now()
    clearInterval(tickIntervalRef.current)
    tickIntervalRef.current = setInterval(() => {
      setTimerPct(Math.max(0, 100 - ((Date.now() - start) / DISPLAY_MS) * 100))
    }, 40)

    // Auto-advance as "no match" if no response
    addTimer(() => {
      clearInterval(tickIntervalRef.current)
      if (!respondedRef.current) submitResponse(idx, 'no-match')
    }, DISPLAY_MS)
  }

  // ── Handle button press ───────────────────────────────────────────────────
  function handleResponse(resp) {
    if (respondedRef.current)           return
    if (phaseRef.current !== 'playing') return
    if (trialPhaseRef.current !== 'display') return
    submitResponse(trialIdxRef.current, resp)
  }

  // ── Start the whole game ──────────────────────────────────────────────────
  function startGame(n) {
    clearAll()
    nBackRef.current = n
    const seq = buildSequence(n)
    seqRef.current = seq
    setNBack(n)
    setResults([])
    phaseRef.current = 'playing'
    setPhase('playing')
    addTimer(() => runTrial(0), 700)
  }

  // Keyboard: M / Space = match,  N = no match
  useEffect(() => {
    function onKey(e) {
      if (['Space', 'KeyM', 'ArrowRight'].includes(e.code)) {
        e.preventDefault()
        handleResponse('match')
      }
      if (['KeyN', 'ArrowLeft'].includes(e.code)) {
        handleResponse('no-match')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearAll(), [])

  // ── Start screen ──────────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Flashback" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="text-5xl mb-3">💡</div>
              <h2 className="text-white text-2xl font-bold">Flashback</h2>
              <p className="text-slate-400 mt-2 text-sm leading-relaxed">
                A sequence of shapes appears one at a time. For each shape, decide whether
                it <strong className="text-white">matches the shape N steps earlier</strong> in
                the sequence.
              </p>
            </div>

            {/* Visual example */}
            <div className="bg-hv-card border border-hv-border rounded-xl p-4">
              <p className="text-hv-muted text-xs uppercase tracking-widest mb-3 text-center">Example (1-Back)</p>
              <div className="flex items-center justify-center gap-2">
                {['circle','square','circle','triangle'].map((s, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`rounded-lg p-1 border ${i === 3 ? 'border-dashed border-hv-muted' : 'border-transparent'}`}>
                      <ShapeSVG name={s} size={36} />
                    </div>
                    <span className="text-hv-muted text-xs">{i + 1}</span>
                  </div>
                ))}
                <div className="flex flex-col items-center gap-1 ml-1">
                  <div className="rounded-full bg-emerald-800 border border-emerald-600 px-2 py-0.5">
                    <span className="text-emerald-300 text-xs font-bold">MATCH</span>
                  </div>
                  <span className="text-hv-muted text-xs">3→4</span>
                </div>
              </div>
              <p className="text-slate-400 text-xs text-center mt-2">
                Shape 4 (triangle) ≠ shape 3 (circle) → <span className="text-red-400">No Match</span>.
                Shape 3 (circle) = shape 2 (circle)? — wait, shape 2 is square. So: shape 3 = circle, shape 2 = square → No match.
              </p>
            </div>

            {/* Level picker */}
            <div className="space-y-2">
              <p className="text-slate-400 text-xs text-center uppercase tracking-widest">Choose level</p>
              {[
                { n: 1, label: '1-Back', desc: 'Compare to 1 shape ago', tag: 'Easiest' },
                { n: 2, label: '2-Back', desc: 'Compare to 2 shapes ago', tag: 'Medium' },
                { n: 3, label: '3-Back', desc: 'Compare to 3 shapes ago', tag: 'Hard' },
              ].map(({ n, label, desc, tag }) => (
                <button
                  key={n}
                  onClick={() => startGame(n)}
                  className="w-full p-4 rounded-xl border-2 border-hv-border bg-hv-card text-left hover:border-amber-500 transition-all active:scale-[0.98]"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold">{label}</span>
                    <span className="text-amber-400 text-xs font-semibold">{tag}</span>
                  </div>
                  <p className="text-hv-muted text-sm mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Results screen ────────────────────────────────────────────────────────
  if (phase === 'results') {
    const hits          = results.filter(r => r.isTarget  && r.response === 'match').length
    const misses        = results.filter(r => r.isTarget  && r.response !== 'match').length
    const falseAlarms   = results.filter(r => !r.isTarget && r.response === 'match').length
    const correctRejects = results.filter(r => !r.isTarget && r.response !== 'match').length
    const correct       = results.filter(r => r.correct).length
    const accuracy      = Math.round((correct / results.length) * 100)
    const grade = accuracy >= 85 ? 'Excellent' : accuracy >= 68 ? 'Good' : 'Keep Practicing'

    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Flashback" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full space-y-5 animate-scale-in">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-hv-card border-4 border-amber-500 flex items-center justify-center mb-3">
                <span className="text-3xl font-bold text-white">{accuracy}%</span>
              </div>
              <h2 className="text-white text-2xl font-bold">{grade}</h2>
              <p className="text-slate-400 mt-1 text-sm">{nBack}-Back · {TOTAL_TRIALS} trials</p>
            </div>

            <div className="bg-hv-card border border-hv-border rounded-xl p-4 grid grid-cols-2 gap-4 text-center text-sm">
              <div>
                <p className="text-emerald-400 font-bold text-xl">{hits}</p>
                <p className="text-hv-muted">Hits</p>
              </div>
              <div>
                <p className="text-emerald-400 font-bold text-xl">{correctRejects}</p>
                <p className="text-hv-muted">Correct Rejects</p>
              </div>
              <div>
                <p className="text-red-400 font-bold text-xl">{misses}</p>
                <p className="text-hv-muted">Misses</p>
              </div>
              <div>
                <p className="text-red-400 font-bold text-xl">{falseAlarms}</p>
                <p className="text-hv-muted">False Alarms</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setResults([]); startGame(nBack) }}
                className="py-3 rounded-xl bg-hv-card border border-hv-border text-white font-semibold hover:border-amber-500 transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={() => { clearAll(); setPhase('start') }}
                className="py-3 rounded-xl bg-hv-card border border-hv-border text-white font-semibold hover:border-amber-500 transition-colors"
              >
                Change Level
              </button>
            </div>
            <button
              onClick={() => onEnd({ accuracy, nBack, display: `${accuracy}% (${nBack}-back)` })}
              className="w-full py-3 rounded-xl bg-amber-700 text-white font-semibold hover:bg-amber-600 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Playing screen ────────────────────────────────────────────────────────
  const { shapes } = seqRef.current
  // The shape the player must compare against (n steps back)
  const nBackShape = trialIdx >= nBack ? shapes[trialIdx - nBack] : null

  return (
    <div className="min-h-screen bg-hv-bg flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-hv-border bg-hv-card">
        <button
          onClick={onBack}
          className="text-hv-muted hover:text-white transition-colors text-sm flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="text-center">
          <p className="text-white font-bold">{nBack}-Back</p>
          <p className="text-hv-muted text-xs">{trialIdx + 1} / {TOTAL_TRIALS}</p>
        </div>
        <div className="text-right">
          <p className="text-white font-bold text-lg leading-none">
            {results.filter(r => r.correct).length}
          </p>
          <p className="text-hv-muted text-xs">correct</p>
        </div>
      </div>

      {/* Countdown bar */}
      <div className="h-1.5 bg-hv-border">
        <div
          className={`h-1.5 ${timerPct > 50 ? 'bg-amber-500' : timerPct > 20 ? 'bg-orange-500' : 'bg-red-500'}`}
          style={{
            width: trialPhase === 'display' ? `${timerPct}%` : '0%',
            transition: trialPhase === 'display' ? 'none' : 'width 0.15s',
          }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">

        {/* N-back reminder strip */}
        <div className="flex items-center gap-3 bg-hv-card border border-hv-border rounded-xl px-4 py-2.5 w-full max-w-xs">
          <div className="flex-1 text-center">
            <p className="text-hv-muted text-xs mb-1">{nBack} step{nBack > 1 ? 's' : ''} ago</p>
            <ShapeChip name={nBackShape} />
          </div>
          <div className="text-hv-muted text-lg">→</div>
          <div className="flex-1 text-center">
            <p className="text-hv-muted text-xs mb-1">now</p>
            <ShapeChip name={trialPhase === 'display' ? shownShape : null} />
          </div>
          <div className="ml-2">
            <p className="text-hv-muted text-xs">Match?</p>
          </div>
        </div>

        {/* Main shape display */}
        <div
          className={`w-44 h-44 rounded-3xl flex items-center justify-center border-2 transition-colors duration-100
            ${trialPhase === 'feedback' && feedback === 'correct'
              ? 'border-emerald-500 bg-emerald-900/25'
              : trialPhase === 'feedback' && feedback === 'wrong'
              ? 'border-red-500 bg-red-900/20'
              : trialPhase === 'display'
              ? 'border-hv-border bg-hv-card'
              : 'border-transparent bg-transparent'}`}
        >
          {trialPhase === 'display' && shownShape && (
            <div className="animate-scale-in" key={trialIdx}>
              <ShapeSVG name={shownShape} size={110} />
            </div>
          )}
          {trialPhase === 'feedback' && (
            <span className={`text-5xl animate-scale-in ${feedback === 'correct' ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedback === 'correct' ? '✓' : '✗'}
            </span>
          )}
          {trialPhase === 'blank' && (
            <div className="w-3 h-3 rounded-full bg-hv-border opacity-30" />
          )}
        </div>

        {/* Shape name */}
        {trialPhase === 'display' && shownShape && (
          <p className="text-hv-muted text-sm capitalize -mt-1">{shownShape}</p>
        )}

        {/* MATCH / NO MATCH buttons */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs mt-2">
          <button
            onMouseDown={() => handleResponse('no-match')}
            onTouchStart={(e) => { e.preventDefault(); handleResponse('no-match') }}
            disabled={trialPhase !== 'display'}
            className={`py-5 rounded-2xl font-bold text-base border-2 transition-all duration-100
              ${trialPhase === 'display'
                ? 'bg-hv-card border-hv-border text-white hover:border-red-500 hover:bg-red-950/40 active:scale-95'
                : 'bg-transparent border-transparent text-hv-muted cursor-not-allowed opacity-30'}`}
          >
            ✗ No Match
          </button>
          <button
            onMouseDown={() => handleResponse('match')}
            onTouchStart={(e) => { e.preventDefault(); handleResponse('match') }}
            disabled={trialPhase !== 'display'}
            className={`py-5 rounded-2xl font-bold text-base border-2 transition-all duration-100
              ${trialPhase === 'display'
                ? 'bg-amber-700 border-amber-600 text-white hover:bg-amber-600 active:scale-95'
                : 'bg-transparent border-transparent text-hv-muted cursor-not-allowed opacity-30'}`}
          >
            ✓ Match
          </button>
        </div>

        {/* Keyboard hint */}
        <p className="text-hv-muted text-xs">
          <kbd className="px-1.5 py-0.5 bg-hv-border rounded text-xs">N</kbd>{' '}
          No Match ·{' '}
          <kbd className="px-1.5 py-0.5 bg-hv-border rounded text-xs">M</kbd>{' '}
          or{' '}
          <kbd className="px-1.5 py-0.5 bg-hv-border rounded text-xs">Space</kbd>{' '}
          Match
        </p>
      </div>
    </div>
  )
}
