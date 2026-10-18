'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

/**
 * Registers the Passway service worker (offline app shell + static caching).
 * API responses are never cached by the SW. When a new version is detected,
 * the user is offered a safe reload — the SW only activates via SKIP_WAITING.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    let reg: ServiceWorkerRegistration | null = null
    let refreshing = false

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((r) => {
        reg = r
        r.addEventListener('updatefound', () => {
          const nw = r.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              toast('Passway update ready', {
                description: 'Reload to switch to the latest version.',
                duration: Infinity,
                action: {
                  label: 'Reload',
                  onClick: () => {
                    nw.postMessage({ type: 'SKIP_WAITING' })
                  },
                },
              })
            }
          })
        })
      })
      .catch(() => undefined)

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    return () => {
      reg = null
    }
  }, [])

  return null
}
