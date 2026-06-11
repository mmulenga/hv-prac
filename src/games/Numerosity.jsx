import { useState, useEffect, useRef, useCallback } from 'react'
import GameHeader from '../components/GameHeader'

const GAME_DURATION = 90   // seconds
const TILE_COUNT    = 9    // 3×3 hexagonal field

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

// Stage the operator based on how many rounds have been attempted
function pickOp(roundsAttempted) {
  if (roundsAttempted < 4)  return '+'
  if (roundsAttempted < 8)  return ['+', '-'][~~(Math.random() * 2)]
  if (roundsAttempted < 12) return ['+', '-', '×'][~~(Math.random() * 3)]
  return ['+', '-', '×', '÷'][~~(Math.random() * 4)]
}

const OP_LABELS = { '+': 'Addition', '-': 'Subtraction', '×': 'Multiplication', '÷': 'Division' }

function generateRound(difficulty, roundsAttempted) {
  const op     = pickOp(roundsAttempted)
  const maxNum = 8 + difficulty * 3
  let answers, target

  if (op === '+') {
    const useThree = difficulty > 2 && Math.random() < 0.4
    if (useThree) {
      const [a, b, c] = [randInt(2, maxNum), randInt(2, maxNum), randInt(2, maxNum)]
      target = a + b + c; answers = [a, b, c]
    } else {
      const [a, b] = [randInt(2, maxNum), randInt(2, maxNum)]
      target = a + b; answers = [a, b]
    }
  } else if (op === '-') {
    const a = randInt(5, maxNum), b = randInt(1, a - 1)
    target = a - b; answers = [a, b]
  } else if (op === '×') {
    const a = randInt(2, Math.min(12, 3 + difficulty)), b = randInt(2, Math.min(12, 3 + difficulty))
    target = a * b; answers = [a, b]
  } else {
    const divisor = randInt(2, Math.min(9, 3 + difficulty)), quotient = randInt(2, Math.min(12, 3 + difficulty))
    target = quotient; answers = [divisor * quotient, divisor]
  }

  // Fill remaining tile slots with distractors that don't accidentally form the answer
  const ansSet = new Set(answers)
  const distractors = []
  let att = 0
  while (distractors.length < TILE_COUNT - answers.length && att < 400) {
    const d = randInt(2, Math.max(...answers, target) + 8)
    if (!ansSet.has(d) && !distractors.includes(d)) {
      // Quick check: don't let a single distractor + any answer tile create the target for +
      let bad = false
      if (op === '+' && answers.length === 2) {
        bad = answers.some(a => a + d === target)
      }
      if (!bad) distractors.push(d)
    }
    att++
  }

  const numbers = shuffle([...answers, ...distractors]).slice(0, TILE_COUNT)
  return { op, target, numbers, answers }
}

// Compute running result for current selection
function runningResult(op, nums) {
  if (nums.length === 0) return null
  if (op === '+') return nums.reduce((s, n) => s + n, 0)
  if (nums.length < 2) return null
  const [a, b] = nums
  if (op === '-') return a - b
  if (op === '×') return a * b
  if (op === '÷') {
    if (b !== 0 && Number.isInteger(a / b)) return a / b
    if (a !== 0 && Number.isInteger(b / a)) return b / a
  }
  return null
}

function isCorrect(op, selected, target) {
  const r = runningResult(op, selected)
  return r === target
}

function autoSubmit(op, selected, target) {
  if (op === '+') return runningResult(op, selected) === target
  return selected.length === 2
}

