import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'

export default function AuthModal({ onClose }) {
  if (!supabase) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-hv-card border border-hv-border rounded-2xl p-6 max-w-sm w-full text-center">
          <p className="text-white font-semibold mb-2">Supabase not configured</p>
          <p className="text-slate-400 text-sm mb-4">
            Add <code className="text-amber-400">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-amber-400">VITE_SUPABASE_ANON_KEY</code> to your{' '}
            <code className="text-amber-400">.env.local</code> file.
          </p>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-hv-border text-white text-sm hover:bg-hv-muted/30 transition-colors">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-hv-card border border-hv-border rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Sign in</h2>
          <button
            onClick={onClose}
            className="text-hv-muted hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <Auth
          supabaseClient={supabase}
          providers={['google', 'apple']}
          redirectTo={window.location.origin + '/hv-prac/'}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#2563eb',
                  brandAccent: '#3b82f6',
                  inputBackground: '#0b1426',
                  inputBorder: '#1e3a5f',
                  inputText: '#f1f5f9',
                  inputPlaceholder: '#64748b',
                  inputLabelText: '#94a3b8',
                  messageText: '#94a3b8',
                  anchorTextColor: '#3b82f6',
                  dividerBackground: '#1e3a5f',
                },
                radii: {
                  borderRadiusButton: '0.75rem',
                  inputBorderRadius: '0.75rem',
                },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
