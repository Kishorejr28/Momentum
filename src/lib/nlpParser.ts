/**
 * Free NLP parser — no API, no cost.
 * Parses voice transcripts into food logs, workouts, journal entries.
 */

export interface ParsedFood {
  mealType: string
  foodName: string
  calories: number
  protein: number
  carbs: number
  fat: number
  isManual: boolean
}

export interface ParsedWorkout {
  type: string
  durationMins: number
  caloriesBurned: number
  notes: string
}

export interface ParsedResult {
  foods: ParsedFood[]
  workouts: ParsedWorkout[]
  journal: string
  mood: string
}

// Meal type keywords
const MEAL_KEYWORDS: Record<string, string[]> = {
  breakfast: ['breakfast', 'morning', 'woke up', 'first meal', 'brunch'],
  lunch: ['lunch', 'afternoon', 'midday', 'noon'],
  dinner: ['dinner', 'evening', 'night', 'supper', 'last meal'],
  snack: ['snack', 'snacked', 'snacking', 'bite', 'between meals', 'pre-workout', 'post-workout'],
}

// Workout type keywords
const WORKOUT_KEYWORDS: Record<string, string[]> = {
  weight_training: ['weight training', 'weights', 'gym', 'chest day', 'leg day', 'back day', 'shoulder day', 'bicep', 'tricep', 'bench', 'squat', 'deadlift', 'lifting', 'strength'],
  running: ['run', 'running', 'jog', 'jogged', 'jogging', 'sprint'],
  cycling: ['cycle', 'cycling', 'bike', 'biked', 'biking'],
  swimming: ['swim', 'swam', 'swimming', 'pool'],
  yoga: ['yoga', 'stretching', 'stretch', 'flexibility'],
  hiit: ['hiit', 'circuit', 'tabata', 'intervals'],
  walking: ['walk', 'walked', 'walking', 'steps'],
  cardio: ['cardio', 'treadmill', 'elliptical', 'stairmaster'],
}

