import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Smile } from 'lucide-react'
import { journalApi } from '../lib/api'
import { format } from 'date-fns'

const MOODS = [
  { id: 'great', label: 'Great', icon: '🔥' },
  { id: 'good', label: 'Good', icon: '😊' },
  { id: 'okay', label: 'Okay', icon: '😐' },
  { id: 'low', label: 'Low', icon: '😔' },
  { id: 'rough', label: 'Rough', icon: '😤' },
]

export default function Journal() {
  const [entries, setEntries] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<string>('good')
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => { journalApi.getAll().then(setEntries) }, [])

  const handleAdd = async () => {
    if (!content.trim()) return
    await journalApi.add({ content, mood, date: today })
    setContent('')
    setMood('good')
    setShowAdd(false)
    journalApi.getAll().then(setEntries)
  }

  const handleDelete = async (id: string) => {
    await journalApi.delete(id)
    setEntries(entries.filter(e => e.id !== id))
  }

  const todayEntries = entries.filter(e => e.date === today)
  const pastEntries = entries.filter(e => e.date !== today)

  return (
    <div className="space-y-5 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Journal</h1>
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>{format(new Date(), 'EEEE, MMM d')}</p>
        </div>
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowAdd(!showAdd)}
          className="btn-accent flex items-center gap-1.5 text-sm">
          <Plus size={16} /> Write
        </motion.button>
      </div>

      {/* Add entry */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass p-5 space-y-4">
            <p className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>How's today going?</p>
            {/* Mood */}
            <div className="flex gap-2 justify-between">
              {MOODS.map(m => (
                <button key={m.id} onClick={() => setMood(m.id)}
                  className="flex flex-col items-center gap-1 flex-1 py-2 rounded-xl text-[11px] font-medium transition-all"
                  style={{
                    background: mood === m.id ? `rgba(var(--accent) / 0.2)` : 'rgba(255,255,255,0.04)',
                    border: mood === m.id ? `1px solid rgba(var(--accent) / 0.4)` : '1px solid transparent',
                    color: mood === m.id ? `rgb(var(--accent))` : 'rgb(var(--text-muted))',
                  }}>
                  <span className="text-xl">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What's on your mind? How did you feel today? What did you accomplish?"
              rows={5}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none leading-relaxed"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgb(var(--text-primary))',
              }}
            />
            <div className="text-xs text-right" style={{ color: 'rgb(var(--text-muted))' }}>
              {content.length} chars
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgb(var(--text-secondary))' }}>Cancel</button>
              <button onClick={handleAdd} className="btn-accent flex-1 py-3 text-sm">Save Entry</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today's entries */}
      {todayEntries.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>Today</p>
          {todayEntries.map(entry => (
            <EntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Past entries */}
      {pastEntries.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>Past Entries</p>
          {pastEntries.map(entry => (
            <EntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {entries.length === 0 && !showAdd && (
        <div className="glass p-8 text-center">
          <p className="text-4xl mb-3">📖</p>
          <p className="font-semibold" style={{ color: 'rgb(var(--text-secondary))' }}>Your journal is empty</p>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>Start writing — it takes 2 minutes</p>
        </div>
      )}
    </div>
  )
}

function EntryCard({ entry, onDelete }: any) {
  const [expanded, setExpanded] = useState(false)
  const mood = MOODS.find(m => m.id === entry.mood)

  return (
    <motion.div layout className="glass p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {mood && <span className="text-lg flex-shrink-0">{mood.icon}</span>}
          <div className="flex-1 min-w-0">
            <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
              {format(new Date(entry.date + 'T00:00:00'), 'MMM d, yyyy')}
              {entry.isVoice && <span className="ml-2">🎙️</span>}
            </p>
            <p className="text-sm leading-relaxed mt-1"
              style={{
                color: 'rgb(var(--text-primary))',
                display: expanded ? 'block' : '-webkit-box',
                WebkitLineClamp: expanded ? undefined : 3,
                WebkitBoxOrient: 'vertical',
                overflow: expanded ? 'visible' : 'hidden',
              }}>
              {entry.content}
            </p>
          </div>
        </div>
        <button onClick={() => onDelete(entry.id)} className="opacity-20 hover:opacity-60 flex-shrink-0">
          <Trash2 size={14} style={{ color: 'rgb(var(--text-muted))' }} />
        </button>
      </div>
      {entry.content.length > 150 && (
        <button onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium" style={{ color: 'rgb(var(--accent))' }}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </motion.div>
  )
}
