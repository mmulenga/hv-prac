import { useState, lazy, Suspense } from 'react'
import GameCard from './components/GameCard'
import AuthModal from './components/AuthModal'
import { useAuth } from './context/AuthContext'
import { useScores } from './hooks/useScores'
import './App.css'

// Lazy-loaded to keep the initial bundle small
const Numerosity = lazy(() => import('./games/Numerosity'))
const DigitSpan   = lazy(() => import('./games/DigitSpan'))
const Puzzle      = lazy(() => import('./games/Puzzle'))
const Flashback   = lazy(() => import('./games/Flashback'))
const ShapeDance  = lazy(() => import('./games/ShapeDance'))
const Profile     = lazy(() => import('./screens/Profile'))  // contains Recharts

const GAMES = [
  {
    id: 'numerosity',
    title: 'Numerosity',
    description: 'An operation symbol is shown — find the two numbers whose combination equals the target.',
    icon: '🔢',
    gradient: 'from-blue-700 to-blue-900',
    skills: ['Processing Speed', 'Arithmetic'],
    rounds: '90 s',
  },
  {
    id: 'digitspan',
    title: 'Digit Span',
    description: 'Watch a sequence of digits appear one at a time, then type them back in order.',
    icon: '🧠',
    gradient: 'from-violet-700 to-purple-900',
    skills: ['Working Memory', 'Attention'],
    rounds: '15 trials',
  },
  {
    id: 'puzzle',
    title: 'Puzzle',
    description: 'Identify the missing piece that completes the 3×3 visual pattern matrix.',
    icon: '🧩',
    gradient: 'from-emerald-700 to-teal-900',
    skills: ['Spatial Reasoning', 'Pattern Recognition'],
    rounds: '12 puzzles',
  },
  {
    id: 'flashback',
    title: 'Flashback',
    description: 'Decide whether each shape matches the one shown N steps earlier in the sequence.',
    icon: '💡',
    gradient: 'from-amber-600 to-orange-900',
    skills: ['Working Memory', 'N-Back'],
    rounds: '25 trials',
  },
  {
    id: 'shapedance',
    title: 'Shape Dance',
    description: 'Press the button when you see the target shape — ignore all other shapes.',
    icon: '🔺',
    gradient: 'from-rose-700 to-red-900',
    skills: ['Reaction Time', 'Inhibition'],
    rounds: '30 trials',
  },
]

const GAME_COMPONENTS = {
  numerosity: Numerosity,
  digitspan: DigitSpan,
  puzzle: Puzzle,
  flashback: Flashback,
  shapedance: ShapeDance,
}

// 'home' | 'profile' | gameId
export default function App() {
  const [screen, setScreen] = useState('home')
  const [showAuth, setShowAuth] = useState(false)
  const [sessionScores, setSessionScores] = useState({}) // fallback for guests

  const { user, loading } = useAuth()
  const { bestScores, saveScore } = useScores()

  function handleGameEnd(gameId, result) {
    setSessionScores(prev => ({ ...prev, [gameId]: result }))
    if (user) saveScore(gameId, result)
    setScreen('home')
  }

  // Guests see session-only scores; signed-in users see their Supabase bests
  function displayScoreFor(gameId) {
    if (user) return bestScores[gameId]?.score_data ?? null
    return sessionScores[gameId] ?? null
  }

  const GameComponent = GAME_COMPONENTS[screen]

  if (screen === 'profile' || GameComponent) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-hv-bg flex items-center justify-center">
          <div className="text-hv-muted text-sm">Loading…</div>
        </div>
      }>
        {screen === 'profile'
          ? <Profile onBack={() => setScreen('home')} />
          : <GameComponent
              onEnd={result => handleGameEnd(screen, result)}
              onBack={() => setScreen('home')}
            />
        }
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen bg-hv-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-hv-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-hv-accent flex items-center justify-center text-sm font-bold text-white">
              HV
            </div>
            <span className="text-white font-semibold tracking-tight">HireVue Practice</span>
          </div>

          <div className="flex items-center gap-3">
            {!loading && (
              user ? (
                <button
                  onClick={() => setScreen('profile')}
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-hv-accent flex items-center justify-center text-xs font-bold text-white">
                    {(user.email ?? 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline">Profile</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="px-4 py-1.5 rounded-lg bg-hv-accent hover:bg-hv-accent-light text-white text-sm font-medium transition-colors"
                >
                  Sign in
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-5xl mx-auto w-full px-6 pt-10 pb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Practice Games</h1>
        <p className="text-hv-muted text-base">
          Sharpen your cognitive skills with the same game formats used in HireVue assessments.
          {!user && (
            <span className="text-slate-400">
              {' '}<button onClick={() => setShowAuth(true)} className="text-hv-accent hover:underline">Sign in</button> to save your scores.
            </span>
          )}
        </p>
      </div>

      {/* Games grid */}
      <div className="max-w-5xl mx-auto w-full px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAMES.map(game => (
            <GameCard
              key={game.id}
              game={game}
              score={displayScoreFor(game.id)}
              onPlay={() => setScreen(game.id)}
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

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}