// Known foods with approximate macros — extended shorthand list
const FOOD_MACROS: Record<string, Omit<ParsedFood, 'mealType' | 'foodName' | 'isManual'>> = {
  'oats': { calories: 150, protein: 5, carbs: 27, fat: 3 },
  'oatmeal': { calories: 150, protein: 5, carbs: 27, fat: 3 },
  'banana': { calories: 105, protein: 1, carbs: 27, fat: 0 },
  'egg': { calories: 68, protein: 6, carbs: 0.5, fat: 4.5 },
  'eggs': { calories: 68, protein: 6, carbs: 0.5, fat: 4.5 },
  'rice': { calories: 240, protein: 4, carbs: 52, fat: 0.5 },
  'dal': { calories: 220, protein: 12, carbs: 32, fat: 5 },
  'roti': { calories: 100, protein: 3, carbs: 18, fat: 1.5 },
  'chapati': { calories: 100, protein: 3, carbs: 18, fat: 1.5 },
  'chicken': { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  'pasta': { calories: 158, protein: 5.5, carbs: 31, fat: 0.9 },
  'bread': { calories: 80, protein: 3, carbs: 15, fat: 1 },
  'milk': { calories: 130, protein: 6.5, carbs: 9.5, fat: 7 },
  'yogurt': { calories: 130, protein: 15, carbs: 8, fat: 4 },
  'curd': { calories: 60, protein: 3.5, carbs: 4, fat: 3 },
  'paneer': { calories: 265, protein: 18, carbs: 3, fat: 20 },
  'idli': { calories: 130, protein: 4, carbs: 26, fat: 0.5 },
  'dosa': { calories: 165, protein: 3.5, carbs: 30, fat: 3.5 },
  'paratha': { calories: 260, protein: 5, carbs: 38, fat: 9 },
  'biryani': { calories: 450, protein: 22, carbs: 58, fat: 13 },
  'sabzi': { calories: 160, protein: 4, carbs: 18, fat: 7 },
  'salad': { calories: 80, protein: 3, carbs: 10, fat: 3 },
  'protein bar': { calories: 200, protein: 20, carbs: 22, fat: 7 },
  'whey': { calories: 110, protein: 22, carbs: 4, fat: 2 },
  'coffee': { calories: 5, protein: 0, carbs: 0.5, fat: 0 },
  'tea': { calories: 2, protein: 0, carbs: 0.5, fat: 0 },
  'apple': { calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  'orange': { calories: 62, protein: 1.2, carbs: 15, fat: 0.2 },
  'almonds': { calories: 174, protein: 6, carbs: 6, fat: 15 },
  'pizza': { calories: 270, protein: 11, carbs: 34, fat: 10 },
  'burger': { calories: 550, protein: 30, carbs: 40, fat: 30 },
  'sandwich': { calories: 300, protein: 15, carbs: 35, fat: 10 },
  'soup': { calories: 120, protein: 6, carbs: 15, fat: 4 },
  'salmon': { calories: 208, protein: 20, carbs: 0, fat: 13 },
}

// Extract numbers from text near a keyword
function extractNumber(text: string, afterKeyword: string, range: [number, number] = [1, 9999]): number | null {
  const pattern = new RegExp(`${afterKeyword}[\\s\\w]*?(\\d+(?:\\.\\d+)?)`, 'i')
  const m = text.match(pattern)
  if (m) {
    const val = parseFloat(m[1])
    if (val >= range[0] && val <= range[1]) return val
  }
  // Also look for number before keyword
  const patternBefore = new RegExp(`(\\d+(?:\\.\\d+)?)[\\s\\w]*?${afterKeyword}`, 'i')
  const m2 = text.match(patternBefore)
  if (m2) {
    const val = parseFloat(m2[1])
    if (val >= range[0] && val <= range[1]) return val
  }
  return null
}

function detectMealType(sentence: string): string {
  for (const [meal, keywords] of Object.entries(MEAL_KEYWORDS)) {
    if (keywords.some(k => sentence.toLowerCase().includes(k))) return meal
  }
  return 'snack'
}

function detectWorkoutType(sentence: string): string {
  for (const [type, keywords] of Object.entries(WORKOUT_KEYWORDS)) {
    if (keywords.some(k => sentence.toLowerCase().includes(k))) return type
  }
  return 'other'
}

function detectMood(text: string): string {
  const lc = text.toLowerCase()
  if (/great|amazing|fantastic|excellent|best|proud|strong|pumped|energized/.test(lc)) return 'great'
  if (/good|well|nice|happy|positive|motivated/.test(lc)) return 'good'
  if (/okay|fine|alright|not bad|average|neutral/.test(lc)) return 'okay'
  if (/tired|exhausted|low|down|sad|drained|rough/.test(lc)) return 'low'
  if (/stressed|anxious|frustrated|rough|hard day|difficult/.test(lc)) return 'rough'
  return 'okay'
}

// Split transcript into sentences / segments
function splitSegments(text: string): string[] {
  return text.split(/[.,;!?]|(?:\band\b)|(?:\bthen\b)|(?:\bafter(?:ward)?\b)/i)
    .map(s => s.trim())
    .filter(s => s.length > 4)
}

function parseFood(segment: string, defaultMealType: string): ParsedFood | null {
  const lc = segment.toLowerCase()

  // Check for explicit calorie mention
  const calMatch = lc.match(/(\d+)\s*(?:cal(?:orie)?s?|kcal)/)
  const explicitCalories = calMatch ? parseInt(calMatch[1]) : null

  // Find matching food
  let matchedFood: string | null = null
  let macros: Omit<ParsedFood, 'mealType' | 'foodName' | 'isManual'> | null = null

  for (const [key, m] of Object.entries(FOOD_MACROS)) {
    if (lc.includes(key)) {
      matchedFood = key
      macros = m
      break
    }
  }

  if (!matchedFood && !explicitCalories) return null

  const mealType = detectMealType(segment) || defaultMealType

  // Try to extract quantity multiplier
  const qtyMatch = lc.match(/(\d+(?:\.\d+)?)\s*(?:piece|pieces|serving|bowl|plate|cup|scoop|slice|glass|bar)?/)
  const qty = qtyMatch ? Math.min(parseFloat(qtyMatch[1]), 10) : 1

  const calories = explicitCalories ?? Math.round((macros?.calories || 0) * qty)
  const protein = Math.round((macros?.protein || 0) * qty)
  const carbs = Math.round((macros?.carbs || 0) * qty)
  const fat = Math.round((macros?.fat || 0) * qty)
  const foodName = matchedFood
    ? matchedFood.charAt(0).toUpperCase() + matchedFood.slice(1)
    : segment.replace(/(\d+\s*(?:cal(?:orie)?s?|kcal))/gi, '').trim().slice(0, 40)

  return { mealType, foodName, calories, protein, carbs, fat, isManual: !matchedFood }
}

function parseWorkout(segment: string): ParsedWorkout | null {
  const lc = segment.toLowerCase()
  const type = detectWorkoutType(segment)
  if (type === 'other' && !/workout|train|exercise|session/.test(lc)) return null

  const duration = extractNumber(lc, '(?:min(?:ute)?s?|hour)', [1, 300])
    ?? extractNumber(lc, 'for', [1, 300])
    ?? null

  if (!duration) return null

  const durationMins = lc.includes('hour') ? duration * 60 : duration

  // Rough calorie estimate: MET × 75kg × hours
  const metMap: Record<string, number> = {
    weight_training: 5, running: 9, cycling: 7, swimming: 8,
    yoga: 3, hiit: 10, walking: 3.5, cardio: 7, other: 5,
  }
  const caloriesBurned = Math.round((metMap[type] || 5) * 75 * (durationMins / 60))

  return {
    type,
    durationMins,
    caloriesBurned,
    notes: segment.trim().slice(0, 120),
  }
}

export function parseTranscript(transcript: string): ParsedResult {
  const segments = splitSegments(transcript)
  const foods: ParsedFood[] = []
  const workouts: ParsedWorkout[] = []
  const journalParts: string[] = []
  const mood = detectMood(transcript)

  let currentMealContext = 'snack'

  for (const seg of segments) {
    const lc = seg.toLowerCase()

    // Update meal context
    for (const [meal, keywords] of Object.entries(MEAL_KEYWORDS)) {
      if (keywords.some(k => lc.includes(k))) {
        currentMealContext = meal
        break
      }
    }

    // Try workout
    const workout = parseWorkout(seg)
    if (workout) { workouts.push(workout); continue }

    // Try food
    const food = parseFood(seg, currentMealContext)
    if (food) { foods.push(food); continue }

    // Catch journal-like content
    if (lc.match(/feel|felt|mood|stress|happy|tired|good|great|rough|proud|focus|sleep|slept|energy|motivation/) ||
        seg.length > 30) {
      journalParts.push(seg)
    }
  }

  return {
    foods,
    workouts,
    journal: journalParts.join('. '),
    mood,
  }
}
