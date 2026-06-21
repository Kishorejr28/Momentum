import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, Flame, Trash2, Shield, Pencil, X } from 'lucide-react'
import { habitsApi, userApi } from '../lib/api'
import { useAppStore } from '../store/appStore'
import { format } from 'date-fns'

const CATEGORIES = [
  { id: 'fitness', label: 'Fitness', icon: '💪' },
  { id: 'mindfulness', label: 'Mind', icon: '🧘' },
  { id: 'learning', label: 'Learning', icon: '📚' },
  { id: 'health', label: 'Health', icon: '🥗' },
  { id: 'chores', label: 'Chores', icon: '🏠' },
  { id: 'social', label: 'Social', icon: '🤝' },
  { id: 'creative', label: 'Creative', icon: '✏️' },
  { id: 'general', label: 'General', icon: '✦' },
]

const FREQ_OPTIONS = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'X times/week' },
]

function HabitCard({ habit, onToggle, onDelete, onEdit }: any) {
  const [pressing, setPressing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(habit.name)

  const cat = CATEGORIES.find(c => c.id === habit.category) || CATEGORIES[7]

  const handleSaveEdit = async () => {
    if (!editName.trim()) return
    await onEdit(habit.id, { name: editName.trim() })
    setEditing(false)
  }

  if (editing) {
    return (
      <motion.div layout className="glass flex items-center gap-3 p-4">
        <input
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(false) }}
          autoFocus
          className="flex-1 px-3 py-2 rounded-xl text-sm font-semibold outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(var(--accent)/0.4)`, color: 'rgb(var(--text-primary))' }}
        />
        <button onClick={handleSaveEdit} className="p-2 rounded-xl"
          style={{ background: `rgba(var(--accent)/0.2)`, color: `rgb(var(--accent))` }}>
          <Check size={16} />
        </button>
        <button onClick={() => setEditing(false)} className="p-2 rounded-xl opacity-50">
          <X size={16} style={{ color: 'rgb(var(--text-muted))' }} />
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="glass glass-hover flex items-center gap-4 p-4"
    >
      {/* Complete button */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        onTapStart={() => setPressing(true)}
        onTap={() => { setPressing(false); onToggle(habit.id) }}
        onTapCancel={() => setPressing(false)}
        onClick={() => onToggle(habit.id)}
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
        style={{
          background: habit.completedToday
            ? `rgb(var(--accent))`
            : 'rgba(255,255,255,0.06)',
          border: habit.completedToday
            ? 'none'
            : `2px solid rgba(var(--accent) / 0.3)`,
          boxShadow: habit.completedToday
            ? `0 0 16px rgba(var(--accent) / 0.5)`
            : 'none',
        }}>
        {habit.completedToday
          ? <Check size={20} color="#000" strokeWidth={3} />
          : <span className="text-lg">{cat.icon}</span>
        }
      </motion.button>

      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate" style={{
          color: habit.completedToday ? 'rgb(var(--text-muted))' : 'rgb(var(--text-primary))',
          textDecoration: habit.completedToday ? 'line-through' : 'none',
        }}>
          {habit.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] font-medium" style={{ color: 'rgb(var(--text-muted))' }}>
            {habit.frequency === 'daily' ? 'Daily' : `${habit.times_per_week}×/week`}
          </span>
          {habit.streak > 0 && (
            <div className="flex items-center gap-0.5 text-[11px] font-semibold"
              style={{ color: 'rgb(var(--accent))' }}>
              <Flame size={11} />
              {habit.streak}d
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setEditing(true)}
        className="p-2 rounded-lg opacity-30 hover:opacity-70 transition-opacity"
        style={{ color: 'rgb(var(--text-muted))' }}>
        <Pencil size={14} />
      </button>
      <button
        onClick={() => onDelete(habit.id)}
        className="p-2 rounded-lg opacity-30 hover:opacity-70 transition-opacity"
        style={{ color: 'rgb(var(--text-muted))' }}>
        <Trash2 size={15} />
      </button>
    </motion.div>
  )
}

