import { useState, useRef, useCallback, useEffect } from 'react'
import GameHeader from '../components/GameHeader'

const TOTAL_TRIALS   = 15
const DIGIT_SHOW_MS  = 750
const DIGIT_BLANK_MS = 200

// Letters used at span 7+ (exclude ambiguous I, O, Q)
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'.split('')

function randomDigits(span) {
  return Array.from({ length: span }, () => Math.floor(Math.random() * 10))
}

function randomMixed(span) {
  // Mix digits and letters — 40% letters
  return Array.from({ length: span }, () =>
    Math.random() < 0.4
      ? LETTERS[Math.floor(Math.random() * LETTERS.length)]
      : Math.floor(Math.random() * 10)
  )
}

function reverseMode(span) { return span >= 6 }
function mixedMode(span)   { return span >= 7 }

// phase: 'start' | 'showing' | 'input' | 'feedback' | 'results'
export default function DigitSpan({ onEnd, onBack }) {
  const [phase,       setPhase]       = useState('start')
  const [sequence,    setSequence]    = useState([])
  const [showingItem, setShowingItem] = useState(null)
  const [userInput,   setUserInput]   = useState('')
  const [score,       setScore]       = useState(0)
  const [trial,       setTrial]       = useState(0)
  const [feedback,    setFeedback]    = useState(null) // 'correct' | 'wrong'
  const [maxSpan,     setMaxSpan]     = useState(3)

  const spanRef          = useRef(3)
  const consecCorrectRef = useRef(0)
  const consecWrongRef   = useRef(0)
  const scoreRef         = useRef(0)
  const inputRef         = useRef(null)
  const timers           = useRef([])

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function schedule(fn, delay) {
    const id = setTimeout(fn, delay)
    timers.current.push(id)
    return id
  }

  const startTrial = useCallback((span, seq) => {
    const useMixed = mixedMode(span)
    const s = seq || (useMixed ? randomMixed(span) : randomDigits(span))

    setSequence(s)
    setUserInput('')
    setFeedback(null)
    setShowingItem(null)
    setPhase('showing')

    let delay = 300
    s.forEach(item => {
      schedule(() => setShowingItem(item), delay)
      delay += DIGIT_SHOW_MS
      schedule(() => setShowingItem(null), delay)
      delay += DIGIT_BLANK_MS
    })
    schedule(() => {
      setPhase('input')
      setTimeout(() => inputRef.current?.focus(), 50)
    }, delay + 100)
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const span    = spanRef.current
    const reverse = reverseMode(span)

    // Normalize input: collapse whitespace, uppercase
    const raw     = userInput.trim().toUpperCase().replace(/\s+/g, '')
    const typed   = raw.split('')

    // Compare against sequence (or reversed sequence)
    const expected = reverse ? [...sequence].reverse() : [...sequence]
    const correct  = typed.length === expected.length &&
                     typed.every((c, i) => String(c) === String(expected[i]))

    if (correct) {
      const newScore = scoreRef.current + span
      scoreRef.current = newScore
      setScore(newScore)
      setFeedback('correct')
      consecCorrectRef.current += 1
      consecWrongRef.current = 0
      if (consecCorrectRef.current >= 2 && span < 9) {
        spanRef.current = span + 1
        consecCorrectRef.current = 0
      }
      setMaxSpan(m => Math.max(m, span))
    } else {
      setFeedback('wrong')
      consecWrongRef.current += 1
      consecCorrectRef.current = 0
      if (consecWrongRef.current >= 2 && span > 2) {
        spanRef.current = span - 1
        consecWrongRef.current = 0
      }
    }

    setPhase('feedback')
    schedule(() => {
      const next = trial + 1
      if (next >= TOTAL_TRIALS) {
        setPhase('results')
      } else {
        setTrial(next)
        startTrial(spanRef.current)
      }
    }, 1400)
  }

  useEffect(() => clearTimers, [])

  if (phase === 'start') {
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Digit Span" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-fade-in">
            <div className="text-6xl">🧠</div>
            <h2 className="text-white text-2xl font-bold">Digit Span</h2>
            <p className="text-slate-400 leading-relaxed">
              A sequence of digits flashes on screen one at a time. Type it back in the exact order
              shown and press Enter.
            </p>
            <ul className="text-sm text-slate-400 space-y-1 text-left">
              <li>• Starts at span 3 · adapts to your performance</li>
              <li>• At span 6+: recall the sequence in <strong className="text-white">reverse</strong></li>
              <li>• At span 7+: letters mix in with the digits</li>
              <li>• {TOTAL_TRIALS} trials total</li>
            </ul>
            <button
              onClick={() => startTrial(3)}
              className="w-full py-3 rounded-xl bg-violet-700 hover:bg-violet-600 text-white font-semibold transition-colors"
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'results') {
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Digit Span" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-scale-in">
            <div className="w-24 h-24 mx-auto rounded-full bg-hv-card border-4 border-violet-600 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{maxSpan}</span>
            </div>
            <div>
              <h2 className="text-white text-2xl font-bold">Max Span: {maxSpan}</h2>
              <p className="text-slate-400 mt-1">Total score: {score} pts · {TOTAL_TRIALS} trials</p>
            </div>
            <div className="bg-hv-card border border-hv-border rounded-xl p-4 text-sm text-slate-400 text-left space-y-1">
              <p className="text-white font-semibold">Reference ranges:</p>
              <p>• Average adult: 5–7 digits</p>
              <p>• Above average: 8+</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  clearTimers()
                  scoreRef.current = 0
                  spanRef.current = 3
                  consecCorrectRef.current = 0
                  consecWrongRef.current = 0
                  setScore(0)
                  setTrial(0)
                  setMaxSpan(3)
                  startTrial(3)
                }}
                className="py-3 rounded-xl bg-hv-card border border-hv-border text-white font-semibold hover:border-violet-600 transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={() => onEnd({ score, maxSpan, display: `Span ${maxSpan}` })}
                className="py-3 rounded-xl bg-violet-700 text-white font-semibold hover:bg-violet-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentSpan = spanRef.current
  const showReverseBanner = reverseMode(currentSpan)
  const inputMode = mixedMode(currentSpan) ? 'text' : 'numeric'

  return (
    <div className="min-h-screen bg-hv-bg flex flex-col">
      <GameHeader
        title="Digit Span"
        onBack={onBack}
        round={trial + 1}
        totalRounds={TOTAL_TRIALS}
        score={score}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">

        {/* Reverse mode banner */}
        {showReverseBanner && (
          <div className="w-full max-w-xs bg-violet-900/40 border border-violet-700 rounded-xl px-4 py-2.5 text-center">
            <p className="text-violet-300 text-sm font-semibold">↩ Type it backwards</p>
          </div>
        )}

        {/* Placeholder dots — show length of sequence */}
        <div className="flex gap-1.5 flex-wrap justify-center">
          {sequence.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                phase === 'input' || phase === 'feedback' ? 'bg-violet-500' : 'bg-hv-border'
              }`}
            />
          ))}
        </div>

        {/* Digit/letter display box */}
        <div className="w-44 h-44 rounded-2xl bg-hv-card border border-hv-border flex items-center justify-center">
          {phase === 'showing' && showingItem !== null ? (
            <span
              className="text-7xl font-bold text-white font-mono animate-scale-in"
              key={String(showingItem) + '-' + Date.now()}
            >
              {showingItem}
            </span>
          ) : phase === 'showing' ? (
            <span className="text-hv-muted text-sm">…</span>
          ) : phase === 'input' ? (
            <div className="text-center">
              <span className="text-hv-muted text-sm">{showReverseBanner ? 'Type in reverse!' : 'Type it!'}</span>
              <p className="text-violet-400 text-xs mt-1">Span: {currentSpan}</p>
            </div>
          ) : phase === 'feedback' ? (
            <span className={`text-4xl ${feedback === 'correct' ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedback === 'correct' ? '✓' : '✗'}
            </span>
          ) : null}
        </div>

        {/* Input form */}
        {phase === 'input' && (
          <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3 animate-fade-in">
            <input
              ref={inputRef}
              type="text"
              inputMode={inputMode}
              value={userInput}
              onChange={e => setUserInput(e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase())}
              placeholder={showReverseBanner ? 'Type backwards…' : 'Enter sequence…'}
              className="w-full py-4 px-4 rounded-xl bg-hv-card border border-hv-border text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-violet-500 transition-colors"
              maxLength={sequence.length + 2}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-violet-700 hover:bg-violet-600 text-white font-semibold transition-colors"
            >
              Submit
            </button>
          </form>
        )}

        {/* Feedback */}
        {phase === 'feedback' && (
          <div className="text-center animate-fade-in">
            <p className={`text-lg font-semibold ${feedback === 'correct' ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedback === 'correct' ? 'Correct!' : 'Incorrect'}
            </p>
            {feedback === 'wrong' && (
              <p className="text-slate-400 text-sm mt-1">
                {showReverseBanner ? 'Reversed: ' : 'Answer: '}
                {(showReverseBanner ? [...sequence].reverse() : sequence).join('  ')}
              </p>
            )}
            <p className="text-hv-muted text-xs mt-2">
              Span: {spanRef.current}{showReverseBanner ? ' · Reverse mode' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
