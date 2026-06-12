import { create } from 'zustand'

export type StreakLevel = 0 | 1 | 2 | 3 | 4

function getStreakLevel(streak: number): StreakLevel {
  if (streak >= 60) return 4
  if (streak >= 30) return 3
  if (streak >= 14) return 2
  if (streak >= 7) return 1
  return 0
}

interface AppState {
  user: any | null
  habits: any[]
  theme: 'dark' | 'light'
  streakLevel: StreakLevel
  setUser: (user: any) => void
  setHabits: (habits: any[]) => void
  toggleTheme: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  habits: [],
  theme: (localStorage.getItem('momentum_theme') as 'dark' | 'light') || 'dark',
  streakLevel: 0,

  setUser: (user) => set({
    user,
    streakLevel: getStreakLevel(user?.current_streak ?? user?.currentStreak ?? 0)
  }),

  setHabits: (habits) => set({ habits }),

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    const level = get().streakLevel
    document.documentElement.className = `${next} streak-${level}`
    localStorage.setItem('momentum_theme', next)
    set({ theme: next })
  },
}))

export { getStreakLevel }
