import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Check, Edit3, Trash2, RefreshCw } from 'lucide-react'
import { parseTranscript, ParsedFood, ParsedWorkout } from '../lib/nlpParser'
import { foodApi, workoutApi, journalApi } from '../lib/api'
import { format } from 'date-fns'

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

function getSpeechRecognition() {
  return (typeof window !== 'undefined')
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null
}

type SaveState = 'idle' | 'saving' | 'saved'

export default function VoiceLog() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState<ReturnType<typeof parseTranscript> | null>(null)
  const [editFood, setEditFood] = useState<ParsedFood[]>([])
  const [editWorkout, setEditWorkout] = useState<ParsedWorkout[]>([])
  const [editJournal, setEditJournal] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const recognitionRef = useRef<any>(null)
  const finalTranscriptRef = useRef<string>('')
  const today = format(new Date(), 'yyyy-MM-dd')

  const supported = !!getSpeechRecognition()

  const startListening = () => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      alert('Voice recognition requires Chrome or Safari. Please open this app in Chrome.')
      return
    }
    finalTranscriptRef.current = ''
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += t + ' '
        } else {
          interim += t
        }
      }
      setTranscript(finalTranscriptRef.current + interim)
    }

    recognition.onerror = (e: any) => {
      console.error('Speech error:', e.error)
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognition.start()
    setListening(true)
    setParsed(null)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const parseVoice = () => {
    if (!transcript.trim()) return
    const result = parseTranscript(transcript)
    setParsed(result)
    setEditFood(result.foods)
    setEditWorkout(result.workouts)
    setEditJournal(result.journal)
  }

  const saveAll = async () => {
    setSaveState('saving')
    try {
      await Promise.all([
        ...editFood.map(f => foodApi.addLog({ ...f, date: today })),
        ...editWorkout.map(w => workoutApi.add({ ...w, date: today })),
        ...(editJournal.trim() ? [journalApi.add({ content: editJournal, mood: parsed?.mood || 'okay', isVoice: true, date: today })] : []),
      ])
      setSaveState('saved')
      setTimeout(() => {
        setTranscript('')
        setParsed(null)
        setSaveState('idle')
      }, 2000)
    } catch {
      setSaveState('idle')
    }
  }

  const removeFood = (i: number) => setEditFood(editFood.filter((_, idx) => idx !== i))
  const removeWorkout = (i: number) => setEditWorkout(editWorkout.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Voice Log</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
          Speak your day — AI parses it into food, workout & journal
        </p>
      </div>

      {/* Not supported warning */}
      {!supported && (
        <div className="glass px-4 py-3 text-sm text-center" style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>
          Voice recognition requires <strong>Chrome</strong> or <strong>Safari</strong>. Please open this app in Chrome.
        </div>
      )}

      {/* Mic */}
      <div className="flex flex-col items-center gap-6 py-6">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={listening ? stopListening : startListening}
          animate={listening ? {
            boxShadow: [
              `0 0 0 0px rgba(var(--accent) / 0.4)`,
              `0 0 0 24px rgba(var(--accent) / 0)`,
            ],
          } : {}}
          transition={listening ? { duration: 1.2, repeat: Infinity } : {}}
          className="w-24 h-24 rounded-full flex items-center justify-center transition-all"
          style={{
            background: listening ? `rgb(var(--accent))` : 'rgba(var(--surface-raised) / 0.8)',
            border: `2px solid rgba(var(--accent) / ${listening ? 1 : 0.3})`,
            boxShadow: listening ? `0 0 32px rgba(var(--accent) / 0.5)` : 'none',
          }}>
          {listening
            ? <MicOff size={32} color={listening ? '#000' : 'rgb(var(--text-secondary))'} />
            : <Mic size={32} style={{ color: 'rgb(var(--accent))' }} />
          }
        </motion.button>
        <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-muted))' }}>
          {listening ? 'Listening... tap to stop' : 'Tap to start speaking'}
        </p>
      </div>

      {/* Example prompt */}
      {!transcript && !listening && (
        <div className="glass p-4 space-y-2">
          <p className="text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Example:</p>
          <p className="text-sm italic leading-relaxed" style={{ color: 'rgb(var(--text-secondary))' }}>
            "Morning had oats with milk and a banana. Lunch was dal rice around 600 calories.
            Hit the gym for chest day, about 1 hour, then 20 minutes treadmill.
            Feeling really good today, energy was high."
          </p>
        </div>
      )}

      {/* Transcript */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>
                Transcript
              </p>
              <button onClick={() => { setTranscript(''); setParsed(null) }}
                className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Clear</button>
            </div>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={4}
              className="w-full text-sm leading-relaxed bg-transparent outline-none resize-none"
              style={{ color: 'rgb(var(--text-primary))' }}
            />
            <button onClick={parseVoice} className="btn-accent w-full py-3 text-sm flex items-center justify-center gap-2">
              <RefreshCw size={15} /> Parse & Review
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parsed review cards */}
      <AnimatePresence>
        {parsed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4">
            <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
              Review & Edit — then confirm
            </p>

            {/* Food cards */}
            {editFood.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>
                  🍽️ Food ({editFood.length})
                </p>
                {editFood.map((food, i) => (
                  <motion.div key={i} layout className="glass p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <input
                          value={food.foodName}
                          onChange={e => setEditFood(editFood.map((f, idx) => idx === i ? { ...f, foodName: e.target.value } : f))}
                          className="font-semibold text-sm bg-transparent outline-none w-full border-b"
                          style={{ color: 'rgb(var(--text-primary))', borderColor: 'rgba(255,255,255,0.1)' }}
                        />
                        <div className="grid grid-cols-4 gap-2">
                          {([
                            ['Cal', 'calories', '🔥'],
                            ['P', 'protein', '💪'],
                            ['C', 'carbs', '⚡'],
                            ['F', 'fat', '🥑'],
                          ] as const).map(([label, key, icon]) => (
                            <div key={key} className="text-center">
                              <input
                                type="number"
                                value={(food as any)[key]}
                                onChange={e => setEditFood(editFood.map((f, idx) => idx === i ? { ...f, [key]: Number(e.target.value) } : f))}
                                className="w-full text-center text-sm font-bold bg-transparent outline-none"
                                style={{ color: 'rgb(var(--text-primary))' }}
                              />
                              <p className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>{icon} {label}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          {['breakfast', 'lunch', 'dinner', 'snack'].map(m => (
                            <button key={m}
                              onClick={() => setEditFood(editFood.map((f, idx) => idx === i ? { ...f, mealType: m } : f))}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
                              style={{
                                background: food.mealType === m ? `rgba(var(--accent) / 0.2)` : 'rgba(255,255,255,0.04)',
                                color: food.mealType === m ? `rgb(var(--accent))` : 'rgb(var(--text-muted))',
                              }}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => removeFood(i)} className="opacity-40 hover:opacity-70 flex-shrink-0">
                        <Trash2 size={14} style={{ color: 'rgb(var(--text-muted))' }} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Workout cards */}
            {editWorkout.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>
                  💪 Workout ({editWorkout.length})
                </p>
                {editWorkout.map((workout, i) => (
                  <motion.div key={i} layout className="glass p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <p className="font-semibold text-sm capitalize" style={{ color: 'rgb(var(--text-primary))' }}>
                          {workout.type.replace('_', ' ')}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            ['Duration (min)', 'durationMins'],
                            ['Calories burned', 'caloriesBurned'],
                          ] as const).map(([label, key]) => (
                            <div key={key}>
                              <label className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>{label}</label>
                              <input
                                type="number"
                                value={(workout as any)[key]}
                                onChange={e => setEditWorkout(editWorkout.map((w, idx) => idx === i ? { ...w, [key]: Number(e.target.value) } : w))}
                                className="w-full bg-transparent outline-none text-sm font-semibold border-b"
                                style={{ color: 'rgb(var(--text-primary))', borderColor: 'rgba(255,255,255,0.1)' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => removeWorkout(i)} className="opacity-40 hover:opacity-70">
                        <Trash2 size={14} style={{ color: 'rgb(var(--text-muted))' }} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Journal */}
            {editJournal && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>
                  📖 Journal ({parsed.mood})
                </p>
                <div className="glass p-4">
                  <textarea
                    value={editJournal}
                    onChange={e => setEditJournal(e.target.value)}
                    rows={3}
                    className="w-full text-sm leading-relaxed bg-transparent outline-none resize-none"
                    style={{ color: 'rgb(var(--text-primary))' }}
                  />
                </div>
              </div>
            )}

            {/* No results */}
            {editFood.length === 0 && editWorkout.length === 0 && !editJournal && (
              <div className="glass p-6 text-center">
                <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
                  Couldn't parse anything specific. Try editing the transcript or speak more clearly.
                </p>
              </div>
            )}

            {/* Save button */}
            {(editFood.length > 0 || editWorkout.length > 0 || editJournal) && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={saveAll}
                disabled={saveState !== 'idle'}
                className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{
                  background: saveState === 'saved' ? '#22c55e' : `rgb(var(--accent))`,
                  color: '#000',
                  boxShadow: `0 4px 24px rgba(var(--accent) / 0.4)`,
                }}>
                {saveState === 'saving' && <RefreshCw size={16} className="animate-spin" />}
                {saveState === 'saved' && <Check size={16} />}
                {saveState === 'idle' && <Check size={16} />}
                {saveState === 'saved' ? 'All Saved!' : saveState === 'saving' ? 'Saving...' : `Confirm & Save All`}
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
