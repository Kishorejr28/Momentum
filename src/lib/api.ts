import { supabase } from './supabase'

// Local date string — avoids UTC timezone mismatch
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── User / Profile ──────────────────────────────────────────
export const userApi = {
  get: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Fetch profile and badges as separate queries — nested joins break with RLS
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      // Profile missing — create it
      const { error: insertErr } = await supabase
        .from('profiles')
        .insert({ id: user.id, name: 'Champion', calorie_goal: 2000 })
      if (insertErr) { console.error('profile insert error:', insertErr); return null }
      const { data: fresh } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      return { ...fresh, badges: [] }
    }

    const { data: userBadges } = await supabase
      .from('user_badges')
      .select('*, badges(*)')
      .eq('user_id', user.id)

    return { ...profile, badges: userBadges || [] }
  },

  update: async (fields: { name?: string; calorie_goal?: number; weight_goal?: number; calorieGoal?: number }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload: any = { ...fields, id: user.id }
    if (payload.calorieGoal !== undefined) { payload.calorie_goal = payload.calorieGoal; delete payload.calorieGoal }
    // upsert so it works even if row doesn't exist yet
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload)
      .eq('id', user.id)
      .select()
      .single()
    if (error) console.error('profile update error:', error)
    return data
  },

  getWeight: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .limit(60)
    return data || []
  },

  logWeight: async (weight: number, unit = 'kg', date?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const d = date || today()
    // Try insert first, update on conflict
    const { error } = await supabase
      .from('weight_logs')
      .insert({ user_id: user.id, date: d, weight, unit })
    if (error?.code === '23505') {
      // Duplicate — update existing row
      await supabase
        .from('weight_logs')
        .update({ weight, unit })
        .eq('user_id', user.id)
        .eq('date', d)
    }
  },

  useShield: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data: profile } = await supabase.from('profiles').select('freeze_shields').eq('id', user.id).single()
    if (!profile || profile.freeze_shields < 1) throw new Error('No shields available')
    await supabase.from('profiles')
      .update({ freeze_shields: profile.freeze_shields - 1, last_active_date: today() })
      .eq('id', user.id)
    return { shieldsRemaining: profile.freeze_shields - 1 }
  },
}

// ── Habits ──────────────────────────────────────────────────
export const habitsApi = {
  getAll: async (date?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const d = date || today()

    const { data: habits } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('order', { ascending: true })

    const { data: logs } = await supabase
      .from('habit_logs')
      .select('habit_id, completed')
      .eq('user_id', user.id)
      .eq('date', d)

    const logMap = new Map((logs || []).map(l => [l.habit_id, l.completed]))
    return (habits || []).map(h => ({ ...h, completedToday: logMap.get(h.id) ?? false }))
  },

  create: async (data: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: habit } = await supabase
      .from('habits')
      .insert({ ...data, user_id: user.id })
      .select()
      .single()
    return habit
  },

  toggle: async (id: string, date?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const d = date || today()

    const { data: existing } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('habit_id', id)
      .eq('date', d)
      .maybeSingle()

    if (existing) {
      await supabase.from('habit_logs').update({ completed: !existing.completed }).eq('id', existing.id)
    } else {
      await supabase.from('habit_logs').insert({ habit_id: id, user_id: user.id, date: d, completed: true })
    }

    await updateHabitStreak(id, user.id)
    await updateGlobalStreak(user.id)
    await checkBadges(user.id)
  },

  delete: async (id: string) => {
    await supabase.from('habits').update({ is_active: false }).eq('id', id)
  },

  update: async (id: string, data: any) => {
    const { data: habit } = await supabase.from('habits').update(data).eq('id', id).select().single()
    return habit
  },
}

