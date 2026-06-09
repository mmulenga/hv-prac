import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Maps each game to the numeric field used to determine "best"
export function getMetric(gameId, scoreData) {
  if (!scoreData) return 0
  switch (gameId) {
    case 'numerosity': return scoreData.score   ?? 0
    case 'digitspan':  return scoreData.maxSpan ?? 0
    case 'puzzle':     return scoreData.score   ?? 0
    case 'flashback':  return scoreData.accuracy ?? 0
    case 'shapedance': return scoreData.hitRate  ?? 0
    default:           return 0
  }
}

// Normalises a raw metric to 0–100 for the radar chart
export function normalise(gameId, value) {
  switch (gameId) {
    case 'numerosity': return Math.min(100, Math.round((value / 20) * 100))
    case 'digitspan':  return Math.min(100, Math.round(((value - 3) / 6) * 100))
    case 'puzzle':     return Math.min(100, Math.round((value / 12) * 100))
    case 'flashback':  return Math.min(100, value)
    case 'shapedance': return Math.min(100, value)
    default:           return 0
  }
}

export function useScores() {
  const { user } = useAuth()
  const [bestScores, setBestScores] = useState({}) // { [gameId]: { score_data, created_at } }
  const [fetching, setFetching] = useState(false)

  // Fetch all personal bests when the user signs in
  useEffect(() => {
    if (!user || !supabase) return
    setFetching(true)

    supabase
      .from('game_scores')
      .select('game_id, score_data, created_at')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!data) return
        const bests = {}
        data.forEach(row => {
          const current = bests[row.game_id]
          const rowMetric = getMetric(row.game_id, row.score_data)
          const bestMetric = current ? getMetric(row.game_id, current.score_data) : -1
          if (rowMetric > bestMetric) bests[row.game_id] = row
        })
        setBestScores(bests)
        setFetching(false)
      })
  }, [user?.id])

  // Clear bests when user signs out
  useEffect(() => {
    if (!user) setBestScores({})
  }, [user])

  const saveScore = useCallback(async (gameId, scoreData) => {
    if (!user || !supabase) return

    await supabase.from('game_scores').insert({
      user_id: user.id,
      game_id: gameId,
      score_data: scoreData,
    })

    // Update local best immediately without a re-fetch
    const newMetric = getMetric(gameId, scoreData)
    const currentBest = bestScores[gameId]
    if (!currentBest || newMetric > getMetric(gameId, currentBest.score_data)) {
      setBestScores(prev => ({
        ...prev,
        [gameId]: { game_id: gameId, score_data: scoreData, created_at: new Date().toISOString() },
      }))
    }
  }, [user, bestScores])

  return { bestScores, saveScore, fetching }
}
