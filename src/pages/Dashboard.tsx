import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Flame, Shield, Trophy, TrendingUp, Apple, Dumbbell, Pencil, Check } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { userApi, habitsApi, foodApi } from '../lib/api'
import { format } from 'date-fns'

const MOTIVATIONAL = [
  "Small steps every day build empires.",
  "Discipline is freedom.",
  "The only bad workout is the one that didn't happen.",
  "Your future self is watching. Make them proud.",
  "Progress, not perfection.",
  "Every day is a chance to be better than yesterday.",
  "Consistency beats intensity. Always.",
  "Champions aren't born. They're built one day at a time.",
]

const streakMessages: Record<number, string> = {
  0: "Start your streak today.",
  1: "7-day fire is within reach.",
  2: "Electric. Keep going.",
  3: "On fire. Nothing can stop you.",
  4: "Legend status. You're unstoppable.",
}

function StreakRing({ streak, level }: { streak: number; level: number }) {
  const size = 140
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const nextMilestone = [7, 14, 30, 60, 100].find(m => m > streak) || 100
  const progress = Math.min(streak / nextMilestone, 1)
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={`rgb(var(--accent))`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s ease', filter: 'drop-shadow(0 0 8px rgb(var(--accent)))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black" style={{ color: 'rgb(var(--accent))' }}>{streak}</span>
        <span className="text-[11px] font-medium" style={{ color: 'rgb(var(--text-muted))' }}>day streak</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user, setUser, habits, setHabits, streakLevel } = useAppStore()
  const [macros, setMacros] = useState<any>(null)
  const [quote] = useState(() => MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)])
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    habitsApi.getAll(today).then(setHabits)
    foodApi.getSummary(today).then(setMacros)
  }, [])

  const saveName = async () => {
    if (!nameInput.trim()) return
    await userApi.update({ name: nameInput.trim() })
    const updated = await userApi.get()
    setUser(updated)
    setEditingName(false)
  }

  const completedCount = habits.filter((h: any) => h.completedToday).length
  const totalHabits = habits.length
  const completionPct = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0

  const calorieGoal = user?.calorie_goal || user?.calorieGoal || 2000
  const caloriesLogged = macros?.calories || 0
  const caloriePct = Math.min((caloriesLogged / calorieGoal) * 100, 100)

  return (
    <div className="space-y-6 pt-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-muted))' }}>
            {format(new Date(), 'EEEE, MMM d')}
          </p>
          {editingName ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                autoFocus
                className="text-xl font-bold bg-transparent outline-none border-b-2 flex-1"
                style={{ color: 'rgb(var(--text-primary))', borderColor: 'rgb(var(--accent))' }}
              />
              <button onClick={saveName}>
                <Check size={18} style={{ color: 'rgb(var(--accent))' }} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-0.5">
              <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
                Hey, {user?.name || 'Champion'} 👋
              </h1>
              <button
                onClick={() => { setNameInput(user?.name || ''); setEditingName(true) }}
                className="opacity-40 hover:opacity-80 transition-opacity">
                <Pencil size={14} style={{ color: 'rgb(var(--text-muted))' }} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: `rgba(var(--accent) / 0.15)`, color: `rgb(var(--accent))` }}>
          <Shield size={14} />
          {user?.freeze_shields ?? user?.freezeShields ?? 0} shields
        </div>
      </div>

      {/* Quote */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass px-5 py-4"
        style={{ borderColor: `rgba(var(--accent) / 0.2)` }}>
        <p className="text-sm italic font-medium leading-relaxed"
          style={{ color: 'rgb(var(--text-secondary))' }}>
          "{quote}"
        </p>
      </motion.div>

      {/* Streak + today progress */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass flex flex-col items-center justify-center py-6 gap-3">
          <StreakRing streak={user?.current_streak ?? user?.currentStreak ?? 0} level={streakLevel} />
          <p className="text-xs text-center font-medium" style={{ color: 'rgb(var(--text-muted))' }}>
            {streakMessages[streakLevel]}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="glass flex flex-col justify-between p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: 'rgb(var(--text-muted))' }}>Today</p>
            <p className="text-3xl font-black" style={{ color: 'rgb(var(--text-primary))' }}>
              {completedCount}<span className="text-lg font-medium" style={{ color: 'rgb(var(--text-muted))' }}>/{totalHabits}</span>
            </p>
            <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>habits done</p>
          </div>
          {/* Progress bar */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Completion</span>
              <span className="text-xs font-bold" style={{ color: 'rgb(var(--accent))' }}>{completionPct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completionPct}%` }}
                transition={{ delay: 0.3, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                className="h-full rounded-full"
                style={{ background: `rgb(var(--accent))`, boxShadow: `0 0 8px rgb(var(--accent) / 0.5)` }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Calories */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Apple size={18} style={{ color: 'rgb(var(--accent))' }} />
            <span className="font-semibold text-sm" style={{ color: 'rgb(var(--text-primary))' }}>Calories Today</span>
          </div>
          <Link to="/food" className="text-xs font-medium" style={{ color: 'rgb(var(--accent))' }}>Log food →</Link>
        </div>
        <div className="flex items-end gap-2 mb-3">
          <span className="text-3xl font-black" style={{ color: 'rgb(var(--text-primary))' }}>
            {Math.round(caloriesLogged)}
          </span>
          <span className="text-sm mb-1" style={{ color: 'rgb(var(--text-muted))' }}>/ {calorieGoal} kcal</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${caloriePct}%` }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="h-full rounded-full"
            style={{
              background: caloriePct > 100 ? '#ef4444' : `rgb(var(--accent))`,
              boxShadow: `0 0 8px rgb(var(--accent) / 0.4)`
            }}
          />
        </div>
        {macros && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Protein', val: macros.protein, color: '#60a5fa' },
              { label: 'Carbs', val: macros.carbs, color: '#f59e0b' },
              { label: 'Fat', val: macros.fat, color: '#f87171' },
            ].map(m => (
              <div key={m.label} className="text-center rounded-xl p-2"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-lg font-bold" style={{ color: m.color }}>{Math.round(m.val)}g</div>
                <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgb(var(--text-muted))' }}>{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass p-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'rgb(var(--text-muted))' }}>Quick Log</p>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/habits" className="glass-hover glass flex items-center gap-3 p-3">
            <Flame size={20} style={{ color: 'rgb(var(--accent))' }} />
            <span className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Habits</span>
          </Link>
          <Link to="/food" className="glass-hover glass flex items-center gap-3 p-3">
            <Apple size={20} style={{ color: '#4ade80' }} />
            <span className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Food</span>
          </Link>
          <Link to="/workout" className="glass-hover glass flex items-center gap-3 p-3">
            <Dumbbell size={20} style={{ color: '#f59e0b' }} />
            <span className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Workout</span>
          </Link>
          <Link to="/analytics" className="glass-hover glass flex items-center gap-3 p-3">
            <TrendingUp size={20} style={{ color: '#a78bfa' }} />
            <span className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Progress</span>
          </Link>
        </div>
      </motion.div>

      {/* Badges */}
      {user?.badges?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} style={{ color: '#facc15' }} />
            <span className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
              Badges ({user.badges.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.badges.map((ub: any) => (
              <motion.div
                key={ub.id}
                whileHover={{ scale: 1.1 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(var(--accent) / 0.15)', color: 'rgb(var(--text-primary))' }}
                title={ub.badge.description}>
                <span>{ub.badge.icon}</span>
                <span>{ub.badge.name}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