// ── Food ─────────────────────────────────────────────────────
export const foodApi = {
  search: async (q: string) => {
    if (!q.trim()) return []

    // 1. Local seeded food_items table
    const { data: local } = await supabase
      .from('food_items')
      .select('*')
      .ilike('name', `%${q}%`)
      .limit(8)

    // 2. Open Food Facts
    let offResults: any[] = []
    try {
      const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=5&fields=product_name,brands,nutriments,serving_size`)
      const data: any = await res.json()
      offResults = (data.products || [])
        .filter((p: any) => p.nutriments?.['energy-kcal_100g'])
        .map((p: any) => ({
          id: `off_${p.code}`,
          name: p.product_name || q,
          brand: p.brands || null,
          source: 'openfoodfacts',
          calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
          protein: Math.round((p.nutriments['proteins_100g'] || 0) * 10) / 10,
          carbs: Math.round((p.nutriments['carbohydrates_100g'] || 0) * 10) / 10,
          fat: Math.round((p.nutriments['fat_100g'] || 0) * 10) / 10,
          serving_unit: '100g',
        }))
    } catch (_) {}

    // 3. USDA
    let usdaResults: any[] = []
    try {
      const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=4&api_key=DEMO_KEY`)
      const data: any = await res.json()
      usdaResults = (data.foods || []).slice(0, 4).map((f: any) => {
        const get = (n: string) => f.foodNutrients?.find((x: any) => x.nutrientName === n)?.value || 0
        return {
          id: `usda_${f.fdcId}`,
          name: f.description,
          brand: f.brandOwner || null,
          source: 'usda',
          calories: Math.round(get('Energy')),
          protein: Math.round(get('Protein') * 10) / 10,
          carbs: Math.round(get('Carbohydrate, by difference') * 10) / 10,
          fat: Math.round(get('Total lipid (fat)') * 10) / 10,
          serving_unit: '100g',
        }
      })
    } catch (_) {}

    return [...(local || []), ...offResults, ...usdaResults]
  },

  getLogs: async (date?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date || today())
      .order('created_at', { ascending: true })
    return data || []
  },

  addLog: async (entry: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('food_logs').insert({
      user_id: user.id,
      date: entry.date || today(),
      meal_type: entry.mealType,
      food_name: entry.foodName,
      calories: Number(entry.calories),
      protein: Number(entry.protein || 0),
      carbs: Number(entry.carbs || 0),
      fat: Number(entry.fat || 0),
      quantity: Number(entry.quantity || 1),
      unit: entry.unit || 'serving',
      is_manual: Boolean(entry.isManual),
    }).select().single()
    return data
  },

  deleteLog: async (id: string) => {
    await supabase.from('food_logs').delete().eq('id', id)
  },

  getSummary: async (date?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { calories: 0, protein: 0, carbs: 0, fat: 0 }
    const { data } = await supabase
      .from('food_logs')
      .select('calories, protein, carbs, fat')
      .eq('user_id', user.id)
      .eq('date', date || today())
    return (data || []).reduce((acc, l) => ({
      calories: acc.calories + l.calories,
      protein: acc.protein + l.protein,
      carbs: acc.carbs + l.carbs,
      fat: acc.fat + l.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
  },
}

// ── Workout ──────────────────────────────────────────────────
export const workoutApi = {
  get: async (date?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date || today())
      .order('created_at', { ascending: true })
    return data || []
  },

  add: async (entry: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('workout_logs').insert({
      user_id: user.id,
      date: entry.date || today(),
      type: entry.type,
      duration_mins: Number(entry.durationMins),
      calories_burned: Number(entry.caloriesBurned || 0),
      notes: entry.notes || null,
    }).select().single()
    return data
  },

  delete: async (id: string) => {
    await supabase.from('workout_logs').delete().eq('id', id)
  },

  getSummary: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i)
      return d.toISOString().split('T')[0]
    })
    const { data } = await supabase.from('workout_logs').select('*').eq('user_id', user.id).in('date', days)
    return days.map(date => ({
      date,
      totalMins: (data || []).filter(l => l.date === date).reduce((a, l) => a + l.duration_mins, 0),
      caloriesBurned: (data || []).filter(l => l.date === date).reduce((a, l) => a + l.calories_burned, 0),
    }))
  },
}

// ── Journal ──────────────────────────────────────────────────
export const journalApi = {
  get: async (date?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('journals')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date || today())
      .order('created_at', { ascending: false })
    return data || []
  },

  getAll: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('journals')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(30)
    return data || []
  },

  add: async (entry: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('journals').insert({
      user_id: user.id,
      date: entry.date || today(),
      content: entry.content,
      mood: entry.mood || null,
      is_voice: Boolean(entry.isVoice),
    }).select().single()
    return data
  },

  delete: async (id: string) => {
    await supabase.from('journals').delete().eq('id', id)
  },
}

