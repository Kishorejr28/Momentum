import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Trash2, X, Scale, Lightbulb, Pencil, Check, ChevronDown } from 'lucide-react'

// Bottom sheet wrapper — always renders above the nav bar
function BottomSheet({ show, onClose, title, children }: { show: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl glass rounded-b-none overflow-y-auto"
            style={{
              maxHeight: '85vh',
              paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            }}>
            {/* Handle + title */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 sticky top-0"
              style={{ background: 'rgba(var(--surface-raised, 26 26 42) / 0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="w-10 h-1 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2"
                style={{ background: 'rgba(255,255,255,0.15)' }} />
              <p className="font-semibold text-sm mt-2" style={{ color: 'rgb(var(--text-primary))' }}>{title}</p>
              <button onClick={onClose} className="p-1.5 rounded-lg mt-2" style={{ color: 'rgb(var(--text-muted))' }}>
                <X size={16} />
              </button>
            </div>
            <div className="px-4 pt-3 space-y-3">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
import { foodApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_ICONS: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' }

// Macro ratios per 100g for common foods — used for "from grams" conversion
const FOOD_MACRO_REFS: Record<string, { cal: number; p: number; c: number; f: number }> = {
  'chicken breast': { cal: 165, p: 31, c: 0, f: 3.6 },
  'chicken': { cal: 165, p: 31, c: 0, f: 3.6 },
  'egg': { cal: 155, p: 13, c: 1.1, f: 11 },
  'eggs': { cal: 155, p: 13, c: 1.1, f: 11 },
  'rice': { cal: 130, p: 2.7, c: 28, f: 0.3 },
  'brown rice': { cal: 111, p: 2.6, c: 23, f: 0.9 },
  'oats': { cal: 389, p: 17, c: 66, f: 7 },
  'oatmeal': { cal: 389, p: 17, c: 66, f: 7 },
  'banana': { cal: 89, p: 1.1, c: 23, f: 0.3 },
  'apple': { cal: 52, p: 0.3, c: 14, f: 0.2 },
  'milk': { cal: 61, p: 3.2, c: 4.8, f: 3.3 },
  'paneer': { cal: 265, p: 18, c: 3.4, f: 20 },
  'dal': { cal: 116, p: 9, c: 20, f: 0.4 },
  'roti': { cal: 297, p: 9, c: 60, f: 2.5 },
  'chapati': { cal: 297, p: 9, c: 60, f: 2.5 },
  'salmon': { cal: 208, p: 20, c: 0, f: 13 },
  'tuna': { cal: 130, p: 29, c: 0, f: 1 },
  'beef': { cal: 250, p: 26, c: 0, f: 17 },
  'whey': { cal: 400, p: 75, c: 8, f: 7 },
  'peanut butter': { cal: 588, p: 25, c: 20, f: 50 },
  'almonds': { cal: 579, p: 21, c: 22, f: 50 },
  'pasta': { cal: 371, p: 13, c: 74, f: 1.5 },
  'bread': { cal: 265, p: 9, c: 49, f: 3.2 },
  'yogurt': { cal: 59, p: 10, c: 3.6, f: 0.4 },
  'curd': { cal: 61, p: 3.5, c: 4.7, f: 3.3 },
  'potato': { cal: 77, p: 2, c: 17, f: 0.1 },
  'sweet potato': { cal: 86, p: 1.6, c: 20, f: 0.1 },
  'lentils': { cal: 116, p: 9, c: 20, f: 0.4 },
  'chickpeas': { cal: 164, p: 8.9, c: 27, f: 2.6 },
  'avocado': { cal: 160, p: 2, c: 9, f: 15 },
  'olive oil': { cal: 884, p: 0, c: 0, f: 100 },
}

// Suggest macros based on calorie input + food name keywords
function suggestMacrosFromCalories(foodName: string, calories: number) {
  if (!calories || !foodName) return null
  const lc = foodName.toLowerCase()

  // Detect food type from name
  if (/chicken|turkey|tuna|fish|salmon|beef|meat|protein/.test(lc)) {
    // High protein
    const p = Math.round(calories * 0.45 / 4)
    const f = Math.round(calories * 0.25 / 9)
    const c = Math.round((calories - p * 4 - f * 9) / 4)
    return { protein: Math.max(0, p), carbs: Math.max(0, c), fat: Math.max(0, f) }
  }
  if (/rice|pasta|bread|roti|naan|oats|potato|fruit|banana|apple/.test(lc)) {
    // High carb
    const c = Math.round(calories * 0.65 / 4)
    const p = Math.round(calories * 0.12 / 4)
    const f = Math.round((calories - c * 4 - p * 4) / 9)
    return { protein: Math.max(0, p), carbs: Math.max(0, c), fat: Math.max(0, f) }
  }
  if (/butter|oil|cheese|nuts|almond|peanut|fat/.test(lc)) {
    // High fat
    const f = Math.round(calories * 0.6 / 9)
    const p = Math.round(calories * 0.1 / 4)
    const c = Math.round((calories - f * 9 - p * 4) / 4)
    return { protein: Math.max(0, p), carbs: Math.max(0, c), fat: Math.max(0, f) }
  }
  // Balanced default
  const p = Math.round(calories * 0.2 / 4)
  const c = Math.round(calories * 0.5 / 4)
  const f = Math.round((calories - p * 4 - c * 4) / 9)
  return { protein: Math.max(0, p), carbs: Math.max(0, c), fat: Math.max(0, f) }
}

// Convert grams of a food to macros
function gramsToMacros(foodName: string, grams: number) {
  const lc = foodName.toLowerCase().trim()
  // Find best match in refs
  for (const [key, ref] of Object.entries(FOOD_MACRO_REFS)) {
    if (lc.includes(key) || key.includes(lc)) {
      const ratio = grams / 100
      return {
        calories: Math.round(ref.cal * ratio),
        protein: Math.round(ref.p * ratio * 10) / 10,
        carbs: Math.round(ref.c * ratio * 10) / 10,
        fat: Math.round(ref.f * ratio * 10) / 10,
      }
    }
  }
  return null
}

function MacroBar({ label, val, max, color }: any) {
  const pct = Math.min((val / max) * 100, 100)
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span style={{ color: 'rgb(var(--text-muted))' }}>{label}</span>
        <span className="font-semibold" style={{ color }}>{Math.round(val)}g</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(128,128,128,0.15)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function MealSelector({ selected, onChange }: { selected: string; onChange: (m: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {MEAL_TYPES.map(m => (
        <button key={m} onClick={() => onChange(m)}
          className="py-2 rounded-xl text-xs font-medium flex flex-col items-center gap-0.5 transition-all"
          style={{
            background: selected === m ? `rgba(var(--accent) / 0.18)` : 'rgba(128,128,128,0.08)',
            border: selected === m ? `1px solid rgba(var(--accent) / 0.5)` : '1px solid transparent',
            color: selected === m ? `rgb(var(--accent))` : 'rgb(var(--text-muted))',
          }}>
          <span>{MEAL_ICONS[m]}</span>
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  )
}

// Reusable food result row
function FoodResultRow({ food, onSelect, onDelete }: { food: any; onSelect: (f: any) => void; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
      style={{ background: 'rgba(128,128,128,0.06)', border: '1px solid rgba(128,128,128,0.08)' }}>
      <button onClick={() => onSelect(food)} className="flex-1 text-left">
        <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{food.name}</p>
        {food.brand && <p className="text-[11px]" style={{ color: 'rgb(var(--text-muted))' }}>{food.brand}</p>}
        <div className="flex gap-2 mt-0.5">
          <span className="text-[10px]" style={{ color: '#60a5fa' }}>P:{Math.round(food.protein || 0)}g</span>
          <span className="text-[10px]" style={{ color: '#f59e0b' }}>C:{Math.round(food.carbs || 0)}g</span>
          <span className="text-[10px]" style={{ color: '#f87171' }}>F:{Math.round(food.fat || 0)}g</span>
          <span className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>per {food.serving_unit || food.servingUnit || '100g'}</span>
        </div>
      </button>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-sm font-bold" style={{ color: 'rgb(var(--accent))' }}>{food.calories}</span>
        <span className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>kcal</span>
        {onDelete && (
          <button onClick={onDelete} className="ml-1 p-1 opacity-40 hover:opacity-80">
            <Trash2 size={12} style={{ color: '#f87171' }} />
          </button>
        )}
      </div>
    </div>
  )
}

// Quantity picker modal
function QtyPicker({ food, meal, onConfirm, onCancel }: { food: any; meal: string; onConfirm: (qty: number, unit: string) => void; onCancel: () => void }) {
  const baseUnit = food.serving_unit || food.servingUnit || '100g'
  const basePer100 = baseUnit === '100g' || baseUnit === 'g' || baseUnit === 'ml'

  const [qty, setQty] = useState(basePer100 ? '100' : '1')
  const [unit, setUnit] = useState(basePer100 ? (baseUnit === 'ml' ? 'ml' : 'g') : 'serving')

  const UNIT_GROUPS = [
    { label: 'Servings', units: ['serving', 'piece', 'slice', 'bowl', 'cup', 'scoop', 'bar', 'tbsp'] },
    { label: 'Weight', units: ['g', 'kg'] },
    { label: 'Volume', units: ['ml', 'l'] },
  ]

  // Convert qty+unit → multiplier relative to food base (per 100g or per serving)
  const getMultiplier = (q: number, u: string): number => {
    if (!q) return 0
    const unitGrams: Record<string, number> = {
      serving: 100, slice: 30, piece: 60, bowl: 250,
      cup: 240, scoop: 30, bar: 50, tbsp: 15,
    }
    if (basePer100) {
      if (u === 'g' || u === 'ml') return q / 100
      if (u === 'kg' || u === 'l') return (q * 1000) / 100
      return (q * (unitGrams[u] ?? 100)) / 100
    } else {
      const servingSize = food.serving_size || 100
      if (u === 'g' || u === 'ml') return q / servingSize
      if (u === 'kg' || u === 'l') return (q * 1000) / servingSize
      return q
    }
  }

  const multiplier = getMultiplier(Number(qty), unit)
  const preview = {
    calories: Math.round(food.calories * multiplier),
    protein: Math.round((food.protein || 0) * multiplier * 10) / 10,
    carbs: Math.round((food.carbs || 0) * multiplier * 10) / 10,
    fat: Math.round((food.fat || 0) * multiplier * 10) / 10,
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onCancel}>
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm glass p-5 space-y-4 mb-2">

        <div>
          <p className="font-bold text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{food.name}</p>
          {food.brand && <p className="text-[11px]" style={{ color: 'rgb(var(--text-muted))' }}>{food.brand}</p>}
          <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
            {food.calories} kcal per {baseUnit}
          </p>
        </div>

        {/* Quantity input */}
        <div>
          <label className="text-[10px] font-semibold mb-1.5 block" style={{ color: 'rgb(var(--text-muted))' }}>How much?</label>
          <input type="number" value={qty} onChange={e => setQty(e.target.value)} min="0"
            autoFocus
            className="w-full px-3 py-3 rounded-xl text-2xl font-black text-center outline-none"
            style={{ background: 'rgba(128,128,128,0.08)', border: `2px solid rgba(var(--accent)/0.5)`, color: 'rgb(var(--text-primary))' }} />
        </div>

        {/* Unit button groups — no native select */}
        <div className="space-y-2">
          {UNIT_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'rgb(var(--text-muted))' }}>{group.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.units.map(u => (
                  <button key={u} onClick={() => setUnit(u)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: unit === u ? `rgb(var(--accent))` : 'rgba(128,128,128,0.12)',
                      color: unit === u ? '#000' : 'rgb(var(--text-secondary))',
                      border: unit === u ? 'none' : '1px solid rgba(128,128,128,0.15)',
                    }}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Live macro preview */}
        <div className="grid grid-cols-4 gap-2 text-center rounded-xl p-3"
          style={{ background: `rgba(var(--accent)/0.08)`, border: `1px solid rgba(var(--accent)/0.15)` }}>
          {[
            { label: 'Cal', val: preview.calories, color: 'rgb(var(--accent))' },
            { label: 'Protein', val: `${preview.protein}g`, color: '#60a5fa' },
            { label: 'Carbs', val: `${preview.carbs}g`, color: '#f59e0b' },
            { label: 'Fat', val: `${preview.fat}g`, color: '#f87171' },
          ].map(m => (
            <div key={m.label}>
              <p className="text-base font-black" style={{ color: m.color }}>{m.val}</p>
              <p className="text-[9px]" style={{ color: 'rgb(var(--text-muted))' }}>{m.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(128,128,128,0.08)', color: 'rgb(var(--text-muted))' }}>Cancel</button>
          <button onClick={() => onConfirm(multiplier, unit)} disabled={preview.calories === 0}
            className="btn-accent flex-1 py-3 text-sm">
            Add to {meal}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function FoodLog() {
  const [logs, setLogs] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [myFoods, setMyFoods] = useState<any[]>([])
  const [searchTab, setSearchTab] = useState<'all' | 'mine'>('all')
  const [searching, setSearching] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<string>('breakfast')
  const [showSearch, setShowSearch] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [showGrams, setShowGrams] = useState(false)
  const [manual, setManual] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' })
  const [macroSuggestion, setMacroSuggestion] = useState<any>(null)
  const [gramsForm, setGramsForm] = useState({ name: '', grams: '' })
  const [gramsResult, setGramsResult] = useState<any>(null)
  // Quantity picker — shown when user taps a food result before adding
  const [qtyFood, setQtyFood] = useState<any>(null)
  const searchTimeout = useRef<any>(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [l, s] = await Promise.all([foodApi.getLogs(today), foodApi.getSummary(today)])
    setLogs(l)
    setSummary(s)
  }

  // Scroll panel into view on mobile when it opens
  const scrollToPanel = () => {
    setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }

  const loadMyFoods = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('food_items')
      .select('*')
      .eq('source', `user_${user.id}`)
      .order('name')
    setMyFoods(data || [])
  }

  const handleSearch = (q: string) => {
    setSearchQuery(q)
    clearTimeout(searchTimeout.current)
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const results = await foodApi.search(q)
      setSearchResults(results)
      setSearching(false)
    }, 400)
  }

  // Open quantity picker instead of adding directly
  const openQtyPicker = (food: any) => {
    setQtyFood(food)
  }

  const confirmAddFood = async (multiplier: number, unit: string) => {
    if (!qtyFood) return
    await foodApi.addLog({
      mealType: selectedMeal,
      foodName: qtyFood.name + (qtyFood.brand ? ` (${qtyFood.brand})` : ''),
      calories: Math.round(qtyFood.calories * multiplier),
      protein: Math.round((qtyFood.protein || 0) * multiplier * 10) / 10,
      carbs: Math.round((qtyFood.carbs || 0) * multiplier * 10) / 10,
      fat: Math.round((qtyFood.fat || 0) * multiplier * 10) / 10,
      quantity: multiplier,
      unit,
    })
    setQtyFood(null)
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
    loadData()
  }

  // Manual: auto-suggest macros when calories + name entered
  const handleManualCaloriesChange = (val: string) => {
    const updated = { ...manual, calories: val }
    setManual(updated)
    if (val && updated.name) {
      const suggestion = suggestMacrosFromCalories(updated.name, Number(val))
      setMacroSuggestion(suggestion)
    } else {
      setMacroSuggestion(null)
    }
  }

  const handleManualNameChange = (val: string) => {
    const updated = { ...manual, name: val }
    setManual(updated)
    if (updated.calories && val) {
      const suggestion = suggestMacrosFromCalories(val, Number(updated.calories))
      setMacroSuggestion(suggestion)
    }
  }

  const applySuggestion = () => {
    if (!macroSuggestion) return
    setManual(m => ({
      ...m,
      protein: String(macroSuggestion.protein),
      carbs: String(macroSuggestion.carbs),
      fat: String(macroSuggestion.fat),
    }))
    setMacroSuggestion(null)
  }

  const addManual = async (saveToMyFoods = false) => {
    if (!manual.name || !manual.calories) return
    await foodApi.addLog({
      mealType: selectedMeal,
      foodName: manual.name,
      calories: Number(manual.calories),
      protein: Number(manual.protein || 0),
      carbs: Number(manual.carbs || 0),
      fat: Number(manual.fat || 0),
      isManual: true,
    })
    if (saveToMyFoods) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('food_items').insert({
          name: manual.name,
          source: `user_${user.id}`,
          calories: Number(manual.calories),
          protein: Number(manual.protein || 0),
          carbs: Number(manual.carbs || 0),
          fat: Number(manual.fat || 0),
          serving_unit: 'serving',
        })
        loadMyFoods()
      }
    }
    setManual({ name: '', calories: '', protein: '', carbs: '', fat: '' })
    setMacroSuggestion(null)
    setShowManual(false)
    loadData()
  }

  // Grams converter
  const handleGramsCalc = () => {
    if (!gramsForm.name || !gramsForm.grams) return
    const result = gramsToMacros(gramsForm.name, Number(gramsForm.grams))
    if (result) {
      setGramsResult(result)
    } else {
      setGramsResult({ notFound: true })
    }
  }

  const addFromGrams = async () => {
    if (!gramsResult || gramsResult.notFound) return
    await foodApi.addLog({
      mealType: selectedMeal,
      foodName: `${gramsForm.name} (${gramsForm.grams}g)`,
      calories: gramsResult.calories,
      protein: gramsResult.protein,
      carbs: gramsResult.carbs,
      fat: gramsResult.fat,
      quantity: Number(gramsForm.grams),
      unit: 'g',
    })
    setGramsForm({ name: '', grams: '' })
    setGramsResult(null)
    setShowGrams(false)
    loadData()
  }

  const [editingLog, setEditingLog] = useState<string | null>(null)
  const [editVals, setEditVals] = useState<any>({})

  const startEditLog = (log: any) => {
    setEditingLog(log.id)
    setEditVals({
      food_name: log.food_name || log.foodName || '',
      calories: log.calories,
      protein: log.protein || 0,
      carbs: log.carbs || 0,
      fat: log.fat || 0,
    })
  }

  const saveEditLog = async (id: string) => {
    await supabase.from('food_logs').update({
      food_name: editVals.food_name,
      calories: Number(editVals.calories),
      protein: Number(editVals.protein),
      carbs: Number(editVals.carbs),
      fat: Number(editVals.fat),
    }).eq('id', id)
    setEditingLog(null)
    loadData()
  }

  const deleteLog = async (id: string) => {
    await foodApi.deleteLog(id)
    loadData()
  }

  const calorieGoal = 2000
  const caloriePct = Math.min((summary.calories / calorieGoal) * 100, 100)

  return (
    <>
    {/* Quantity picker modal */}
    <AnimatePresence>
      {qtyFood && (
        <QtyPicker
          food={qtyFood}
          meal={selectedMeal}
          onConfirm={confirmAddFood}
          onCancel={() => setQtyFood(null)}
        />
      )}
    </AnimatePresence>

    <div className="space-y-5 pt-2 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Food Log</h1>
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>{format(new Date(), 'EEEE, MMM d')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowSearch(!showSearch); setShowManual(false); setShowGrams(false); scrollToPanel() }}
            className="btn-accent flex items-center gap-1.5 text-sm py-2">
            <Search size={15} /> Search
          </button>
          <button onClick={() => { setShowGrams(!showGrams); setShowSearch(false); setShowManual(false); scrollToPanel() }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(var(--accent) / 0.12)', color: 'rgb(var(--accent))' }}>
            <Scale size={15} /> Grams
          </button>
          <button onClick={() => { setShowManual(!showManual); setShowSearch(false); setShowGrams(false); scrollToPanel() }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(128,128,128,0.1)', color: 'rgb(var(--text-secondary))' }}>
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Calorie ring + macros */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass p-5">
        <div className="flex items-center gap-6 mb-4">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(128,128,128,0.12)" strokeWidth="8" />
              <circle cx="48" cy="48" r="40" fill="none"
                stroke={`rgb(var(--accent))`}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 * (1 - caloriePct / 100)}
                style={{ transition: 'stroke-dashoffset 1s ease', filter: 'drop-shadow(0 0 6px rgb(var(--accent)))' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black" style={{ color: 'rgb(var(--text-primary))' }}>{Math.round(summary.calories)}</span>
              <span className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>kcal</span>
            </div>
          </div>
          <div className="flex-1 space-y-2.5">
            <MacroBar label="Protein" val={summary.protein} max={160} color="#60a5fa" />
            <MacroBar label="Carbs" val={summary.carbs} max={250} color="#f59e0b" />
            <MacroBar label="Fat" val={summary.fat} max={65} color="#f87171" />
          </div>
        </div>
        <div className="text-xs text-center" style={{ color: 'rgb(var(--text-muted))' }}>
          {Math.max(0, Math.round(calorieGoal - summary.calories))} kcal remaining of {calorieGoal} goal
        </div>
      </motion.div>

      {/* ── Grams converter bottom sheet ── */}
      <BottomSheet show={showGrams} onClose={() => setShowGrams(false)} title="Convert from Grams">
        <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
          Enter food name + grams → auto-calculates calories & macros
        </p>
        <MealSelector selected={selectedMeal} onChange={setSelectedMeal} />
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <input
              value={gramsForm.name}
              onChange={e => { setGramsForm({ ...gramsForm, name: e.target.value }); setGramsResult(null) }}
              placeholder="Food name (e.g. chicken, rice)"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(128,128,128,0.08)', border: '1px solid rgba(128,128,128,0.15)', color: 'rgb(var(--text-primary))' }}
            />
          </div>
          <div>
            <input type="number" value={gramsForm.grams}
              onChange={e => { setGramsForm({ ...gramsForm, grams: e.target.value }); setGramsResult(null) }}
              placeholder="grams"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none text-center"
              style={{ background: 'rgba(128,128,128,0.08)', border: '1px solid rgba(128,128,128,0.15)', color: 'rgb(var(--text-primary))' }}
            />
          </div>
        </div>
        <button onClick={handleGramsCalc} className="btn-accent w-full py-2.5 text-sm">Calculate</button>
        <AnimatePresence>
          {gramsResult && !gramsResult.notFound && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl p-3 space-y-2"
              style={{ background: `rgba(var(--accent) / 0.08)`, border: `1px solid rgba(var(--accent) / 0.2)` }}>
              <p className="text-xs font-semibold" style={{ color: 'rgb(var(--accent))' }}>
                {gramsForm.grams}g of {gramsForm.name}
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Cal', val: gramsResult.calories, color: 'rgb(var(--accent))' },
                  { label: 'Protein', val: gramsResult.protein, color: '#60a5fa' },
                  { label: 'Carbs', val: gramsResult.carbs, color: '#f59e0b' },
                  { label: 'Fat', val: gramsResult.fat, color: '#f87171' },
                ].map(m => (
                  <div key={m.label} className="rounded-lg p-2" style={{ background: 'rgba(128,128,128,0.08)' }}>
                    <p className="text-base font-black" style={{ color: m.color }}>{m.val}</p>
                    <p className="text-[9px] font-medium" style={{ color: 'rgb(var(--text-muted))' }}>{m.label}</p>
                  </div>
                ))}
              </div>
              <button onClick={addFromGrams} className="btn-accent w-full py-2.5 text-sm">
                Add to {selectedMeal}
              </button>
            </motion.div>
          )}
          {gramsResult?.notFound && (
            <div className="text-sm rounded-xl p-3 text-center"
              style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
              Food not in database. Try Search or Manual entry.
            </div>
          )}
        </AnimatePresence>
        <div className="h-2" />
      </BottomSheet>

      {/* ── Search bottom sheet ── */}
      <BottomSheet show={showSearch} onClose={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }} title="Search Food">
        <MealSelector selected={selectedMeal} onChange={setSelectedMeal} />
        <div className="flex rounded-xl overflow-hidden" style={{ background: 'rgba(128,128,128,0.08)' }}>
          {(['all', 'mine'] as const).map(t => (
            <button key={t} onClick={() => { setSearchTab(t); if (t === 'mine') loadMyFoods() }}
              className="flex-1 py-2 text-xs font-semibold transition-all capitalize"
              style={{
                background: searchTab === t ? `rgb(var(--accent))` : 'transparent',
                color: searchTab === t ? '#000' : 'rgb(var(--text-muted))',
                borderRadius: 10,
              }}>
              {t === 'all' ? '🌍 All Foods' : '⭐ My Foods'}
            </button>
          ))}
        </div>
        {searchTab === 'all' && <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3.5" style={{ color: 'rgb(var(--text-muted))' }} />
            <input value={searchQuery} onChange={e => handleSearch(e.target.value)}
              placeholder="Search — dal, banana, protein bar..."
              className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(128,128,128,0.08)', border: '1px solid rgba(128,128,128,0.12)', color: 'rgb(var(--text-primary))' }}
              autoFocus />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]) }} className="absolute right-3 top-3.5">
                <X size={16} style={{ color: 'rgb(var(--text-muted))' }} />
              </button>
            )}
          </div>
          {searching && <p className="text-xs text-center py-1" style={{ color: 'rgb(var(--text-muted))' }}>Searching databases...</p>}
          {searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((food: any, i) => <FoodResultRow key={i} food={food} onSelect={openQtyPicker} />)}
            </div>
          )}
        </>}
        {searchTab === 'mine' && (
          <div className="space-y-1">
            {myFoods.length === 0
              ? <p className="text-sm text-center py-4" style={{ color: 'rgb(var(--text-muted))' }}>No saved foods yet</p>
              : myFoods.map((food: any) => (
                <FoodResultRow key={food.id} food={food} onSelect={openQtyPicker}
                  onDelete={async () => { await supabase.from('food_items').delete().eq('id', food.id); loadMyFoods() }} />
              ))
            }
          </div>
        )}
        <div className="h-2" />
      </BottomSheet>

      {/* ── Manual entry bottom sheet ── */}
      <BottomSheet show={showManual} onClose={() => setShowManual(false)} title="Manual Entry">
        <MealSelector selected={selectedMeal} onChange={setSelectedMeal} />
        <input value={manual.name} onChange={e => handleManualNameChange(e.target.value)}
          placeholder="Food name (e.g. Spaghetti)"
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(128,128,128,0.08)', border: '1px solid rgba(128,128,128,0.12)', color: 'rgb(var(--text-primary))' }}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'rgb(var(--text-muted))' }}>Grams (auto-calc)</label>
            <input type="number" placeholder="e.g. 150"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none text-center"
              style={{ background: 'rgba(128,128,128,0.08)', border: '1px solid rgba(128,128,128,0.12)', color: 'rgb(var(--text-primary))' }}
              onChange={e => {
                const grams = Number(e.target.value)
                if (!grams || !manual.name) return
                const result = gramsToMacros(manual.name, grams)
                if (result) {
                  setManual(m => ({ ...m, calories: String(result.calories), protein: String(result.protein), carbs: String(result.carbs), fat: String(result.fat) }))
                  setMacroSuggestion(null)
                } else {
                  setMacroSuggestion(suggestMacrosFromCalories(manual.name, grams * 1.5))
                }
              }} />
          </div>
          <div>
            <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'rgb(var(--text-muted))' }}>Calories (kcal)</label>
            <input type="number" value={manual.calories} onChange={e => handleManualCaloriesChange(e.target.value)}
              placeholder="e.g. 400"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none text-center"
              style={{ background: 'rgba(128,128,128,0.08)', border: '1px solid rgba(128,128,128,0.12)', color: 'rgb(var(--text-primary))' }}
            />
          </div>
        </div>
        <AnimatePresence>
          {macroSuggestion && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl p-3"
              style={{ background: `rgba(var(--accent)/0.08)`, border: `1px solid rgba(var(--accent)/0.2)` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb size={13} style={{ color: 'rgb(var(--accent))' }} />
                <span className="text-xs font-semibold" style={{ color: 'rgb(var(--accent))' }}>Estimated macros</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { label: 'Protein', val: macroSuggestion.protein, color: '#60a5fa' },
                  { label: 'Carbs', val: macroSuggestion.carbs, color: '#f59e0b' },
                  { label: 'Fat', val: macroSuggestion.fat, color: '#f87171' },
                ].map(m => (
                  <div key={m.label} className="text-center rounded-lg py-1.5" style={{ background: 'rgba(128,128,128,0.08)' }}>
                    <p className="text-sm font-bold" style={{ color: m.color }}>{m.val}g</p>
                    <p className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>{m.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={applySuggestion} className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: `rgb(var(--accent))`, color: '#000' }}>Apply</button>
                <button onClick={() => setMacroSuggestion(null)} className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: 'rgba(128,128,128,0.1)', color: 'rgb(var(--text-muted))' }}>Skip</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'protein', label: 'Protein (g)', color: '#60a5fa' },
            { key: 'carbs', label: 'Carbs (g)', color: '#f59e0b' },
            { key: 'fat', label: 'Fat (g)', color: '#f87171' },
          ].map(({ key, label, color }) => (
            <div key={key}>
              <label className="text-[10px] font-semibold mb-1 block" style={{ color }}>{label}</label>
              <input type="number" value={(manual as any)[key]}
                onChange={e => setManual({ ...manual, [key]: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none text-center"
                style={{ background: 'rgba(128,128,128,0.08)', border: `1px solid rgba(128,128,128,0.12)`, color: 'rgb(var(--text-primary))' }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 pb-2">
          <button onClick={() => addManual(true)} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: `rgba(var(--accent)/0.15)`, color: `rgb(var(--accent))` }}>
            + Save & Add
          </button>
          <button onClick={() => addManual(false)} className="btn-accent flex-1 py-3 text-sm">Add Once</button>
        </div>
      </BottomSheet>

      {/* Logs by meal */}
      {MEAL_TYPES.map(meal => {
        const mealLogs = logs.filter(l => (l.meal_type || l.mealType) === meal)
        if (mealLogs.length === 0) return null
        const mealCals = mealLogs.reduce((a: number, l: any) => a + l.calories, 0)
        return (
          <motion.div key={meal} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>{MEAL_ICONS[meal]}</span>
                <span className="font-semibold text-sm capitalize" style={{ color: 'rgb(var(--text-primary))' }}>{meal}</span>
              </div>
              <span className="text-xs font-medium" style={{ color: 'rgb(var(--accent))' }}>{Math.round(mealCals)} kcal</span>
            </div>
            {mealLogs.map((log: any) => (
              <div key={log.id}>
                {editingLog === log.id ? (
                  <div className="space-y-2 p-3 rounded-xl" style={{ background: `rgba(var(--accent)/0.08)`, border: `1px solid rgba(var(--accent)/0.2)` }}>
                    <input value={editVals.food_name} onChange={e => setEditVals({ ...editVals, food_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm font-medium outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgb(var(--text-primary))' }} />
                    <div className="grid grid-cols-4 gap-2">
                      {[['Cal','calories','rgb(var(--accent))'],['P','protein','#60a5fa'],['C','carbs','#f59e0b'],['F','fat','#f87171']].map(([label,key,color]) => (
                        <div key={key}>
                          <label className="text-[10px] font-semibold" style={{ color }}>{label}</label>
                          <input type="number" value={editVals[key]} onChange={e => setEditVals({ ...editVals, [key]: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-lg text-sm text-center outline-none"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgb(var(--text-primary))' }} />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEditLog(log.id)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                        style={{ background: `rgb(var(--accent))`, color: '#000' }}>
                        <Check size={12} /> Save
                      </button>
                      <button onClick={() => setEditingLog(null)} className="px-3 py-1.5 rounded-lg text-xs opacity-60"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgb(var(--text-muted))' }}>
                        Cancel
                      </button>
                      <button onClick={() => deleteLog(log.id)} className="px-3 py-1.5 rounded-lg text-xs"
                        style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl"
                    style={{ background: 'rgba(128,128,128,0.06)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                        {log.food_name || log.foodName}
                      </p>
                      <p className="text-[11px] mt-0.5">
                        <span style={{ color: '#60a5fa' }}>P:{Math.round(log.protein)}g</span>
                        <span className="mx-1" style={{ color: 'rgb(var(--text-muted))' }}>·</span>
                        <span style={{ color: '#f59e0b' }}>C:{Math.round(log.carbs)}g</span>
                        <span className="mx-1" style={{ color: 'rgb(var(--text-muted))' }}>·</span>
                        <span style={{ color: '#f87171' }}>F:{Math.round(log.fat)}g</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold mr-1" style={{ color: 'rgb(var(--text-secondary))' }}>{Math.round(log.calories)}</span>
                      <button onClick={() => startEditLog(log)} className="p-1.5 rounded-lg opacity-30 hover:opacity-70">
                        <Pencil size={13} style={{ color: 'rgb(var(--text-muted))' }} />
                      </button>
                      <button onClick={() => deleteLog(log.id)} className="p-1.5 rounded-lg opacity-30 hover:opacity-70">
                        <Trash2 size={13} style={{ color: 'rgb(var(--text-muted))' }} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )
      })}

      {logs.length === 0 && (
        <div className="glass p-8 text-center">
          <p className="text-4xl mb-3">🥗</p>
          <p className="font-semibold" style={{ color: 'rgb(var(--text-secondary))' }}>Nothing logged yet</p>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
            Search foods, enter grams, or add manually
          </p>
        </div>
      )}
    </div>
    </>
  )
}
