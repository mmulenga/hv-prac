import { useState, useEffect, useRef, useCallback } from 'react'
import GameHeader from '../components/GameHeader'

const GAME_DURATION = 90   // seconds
const GRID_SIZE = 6
const OPS = ['+', '-', '×', '÷']
const OP_LABELS = { '+': 'Addition', '-': 'Subtraction', '×': 'Multiplication', '÷': 'Division' }

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateRound(difficulty) {
  const op = OPS[Math.floor(Math.random() * OPS.length)]
  const maxNum = 10 + difficulty * 3
  let a, b, target

  switch (op) {
    case '+':
      a = randInt(1, maxNum)
      b = randInt(1, maxNum)
      target = a + b
      break
    case '-':
      a = randInt(3, maxNum)
      b = randInt(1, a - 1)
      target = a - b
      break
    case '×':
      a = randInt(2, Math.min(12, 3 + difficulty))
      b = randInt(2, Math.min(12, 3 + difficulty))
      target = a * b
      break
    case '÷': {
      const divisor = randInt(2, Math.min(10, 3 + difficulty))
      const quotient = randInt(2, Math.min(12, 3 + difficulty))
      a = divisor * quotient
      b = divisor
      target = quotient
      break
    }
    default:
      a = 1; b = 1; target = 2
  }

  // Build tile pool: correct pair + distractors that don't accidentally solve it
  const correctSet = new Set([a, b])
  const distractors = []
  let attempts = 0
  while (distractors.length < GRID_SIZE - 2 && attempts < 200) {
    const d = randInt(1, Math.max(a, b, target) + 5)
    if (!correctSet.has(d) && !distractors.includes(d)) {
      distractors.push(d)
    }
    attempts++
  }

  const numbers = shuffle([a, b, ...distractors].slice(0, GRID_SIZE))
  return { op, target, numbers, answerPair: [a, b] }
}

function isCorrectPair(op, n1, n2, target) {
  switch (op) {
    case '+': return n1 + n2 === target
    case '-': return Math.abs(n1 - n2) === target
    case '×': return n1 * n2 === target
    case '÷':
      return (n2 !== 0 && Number.isInteger(n1 / n2) && n1 / n2 === target) ||
             (n1 !== 0 && Number.isInteger(n2 / n1) && n2 / n1 === target)
    default: return false
  }
}

