import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, ReferenceLine } from 'recharts'
import { analyticsApi, userApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { Target, TrendingDown, TrendingUp, Minus } from 'lucide-react'

function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass px-3 py-2 text-xs space-y-1">
      <p className="font-semibold" style={{ color: 'rgb(var(--text-secondary))' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

function HeatmapGrid({ data }: { data: any[] }) {
  const getColor = (rate: number) => {
    if (rate === 0) return 'rgba(255,255,255,0.04)'
    if (rate < 0.25) return 'rgba(var(--accent) / 0.2)'
    if (rate < 0.5) return 'rgba(var(--accent) / 0.4)'
    if (rate < 0.75) return 'rgba(var(--accent) / 0.65)'
    return 'rgb(var(--accent))'
  }

  return (
    <div className="flex flex-wrap gap-1">
      {data.map((d: any, i: number) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.003 }}
          title={`${d.date}: ${d.completed}/${d.total} habits`}
          className="w-4 h-4 rounded-sm"
          style={{ background: getColor(d.rate) }}
        />
      ))}
    </div>
  )
}

export default function Analytics() {
  const [heatmap, setHeatmap] = useState<any[]>([])
  const [macros, setMacros] = useState<any[]>([])
  const [weekly, setWeekly] = useState<any[]>([])
  const [weightLogs, setWeightLogs] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [weightInput, setWeightInput] = useState('')
  const [showWeight, setShowWeight] = useState(false)
  const [targetWeight, setTargetWeight] = useState('')
  const [editTarget, setEditTarget] = useState(false)

  useEffect(() => {
    Promise.all([
      analyticsApi.heatmap().then(setHeatmap),
      analyticsApi.macros().then(setMacros),
      analyticsApi.weekly().then(setWeekly),
      userApi.getWeight().then(setWeightLogs),
      userApi.get().then(u => { setUser(u); setTargetWeight(u?.weight_goal ? String(u.weight_goal) : '') }),
    ])
  }, [])

  const logWeight = async () => {
    if (!weightInput) return
    await userApi.logWeight(Number(weightInput))
    const fresh = await userApi.getWeight()
    setWeightLogs(fresh)
    setWeightInput('')
    setShowWeight(false)
  }

  const saveTargetWeight = async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    await supabase.from('profiles').update({ weight_goal: Number(targetWeight) }).eq('id', u.id)
    setUser((prev: any) => ({ ...prev, weight_goal: Number(targetWeight) }))
    setEditTarget(false)
  }

  // ── Weight progress math ──────────────────────────────────────
  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : null
  const goalWeight = user?.weight_goal || null
  const calorieGoal = user?.calorie_goal || 2000

  // Avg daily calories from last 7 days of macros data
  const last7Macros = macros.slice(-7).filter(d => d.calories > 0)
  const avgDailyCalories = last7Macros.length > 0
    ? Math.round(last7Macros.reduce((a: number, d: any) => a + d.calories, 0) / last7Macros.length)
    : calorieGoal

  // Avg daily calories burned from workouts (rough: 2000 TDEE base + logged workouts)
  // Mifflin-St Jeor rough TDEE — we don't have age/height so use a reasonable default
  const estimatedTDEE = 2200 // kcal/day sedentary baseline; would need user profile for exact
  const dailyDeficitOrSurplus = estimatedTDEE - avgDailyCalories // positive = deficit (losing weight)

  // 1 kg fat ≈ 7700 kcal
  const KG_PER_KCAL = 1 / 7700
  const weightChangePerDay = -(dailyDeficitOrSurplus * KG_PER_KCAL) // negative deficit = weight loss
  const kgToGoal = goalWeight && currentWeight ? goalWeight - currentWeight : null
  const daysToGoal = kgToGoal !== null && weightChangePerDay !== 0
    ? Math.abs(Math.round(kgToGoal / weightChangePerDay))
    : null
  const weeksToGoal = daysToGoal !== null ? Math.round(daysToGoal / 7) : null

  const isLosingWeight = dailyDeficitOrSurplus > 0
  const isGainingWeight = dailyDeficitOrSurplus < 0
  const direction = kgToGoal !== null ? (kgToGoal < 0 ? 'lose' : 'gain') : null
  const onTrack = direction === 'lose' ? isLosingWeight : isGainingWeight

  const macroLabels = macros.map((d: any) => format(parseISO(d.date), 'MMM d'))
  const weightData = weightLogs.map((w: any) => ({
    date: format(parseISO(w.date + 'T00:00:00'), 'MMM d'),
    weight: w.weight,
    target: goalWeight,
  }))

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Analytics</h1>

      {/* Streak summary */}
      {user && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-5">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgb(var(--text-muted))' }}>Streak</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-3xl font-black" style={{ color: 'rgb(var(--accent))' }}>{user.current_streak ?? user.currentStreak ?? 0}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>Current streak</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black" style={{ color: 'rgb(var(--text-primary))' }}>{user.longest_streak ?? user.longestStreak ?? 0}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>Best streak</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Habit heatmap */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="glass p-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgb(var(--text-muted))' }}>
          90-Day Activity
        </p>
        <HeatmapGrid data={heatmap} />
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>Less</span>
          {[0, 0.3, 0.6, 0.85, 1].map((r, i) => (
            <div key={i} className="w-3 h-3 rounded-sm"
              style={{ background: r === 0 ? 'rgba(255,255,255,0.04)' : `rgba(var(--accent) / ${r})` }} />
          ))}
          <span className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>More</span>
        </div>
      </motion.div>

      {/* Weekly completion rate */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="glass p-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgb(var(--text-muted))' }}>
          Weekly Habit Rate
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weekly} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'rgb(var(--text-muted))' }}
              tickFormatter={(d) => format(parseISO(d + 'T00:00:00'), 'MMM d')} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'rgb(var(--text-muted))' }}
              tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<GlassTooltip />} />
            <Bar dataKey="completionRate" name="Completion %" fill="rgb(var(--accent))"
              radius={[4, 4, 0, 0]}
              style={{ filter: 'drop-shadow(0 0 4px rgb(var(--accent) / 0.4))' }} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Calorie trend */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass p-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgb(var(--text-muted))' }}>
          Calories — 14 Days
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={macros}>
            <defs>
              <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(var(--accent))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="rgb(var(--accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgb(var(--text-muted))' }}
              tickFormatter={(d) => format(parseISO(d + 'T00:00:00'), 'MMM d')} />
            <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--text-muted))' }} />
            <Tooltip content={<GlassTooltip />} />
            <Area type="monotone" dataKey="calories" name="Calories" stroke="rgb(var(--accent))"
              fill="url(#calGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Macro trend */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="glass p-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgb(var(--text-muted))' }}>
          Macros — 14 Days
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={macros}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgb(var(--text-muted))' }}
              tickFormatter={(d) => format(parseISO(d + 'T00:00:00'), 'MMM d')} />
            <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--text-muted))' }} />
            <Tooltip content={<GlassTooltip />} />
            <Area type="monotone" dataKey="protein" name="Protein" stroke="#60a5fa" fill="rgba(96,165,250,0.1)" strokeWidth={2} />
            <Area type="monotone" dataKey="carbs" name="Carbs" stroke="#f59e0b" fill="rgba(245,158,11,0.1)" strokeWidth={2} />
            <Area type="monotone" dataKey="fat" name="Fat" stroke="#f87171" fill="rgba(248,113,113,0.1)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Weight + Target + ETA */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>Weight Progress</p>
          <button onClick={() => setShowWeight(!showWeight)}
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: `rgba(var(--accent)/0.15)`, color: `rgb(var(--accent))` }}>
            + Log today
          </button>
        </div>

        {/* Log weight input */}
        <AnimatePresence>
          {showWeight && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="flex gap-2">
              <input type="number" value={weightInput} onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && logWeight()}
                placeholder="e.g. 74.5 kg" autoFocus
                className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(128,128,128,0.08)', border: `1px solid rgba(var(--accent)/0.3)`, color: 'rgb(var(--text-primary))' }}
              />
              <button onClick={logWeight} className="btn-accent px-4 py-2 text-sm">Save</button>
              <button onClick={() => setShowWeight(false)} className="px-3 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(128,128,128,0.08)', color: 'rgb(var(--text-muted))' }}>✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current vs Target */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(128,128,128,0.06)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-muted))' }}>Current</p>
            <p className="text-2xl font-black" style={{ color: 'rgb(var(--text-primary))' }}>
              {currentWeight ? `${currentWeight}` : '—'}
            </p>
            <p className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>kg</p>
          </div>
          <div className="rounded-xl p-3 text-center relative" style={{ background: `rgba(var(--accent)/0.08)`, border: `1px solid rgba(var(--accent)/0.2)` }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-muted))' }}>Target</p>
            {editTarget ? (
              <div className="flex gap-1">
                <input type="number" value={targetWeight} onChange={e => setTargetWeight(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTargetWeight() }}
                  autoFocus className="w-full px-2 py-1 rounded-lg text-sm text-center outline-none font-bold"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgb(var(--text-primary))' }} />
                <button onClick={saveTargetWeight} className="text-xs px-2 rounded-lg"
                  style={{ background: `rgb(var(--accent))`, color: '#000' }}>✓</button>
              </div>
            ) : (
              <button onClick={() => setEditTarget(true)} className="w-full">
                <p className="text-2xl font-black" style={{ color: `rgb(var(--accent))` }}>
                  {goalWeight ? `${goalWeight}` : '—'}
                </p>
                <p className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>kg · tap to set</p>
              </button>
            )}
          </div>
        </div>

        {/* ETA card — only show when we have enough data */}
        {currentWeight && goalWeight && currentWeight !== goalWeight && (
          <div className="rounded-xl p-4 space-y-3" style={{
            background: onTrack ? `rgba(74,222,128,0.08)` : `rgba(251,146,60,0.08)`,
            border: `1px solid ${onTrack ? 'rgba(74,222,128,0.25)' : 'rgba(251,146,60,0.25)'}`,
          }}>
            <div className="flex items-center gap-2">
              {direction === 'lose'
                ? <TrendingDown size={16} style={{ color: onTrack ? '#4ade80' : '#fb923c' }} />
                : <TrendingUp size={16} style={{ color: onTrack ? '#4ade80' : '#fb923c' }} />
              }
              <p className="text-xs font-semibold" style={{ color: onTrack ? '#4ade80' : '#fb923c' }}>
                Goal: {direction === 'lose' ? 'Lose' : 'Gain'} {Math.abs(kgToGoal!).toFixed(1)} kg
                {onTrack ? ' — on track 🎯' : ' — adjust calories ⚠️'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-black" style={{ color: 'rgb(var(--text-primary))' }}>
                  {avgDailyCalories}
                </p>
                <p className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>avg eaten/day</p>
              </div>
              <div>
                <p className="text-lg font-black" style={{ color: 'rgb(var(--text-primary))' }}>
                  ~{estimatedTDEE}
                </p>
                <p className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>est. TDEE</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1">
                  {dailyDeficitOrSurplus > 0
                    ? <TrendingDown size={12} style={{ color: '#4ade80' }} />
                    : <TrendingUp size={12} style={{ color: '#f87171' }} />
                  }
                  <p className="text-lg font-black" style={{ color: dailyDeficitOrSurplus > 0 ? '#4ade80' : '#f87171' }}>
                    {Math.abs(dailyDeficitOrSurplus)}
                  </p>
                </div>
                <p className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>
                  {dailyDeficitOrSurplus > 0 ? 'deficit/day' : 'surplus/day'}
                </p>
              </div>
            </div>

            {daysToGoal !== null && onTrack && (
              <div className="text-center pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <p className="text-2xl font-black" style={{ color: `rgb(var(--accent))` }}>
                  ~{weeksToGoal} weeks
                </p>
                <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                  ({daysToGoal} days) · reach {goalWeight} kg by {format(new Date(Date.now() + daysToGoal * 86400000), 'MMM d, yyyy')}
                </p>
              </div>
            )}
            {!onTrack && (
              <p className="text-xs text-center" style={{ color: 'rgb(var(--text-muted))' }}>
                {direction === 'lose'
                  ? `Eat less than ${estimatedTDEE} kcal/day to create a deficit`
                  : `Eat more than ${estimatedTDEE} kcal/day to create a surplus`
                }
              </p>
            )}
          </div>
        )}

        {/* Weight chart */}
        {weightData.length > 1 ? (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={weightData}>
              <defs>
                <linearGradient id="wtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgb(var(--text-muted))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--text-muted))' }} domain={['auto', 'auto']} />
              <Tooltip content={<GlassTooltip />} />
              {goalWeight && (
                <ReferenceLine y={goalWeight} stroke="rgb(var(--accent))" strokeDasharray="4 4"
                  label={{ value: `Goal ${goalWeight}kg`, position: 'right', fontSize: 10, fill: 'rgb(var(--accent))' }} />
              )}
              <Area type="monotone" dataKey="weight" name="Weight (kg)" stroke="#a78bfa"
                fill="url(#wtGrad)" strokeWidth={2} dot={{ fill: '#a78bfa', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-center py-4" style={{ color: 'rgb(var(--text-muted))' }}>
            Log at least 2 weight entries to see your chart
          </p>
        )}
      </motion.div>
    </div>
  )
}
