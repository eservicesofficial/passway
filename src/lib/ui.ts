/** Client-side UI helpers: avatars, formatting, password strength, generator. */

const AVATAR_COLORS = [
  '#059669', // emerald
  '#0d9488', // teal
  '#d97706', // amber
  '#ea580c', // orange
  '#e11d48', // rose
  '#db2777', // pink
  '#7c3aed', // violet
  '#65a30d', // lime
  '#c026d3', // fuchsia
  '#ca8a04', // yellow
]

export function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function initials(text: string): string {
  const clean = text.trim()
  if (!clean) return '?'
  const words = clean.split(/[\s._@-]+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return clean.slice(0, 2).toUpperCase()
}

export function hostOf(url: string | null): string {
  if (!url) return ''
  try {
    const withProto = url.startsWith('http') ? url : `https://${url}`
    return new URL(withProto).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function urlHref(url: string | null): string | null {
  if (!url) return null
  return url.startsWith('http') ? url : `https://${url}`
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Password strength
// ---------------------------------------------------------------------------
export interface Strength {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  color: string
}

const STRENGTH_META: Array<{ label: string; color: string }> = [
  { label: 'Very weak', color: '#ef4444' },
  { label: 'Weak', color: '#f97316' },
  { label: 'Fair', color: '#eab308' },
  { label: 'Strong', color: '#84cc16' },
  { label: 'Excellent', color: '#10b981' },
]

export function scorePassword(pw: string): Strength {
  if (!pw) return { score: 0, label: 'Empty', color: '#94a3b8' }
  const hasLower = /[a-z]/.test(pw)
  const hasUpper = /[A-Z]/.test(pw)
  const hasDigit = /[0-9]/.test(pw)
  const hasSymbol = /[^A-Za-z0-9]/.test(pw)
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length
  const unique = new Set(pw).size

  let score: Strength['score'] = 0
  if (pw.length >= 6) score = 1
  if (pw.length >= 8 && variety >= 2) score = 2
  if (pw.length >= 12 && variety >= 3 && unique >= pw.length * 0.6) score = 3
  if (pw.length >= 16 && variety === 4 && unique >= pw.length * 0.7) score = 4

  // penalties: sequential runs (abc, 123), heavy repetition
  let sequential = 0
  for (let i = 0; i < pw.length - 2; i++) {
    const a = pw.charCodeAt(i)
    if ((a + 1 === pw.charCodeAt(i + 1) && a + 2 === pw.charCodeAt(i + 2)) || (a === pw.charCodeAt(i + 1) && a === pw.charCodeAt(i + 2))) {
      sequential++
    }
  }
  if (sequential >= 2) score = Math.max(0, score - 2) as Strength['score']
  else if (sequential === 1) score = Math.max(0, score - 1) as Strength['score']

  const meta = STRENGTH_META[score]
  return { score, label: meta.label, color: meta.color }
}

// ---------------------------------------------------------------------------
// Password generator
// ---------------------------------------------------------------------------
const SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*()_+-=[]{};:,.<>?/',
}
const AMBIGUOUS = { lower: 'l', upper: 'IO', digits: '01', symbols: '' }

export interface GeneratorOptions {
  length: number
  lower: boolean
  upper: boolean
  digits: boolean
  symbols: boolean
  avoidAmbiguous: boolean
}

export function generatePassword(opts: GeneratorOptions): string {
  const build = (set: string, avoid: string) =>
    opts.avoidAmbiguous ? set.replace(new RegExp(`[${avoid}]`, 'g'), '') : set

  const pools: string[] = []
  if (opts.lower) pools.push(build(SETS.lower, AMBIGUOUS.lower))
  if (opts.upper) pools.push(build(SETS.upper, AMBIGUOUS.upper))
  if (opts.digits) pools.push(build(SETS.digits, AMBIGUOUS.digits))
  if (opts.symbols) pools.push(build(SETS.symbols, AMBIGUOUS.symbols))
  const all = pools.join('')
  if (!all) return ''

  const randomInt = (max: number) => {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0] % max
  }

  const chars: string[] = []
  // guarantee one char from each selected pool
  for (const pool of pools) chars.push(pool[randomInt(pool.length)])
  while (chars.length < opts.length) chars.push(all[randomInt(all.length)])
  // Fisher–Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.slice(0, opts.length).join('')
}

export const GROUP_COLORS = AVATAR_COLORS
