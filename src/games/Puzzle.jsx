import { useState, useCallback } from 'react'
import GameHeader from '../components/GameHeader'

const TOTAL_PUZZLES = 12

const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'cross']
const FILLS = ['solid', 'hollow', 'stripe']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickN(arr, n) {
  return shuffle([...arr]).slice(0, n)
}

// Generate a matrix puzzle using one of 3 rule types.
// Returns { grid: Cell[3][3], answer: Cell, choices: Cell[] }
// Cell = { shape, fill, count }
function generatePuzzle(seed) {
  const ruleType = seed % 3

  const shapes = pickN(SHAPES, 3)
  const fills = pickN(FILLS, 3)

  let grid
  if (ruleType === 0) {
    // Rule A: row determines shape, col determines fill, count = 2
    grid = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => ({
        shape: shapes[r],
        fill: fills[c],
        count: 2,
      }))
    )
  } else if (ruleType === 1) {
    // Rule B: col determines shape, row determines fill, count = (r+c)%3 +1
    grid = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => ({
        shape: shapes[c],
        fill: fills[r],
        count: ((r + c) % 3) + 1,
      }))
    )
  } else {
    // Rule C: same shape throughout, fill cycles per row, count increments per col
    grid = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => ({
        shape: shapes[0],
        fill: fills[r],
        count: c + 1,
      }))
    )
  }

  const answer = grid[2][2]

  // Generate wrong answers by mutating one property of the answer
  const wrongPool = [
    { ...answer, shape: shapes[(shapes.indexOf(answer.shape) + 1) % 3] },
    { ...answer, fill: fills[(fills.indexOf(answer.fill) + 1) % 3] },
    { ...answer, count: answer.count === 3 ? 1 : answer.count + 1 },
    { ...answer, shape: shapes[(shapes.indexOf(answer.shape) + 2) % 3], fill: fills[(fills.indexOf(answer.fill) + 2) % 3] },
  ]

  const choices = shuffle([answer, ...wrongPool.slice(0, 3)])
  return { grid, answer, choices }
}

