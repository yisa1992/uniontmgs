'use client'

import { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show || !deferredPrompt) return null

  const onInstall = async () => {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
    }
    setDeferredPrompt(null)
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] bg-slate-800 border border-slate-600 rounded-xl p-4 shadow-xl flex items-center justify-between gap-3">
      <p className="text-sm text-slate-200">Install app for quick access</p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => setShow(false)}
          className="text-xs text-slate-400 hover:text-white px-2 py-1"
        >
          Later
        </button>
        <button
          onClick={onInstall}
          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium"
        >
          Install
        </button>
      </div>
    </div>
  )
}
