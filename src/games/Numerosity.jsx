import { useState, useEffect, useRef, useCallback } from 'react'
import GameHeader from '../components/GameHeader'

const TOTAL_ROUNDS = 20
const ARENA_SIZE = 280
const DOT_R = 9
const MIN_DIST = DOT_R * 2.6

function getDifficulty(round) {
  if (round < 7) return { min: 3, max: 10, showMs: 900 }
  if (round < 14) return { min: 7, max: 20, showMs: 700 }
  return { min: 12, max: 35, showMs: 500 }
}

function generateDots(count) {
  const dots = []
  let attempts = 0
  const pad = DOT_R + 4
  while (dots.length < count && attempts < 2000) {
    const x = pad + Math.random() * (ARENA_SIZE - pad * 2)
    const y = pad + Math.random() * (ARENA_SIZE - pad * 2)
    const ok = dots.every(d => Math.hypot(d.x - x, d.y - y) > MIN_DIST)
    if (ok) dots.push({ x, y })
    attempts++
  }
  return dots
}

function makeChoices(correct) {
  const offsets = [-5, -2, 3, 7, -8, 4, -3, 6].sort(() => Math.random() - 0.5)
  const wrongs = new Set()
  for (const o of offsets) {
    const v = correct + o
    if (v > 0 && v !== correct) wrongs.add(v)
    if (wrongs.size === 3) break
  }
  return shuffle([correct, ...[...wrongs].slice(0, 3)])
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// phase: 'start' | 'countdown' | 'showing' | 'answering' | 'feedback' | 'results'
export default function Numerosity({ onEnd, onBack }) {
  const [phase, setPhase] = useState('start')
  const [round, setRound] = useState(0)
  const [dots, setDots] = useState([])
  const [dotCount, setDotCount] = useState(0)
  const [choices, setChoices] = useState([])
  const [selected, setSelected] = useState(null)
  const [score, setScore] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const timerRef = useRef(null)

  const clear = () => { clearTimeout(timerRef.current); clearInterval(timerRef.current) }

  const startRound = useCallback((r) => {
    const { min, max, showMs } = getDifficulty(r)
    const count = min + Math.floor(Math.random() * (max - min + 1))
    const d = generateDots(count)
    setDots(d)
    setDotCount(count)
    setChoices(makeChoices(count))
    setSelected(null)
    setPhase('showing')
    timerRef.current = setTimeout(() => setPhase('answering'), showMs)
  }, [])

  useEffect(() => {
    if (phase === 'countdown') {
      setCountdown(3)
      let c = 3
      timerRef.current = setInterval(() => {
        c--
        if (c <= 0) {
          clear()
          startRound(0)
        } else {
          setCountdown(c)
        }
      }, 800)
    }
    return clear
  }, [phase, startRound])

  function handleAnswer(choice) {
    clear()
    setSelected(choice)
    const correct = choice === dotCount
    if (correct) setScore(s => s + 1)
    setPhase('feedback')
    timerRef.current = setTimeout(() => {
      const next = round + 1
      if (next >= TOTAL_ROUNDS) {
        setPhase('results')
      } else {
        setRound(next)
        startRound(next)
      }
    }, 900)
  }

  useEffect(() => () => clear(), [])

  if (phase === 'start') {
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Numerosity" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-fade-in">
            <div className="text-6xl">⚫</div>
            <h2 className="text-white text-2xl font-bold">Numerosity</h2>
            <p className="text-slate-400 leading-relaxed">
              A cluster of dots will flash on screen briefly. Estimate the count as quickly and
              accurately as possible, then pick your answer.
            </p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• {TOTAL_ROUNDS} rounds · difficulty increases</li>
              <li>• Dots shown for 0.5 – 0.9 seconds</li>
              <li>• +1 point per correct answer</li>
            </ul>
            <button
              onClick={() => setPhase('countdown')}
              className="w-full py-3 rounded-xl bg-hv-accent hover:bg-hv-accent-light text-white font-semibold transition-colors"
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'results') {
    const pct = Math.round((score / TOTAL_ROUNDS) * 100)
    const grade = pct >= 85 ? 'Excellent' : pct >= 65 ? 'Good' : pct >= 45 ? 'Fair' : 'Keep Practicing'
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Numerosity" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-scale-in">
            <div className="w-24 h-24 mx-auto rounded-full bg-hv-card border-4 border-hv-accent flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{pct}%</span>
            </div>
            <div>
              <h2 className="text-white text-2xl font-bold">{grade}</h2>
              <p className="text-slate-400 mt-1">{score} correct out of {TOTAL_ROUNDS}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setScore(0); setRound(0); setPhase('countdown') }}
                className="py-3 rounded-xl bg-hv-card border border-hv-border text-white font-semibold hover:border-hv-accent transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={() => onEnd({ score, total: TOTAL_ROUNDS, display: `${score}/${TOTAL_ROUNDS}` })}
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

  return (
    <div className="min-h-screen bg-hv-bg flex flex-col">
      <GameHeader
        title="Numerosity"
        onBack={onBack}
        round={round + (phase === 'feedback' ? 1 : 1)}
        totalRounds={TOTAL_ROUNDS}
        score={score}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        {/* Dot arena */}
        <div
          className="relative rounded-2xl bg-hv-card border border-hv-border overflow-hidden"
          style={{ width: ARENA_SIZE, height: ARENA_SIZE }}
        >
          {phase === 'countdown' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-7xl font-bold animate-pop">{countdown}</span>
            </div>
          ) : phase === 'answering' || phase === 'feedback' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-hv-muted text-lg">How many dots?</span>
            </div>
          ) : (
            <svg width={ARENA_SIZE} height={ARENA_SIZE} className="absolute inset-0">
              {dots.map((d, i) => (
                <circle
                  key={i}
                  cx={d.x}
                  cy={d.y}
                  r={DOT_R}
                  fill="white"
                  opacity="0.92"
                />
              ))}
            </svg>
          )}
        </div>

        {/* Choices */}
        {(phase === 'answering' || phase === 'feedback') && (
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs animate-fade-in">
            {choices.map(c => {
              let cls = 'py-4 rounded-xl text-xl font-bold transition-all duration-150 border '
              if (phase === 'feedback') {
                if (c === dotCount) cls += 'bg-emerald-700 border-emerald-500 text-white'
                else if (c === selected) cls += 'bg-red-800 border-red-600 text-white'
                else cls += 'bg-hv-card border-hv-border text-hv-muted'
              } else {
                cls += 'bg-hv-card border-hv-border text-white hover:border-hv-accent-light active:scale-95'
              }
              return (
                <button
                  key={c}
                  disabled={phase === 'feedback'}
                  className={cls}
                  onClick={() => handleAnswer(c)}
                >
                  {c}
                </button>
              )
            })}
          </div>
        )}

        {/* Feedback indicator */}
        {phase === 'feedback' && (
          <div className={`text-sm font-semibold animate-fade-in ${selected === dotCount ? 'text-emerald-400' : 'text-red-400'}`}>
            {selected === dotCount ? '✓ Correct!' : `✗ Answer was ${dotCount}`}
          </div>
        )}
      </div>
    </div>
  )
}
