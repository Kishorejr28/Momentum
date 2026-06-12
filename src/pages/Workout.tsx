import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Timer, Flame, Pencil, Check, X } from 'lucide-react'
import { workoutApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

const WORKOUT_TYPES = [
  { id: 'weight_training', label: 'Weight Training', icon: '🏋️', met: 5 },
  { id: 'running', label: 'Running', icon: '🏃', met: 9 },
  { id: 'cycling', label: 'Cycling', icon: '🚴', met: 7 },
  { id: 'swimming', label: 'Swimming', icon: '🏊', met: 8 },
  { id: 'yoga', label: 'Yoga', icon: '🧘', met: 3 },
  { id: 'hiit', label: 'HIIT', icon: '⚡', met: 10 },
  { id: 'walking', label: 'Walking', icon: '🚶', met: 3.5 },
  { id: 'cardio', label: 'Cardio', icon: '💓', met: 7 },
  { id: 'sports', label: 'Sports', icon: '⚽', met: 7 },
  { id: 'other', label: 'Other', icon: '✦', met: 5 },
]

const WEIGHT_KG = 75 // default, ideally from user profile

function estimateCalories(type: string, durationMins: number): number {
  const wt = WORKOUT_TYPES.find(w => w.id === type)
  const met = wt?.met || 5
  return Math.round((met * WEIGHT_KG * (durationMins / 60)))
}

export default function Workout() {
  const [logs, setLogs] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ type: 'weight_training', durationMins: '', caloriesBurned: '', notes: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVals, setEditVals] = useState<any>({})
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => { workoutApi.get(today).then(setLogs) }, [])

  const totalCalsBurned = logs.reduce((a, l) => a + (l.calories_burned ?? l.caloriesBurned ?? 0), 0)
  const totalMins = logs.reduce((a, l) => a + (l.duration_mins ?? l.durationMins ?? 0), 0)

  const startEdit = (log: any) => {
    setEditingId(log.id)
    setEditVals({ duration_mins: log.duration_mins ?? log.durationMins, calories_burned: log.calories_burned ?? log.caloriesBurned, notes: log.notes || '' })
  }

  const saveEdit = async (id: string) => {
    await supabase.from('workout_logs').update({
      duration_mins: Number(editVals.duration_mins),
      calories_burned: Number(editVals.calories_burned),
      notes: editVals.notes,
    }).eq('id', id)
    setEditingId(null)
    workoutApi.get(today).then(setLogs)
  }

  const handleTypeChange = (type: string) => {
    const estimated = form.durationMins ? estimateCalories(type, Number(form.durationMins)) : ''
    setForm({ ...form, type, caloriesBurned: String(estimated) })
  }

  const handleDurationChange = (val: string) => {
    const estimated = val ? estimateCalories(form.type, Number(val)) : ''
    setForm({ ...form, durationMins: val, caloriesBurned: String(estimated) })
  }

  const handleAdd = async () => {
    if (!form.durationMins) return
    await workoutApi.add({
      date: today,
      type: form.type,
      durationMins: Number(form.durationMins),
      caloriesBurned: Number(form.caloriesBurned || 0),
      notes: form.notes,
    })
    setForm({ type: 'weight_training', durationMins: '', caloriesBurned: '', notes: '' })
    setShowAdd(false)
    workoutApi.get(today).then(setLogs)
  }

  return (
    <div className="space-y-5 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Workout</h1>
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>{format(new Date(), 'EEEE, MMM d')}</p>
        </div>
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowAdd(!showAdd)}
          className="btn-accent flex items-center gap-1.5 text-sm">
          <Plus size={16} /> Log
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass p-4 flex items-center gap-3">
          <Timer size={24} style={{ color: 'rgb(var(--accent))' }} />
          <div>
            <p className="text-2xl font-black" style={{ color: 'rgb(var(--text-primary))' }}>{totalMins}</p>
            <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>minutes</p>
          </div>
        </div>
        <div className="glass p-4 flex items-center gap-3">
          <Flame size={24} style={{ color: '#f97316' }} />
          <div>
            <p className="text-2xl font-black" style={{ color: 'rgb(var(--text-primary))' }}>{Math.round(totalCalsBurned)}</p>
            <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>kcal burned</p>
          </div>
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass p-5 space-y-4">
            <p className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Log Workout</p>
            {/* Type grid */}
            <div className="grid grid-cols-5 gap-2">
              {WORKOUT_TYPES.map(wt => (
                <button key={wt.id} onClick={() => handleTypeChange(wt.id)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-medium transition-all"
                  style={{
                    background: form.type === wt.id ? `rgba(var(--accent) / 0.2)` : 'rgba(255,255,255,0.04)',
                    border: form.type === wt.id ? `1px solid rgba(var(--accent) / 0.5)` : '1px solid transparent',
                    color: form.type === wt.id ? `rgb(var(--accent))` : 'rgb(var(--text-muted))',
                  }}>
                  <span className="text-lg">{wt.icon}</span>
                  {wt.label.split(' ')[0]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-muted))' }}>Duration (mins)</label>
                <input type="number" value={form.durationMins} onChange={e => handleDurationChange(e.target.value)}
                  placeholder="45"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(var(--text-primary))' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-muted))' }}>Calories burned</label>
                <input type="number" value={form.caloriesBurned} onChange={e => setForm({ ...form, caloriesBurned: e.target.value })}
                  placeholder="Auto-estimated"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(var(--text-primary))' }}
                />
              </div>
            </div>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes (optional)"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(var(--text-primary))' }}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgb(var(--text-secondary))' }}>Cancel</button>
              <button onClick={handleAdd} className="btn-accent flex-1 py-3 text-sm">Log Workout</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log list */}
      <div className="space-y-3">
        <AnimatePresence>
          {logs.map((log: any) => {
            const wt = WORKOUT_TYPES.find(w => w.id === log.type)
            return (
              <motion.div key={log.id} layout
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                className="glass p-4">
                {editingId === log.id ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{wt?.icon} {wt?.label || log.type}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>Duration (mins)</label>
                        <input type="number" value={editVals.duration_mins} onChange={e => setEditVals({ ...editVals, duration_mins: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgb(var(--text-primary))' }} />
                      </div>
                      <div>
                        <label className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>Calories burned</label>
                        <input type="number" value={editVals.calories_burned} onChange={e => setEditVals({ ...editVals, calories_burned: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgb(var(--text-primary))' }} />
                      </div>
                    </div>
                    <input value={editVals.notes} onChange={e => setEditVals({ ...editVals, notes: e.target.value })}
                      placeholder="Notes" className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgb(var(--text-primary))' }} />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(log.id)} className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
                        style={{ background: `rgb(var(--accent))`, color: '#000' }}>
                        <Check size={12} /> Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl text-xs opacity-60"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgb(var(--text-muted))' }}>Cancel</button>
                      <button onClick={async () => { await workoutApi.delete(log.id); workoutApi.get(today).then(setLogs) }}
                        className="px-4 py-2 rounded-xl text-xs" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: `rgba(var(--accent) / 0.15)` }}>
                      {wt?.icon || '✦'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{wt?.label || log.type}</p>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs flex items-center gap-1" style={{ color: 'rgb(var(--text-muted))' }}>
                          <Timer size={11} /> {log.duration_mins ?? log.durationMins}m
                        </span>
                        <span className="text-xs flex items-center gap-1" style={{ color: '#f97316' }}>
                          <Flame size={11} /> {Math.round(log.calories_burned ?? log.caloriesBurned ?? 0)} kcal
                        </span>
                      </div>
                      {log.notes && <p className="text-xs mt-0.5 italic" style={{ color: 'rgb(var(--text-muted))' }}>{log.notes}</p>}
                    </div>
                    <button onClick={() => startEdit(log)} className="p-2 opacity-30 hover:opacity-70">
                      <Pencil size={14} style={{ color: 'rgb(var(--text-muted))' }} />
                    </button>
                    <button onClick={async () => { await workoutApi.delete(log.id); workoutApi.get(today).then(setLogs) }}
                      className="p-2 opacity-30 hover:opacity-70">
                      <Trash2 size={14} style={{ color: 'rgb(var(--text-muted))' }} />
                    </button>
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
        {logs.length === 0 && (
          <div className="glass p-8 text-center">
            <p className="text-4xl mb-3">🏋️</p>
            <p className="font-semibold" style={{ color: 'rgb(var(--text-secondary))' }}>No workouts logged</p>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>Tap Log to add today's session</p>
          </div>
        )}
      </div>
    </div>
  )
}