// ── Hexagonal tile component ──────────────────────────────────────────────
function HexTile({ num, selected, feedback, onClick, disabled }) {
  let bg = 'bg-hv-card'
  if (feedback === 'correct' && selected) bg = 'bg-emerald-800'
  else if (feedback === 'wrong' && selected) bg = 'bg-red-900'
  else if (selected) bg = 'bg-blue-800'

  const hexClip = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-20 h-[88px] flex items-center justify-center transition-all duration-100 active:scale-95`}
    >
      {/* Background hex */}
      <div
        className={`absolute inset-0 ${bg} transition-colors duration-100`}
        style={{ clipPath: hexClip }}
      />
      {/* Inner border effect */}
      <div
        className={`absolute inset-[3px] transition-colors duration-100
          ${selected
            ? (feedback === 'correct' ? 'bg-emerald-700' : feedback === 'wrong' ? 'bg-red-800' : 'bg-blue-700')
            : 'bg-hv-bg'
          }`}
        style={{ clipPath: hexClip }}
      />
      <span className="relative z-10 text-xl font-bold text-white tabular-nums select-none">
        {num}
      </span>
    </button>
  )
}

// phase: 'start' | 'playing' | 'results'
export default function Numerosity({ onEnd, onBack }) {
  const [phase,    setPhase]    = useState('start')
  const [round,    setRound]    = useState(null)
  const [selected, setSelected] = useState([])   // tile indices (up to 3)
  const [feedback, setFeedback] = useState(null) // null | 'correct' | 'wrong'
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [score,    setScore]    = useState(0)
  const [total,    setTotal]    = useState(0)

  const difficultyRef    = useRef(0)
  const feedbackActiveRef = useRef(false)
  const phaseRef         = useRef('start')
  const roundRef         = useRef(null)
  const totalRef         = useRef(0)
  const countdownRef     = useRef(null)
  const feedbackTimerRef = useRef(null)

  function setPhaseSync(p) { phaseRef.current = p; setPhase(p) }

  function spawnRound() {
    const r = generateRound(difficultyRef.current, totalRef.current)
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
    totalRef.current = 0
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
    const r = roundRef.current

    setSelected(prev => {
      // Deselect if already selected
      if (prev.includes(idx)) return prev.filter(i => i !== idx)
      // Cap at 3 selections
      if (prev.length >= 3) return prev

      const next = [...prev, idx]
      const nums = next.map(i => r.numbers[i])

      if (autoSubmit(r.op, nums, r.target)) {
        feedbackActiveRef.current = true
        const correct = isCorrect(r.op, nums, r.target)

        if (correct) {
          difficultyRef.current = Math.min(10, difficultyRef.current + 1)
          setScore(s => s + 1)
        } else {
          difficultyRef.current = Math.max(0, difficultyRef.current - 1)
        }
        totalRef.current += 1
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
              A target number and operator appear. A field of numbered hexagonal tiles covers the
              screen — tap them in sequence to build an expression that hits the target.
            </p>
            <ul className="text-sm text-slate-400 space-y-1 text-left">
              <li>• {GAME_DURATION}s time limit · answer as many as possible</li>
              <li>• Operators unlock as you progress: + → − → × → ÷</li>
              <li>• For addition you may select 2 or 3 tiles</li>
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
    const pct   = total > 0 ? Math.round((score / total) * 100) : 0
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
  const timerPct   = (timeLeft / GAME_DURATION) * 100
  const timerColor = timeLeft > 30 ? 'bg-hv-accent' : timeLeft > 10 ? 'bg-amber-500' : 'bg-red-500'

  const selectedNums = round ? selected.map(i => round.numbers[i]) : []
  const runTotal     = round && selectedNums.length > 0 ? runningResult(round.op, selectedNums) : null
  const isHit        = runTotal === round?.target

  // Build expression string for display
  let expression = ''
  if (round && selectedNums.length > 0) {
    if (round.op === '+') {
      expression = `${selectedNums.join(' + ')}${runTotal !== null ? ` = ${runTotal}` : ''}`
    } else if (selectedNums.length === 1) {
      expression = `${selectedNums[0]} ${round.op} …`
    } else {
      expression = `${selectedNums[0]} ${round.op} ${selectedNums[1]}${runTotal !== null ? ` = ${runTotal}` : ''}`
    }
  }

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

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-5">
        {round && (
          <>
            {/* Operator + target */}
            <div className="flex items-center gap-4 animate-fade-in" key={round.target + round.op}>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-hv-accent flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{round.op}</span>
                </div>
                <p className="text-hv-muted text-xs mt-1">{OP_LABELS[round.op]}</p>
              </div>
              <div className="text-hv-muted text-xl font-light">→</div>
              <div className="flex flex-col items-center">
                <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center transition-colors ${
                  feedback === 'correct' ? 'border-emerald-500 bg-emerald-900/30' :
                  feedback === 'wrong'   ? 'border-red-500 bg-red-900/20' :
                  isHit                  ? 'border-emerald-400 bg-emerald-900/20' :
                  'border-hv-border bg-hv-card'
                }`}>
                  <span className="text-white text-3xl font-bold tabular-nums">{round.target}</span>
                </div>
                <p className="text-hv-muted text-xs mt-1">Target</p>
              </div>
            </div>

            {/* Running expression */}
            <div className="h-7 flex items-center justify-center">
              {expression ? (
                <p className={`text-sm font-mono font-semibold transition-colors ${
                  feedback === 'correct' ? 'text-emerald-400' :
                  feedback === 'wrong'   ? 'text-red-400' :
                  isHit                  ? 'text-emerald-300' :
                  'text-slate-300'
                }`}>
                  {expression}
                  {isHit && feedback === null ? ' ✓' : ''}
                </p>
              ) : (
                <p className="text-hv-muted text-sm">
                  {round.op === '+' ? 'Select 2–3 tiles that sum to the target' : 'Select 2 tiles'}
                </p>
              )}
            </div>

            {/* Hex tile grid (3×3) */}
            <div className="grid grid-cols-3 gap-x-2 gap-y-1 animate-fade-in" key={round.numbers.join(',')}>
              {round.numbers.map((num, idx) => (
                <HexTile
                  key={idx}
                  num={num}
                  selected={selected.includes(idx)}
                  feedback={feedback}
                  onClick={() => handleTileClick(idx)}
                  disabled={feedbackActiveRef.current}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
