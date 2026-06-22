import { useState, useEffect, useRef, useCallback } from 'react'
import GameHeader from '../components/GameHeader'

const GAME_DURATION = 90   // seconds
const TILE_COUNT    = 9    // tiles per round

// ── Molecule layout constants ─────────────────────────────────────────────────
const TILE_W = 64           // hex tile width  (px)
const TILE_H = 68           // hex tile height (px)
const HEX_STEP = 80         // centre-to-centre step; safe for all 6 hex directions
const BOND_MARGIN = 34      // shorten bond lines from each tile centre by this much

// 6 hex directions at 60° intervals
const HEX_DIRS = [0, 60, 120, 180, 240, 300].map(d => d * Math.PI / 180)

// Rectangle-based overlap check (axis-aligned tiles)
function tilesOverlap(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) < TILE_W && Math.abs(y1 - y2) < TILE_H
}

// Build a random molecular spanning tree of n nodes.
// Returns { positions: [x,y][], edges: [a,b][] } centred at origin.
function genMolecule(n) {
  const positions = [[0, 0]]
  const edges     = []
  const degree    = [0]      // connection count per node

  for (let i = 1; i < n; i++) {
    // Prefer low-degree parents to encourage branching over long chains
    const parentOrder = Array.from({ length: positions.length }, (_, k) => k)
      .sort((a, b) => degree[a] - degree[b] + (Math.random() - 0.5) * 1.2)

    const dirs = [...HEX_DIRS].sort(() => Math.random() - 0.5)
    let placed = false

    outer: for (const p of parentOrder) {
      for (const dir of dirs) {
        const nx = positions[p][0] + Math.cos(dir) * HEX_STEP
        const ny = positions[p][1] + Math.sin(dir) * HEX_STEP
        if (positions.every(([ex, ey]) => !tilesOverlap(nx, ny, ex, ey))) {
          positions.push([nx, ny])
          edges.push([p, i])
          degree[p]++
          degree.push(1)
          placed = true
          break outer
        }
      }
    }

    if (!placed) {
      // Fallback: extend horizontally from the last placed tile
      const last = positions.length - 1
      positions.push([positions[last][0] + HEX_STEP, 0])
      edges.push([last, i])
      degree[last]++
      degree.push(1)
    }
  }

  const xs = positions.map(p => p[0])
  const ys = positions.map(p => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  return {
    positions: positions.map(([x, y]) => [x - cx, y - cy]),
    edges,
  }
}

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
  const { positions, edges } = genMolecule(TILE_COUNT)
  return { op, target, numbers, answers, positions, edges }
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
      style={{ width: TILE_W, height: TILE_H }}
      className="relative flex items-center justify-center transition-all duration-100 active:scale-95"
    >
      <div className={`absolute inset-0 ${bg} transition-colors duration-100`} style={{ clipPath: hexClip }} />
      <div
        className={`absolute inset-[3px] transition-colors duration-100 ${
          selected
            ? (feedback === 'correct' ? 'bg-emerald-700' : feedback === 'wrong' ? 'bg-red-800' : 'bg-blue-700')
            : 'bg-hv-bg'
        }`}
        style={{ clipPath: hexClip }}
      />
      <span className="relative z-10 text-base font-bold text-white tabular-nums select-none">{num}</span>
    </button>
  )
}

// ── Molecule layout: bond lines + scattered hex tiles ─────────────────────
function MoleculeLayout({ round, selected, feedback, onTileClick, disabled }) {
  const { numbers, positions, edges } = round

  const xs  = positions.map(p => p[0])
  const ys  = positions.map(p => p[1])
  const pad = TILE_W * 0.6
  const rawW = Math.max(...xs) - Math.min(...xs) + TILE_W + pad * 2
  const rawH = Math.max(...ys) - Math.min(...ys) + TILE_H + pad * 2
  const ox   = -Math.min(...xs) + pad   // x offset so all positions are ≥ 0
  const oy   = -Math.min(...ys) + pad

  // Scale down if the molecule is wider than the available play area
  const MAX_W = 312
  const scale = rawW > MAX_W ? MAX_W / rawW : 1
  const cW = rawW * scale
  const cH = rawH * scale

  return (
    <div style={{ width: cW, height: cH }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: rawW, height: rawH }}>
        {/* Bond lines rendered below tiles */}
        <svg className="absolute inset-0 pointer-events-none" width={rawW} height={rawH}>
          {edges.map(([a, b], i) => {
            const ax = positions[a][0] + ox + TILE_W / 2
            const ay = positions[a][1] + oy + TILE_H / 2
            const bx = positions[b][0] + ox + TILE_W / 2
            const by = positions[b][1] + oy + TILE_H / 2
            const dx = bx - ax, dy = by - ay
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            const ux = dx / len, uy = dy / len
            return (
              <line
                key={i}
                x1={ax + ux * BOND_MARGIN} y1={ay + uy * BOND_MARGIN}
                x2={bx - ux * BOND_MARGIN} y2={by - uy * BOND_MARGIN}
                stroke="#1e3a5f" strokeWidth={7} strokeLinecap="round"
              />
            )
          })}
        </svg>
        {/* Hex tiles */}
        {positions.map(([px, py], idx) => (
          <div key={idx} className="absolute" style={{ left: px + ox, top: py + oy }}>
            <HexTile
              num={numbers[idx]}
              selected={selected.includes(idx)}
              feedback={feedback}
              onClick={() => onTileClick(idx)}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
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

            {/* Molecular bond layout */}
            <div className="animate-fade-in" key={round.numbers.join(',')}>
              <MoleculeLayout
                round={round}
                selected={selected}
                feedback={feedback}
                onTileClick={handleTileClick}
                disabled={feedbackActiveRef.current}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
