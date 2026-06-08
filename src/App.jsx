import { useState } from 'react'
import GameCard from './components/GameCard'
import Numerosity from './games/Numerosity'
import DigitSpan from './games/DigitSpan'
import Puzzle from './games/Puzzle'
import Flashback from './games/Flashback'
import ShapeDance from './games/ShapeDance'
import './App.css'

const GAMES = [
  {
    id: 'numerosity',
    title: 'Numerosity',
    description: 'Dots flash briefly on screen — estimate the count and pick the right answer before time runs out.',
    icon: '⚫',
    gradient: 'from-blue-700 to-blue-900',
    skills: ['Processing Speed', 'Numerical Estimation'],
    rounds: 20,
  },
  {
    id: 'digitspan',
    title: 'Digit Span',
    description: 'Watch a sequence of digits appear one at a time, then type them back in order.',
    icon: '🔢',
    gradient: 'from-violet-700 to-purple-900',
    skills: ['Working Memory', 'Attention'],
    rounds: 15,
  },
  {
    id: 'puzzle',
    title: 'Puzzle',
    description: 'Identify the missing piece that completes the 3×3 visual pattern matrix.',
    icon: '🧩',
    gradient: 'from-emerald-700 to-teal-900',
    skills: ['Spatial Reasoning', 'Pattern Recognition'],
    rounds: 12,
  },
  {
    id: 'flashback',
    title: 'Flashback',
    description: 'Watch grid squares light up in sequence, then reproduce the pattern from memory.',
    icon: '💡',
    gradient: 'from-amber-600 to-orange-900',
    skills: ['Visual Memory', 'Spatial Recall'],
    rounds: 10,
  },
  {
    id: 'shapedance',
    title: 'Shape Dance',
    description: 'Press the button when you see the target shape — ignore all other shapes.',
    icon: '🔺',
    gradient: 'from-rose-700 to-red-900',
    skills: ['Reaction Time', 'Inhibition Control'],
    rounds: 30,
  },
]

const GAME_COMPONENTS = {
  numerosity: Numerosity,
  digitspan: DigitSpan,
  puzzle: Puzzle,
  flashback: Flashback,
  shapedance: ShapeDance,
}

export default function App() {
  const [activeGame, setActiveGame] = useState(null)
  const [scores, setScores] = useState({})

  function handleGameEnd(gameId, result) {
    setScores(prev => ({ ...prev, [gameId]: result }))
    setActiveGame(null)
  }

  if (activeGame) {
    const GameComponent = GAME_COMPONENTS[activeGame]
    return (
      <GameComponent
        onEnd={(result) => handleGameEnd(activeGame, result)}
        onBack={() => setActiveGame(null)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-hv-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-hv-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-hv-accent flex items-center justify-center text-sm font-bold">
              HV
            </div>
            <span className="text-white font-semibold tracking-tight">HireVue Practice</span>
          </div>
          <span className="text-hv-muted text-sm">Cognitive Assessment Games</span>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-5xl mx-auto w-full px-6 pt-12 pb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Practice Games</h1>
        <p className="text-hv-muted text-base">
          Sharpen your cognitive skills with the same game formats used in HireVue assessments.
        </p>
      </div>

      {/* Games Grid */}
      <div className="max-w-5xl mx-auto w-full px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAMES.map(game => (
            <GameCard
              key={game.id}
              game={game}
              score={scores[game.id]}
              onPlay={() => setActiveGame(game.id)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-hv-border px-6 py-4 text-center">
        <p className="text-hv-muted text-xs">
          Practice tool — not affiliated with HireVue Inc.
        </p>
      </div>
    </div>
  )
}