// ── Analytics ────────────────────────────────────────────────
export const analyticsApi = {
  heatmap: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const days = Array.from({ length: 90 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i)
      return d.toISOString().split('T')[0]
    }).reverse()

    const { data: habits } = await supabase.from('habits').select('id').eq('user_id', user.id).eq('is_active', true)
    const { data: logs } = await supabase.from('habit_logs').select('date, habit_id').eq('user_id', user.id).eq('completed', true).in('date', days)

    const total = (habits || []).length
    return days.map(date => {
      const completed = (logs || []).filter(l => l.date === date).length
      return { date, completed, total, rate: total > 0 ? completed / total : 0 }
    })
  },

  macros: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i)
      return d.toISOString().split('T')[0]
    }).reverse()

    const { data } = await supabase.from('food_logs').select('date, calories, protein, carbs, fat').eq('user_id', user.id).in('date', days)
    return days.map(date => {
      const dayLogs = (data || []).filter(l => l.date === date)
      return {
        date,
        calories: Math.round(dayLogs.reduce((a, l) => a + l.calories, 0)),
        protein: Math.round(dayLogs.reduce((a, l) => a + l.protein, 0)),
        carbs: Math.round(dayLogs.reduce((a, l) => a + l.carbs, 0)),
        fat: Math.round(dayLogs.reduce((a, l) => a + l.fat, 0)),
      }
    })
  },

  weekly: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const weeks = Array.from({ length: 8 }, (_, weekIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) => {
        const d = new Date(); d.setDate(d.getDate() - weekIndex * 7 - dayIndex)
        return d.toISOString().split('T')[0]
      })
    )
    const allDates = weeks.flat()
    const { data: habits } = await supabase.from('habits').select('id').eq('user_id', user.id).eq('is_active', true)
    const { data: logs } = await supabase.from('habit_logs').select('date').eq('user_id', user.id).eq('completed', true).in('date', allDates)

    return weeks.map(week => {
      const completed = (logs || []).filter(l => week.includes(l.date)).length
      const total = (habits || []).length * 7
      return { week: week[week.length - 1], completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 }
    }).reverse()
  },
}

// ── Streak helpers ───────────────────────────────────────────
async function updateHabitStreak(habitId: string, userId: string) {
  const { data: logs } = await supabase
    .from('habit_logs')
    .select('date')
    .eq('habit_id', habitId)
    .eq('completed', true)
    .order('date', { ascending: false })

  let streak = 0
  let checkDate = new Date()
  for (const log of (logs || [])) {
    const logDate = new Date(log.date + 'T00:00:00')
    const diff = Math.floor((checkDate.getTime() - logDate.getTime()) / 86400000)
    if (diff <= 1) { streak++; checkDate = logDate } else break
  }
  await supabase.from('habits').update({ streak }).eq('id', habitId)
}

async function updateGlobalStreak(userId: string) {
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (!profile) return

  const todayStr = today()
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  // Don't update streak twice on the same day
  if (profile.last_active_date === todayStr) return

  const { data: habits } = await supabase.from('habits').select('id').eq('user_id', userId).eq('is_active', true)
  const { data: todayLogs } = await supabase.from('habit_logs').select('habit_id').eq('user_id', userId).eq('date', todayStr).eq('completed', true)

  // Need at least one habit completed to count as an active day
  const completedCount = (todayLogs || []).length
  if (completedCount === 0 || (habits || []).length === 0) return

  let newStreak = profile.current_streak
  if (profile.last_active_date === yesterdayStr) {
    newStreak = profile.current_streak + 1
  } else {
    // Gap of more than 1 day — reset to 1 (unless shield was used)
    newStreak = 1
  }

  await supabase.from('profiles').update({
    current_streak: newStreak,
    longest_streak: Math.max(newStreak, profile.longest_streak),
    last_active_date: todayStr,
  }).eq('id', userId)
}

async function checkBadges(userId: string) {
  const { data: profile } = await supabase.from('profiles').select('current_streak, freeze_shields').eq('id', userId).single()
  if (!profile) return

  const streakMap: Record<number, string> = { 7: 'streak_7', 14: 'streak_14', 30: 'streak_30', 60: 'streak_60', 100: 'streak_100' }

  for (const [days, key] of Object.entries(streakMap)) {
    if (profile.current_streak >= Number(days)) {
      const { data: badge } = await supabase.from('badges').select('id').eq('key', key).single()
      if (!badge) continue
      const { data: existing } = await supabase.from('user_badges').select('id').eq('user_id', userId).eq('badge_id', badge.id).maybeSingle()
      if (!existing) {
        await supabase.from('user_badges').insert({ user_id: userId, badge_id: badge.id })
        if (Number(days) === 7 || Number(days) === 30) {
          await supabase.from('profiles').update({ freeze_shields: Math.min(profile.freeze_shields + 1, 2) }).eq('id', userId)
        }
      }
    }
  }
}
