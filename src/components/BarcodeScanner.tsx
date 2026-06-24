import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'

interface BarcodeScannerProps {
  onResult: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onResult, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(true)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
      if (result) {
        setFlash(true)
        setScanning(false)
        setTimeout(() => {
          onResult(result.getText())
        }, 300)
      }
    }).catch((e: any) => {
      setError(e?.message?.includes('Permission') || e?.message?.includes('allowed')
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : 'Camera not available. Try searching manually.')
    })

    return () => {
      try { (reader as any).reset?.() } catch (_) {}
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: '#000' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pb-4"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', background: 'rgba(0,0,0,0.8)' }}>
        <div className="flex items-center gap-2">
          <Zap size={18} style={{ color: '#6366f1' }} />
          <p className="font-semibold text-white text-sm">Scan Barcode</p>
        </div>
        <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', padding: 8 }}>
          <X size={22} />
        </button>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />

        {/* Flash on scan */}
        <AnimatePresence>
          {flash && (
            <motion.div initial={{ opacity: 0.8 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-white pointer-events-none" />
          )}
        </AnimatePresence>

        {/* Scan frame overlay */}
        {!error && scanning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-48">
              {/* Corner brackets */}
              {[
                'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
                'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
                'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
                'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
              ].map((c, i) => (
                <div key={i} className={`absolute w-8 h-8 border-white ${c}`} />
              ))}
              {/* Scanning line */}
              <motion.div
                animate={{ top: ['10%', '85%', '10%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute left-0 right-0 h-0.5"
                style={{ background: 'linear-gradient(90deg, transparent, #6366f1, transparent)' }}
              />
            </div>
            <p className="absolute bottom-24 text-white text-sm font-medium opacity-70">
              Point at a barcode or QR code
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-white text-sm">{error}</p>
            <button onClick={onClose}
              style={{ padding: '12px 24px', background: '#6366f1', color: '#000', borderRadius: 12, fontWeight: 600, border: 'none', fontSize: 14 }}>
              Go back to search
            </button>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      {!error && (
        <div className="px-5 py-4 text-center" style={{ background: 'rgba(0,0,0,0.8)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
            Scans EAN, UPC, QR codes — works with most packaged foods
          </p>
        </div>
      )}
    </motion.div>
  )
}
