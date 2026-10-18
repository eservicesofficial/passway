'use client'

import { useEffect, useRef } from 'react'
import type { ViewKey } from '@/components/pwm/pwm-context'

/**
 * Android/mobile back-button coordination for the single-page app.
 *
 * Model (per-document history entries):
 *  - App mount: replaceState({passway-view}) on the initial entry + pushState
 *    ({passway-root}) sentinel so the browser back button at the app root always
 *    hits a known entry (pushed entries are never rewritten by the framework).
 *  - Every in-app view change pushes a { passway-view } entry.
 *  - Every open overlay (dialog/sheet) pushes an entry and registers a closer.
 *  - popstate resolution order:
 *      1. close the top-most open overlay (LIFO),
 *      1b. drain stale overlay entries left behind by programmatic closes,
 *      2. navigate back to the view encoded in the new history state,
 *      3. at the passway-root sentinel -> exit confirmation + re-arm on Stay.
 */

type OverlayEntry = { id: number; close: () => void }

const STACK: OverlayEntry[] = []
let booted = false
let ignoreNextPop = false
let exitBypass = false
let currentView: ViewKey = 'dashboard'

/**
 * Stable handler bag: survives Fast Refresh / module instance swaps because the
 * app-shell rebinds these on every mount. The (single) popstate listener reads
 * them lazily, so handlers are never orphaned from the UI.
 */
export const navHandlers: {
  onView?: (v: ViewKey, fromHistory: boolean) => void
  onExitRequest?: () => void
} = {}

const VIEW_MARKER = 'passway-view'
const OVERLAY_MARKER = 'passway-overlay'

function ensurePopListener() {
  if (booted || typeof window === 'undefined') return
  booted = true
  window.addEventListener('popstate', (e: PopStateEvent) => {
    if (ignoreNextPop) {
      ignoreNextPop = false
      return
    }
    if (exitBypass) {
      // Confirmed exit — let the browser continue leaving the document.
      return
    }
    // 1) Overlays first (dialogs, sheets)
    if (STACK.length > 0) {
      const top = STACK[STACK.length - 1]
      top.close() // idempotent; the overlay hook cleanup removes it from STACK
      return
    }
    // 1b) Stale overlay entry (programmatic closes can leave one in the stack) —
    //     drain: keep popping until a meaningful entry is reached.
    if ((e.state as { marker?: string } | null)?.marker === OVERLAY_MARKER) {
      window.history.back()
      return
    }
    // 2) In-app view navigation
    const st = (e.state ?? {}) as { marker?: string; view?: ViewKey }
    if (st.marker === VIEW_MARKER && st.view) {
      if (st.view !== currentView) {
        currentView = st.view // keep module state in sync on history pops
        navHandlers.onView?.(st.view, true)
      } else {
        // Popped back to the app-root guard entry -> explicit exit confirmation.
        navHandlers.onExitRequest?.()
      }
      return
    }
    // 3) Root of the app -> exit confirmation, then re-arm so the app is not
    //    silently abandoned by the next back press.
    navHandlers.onExitRequest?.()
  })
}

/** Call once when the authenticated app mounts. */
export function bootNavHistory(initialView: ViewKey = 'dashboard') {
  if (typeof window === 'undefined') return
  ensurePopListener()
  currentView = initialView
  const st = window.history.state as { marker?: string; view?: ViewKey } | null
  if (st?.marker === VIEW_MARKER && st.view) {
    currentView = st.view // restore view across page refresh
  } else {
    window.history.replaceState({ marker: VIEW_MARKER, view: currentView }, '')
  }
  // Root guard entry: the first back press at the app root pops into THIS
  // known entry (same view as current) which triggers the exit confirmation.
  // The current state is merged so Next.js's router still recognizes it.
  const base = (window.history.state ?? {}) as Record<string, unknown>
  window.history.pushState({ ...base, marker: VIEW_MARKER, view: currentView }, '')
}

/** Navigate in-app: updates state via handler and pushes a history entry. */
export function pushView(v: ViewKey) {
  currentView = v
  if (typeof window !== 'undefined') {
    const base = (window.history.state ?? {}) as Record<string, unknown>
    window.history.pushState({ ...base, marker: VIEW_MARKER, view: v }, '')
  }
  navHandlers.onView?.(v, false)
}

/**
 * Overlay lifecycle: pushes a history entry while `open` is true and keeps a
 * LIFO closer so the back button dismisses overlays before views.
 * Returns `closeViaUi` which keeps the history stack in sync when the user
 * closes the overlay through the UI.
 */
export function useOverlayHistory(open: boolean, close: () => void) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  }, [close])

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    ensurePopListener()
    const entry: OverlayEntry = { id: Math.random(), close: () => closeRef.current() }
    STACK.push(entry)
    const base = (window.history.state ?? {}) as Record<string, unknown>
    window.history.pushState({ ...base, marker: OVERLAY_MARKER }, '')
    return () => {
      const i = STACK.indexOf(entry)
      if (i >= 0) STACK.splice(i, 1)
    }
  }, [open])

  return {
    /** Use for UI-initiated closes (X buttons, Cancel, Escape) so history stays in sync. */
    closeViaUi: () => {
      ignoreNextPop = true
      if (typeof window !== 'undefined') window.history.back()
      closeRef.current()
    },
  }
}

/** User explicitly confirmed leaving the app. */
export function performExit() {
  exitBypass = true
  try {
    window.close()
  } catch {
    /* noop */
  }
  window.setTimeout(() => {
    window.history.back()
    // If there is no previous document (e.g. fresh PWA window), stay gracefully.
  }, 120)
}

/** Re-arm the root guard after the user chose to stay in the app. */
export function rearmRootGuard() {
  if (typeof window === 'undefined' || exitBypass) return
  const base = (window.history.state ?? {}) as Record<string, unknown>
  window.history.pushState({ ...base, marker: VIEW_MARKER, view: currentView }, '')
}
