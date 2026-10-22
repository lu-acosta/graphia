export type Doc = {
  id: string
  title: string
  content: string
  favorite: boolean
  createdAt: number
  updatedAt: number
  trashed?: boolean
  preview?: string
}

export type Preferences = {
  language: 'es' | 'en'
  autocomplete: boolean
  commandLanguage: 'es' | 'en'
  theme: 'dark' | 'light'
}

export const DB_NAME = 'graphia-local'
export const DB_VERSION = 1
export const DOC_STORE = 'documents'
export const PREF_KEY = 'graphia.preferences'

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        const store = db.createObjectStore(DOC_STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
        store.createIndex('trashed', 'trashed')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'))
  })
}

export async function getDocuments(): Promise<Doc[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction(DOC_STORE, 'readonly').objectStore(DOC_STORE).getAll()
    request.onsuccess = () => resolve((request.result as Doc[]).sort((a, b) => b.updatedAt - a.updatedAt))
    request.onerror = () => reject(request.error)
  })
}

export async function saveDocument(doc: Doc): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, 'readwrite')
    tx.objectStore(DOC_STORE).put(doc)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not save document'))
    tx.onabort = () => reject(tx.error ?? new Error('Could not save document'))
  })
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, 'readwrite')
    tx.objectStore(DOC_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not delete document'))
  })
}

export function blankDocument(title = 'Untitled notes'): Doc {
  const now = Date.now()
  const id = crypto.randomUUID()
  const content = '<p></p>'
  return { id, title, content, favorite: false, createdAt: now, updatedAt: now }
}

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

export function loadPreferences(): Preferences {
  const defaults: Preferences = { language: 'es', autocomplete: true, commandLanguage: 'es', theme: 'dark' }
  try {
    const stored = localStorage.getItem(PREF_KEY)
    if (!stored) return defaults
    const value = JSON.parse(stored) as Partial<Preferences>
    return {
      language: value.language === 'en' ? 'en' : 'es',
      autocomplete: value.autocomplete !== false,
      commandLanguage: value.commandLanguage === 'en' ? 'en' : 'es',
      theme: value.theme === 'light' ? 'light' : 'dark',
    }
  } catch {
    return defaults
  }
}

export function savePreferences(preferences: Preferences): void {
  localStorage.setItem(PREF_KEY, JSON.stringify(preferences))
}
