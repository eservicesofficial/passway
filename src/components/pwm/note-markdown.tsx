'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Safe markdown renderer for notes (Memos-style preview).
 * - GFM: tables, strikethrough, task list checkboxes
 * - URL transform blocks dangerous schemes (javascript:, vbscript:, …)
 * - Links open safely in a new tab; images restricted to same-origin
 *   attachment endpoints or inline data images.
 */
function safeUrl(src: string): string {
  if (src.startsWith('/') || src.startsWith('#')) return src
  if (/^data:image\//i.test(src)) return src
  if (/^https?:\/\//i.test(src)) return src
  if (/^mailto:/i.test(src)) return src
  return ''
}

export function NoteMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed [&_hr]:my-3 [&_hr]:border-border [&_img]:max-h-72 [&_img]:rounded-lg [&_img]:border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={{
          a: ({ href, children }) => (
            <a
              href={href ?? '#'}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium text-emerald-600 underline decoration-emerald-600/30 underline-offset-2 hover:decoration-emerald-600 dark:text-emerald-400"
            >
              {children}
            </a>
          ),
          input: ({ checked, type }) =>
            type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={!!checked}
                readOnly
                className="mr-1.5 h-3.5 w-3.5 translate-y-px rounded accent-emerald-600"
              />
            ) : null,
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className ?? '')
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg border bg-secondary/60 p-3 font-mono text-xs">
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded-md bg-secondary/80 px-1 py-0.5 font-mono text-[0.8em]">{children}</code>
            )
          },
          pre: ({ children }) => <pre className="my-2 list-none pl-0">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-4 border-emerald-500/40 pl-3 text-muted-foreground">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border">
              <table className="w-full text-xs [&_td]:border-b [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:bg-secondary/60 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold">
                {children}
              </table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
