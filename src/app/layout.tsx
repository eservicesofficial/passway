import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/pwm/theme-provider'
import { PwaRegister } from '@/components/pwm/pwa-register'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Passway · Premium Password Manager',
  applicationName: 'Passway',
  description:
    'A premium, secure password manager with AES-256-GCM vault encryption, Argon2id password hashing, secure QR login, vault sharing, an integrated notepad, and 30-day recoverable Trash.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Passway',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7fdfa' },
    { media: '(prefers-color-scheme: dark)', color: '#101613' },
  ],
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster position="bottom-right" richColors closeButton />
        <PwaRegister />
      </body>
    </html>
  )
}