export default function Habits() {
  const { habits, setHabits, user, setUser } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [newHabit, setNewHabit] = useState({ name: '', category: 'general', frequency: 'daily', times_per_week: 1 })
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    habitsApi.getAll(today).then(data => {
      const sorted = [...data].sort((a: any, b: any) => {
        if (a.completedToday === b.completedToday) return 0
        return a.completedToday ? 1 : -1
      })
      setHabits(sorted)
    })
  }, [])

  const handleToggle = async (id: string) => {
    await habitsApi.toggle(id, today)
    const updated = await habitsApi.getAll(today)
    // Incomplete on top, completed at bottom
    const sorted = [...updated].sort((a: any, b: any) => {
      if (a.completedToday === b.completedToday) return 0
      return a.completedToday ? 1 : -1
    })
    setHabits(sorted)
    const updatedUser = await userApi.get()
    setUser(updatedUser)
  }

  const handleDelete = async (id: string) => {
    await habitsApi.delete(id)
    setHabits(habits.filter((h: any) => h.id !== id))
  }

  const handleAdd = async () => {
    if (!newHabit.name.trim()) return
    await habitsApi.create(newHabit)
    const updated = await habitsApi.getAll(today)
    setHabits(updated)
    setNewHabit({ name: '', category: 'general', frequency: 'daily', times_per_week: 1 })
    setShowAdd(false)
  }

  const handleEdit = async (id: string, data: any) => {
    await habitsApi.update(id, data)
    const updated = await habitsApi.getAll(today)
    setHabits(updated)
  }

  const handleUseShield = async () => {
    try {
      await userApi.useShield()
      const updatedUser = await userApi.get()
      setUser(updatedUser)
    } catch (e: any) {
      alert(e.response?.data?.error || 'No shields available')
    }
  }

  const completedCount = habits.filter((h: any) => h.completedToday).length

  return (
    <div className="space-y-5 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Habits</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
            {completedCount}/{habits.length} done today
          </p>
        </div>
        <div className="flex gap-2">
          {(user?.freeze_shields ?? user?.freezeShields ?? 0) > 0 && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleUseShield}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
              <Shield size={15} />
              Use Shield
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowAdd(!showAdd)}
            className="btn-accent flex items-center gap-1.5 text-sm">
            <Plus size={16} />
            Add
          </motion.button>
        </div>
      </div>

      {/* Shield info */}
      <div className="glass px-4 py-3 flex items-center gap-3">
        <Shield size={16} style={{ color: 'rgb(var(--accent))' }} />
        <div className="flex-1">
          <p className="text-xs font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Freeze Shields: {user?.freeze_shields ?? user?.freezeShields ?? 0}/2
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
            Earn by: 7, 30, 60, 100 day streaks · 1 free on signup
          </p>
        </div>
      </div>

      {/* Add habit form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass p-5 space-y-4">
            <h3 className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>New Habit</h3>
            <input
              value={newHabit.name}
              onChange={e => setNewHabit({ ...newHabit, name: e.target.value })}
              placeholder="e.g. Morning run, Read 20 pages..."
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgb(var(--text-primary))',
              }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            {/* Category */}
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setNewHabit({ ...newHabit, category: cat.id })}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl text-[11px] font-medium transition-all"
                  style={{
                    background: newHabit.category === cat.id ? `rgba(var(--accent) / 0.2)` : 'rgba(255,255,255,0.04)',
                    border: newHabit.category === cat.id ? `1px solid rgba(var(--accent) / 0.5)` : '1px solid transparent',
                    color: newHabit.category === cat.id ? `rgb(var(--accent))` : 'rgb(var(--text-muted))',
                  }}>
                  <span className="text-base">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Frequency */}
            <div className="grid grid-cols-3 gap-2">
              {FREQ_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNewHabit({ ...newHabit, frequency: opt.value })}
                  className="py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: newHabit.frequency === opt.value ? `rgba(var(--accent) / 0.2)` : 'rgba(255,255,255,0.04)',
                    border: newHabit.frequency === opt.value ? `1px solid rgba(var(--accent) / 0.4)` : '1px solid transparent',
                    color: newHabit.frequency === opt.value ? `rgb(var(--accent))` : 'rgb(var(--text-muted))',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {newHabit.frequency === 'custom' && (
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Times per week:</span>
                <input
                  type="number" min={1} max={7}
                  value={newHabit.times_per_week}
                  onChange={e => setNewHabit({ ...newHabit, times_per_week: Number(e.target.value) })}
                  className="w-16 px-3 py-2 rounded-lg text-sm text-center outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgb(var(--text-primary))', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgb(var(--text-secondary))' }}>
                Cancel
              </button>
              <button onClick={handleAdd} className="btn-accent flex-1 py-3 text-sm">
                Create Habit
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Habit list */}
      <div className="space-y-3">
        <AnimatePresence>
          {habits.map((habit: any) => (
            <HabitCard key={habit.id} habit={habit} onToggle={handleToggle} onDelete={handleDelete} onEdit={handleEdit} />
          ))}
        </AnimatePresence>
        {habits.length === 0 && (
          <div className="glass p-8 text-center">
            <p className="text-4xl mb-3">✦</p>
            <p className="font-semibold" style={{ color: 'rgb(var(--text-secondary))' }}>No habits yet</p>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>Tap Add to start building your routine</p>
          </div>
        )}
      </div>
    </div>
  )
}
