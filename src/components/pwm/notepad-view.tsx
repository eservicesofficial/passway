'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AtSign,
  Bold,
  Check,
  ClipboardList,
  Download,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  Loader2,
  NotebookPen,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/pwm/empty-state'
import { NoteMarkdown } from '@/components/pwm/note-markdown'
import { useOverlayHistory } from '@/components/pwm/nav-history'
import { usePwm } from '@/components/pwm/pwm-context'
import { api } from '@/lib/client'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/ui'
import type { NoteDTO } from '@/lib/types'

type Scope = 'all' | 'pinned' | 'trash'
const DRAFT_KEY = 'passway-note-draft'
const AUTOSAVE_MS = 900

function extractTags(content: string): string[] {
  const tags = new Set<string>()
  const re = /(?:^|[^A-Za-z0-9_])#([A-Za-z0-9_-]{1,32})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) tags.add(m[1].toLowerCase())
  return [...tags]
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function NotepadView() {
  const { vaultVersion, bumpVault } = usePwm()
  const [notes, setNotes] = useState<NoteDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<Scope>('all')
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  // composer state
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  const [pinnedNew, setPinnedNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'draft'>('idle')
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editingRef = useRef<string | null>(null)
  editingRef.current = editingId

  // trash purge confirmation dialog state
  const [purgeTarget, setPurgeTarget] = useState<NoteDTO | null>(null)
  const purgeOverlay = useOverlayHistory(!!purgeTarget, () => setPurgeTarget(null))
  const [purging, setPurging] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api<{ notes: NoteDTO[] }>('/api/notes?scope=all&sort=updated')
      setNotes(d.notes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, vaultVersion])

  // restore draft for a brand-new note
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        setContent(draft)
        setSaveState('draft')
      }
    } catch {
      /* private mode */
    }
  }, [])

  const tags = useMemo(() => {
    const set = new Set<string>()
    notes.forEach((n) => n.tags.forEach((t) => set.add(t)))
    return [...set].sort().slice(0, 16)
  }, [notes])

  const visible = useMemo(() => {
    let list = notes
    if (scope === 'pinned') list = list.filter((n) => n.pinned)
    if (tagFilter) list = list.filter((n) => n.tags.includes(tagFilter))
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((n) => n.content.toLowerCase().includes(q))
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [notes, scope, tagFilter, query])

  // ---- autosave (edit mode) + local draft persistence (new mode) ----------
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    if (!content.trim()) {
      if (!editingId) setSaveState('idle')
      return
    }
    if (editingId) {
      setSaveState('saving')
      autosaveTimer.current = setTimeout(async () => {
        try {
          const res = await api<{ note: NoteDTO }>(`/api/notes/${editingId}`, {
            method: 'PATCH',
            body: { content },
          })
          setNotes((list) => list.map((n) => (n.id === editingId ? res.note : n)))
          setSaveState('saved')
          bumpVault()
        } catch (err) {
          setSaveState('idle')
          toast.error(err instanceof Error ? err.message : 'Autosave failed')
        }
      }, AUTOSAVE_MS)
    } else {
      setSaveState('draft')
      try {
        localStorage.setItem(DRAFT_KEY, content)
      } catch {
        /* private mode */
      }
    }
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [content, editingId, bumpVault])

  function wrapSelection(before: string, after = before, placeholder = '') {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const selected = value.slice(s, e) || placeholder
    const next = value.slice(0, s) + before + selected + after + value.slice(e)
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + before.length, s + before.length + selected.length)
    })
  }

  function prefixLines(prefix: string) {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const start = value.lastIndexOf('\n', s - 1) + 1
    const end = value.indexOf('\n', e) === -1 ? value.length : value.indexOf('\n', e)
    const block = value
      .slice(start, end)
      .split('\n')
      .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l))
      .join('\n')
    const next = value.slice(0, start) + block + value.slice(end)
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start, start + block.length)
    })
  }

  function insertAtCursor(text: string) {
    const ta = textareaRef.current
    if (!ta) {
      setContent((c) => c + text)
      return
    }
    const { selectionStart: s, selectionEnd: e, value } = ta
    const next = value.slice(0, s) + text + value.slice(e)
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + text.length, s + text.length)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey
    if (!mod) return
    const k = e.key.toLowerCase()
    if (k === 'b') {
      e.preventDefault()
      wrapSelection('**', '**', 'bold text')
    } else if (k === 'i') {
      e.preventDefault()
      wrapSelection('*', '*', 'italic text')
    } else if (k === 'k') {
      e.preventDefault()
      wrapSelection('[', '](https://)', 'link text')
    } else if (k === 's') {
      e.preventDefault()
      if (editingId) saveNow()
      else createNote()
    } else if (k === 'p' && e.shiftKey) {
      e.preventDefault()
      setPreview((v) => !v)
    } else if (k === 'e' && e.shiftKey) {
      e.preventDefault()
      prefixLines('- [ ] ')
    }
  }

  async function createNote() {
    const body = content.trim()
    if (!body || saving) return
    setSaving(true)
    try {
      const res = await api<{ note: NoteDTO }>('/api/notes', { method: 'POST', body: { content: body, pinned: pinnedNew } })
      setNotes((list) => [res.note, ...list])
      setContent('')
      setPinnedNew(false)
      setSaveState('idle')
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* noop */
      }
      toast.success('Note saved')
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save note')
    } finally {
      setSaving(false)
    }
  }

  async function saveNow() {
    if (!editingId || saving) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    const body = content.trim()
    if (!body) {
      toast.error('Note cannot be empty')
      return
    }
    setSaving(true)
    try {
      const res = await api<{ note: NoteDTO }>(`/api/notes/${editingId}`, { method: 'PATCH', body: { content: body } })
      setNotes((list) => list.map((n) => (n.id === editingId ? res.note : n)))
      setSaveState('saved')
      toast.success('Note updated')
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update note')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(note: NoteDTO) {
    setEditingId(note.id)
    setContent(note.content)
    setPreview(false)
    setSaveState('idle')
    textareaRef.current?.focus()
  }

  function cancelEdit() {
    setEditingId(null)
    setContent('')
    setSaveState('idle')
    setPreview(false)
  }

  async function togglePin(note: NoteDTO) {
    try {
      const res = await api<{ pinned: boolean }>(`/api/notes/${note.id}`, {
        method: 'PATCH',
        body: { action: 'pin', value: !note.pinned },
      })
      setNotes((list) => list.map((n) => (n.id === note.id ? { ...n, pinned: res.pinned } : n)))
      toast.success(res.pinned ? 'Note pinned' : 'Note unpinned')
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  async function trashNote(note: NoteDTO) {
    try {
      await api(`/api/notes/${note.id}`, { method: 'PATCH', body: { action: 'trash' } })
      setNotes((list) => list.filter((n) => n.id !== note.id))
      if (editingId === note.id) cancelEdit()
      toast.success('Moved to Notepad Trash', { description: 'Recover it for the next 30 days.' })
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  async function restoreNote(note: NoteDTO) {
    try {
      await api(`/api/notes/${note.id}`, { method: 'PATCH', body: { action: 'restore' } })
      toast.success('Note restored')
      await load()
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  async function purgeNote(note: NoteDTO) {
    setPurging(true)
    try {
      await api(`/api/notes/${note.id}?permanent=1`, { method: 'DELETE' })
      toast.success('Note permanently deleted')
      purgeOverlay.closeViaUi()
      await load()
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setPurging(false)
    }
  }

  async function uploadAttachment(file: File) {
    const noteId = editingRef.current
    if (!noteId) {
      toast.error('Save the note first, then attach files')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set('noteId', noteId)
      fd.set('file', file)
      const res = await api<{ attachment: { id: string; name: string; mime: string } }>('/api/notes/attachments', {
        method: 'POST',
        body: fd,
      })
      const url = `/api/notes/attachments/${res.attachment.id}`
      const md = res.attachment.mime.startsWith('image/') ? `![${res.attachment.name}](${url})\n` : `\n[${res.attachment.name}](${url})`
      insertAtCursor(md)
      const updated = await api<{ note: NoteDTO }>(`/api/notes/${noteId}`)
      setNotes((list) => list.map((n) => (n.id === noteId ? updated.note : n)))
      toast.success('Attachment added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const isEditing = !!editingId
  const editorDisabled = scope === 'trash'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <NotebookPen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Notepad
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {notes.length} note{notes.length === 1 ? '' : 's'} · Markdown, #tags, checklists — inspired by the open-source
            Memos project (MIT)
          </p>
        </div>
      </header>

      {/* Toolbar: scope + search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border bg-secondary/50 p-1" role="tablist" aria-label="Notes scope">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'pinned', label: 'Pinned' },
              { key: 'trash', label: 'Trash' },
            ] as { key: Scope; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={scope === t.key}
              onClick={() => setScope(t.key)}
              className={cn(
                'h-8 rounded-lg px-3 text-xs font-semibold transition-colors',
                scope === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="h-10 rounded-xl border-transparent bg-secondary/60 pl-9 focus-visible:bg-background"
            aria-label="Search notes"
          />
        </div>
        {isEditing && (
          <Badge variant="outline" className="h-8 gap-1.5 rounded-xl border-emerald-500/40 bg-emerald-500/10 px-3 text-emerald-700 dark:text-emerald-300">
            <Pencil className="h-3 w-3" /> Editing existing note
          </Badge>
        )}
      </div>

      {/* Tag chips */}
      {tags.length > 0 && scope !== 'trash' && (
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <AtSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter((p) => (p === t ? null : t))}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
                tagFilter === t
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-transparent bg-secondary/60 text-muted-foreground hover:text-foreground',
              )}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {/* Composer / editor */}
      {!editorDisabled && (
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center gap-0.5 border-b px-2 py-1.5" role="toolbar" aria-label="Formatting">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => wrapSelection('**', '**', 'bold text')} aria-label="Bold (Ctrl+B)" title="Bold (Ctrl+B)">
              <Bold className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => wrapSelection('*', '*', 'italic text')} aria-label="Italic (Ctrl+I)" title="Italic (Ctrl+I)">
              <Italic className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => prefixLines('## ')} aria-label="Heading" title="Heading">
              <Heading2 className="h-4 w-4" />
            </Button>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => prefixLines('- ')} aria-label="Bullet list" title="Bullet list">
              <List className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => prefixLines('- [ ] ')} aria-label="Checklist (Ctrl+Shift+E)" title="Checklist (Ctrl+Shift+E)">
              <ClipboardList className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => wrapSelection('[', '](https://)', 'link text')} aria-label="Link (Ctrl+K)" title="Link (Ctrl+K)">
              <Link2 className="h-4 w-4" />
            </Button>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !isEditing}
              aria-label="Attach file (requires saved note)"
              title="Attach file (max 1.5 MB, saved notes)"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadAttachment(f)
              }}
            />
            <div className="flex-1" />
            <Button
              variant={pinnedNew ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setPinnedNew((v) => !v)}
              disabled={isEditing}
              aria-label={pinnedNew ? 'Will be pinned' : 'Pin new note'}
              title={pinnedNew ? 'Will be pinned' : 'Pin new note'}
            >
              <Pin className={cn('h-4 w-4', pinnedNew && 'fill-amber-400 text-amber-400')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPreview((v) => !v)}
              aria-label={preview ? 'Edit markdown' : 'Preview (Ctrl+Shift+P)'}
              title={preview ? 'Edit markdown' : 'Preview (Ctrl+Shift+P)'}
            >
              {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>

          {preview ? (
            <div className="min-h-28 px-4 py-3">
              {content.trim() ? (
                <NoteMarkdown content={content} />
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
              )}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              placeholder="Write a note… use #tags, - [ ] checklists, **bold**, [links](https://)"
              className="w-full resize-y rounded-b-2xl bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70"
              aria-label="Note content"
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
            <span className="text-[11px] text-muted-foreground" aria-live="polite">
              {saveState === 'saving' && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>}
              {saveState === 'saved' && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" /> Saved</span>}
              {saveState === 'draft' && 'Draft saved on this device'}
              {saveState === 'idle' && <span className="hidden sm:inline">Ctrl+Enter to save · Ctrl+B/I/K format · Ctrl+Shift+P preview</span>}
            </span>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="ghost" size="sm" className="h-9 rounded-lg" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                  <Button size="sm" className="h-9 rounded-lg font-semibold" onClick={saveNow} disabled={saving || !content.trim()}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Update note
                  </Button>
                </>
              ) : (
                <Button size="sm" className="h-9 rounded-lg font-semibold" onClick={createNote} disabled={saving || !content.trim()}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Save note
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes timeline */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title={scope === 'trash' ? 'Notepad Trash is empty' : scope === 'pinned' ? 'No pinned notes' : 'No notes yet'}
          description={
            scope === 'trash'
              ? 'Deleted notes stay recoverable here for 30 days.'
              : scope === 'pinned'
                ? 'Pin the notes you reference most and they will float to the top.'
                : 'Capture your first note — markdown, checklists and #tags are all supported.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((note, i) => (
            <li key={note.id} className="animate-view-in" style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}>
              <article className="rounded-2xl border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {note.pinned && (
                    <Badge variant="outline" className="h-5 gap-1 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      <Pin className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> Pinned
                    </Badge>
                  )}
                  {note.tags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTagFilter(t)}
                      className="rounded-full bg-secondary px-1.5 py-px text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      #{t}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] text-muted-foreground" title={new Date(note.updatedAt).toLocaleString()}>
                    {note.updatedAt !== note.createdAt ? 'edited ' : ''}
                    {timeAgo(note.updatedAt)}
                  </span>
                </div>

                <NoteMarkdown content={note.content} />

                {note.attachments.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {note.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={`/api/notes/attachments/${a.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border bg-secondary/50 px-2 py-1 text-[11px] font-medium transition-colors hover:bg-secondary"
                        download={a.name}
                      >
                        <Paperclip className="h-3 w-3" /> {a.name}
                        <span className="text-muted-foreground">({Math.max(1, Math.round(a.size / 1024))} KB)</span>
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-1.5 border-t pt-2.5">
                  <span className="text-[11px] text-muted-foreground">Created {timeAgo(note.createdAt)}</span>
                  <div className="flex-1" />
                  {scope === 'trash' ? (
                    <>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => restoreNote(note)}>
                        <Undo2 className="h-3.5 w-3.5" /> Restore
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs text-destructive hover:text-destructive" onClick={() => setPurgeTarget(note)}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete forever
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => download(`note-${note.createdAt.slice(0, 10)}.md`, note.content)} aria-label="Export as Markdown" title="Export as .md">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => togglePin(note)}
                        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                      >
                        {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => startEdit(note)} aria-label="Edit note" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/80 hover:text-destructive" onClick={() => trashNote(note)} aria-label="Move note to Trash" title="Move to Trash">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {/* Purge confirmation */}
      <AlertDialog open={!!purgeTarget} onOpenChange={(o) => { if (!o) purgeOverlay.closeViaUi() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Attachments on the note are removed too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep note</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (purgeTarget) purgeNote(purgeTarget)
              }}
            >
              {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
