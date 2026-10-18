/** Human-readable device description from a User-Agent header (no external deps). */
export function deviceLabelFromUA(ua: string | null): string {
  if (!ua) return 'Unknown device'
  const s = ua.toLowerCase()

  let browser = 'Browser'
  if (s.includes('edg/')) browser = 'Edge'
  else if (s.includes('opr/') || s.includes('opera')) browser = 'Opera'
  else if (s.includes('chrome/') && !s.includes('chromium')) browser = 'Chrome'
  else if (s.includes('firefox/')) browser = 'Firefox'
  else if (s.includes('safari/')) browser = 'Safari'

  let os = 'Unknown OS'
  if (s.includes('windows')) os = 'Windows'
  else if (s.includes('android')) os = 'Android'
  else if (s.includes('iphone') || s.includes('ipad')) os = 'iOS'
  else if (s.includes('mac os') || s.includes('macintosh')) os = 'macOS'
  else if (s.includes('linux')) os = 'Linux'

  return `${browser} on ${os}`
}
