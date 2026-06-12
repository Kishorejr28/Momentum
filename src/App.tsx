import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Flame, Apple, Dumbbell, BookOpen, BarChart2, Sun, Moon, Mic, LogOut } from 'lucide-react'
import { useAppStore } from './store/appStore'
import { userApi } from './lib/api'
import { supabase } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import Habits from './pages/Habits'
import FoodLog from './pages/FoodLog'
import Workout from './pages/Workout'
import Journal from './pages/Journal'
import Analytics from './pages/Analytics'
import VoiceLog from './pages/VoiceLog'
import Onboarding from './pages/Onboarding'
import AuthPage from './pages/AuthPage'

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/habits', icon: Flame, label: 'Habits' },
  { to: '/food', icon: Apple, label: 'Food' },
  { to: '/workout', icon: Dumbbell, label: 'Workout' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/analytics', icon: BarChart2, label: 'Stats' },
]

function Layout({ children }: { children: React.ReactNode }) {
  const { streakLevel, theme, toggleTheme } = useAppStore()
  const location = useLocation()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <div className="min-h-screen relative">
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6"
        style={{
          paddingTop: 'calc(1rem + env(safe-area-inset-top))',
          paddingBottom: '1rem',
          background: 'rgba(var(--surface, 18 18 28) / 0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
            style={{ background: `rgb(var(--accent))`, boxShadow: `0 0 16px rgb(var(--accent) / 0.5)` }}>
            ✦
          </div>
          <span className="font-bold text-lg tracking-tight" style={{ color: 'rgb(var(--text-primary))' }}>
            Momentum
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NavLink to="/voice"
            className="p-2 rounded-xl transition-all hover:scale-110"
            style={{ background: `rgba(var(--accent) / 0.15)`, color: `rgb(var(--accent))` }}>
            <Mic size={18} />
          </NavLink>
          <button onClick={toggleTheme}
            className="p-2 rounded-xl transition-all hover:scale-110"
            style={{ background: 'rgba(var(--surface-raised, 26 26 42) / 0.8)', color: 'rgb(var(--text-secondary))' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={handleSignOut}
            className="p-2 rounded-xl transition-all hover:scale-110 opacity-50 hover:opacity-90"
            style={{ color: 'rgb(var(--text-muted))' }}
            title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="px-4 max-w-2xl mx-auto relative z-10 min-h-screen"
        style={{
          paddingTop: 'calc(5rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))',
        }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-4"
        style={{
          paddingTop: '0.75rem',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
          background: 'rgba(var(--surface, 18 18 28) / 0.92)',
          backdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.05)'
        }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {({ isActive }) => (
              <motion.div whileTap={{ scale: 0.88 }}
                className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all"
                style={{
                  color: isActive ? `rgb(var(--accent))` : `rgb(var(--text-muted))`,
                  background: isActive ? `rgba(var(--accent) / 0.12)` : 'transparent',
                }}>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

type AppState = 'loading' | 'auth' | 'onboarding' | 'app'

export default function App() {
  const { setUser, streakLevel, theme } = useAppStore()
  const [appState, setAppState] = useState<AppState>('loading')

  useEffect(() => {
    document.documentElement.className = `${theme} streak-${streakLevel}`
  }, [streakLevel, theme])

  useEffect(() => {
    // Check Supabase session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setAppState('auth'); return }

      const profile = await userApi.get()
      console.log('Session found, profile:', profile)
      setUser(profile)
      setAppState(!profile || profile.name === 'Champion' ? 'onboarding' : 'app')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event)
      if (!session) { setAppState('auth'); return }
      if (event === 'SIGNED_IN') {
        const profile = await userApi.get()
        console.log('Signed in, profile:', profile)
        setUser(profile)
        setAppState(!profile || profile.name === 'Champion' ? 'onboarding' : 'app')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (appState === 'loading') return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
        style={{ fontSize: 32, color: 'rgb(99 102 241)' }}>✦</motion.div>
    </div>
  )

  if (appState === 'auth') return <AuthPage onAuth={() => {}} />

  if (appState === 'onboarding') return (
    <Onboarding onDone={async () => {
      // Re-fetch fresh profile after name was saved
      const profile = await userApi.get()
      setUser(profile)
      setAppState('app')
    }} />
  )

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/food" element={<FoodLog />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/voice" element={<VoiceLog />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
