import { useState, useEffect, useRef, useCallback } from 'react'
import GameHeader from '../components/GameHeader'

const TOTAL_ROUNDS = 10
const GRID_SIZE = 4        // 4×4
const CELL_COUNT = GRID_SIZE * GRID_SIZE
const CELL_SHOW_MS = 500   // how long each cell lights up
const CELL_BLANK_MS = 150  // gap between cells

function generateSequence(length) {
  const pool = Array.from({ length: CELL_COUNT }, (_, i) => i)
  const shuffled = pool.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, length)
}

function getSeqLength(round) {
  return Math.min(3 + round, CELL_COUNT - 1)
}

// phase: 'start' | 'preview' | 'input' | 'feedback' | 'results'
export default function Flashback({ onEnd, onBack }) {
  const [phase, setPhase] = useState('start')
  const [round, setRound] = useState(0)
  const [sequence, setSequence] = useState([])
  const [litCell, setLitCell] = useState(null)      // currently highlighted during preview
  const [userClicks, setUserClicks] = useState([])  // cells clicked by user
  const [score, setScore] = useState(0)
  const [feedbackCells, setFeedbackCells] = useState(null) // { correct: Set, wrong: Set, missed: Set }
  const timerRef = useRef(null)

  const clear = () => clearTimeout(timerRef.current)

  const startRound = useCallback((r) => {
    const len = getSeqLength(r)
    const seq = generateSequence(len)
    setSequence(seq)
    setUserClicks([])
    setFeedbackCells(null)
    setLitCell(null)
    setPhase('preview')

    // Play through the sequence
    let i = 0
    function showNext() {
      if (i >= seq.length) {
        setLitCell(null)
        timerRef.current = setTimeout(() => setPhase('input'), 400)
        return
      }
      setLitCell(seq[i])
      i++
      timerRef.current = setTimeout(() => {
        setLitCell(null)
        timerRef.current = setTimeout(showNext, CELL_BLANK_MS)
      }, CELL_SHOW_MS)
    }

    timerRef.current = setTimeout(showNext, 500) // short delay before starting
  }, [])

  function handleCellClick(idx) {
    if (phase !== 'input') return
    const next = [...userClicks, idx]
    setUserClicks(next)

    if (next.length === sequence.length) {
      // Evaluate
      let correct = 0
      const correctSet = new Set()
      const wrongSet = new Set()
      const missedSet = new Set()

      next.forEach((cell, i) => {
        if (sequence[i] === cell) { correct++; correctSet.add(cell) }
        else wrongSet.add(cell)
      })
      sequence.forEach((cell, i) => {
        if (next[i] !== cell) missedSet.add(cell)
      })

      if (correct === sequence.length) setScore(s => s + sequence.length)
      setFeedbackCells({ correct: correctSet, wrong: wrongSet, missed: missedSet })
      setPhase('feedback')

      timerRef.current = setTimeout(() => {
        const nr = round + 1
        if (nr >= TOTAL_ROUNDS) {
          setPhase('results')
        } else {
          setRound(nr)
          startRound(nr)
        }
      }, 1400)
    }
  }

  useEffect(() => () => clear(), [])

  if (phase === 'start') {
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Flashback" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-fade-in">
            <div className="text-6xl">💡</div>
            <h2 className="text-white text-2xl font-bold">Flashback</h2>
            <p className="text-slate-400 leading-relaxed">
              Watch the grid squares light up in sequence. After the preview ends,
              click the same squares in the exact order shown.
            </p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• 4×4 grid · {TOTAL_ROUNDS} rounds</li>
              <li>• Sequence grows longer each round</li>
              <li>• Points for each correctly placed square</li>
            </ul>
            <button
              onClick={() => startRound(0)}
              className="w-full py-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-semibold transition-colors"
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'results') {
    const maxPossible = Array.from({ length: TOTAL_ROUNDS }, (_, r) => getSeqLength(r)).reduce((a, b) => a + b, 0)
    const pct = Math.round((score / maxPossible) * 100)
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Flashback" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-scale-in">
            <div className="w-24 h-24 mx-auto rounded-full bg-hv-card border-4 border-amber-500 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{pct}%</span>
            </div>
            <div>
              <h2 className="text-white text-2xl font-bold">
                {pct >= 80 ? 'Excellent' : pct >= 55 ? 'Good' : 'Keep Practicing'}
              </h2>
              <p className="text-slate-400 mt-1">{score} / {maxPossible} points</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setScore(0); setRound(0); startRound(0) }}
                className="py-3 rounded-xl bg-hv-card border border-hv-border text-white font-semibold hover:border-amber-500 transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={() => onEnd({ score, max: maxPossible, display: `${score} pts` })}
                className="py-3 rounded-xl bg-amber-700 text-white font-semibold hover:bg-amber-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const seqLen = sequence.length
  const clickCount = userClicks.length

  function cellColor(idx) {
    if (phase === 'preview') {
      if (idx === litCell) return 'bg-amber-400 border-amber-300 shadow-lg shadow-amber-500/50'
      return 'bg-hv-card border-hv-border'
    }
    if (phase === 'feedback' && feedbackCells) {
      if (feedbackCells.correct.has(idx)) return 'bg-emerald-700 border-emerald-500'
      if (feedbackCells.wrong.has(idx)) return 'bg-red-800 border-red-600'
      if (feedbackCells.missed.has(idx)) return 'bg-amber-800 border-amber-600'
    }
    const clickPos = userClicks.indexOf(idx)
    if (clickPos !== -1) return 'bg-blue-700 border-blue-500'
    return 'bg-hv-card border-hv-border hover:border-amber-500 hover:bg-amber-900/20 active:scale-95'
  }

  return (
    <div className="min-h-screen bg-hv-bg flex flex-col">
      <GameHeader
        title="Flashback"
        onBack={onBack}
        round={round + 1}
        totalRounds={TOTAL_ROUNDS}
        score={score}
      />
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {/* Status */}
        <div className="text-center">
          {phase === 'preview' && (
            <p className="text-amber-400 font-semibold animate-flash">Watch the sequence…</p>
          )}
          {phase === 'input' && (
            <p className="text-white font-semibold">
              Click {seqLen - clickCount} more {seqLen - clickCount === 1 ? 'square' : 'squares'}
            </p>
          )}
          {phase === 'feedback' && (
            <p className={`font-semibold ${feedbackCells && userClicks.every((c, i) => sequence[i] === c) ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedbackCells && userClicks.every((c, i) => sequence[i] === c) ? '✓ Perfect!' : '✗ Not quite'}
            </p>
          )}
          <p className="text-hv-muted text-xs mt-1">Sequence length: {seqLen}</p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {sequence.map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i < userClicks.length ? 'bg-amber-400' : 'bg-hv-border'
              }`}
            />
          ))}
        </div>

        {/* Grid */}
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
        >
          {Array.from({ length: CELL_COUNT }, (_, idx) => (
            <button
              key={idx}
              disabled={phase !== 'input'}
              onClick={() => handleCellClick(idx)}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 transition-all duration-150 ${cellColor(idx)}`}
            >
              {phase === 'input' && userClicks.indexOf(idx) !== -1 && (
                <span className="text-white font-bold text-sm">
                  {userClicks.indexOf(idx) + 1}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