// SVG shape renderer
function ShapeIcon({ shape, fill, size = 28 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.34
  const fillColor = '#3b82f6'
  const strokeColor = '#60a5fa'
  const sw = 2

  const fillProp = fill === 'solid' ? fillColor : fill === 'hollow' ? 'none' : 'url(#stripe)'
  const strokeProp = strokeColor

  function renderShape() {
    switch (shape) {
      case 'circle':
        return <circle cx={cx} cy={cy} r={r} fill={fillProp} stroke={strokeProp} strokeWidth={sw} />
      case 'square':
        return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={fillProp} stroke={strokeProp} strokeWidth={sw} />
      case 'triangle':
        return (
          <polygon
            points={`${cx},${cy - r} ${cx + r * 0.87},${cy + r * 0.5} ${cx - r * 0.87},${cy + r * 0.5}`}
            fill={fillProp} stroke={strokeProp} strokeWidth={sw}
          />
        )
      case 'diamond':
        return (
          <polygon
            points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
            fill={fillProp} stroke={strokeProp} strokeWidth={sw}
          />
        )
      case 'cross':
        return (
          <g fill={fillProp} stroke={strokeProp} strokeWidth={sw}>
            <rect x={cx - r * 0.33} y={cy - r} width={r * 0.66} height={r * 2} />
            <rect x={cx - r} y={cy - r * 0.33} width={r * 2} height={r * 0.66} />
          </g>
        )
      default:
        return null
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <pattern id="stripe" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={strokeColor} strokeWidth="2" />
        </pattern>
      </defs>
      {renderShape()}
    </svg>
  )
}

function MatrixCell({ shape, fill, count, size = 24, highlight = false }) {
  const gap = size * 0.15
  const totalW = count * size + (count - 1) * gap
  const offsets = Array.from({ length: count }, (_, i) => i * (size + gap) - totalW / 2 + size / 2)

  return (
    <div
      className={`relative flex items-center justify-center rounded-lg border transition-colors
        ${highlight ? 'border-hv-accent-light bg-blue-900/30' : 'border-hv-border bg-hv-bg'}`}
      style={{ width: 72, height: 72 }}
    >
      <svg width={72} height={72} viewBox="-36 -36 72 72">
        <defs>
          <pattern id={`stripe-${shape}-${fill}`} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="#60a5fa" strokeWidth="2" />
          </pattern>
        </defs>
        {offsets.map((ox, i) => (
          <g key={i} transform={`translate(${count > 1 ? ox : 0}, 0)`}>
            <ShapeInSVG shape={shape} fill={fill} size={size} />
          </g>
        ))}
      </svg>
    </div>
  )
}

function ShapeInSVG({ shape, fill, size }) {
  const r = size * 0.38
  const fillColor = '#3b82f6'
  const strokeColor = '#60a5fa'
  const sw = 1.5
  const fp = fill === 'solid' ? fillColor : fill === 'hollow' ? 'none' : 'url(#stripe-' + shape + '-' + fill + ')'

  switch (shape) {
    case 'circle':
      return <circle r={r} fill={fp} stroke={strokeColor} strokeWidth={sw} />
    case 'square':
      return <rect x={-r} y={-r} width={r * 2} height={r * 2} fill={fp} stroke={strokeColor} strokeWidth={sw} />
    case 'triangle':
      return (
        <polygon
          points={`0,${-r} ${r * 0.87},${r * 0.5} ${-r * 0.87},${r * 0.5}`}
          fill={fp} stroke={strokeColor} strokeWidth={sw}
        />
      )
    case 'diamond':
      return (
        <polygon
          points={`0,${-r} ${r},0 0,${r} ${-r},0`}
          fill={fp} stroke={strokeColor} strokeWidth={sw}
        />
      )
    case 'cross':
      return (
        <g fill={fp} stroke={strokeColor} strokeWidth={sw}>
          <rect x={-r * 0.3} y={-r} width={r * 0.6} height={r * 2} />
          <rect x={-r} y={-r * 0.3} width={r * 2} height={r * 0.6} />
        </g>
      )
    default:
      return null
  }
}

// phase: 'start' | 'question' | 'feedback' | 'results'
export default function Puzzle({ onEnd, onBack }) {
  const [phase, setPhase] = useState('start')
  const [puzzleIdx, setPuzzleIdx] = useState(0)
  const [puzzle, setPuzzle] = useState(() => generatePuzzle(0))
  const [selected, setSelected] = useState(null)
  const [score, setScore] = useState(0)
  const [history, setHistory] = useState([]) // array of booleans

  const startQuestion = useCallback((idx) => {
    setPuzzle(generatePuzzle(idx * 7 + Math.floor(Math.random() * 100)))
    setSelected(null)
    setPhase('question')
  }, [])

  function handleChoice(idx) {
    if (phase !== 'question') return
    setSelected(idx)
    const cell = puzzle.choices[idx]
    const correct =
      cell.shape === puzzle.answer.shape &&
      cell.fill === puzzle.answer.fill &&
      cell.count === puzzle.answer.count

    if (correct) setScore(s => s + 1)
    setHistory(h => [...h, correct])
    setPhase('feedback')

    setTimeout(() => {
      const next = puzzleIdx + 1
      if (next >= TOTAL_PUZZLES) {
        setPhase('results')
      } else {
        setPuzzleIdx(next)
        startQuestion(next)
      }
    }, 900)
  }

  if (phase === 'start') {
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Puzzle" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-fade-in">
            <div className="text-6xl">🧩</div>
            <h2 className="text-white text-2xl font-bold">Puzzle</h2>
            <p className="text-slate-400 leading-relaxed">
              Each puzzle shows a 3×3 grid of symbols following a hidden rule.
              The bottom-right cell is missing — identify it from four choices.
            </p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• {TOTAL_PUZZLES} puzzles</li>
              <li>• Look for patterns in shape, fill, and count</li>
              <li>• +1 point per correct answer</li>
            </ul>
            <button
              onClick={() => startQuestion(0)}
              className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold transition-colors"
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'results') {
    const pct = Math.round((score / TOTAL_PUZZLES) * 100)
    return (
      <div className="min-h-screen bg-hv-bg flex flex-col">
        <GameHeader title="Puzzle" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6 animate-scale-in">
            <div className="w-24 h-24 mx-auto rounded-full bg-hv-card border-4 border-emerald-600 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{pct}%</span>
            </div>
            <div>
              <h2 className="text-white text-2xl font-bold">
                {pct >= 83 ? 'Excellent' : pct >= 58 ? 'Good' : 'Keep Practicing'}
              </h2>
              <p className="text-slate-400 mt-1">{score} / {TOTAL_PUZZLES} correct</p>
            </div>
            {/* History */}
            <div className="flex justify-center gap-1.5 flex-wrap">
              {history.map((ok, i) => (
                <div key={i} className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${ok ? 'bg-emerald-700 text-white' : 'bg-red-800 text-white'}`}>
                  {ok ? '✓' : '✗'}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setScore(0); setPuzzleIdx(0); setHistory([]); startQuestion(0) }}
                className="py-3 rounded-xl bg-hv-card border border-hv-border text-white font-semibold hover:border-emerald-600 transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={() => onEnd({ score, total: TOTAL_PUZZLES, display: `${score}/${TOTAL_PUZZLES}` })}
                className="py-3 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { grid, choices } = puzzle

  return (
    <div className="min-h-screen bg-hv-bg flex flex-col">
      <GameHeader
        title="Puzzle"
        onBack={onBack}
        round={puzzleIdx + 1}
        totalRounds={TOTAL_PUZZLES}
        score={score}
      />
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        {/* 3×3 matrix */}
        <div className="space-y-1 animate-fade-in">
          {grid.map((row, r) => (
            <div key={r} className="flex gap-1">
              {row.map((cell, c) => {
                const isMissing = r === 2 && c === 2
                return (
                  <div key={c}>
                    {isMissing ? (
                      <div className="w-[72px] h-[72px] rounded-lg border-2 border-dashed border-hv-accent flex items-center justify-center text-hv-accent text-2xl font-bold">
                        ?
                      </div>
                    ) : (
                      <MatrixCell shape={cell.shape} fill={cell.fill} count={cell.count} />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <p className="text-hv-muted text-sm">Select the missing piece</p>

        {/* 4 choices */}
        <div className="grid grid-cols-2 gap-2 animate-fade-in">
          {choices.map((cell, idx) => {
            let border = 'border-hv-border hover:border-hv-accent-light'
            if (phase === 'feedback') {
              const isAnswer = cell.shape === puzzle.answer.shape && cell.fill === puzzle.answer.fill && cell.count === puzzle.answer.count
              if (isAnswer) border = 'border-emerald-500'
              else if (idx === selected) border = 'border-red-500'
              else border = 'border-hv-border'
            }

            return (
              <button
                key={idx}
                disabled={phase === 'feedback'}
                onClick={() => handleChoice(idx)}
                className={`rounded-xl border-2 p-2 flex items-center justify-center transition-colors ${border} bg-hv-card active:scale-95`}
              >
                <MatrixCell shape={cell.shape} fill={cell.fill} count={cell.count} />
              </button>
            )
          })}
        </div>

        {phase === 'feedback' && (
          <p className={`text-sm font-semibold animate-fade-in ${selected !== null && choices[selected].shape === puzzle.answer.shape && choices[selected].fill === puzzle.answer.fill && choices[selected].count === puzzle.answer.count ? 'text-emerald-400' : 'text-red-400'}`}>
            {selected !== null && choices[selected].shape === puzzle.answer.shape && choices[selected].fill === puzzle.answer.fill && choices[selected].count === puzzle.answer.count
              ? '✓ Correct!'
              : '✗ Wrong answer'}
          </p>
        )}
      </div>
    </div>
  )
}
