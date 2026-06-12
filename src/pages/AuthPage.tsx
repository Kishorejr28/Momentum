import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup' | 'forgot'

export default function AuthPage({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    setError('')
    setMessage('')
    if (!email || (mode !== 'forgot' && !password)) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onAuth()
      } else if (mode === 'signup') {
        if (!name.trim()) { setError('Please enter your name.'); setLoading(false); return }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name: name.trim() } }
        })
        if (error) throw error
        // Immediately write name to profile if session exists (email confirm disabled)
        if (data.session) {
          await supabase.from('profiles').update({ name: name.trim() }).eq('id', data.session.user.id)
          onAuth()
        } else {
          setMessage('Account created! Check your email to confirm, then log in.')
          setMode('login')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        setMessage('Password reset email sent — check your inbox.')
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    }
    setLoading(false)
  }

  return (
    <div className="streak-0 min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#0a0a0f' }}>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 mb-10">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
          style={{ background: 'rgb(99 102 241)', boxShadow: '0 0 32px rgba(99,102,241,0.5)' }}>
          ✦
        </div>
        <h1 className="text-3xl font-black" style={{ color: '#f8f8ff' }}>Momentum</h1>
        <p className="text-sm" style={{ color: 'rgba(248,248,255,0.4)' }}>
          Build habits. Track health. Stay consistent.
        </p>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-sm space-y-4"
        style={{
          background: 'rgba(26,26,42,0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20,
          padding: 28,
        }}>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {(['login', 'signup'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setMessage('') }}
              className="flex-1 py-2.5 text-sm font-semibold transition-all capitalize"
              style={{
                background: mode === m ? 'rgb(99 102 241)' : 'transparent',
                color: mode === m ? '#000' : 'rgba(248,248,255,0.5)',
                borderRadius: 10,
              }}>
              {m}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'login' ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-3">

            {mode === 'signup' && (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8f8ff' }}
              />
            )}

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8f8ff' }}
            />

            {mode !== 'forgot' && (
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8f8ff' }}
              />
            )}

            {error && (
              <p className="text-xs text-center py-1" style={{ color: '#f87171' }}>{error}</p>
            )}
            {message && (
              <p className="text-xs text-center py-1" style={{ color: '#4ade80' }}>{message}</p>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition-all"
              style={{
                background: 'rgb(99 102 241)',
                color: '#000',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
              }}>
              {loading ? '...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
            </motion.button>

            {mode === 'login' && (
              <button onClick={() => { setMode('forgot'); setError('') }}
                className="w-full text-xs text-center py-1"
                style={{ color: 'rgba(248,248,255,0.35)' }}>
                Forgot password?
              </button>
            )}
            {mode === 'forgot' && (
              <button onClick={() => setMode('login')}
                className="w-full text-xs text-center py-1"
                style={{ color: 'rgba(248,248,255,0.35)' }}>
                ← Back to login
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
