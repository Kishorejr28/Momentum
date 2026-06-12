import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [calorieGoal, setCalorieGoal] = useState('2000')
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleStep1 = () => {
    if (name.trim().length < 1) return
    setStep(2)
  }

  const handleFinish = async () => {
    setSaving(true)
    setError('')
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) { setError('Not logged in. Refresh and try again.'); setSaving(false); return }

      // Use UPDATE — the profile row already exists (created by trigger or backfill)
      // If somehow it doesn't exist, INSERT it
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ name: name.trim(), calorie_goal: Number(calorieGoal) || 2000 })
        .eq('id', user.id)

      if (updateErr) {
        // Row doesn't exist yet — insert it
        const { error: insertErr } = await supabase
          .from('profiles')
          .insert({ id: user.id, name: name.trim(), calorie_goal: Number(calorieGoal) || 2000 })
        if (insertErr) { setError('Could not save: ' + insertErr.message); setSaving(false); return }
      }

      onDone()
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#0a0a0f' }}>
      {step === 1 && (
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'rgb(99 102 241)', boxShadow: '0 0 32px rgba(99,102,241,0.5)' }}>
              ✦
            </div>
            <h1 className="text-3xl font-black" style={{ color: '#f8f8ff' }}>Momentum</h1>
            <p className="text-sm" style={{ color: 'rgba(248,248,255,0.4)' }}>Your personal health & habit tracker</p>
          </div>
          <div className="space-y-4">
            <p className="text-lg font-semibold" style={{ color: '#f8f8ff' }}>What should we call you?</p>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStep1()}
              placeholder="Your name..."
              autoFocus
              className="w-full px-5 py-4 rounded-2xl text-center text-lg font-semibold outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `2px solid ${name ? 'rgb(99 102 241)' : 'rgba(255,255,255,0.1)'}`,
                color: '#f8f8ff',
              }}
            />
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleStep1} disabled={!name.trim()}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all"
              style={{
                background: name.trim() ? 'rgb(99 102 241)' : 'rgba(255,255,255,0.06)',
                color: name.trim() ? '#000' : 'rgba(248,248,255,0.3)',
                boxShadow: name.trim() ? '0 4px 24px rgba(99,102,241,0.4)' : 'none',
              }}>
              Continue →
            </motion.button>
          </div>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-sm space-y-8 text-center">
          <div>
            <p className="text-2xl font-black mb-2" style={{ color: '#f8f8ff' }}>Hey, {name}! 👋</p>
            <p className="text-sm" style={{ color: 'rgba(248,248,255,0.4)' }}>Set your daily calorie goal</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Cut', kcal: '1600', desc: 'Lose weight' },
                { label: 'Maintain', kcal: '2000', desc: 'Stay lean' },
                { label: 'Bulk', kcal: '2500', desc: 'Build muscle' },
              ].map(p => (
                <button key={p.kcal} onClick={() => setCalorieGoal(p.kcal)}
                  className="p-3 rounded-2xl flex flex-col items-center gap-1 transition-all"
                  style={{
                    background: calorieGoal === p.kcal ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                    border: calorieGoal === p.kcal ? '2px solid rgba(99,102,241,0.6)' : '2px solid transparent',
                    color: calorieGoal === p.kcal ? 'rgb(99 102 241)' : 'rgba(248,248,255,0.5)',
                  }}>
                  <span className="font-bold text-base">{p.kcal}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide">{p.label}</span>
                  <span className="text-[10px]">{p.desc}</span>
                </button>
              ))}
            </div>
            <input type="number" value={calorieGoal} onChange={e => setCalorieGoal(e.target.value)}
              placeholder="Custom kcal"
              className="w-full px-5 py-3 rounded-2xl text-center font-semibold outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8f8ff' }}
            />
            {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleFinish} disabled={saving}
              className="w-full py-4 rounded-2xl font-bold text-base"
              style={{ background: 'rgb(99 102 241)', color: '#000', opacity: saving ? 0.7 : 1, boxShadow: '0 4px 24px rgba(99,102,241,0.4)' }}>
              {saving ? 'Saving...' : 'Start Building Momentum ✦'}
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