// phase: 'start' | 'playing' | 'results'
export default function Numerosity({ onEnd, onBack }) {
  const [phase, setPhase] = useState('start')
  const [round, setRound] = useState(null)
  const [selected, setSelected] = useState([])   // up to 2 tile indices
  const [feedback, setFeedback] = useState(null) // null | 'correct' | 'wrong'
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)

  // Refs for values needed inside timer/callback closures without stale reads
  const difficultyRef = useRef(0)
  const feedbackActiveRef = useRef(false)
  const phaseRef = useRef('start')
  const roundRef = useRef(null)
  const countdownRef = useRef(null)
  const feedbackTimerRef = useRef(null)

  function setPhaseSync(p) { phaseRef.current = p; setPhase(p) }

  function spawnRound() {
    const r = generateRound(difficultyRef.current)
    roundRef.current = r
    setRound({ ...r })
    setSelected([])
    setFeedback(null)
    feedbackActiveRef.current = false
  }

  const endGame = useCallback(() => {
    clearInterval(countdownRef.current)
    clearTimeout(feedbackTimerRef.current)
    setPhaseSync('results')
  }, [])

  function startGame() {
    difficultyRef.current = 0
    feedbackActiveRef.current = false
    setScore(0)
    setTotal(0)
    setTimeLeft(GAME_DURATION)
    spawnRound()
    setPhaseSync('playing')

    countdownRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(); return 0 }
        return t - 1
      })
    }, 1000)
  }

  function handleTileClick(idx) {
    if (phaseRef.current !== 'playing' || feedbackActiveRef.current) return

    setSelected(prev => {
      // Deselect if already selected
      if (prev.includes(idx)) return prev.filter(i => i !== idx)
      const next = [...prev, idx]

      if (next.length === 2) {
        feedbackActiveRef.current = true
        const r = roundRef.current
        const n1 = r.numbers[next[0]]
        const n2 = r.numbers[next[1]]
        const correct = isCorrectPair(r.op, n1, n2, r.target)

        if (correct) {
          difficultyRef.current = Math.min(difficultyRef.current + 1, 8)
          setScore(s => s + 1)
        }
        setTotal(t => t + 1)
        setFeedback(correct ? 'correct' : 'wrong')

        feedbackTimerRef.current = setTimeout(() => {
          if (phaseRef.current === 'playing') spawnRound()
        }, 700)
      }

      return next
    })
  }

  useEffect(() => () => {
    clearInterval(countdownRef.current)
    clearTimeout(feedbackTimerRef.current)
  }, [])

  // ── Start screen ──────────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Numerosity" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-5 animate-fade-in">
            <div className="text-5xl">🔢</div>
            <h2 className="text-white text-2xl font-bold">Numerosity</h2>
            <p className="text-slate-400 leading-relaxed">
              An operation symbol will appear at the top of each round.
              Select the <strong className="text-white">two numbers</strong> from the grid that,
              when combined using that operation, equal the target result.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {OPS.map(op => (
                <div key={op} className="bg-hv-card border border-hv-border rounded-lg p-3 text-left">
                  <span className="text-2xl font-bold text-white mr-2">{op}</span>
                  <span className="text-hv-muted">{OP_LABELS[op]}</span>
                </div>
              ))}
            </div>
            <ul className="text-sm text-slate-400 space-y-1 text-left">
              <li>• {GAME_DURATION} second time limit</li>
              <li>• Answer as many as possible before time runs out</li>
              <li>• Difficulty increases with correct answers</li>
            </ul>
            <button
              onClick={startGame}
              className="w-full py-3 rounded-xl bg-hv-accent hover:bg-hv-accent-light text-white font-semibold transition-colors"
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
    const pct = total > 0 ? Math.round((score / total) * 100) : 0
    const grade = score >= 20 ? 'Exceptional' : score >= 14 ? 'Strong' : score >= 8 ? 'Good' : 'Keep Practicing'
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Numerosity" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-scale-in">
            <div className="w-24 h-24 mx-auto rounded-full bg-hv-card border-4 border-hv-accent flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{score}</span>
            </div>
            <div>
              <h2 className="text-white text-2xl font-bold">{grade}</h2>
              <p className="text-slate-400 mt-1">{score} correct of {total} attempted ({pct}%)</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={startGame}
                className="py-3 rounded-xl bg-hv-card border border-hv-border text-white font-semibold hover:border-hv-accent transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={() => onEnd({ score, total, display: `${score} correct` })}
                className="py-3 rounded-xl bg-hv-accent text-white font-semibold hover:bg-hv-accent-light transition-colors"
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
  const timerPct = (timeLeft / GAME_DURATION) * 100
  const timerColor = timeLeft > 30 ? 'bg-hv-accent' : timeLeft > 10 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="min-h-screen bg-hv-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-hv-border bg-hv-card">
        <button onClick={onBack} className="flex items-center gap-2 text-hv-muted hover:text-white transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-white font-bold">{score} <span className="text-hv-muted font-normal">correct</span></span>
          <span className="text-white font-bold">{total} <span className="text-hv-muted font-normal">tried</span></span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-hv-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={`font-bold tabular-nums ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>{timeLeft}s</span>
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-1 bg-hv-border">
        <div className={`h-1 transition-all duration-1000 ${timerColor}`} style={{ width: `${timerPct}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {round && (
          <>
            {/* Operation + target */}
            <div className="text-center space-y-1 animate-fade-in" key={round.target + round.op}>
              <div className="flex items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-hv-accent flex items-center justify-center">
                  <span className="text-white text-3xl font-bold">{round.op}</span>
                </div>
              </div>
              <p className="text-hv-muted text-sm mt-2">{OP_LABELS[round.op]}</p>
            </div>

            {/* Target */}
            <div className="text-center">
              <p className="text-slate-400 text-sm uppercase tracking-widest mb-1">Target</p>
              <div className={`w-24 h-24 mx-auto rounded-2xl border-2 flex items-center justify-center transition-colors ${
                feedback === 'correct' ? 'border-emerald-500 bg-emerald-900/30' :
                feedback === 'wrong' ? 'border-red-500 bg-red-900/20' :
                'border-hv-border bg-hv-card'
              }`}>
                <span className="text-white text-4xl font-bold tabular-nums">{round.target}</span>
              </div>
            </div>

            {/* Number grid */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-xs animate-fade-in">
              {round.numbers.map((num, idx) => {
                const isSel = selected.includes(idx)
                let cls = 'h-16 rounded-xl border-2 text-xl font-bold transition-all duration-100 active:scale-95 '
                if (feedback !== null && isSel) {
                  cls += feedback === 'correct'
                    ? 'border-emerald-500 bg-emerald-800 text-white'
                    : 'border-red-500 bg-red-900 text-white'
                } else if (isSel) {
                  cls += 'border-hv-accent-light bg-blue-900/40 text-white'
                } else {
                  cls += 'border-hv-border bg-hv-card text-white hover:border-hv-accent-light hover:bg-hv-card/80'
                }
                return (
                  <button
                    key={idx}
                    className={cls}
                    onClick={() => handleTileClick(idx)}
                    disabled={feedback !== null && selected.length === 2}
                  >
                    {num}
                  </button>
                )
              })}
            </div>

            {/* Instruction / feedback */}
            <p className={`text-sm font-semibold transition-colors ${
              feedback === 'correct' ? 'text-emerald-400' :
              feedback === 'wrong' ? 'text-red-400' :
              'text-hv-muted'
            }`}>
              {feedback === 'correct' ? '✓ Correct!' :
               feedback === 'wrong' ? '✗ Wrong pair' :
               `Select 2 numbers · ${2 - selected.length} remaining`}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
