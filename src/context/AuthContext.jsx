import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  isPremium: false,
  refreshPremium: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load premium status whenever the signed-in user changes
  useEffect(() => {
    if (!supabase || !session?.user?.id) { setIsPremium(false); return }
    supabase
      .from('profiles')
      .select('is_premium')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => setIsPremium(data?.is_premium ?? false))
  }, [session?.user?.id])

  const refreshPremium = useCallback(async () => {
    if (!supabase || !session?.user?.id) return
    const { data } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('user_id', session.user.id)
      .single()
    setIsPremium(data?.is_premium ?? false)
  }, [session?.user?.id])

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      session,
      loading,
      isPremium,
      refreshPremium,
      signOut: () => supabase?.auth.signOut(),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
