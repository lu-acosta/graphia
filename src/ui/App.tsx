import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownUp, ArrowLeft, ArrowUpRight, Check, ChevronDown, Clock3, Command, Copy, FilePlus2, FileText, Globe2, Grid2X2, HelpCircle, Home, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Pin, Search, Settings2, Sigma, Sparkles, Star, Trash2, Upload, X, Wrench } from 'lucide-react'
import katex from 'katex'
import { type Doc, type Preferences, blankDocument, deleteDocument, getDocuments, loadPreferences, saveDocument, savePreferences } from '../model'
import { ScientificEditor } from '../editor/ScientificEditor'
import { diagramSvg, type CanvasData } from '../editor/DiagramNode'

type View = 'home' | 'all' | 'recent' | 'favorites' | 'trash' | 'settings'
const copy = {
  es: { home: 'Inicio', all: 'Todos los documentos', recent: 'Recientes', favorites: 'Favoritos', trash: 'Papelera', settings: 'Configuración', work: 'ESPACIO DE TRABAJO', library: 'BIBLIOTECA', new: 'Nuevo documento', search: 'Buscar documentos…', greeting: 'Un espacio para pensar', sub: 'Tus ideas merecen espacio para desarrollarse.', welcome: 'Volvé a tu hilo de pensamiento.', recentDocs: 'Seguiste trabajando en esto', seeAll: 'Ver todo', untitled: 'Documento sin título', updated: 'Actualizado', empty: 'Todavía no hay documentos', emptyHint: 'Empezá con una idea. El resto toma forma en el camino.', createFirst: 'Crear tu primer documento', saved: 'Todos los cambios guardados', saving: 'Guardando cambios…', failed: 'No se pudo guardar', settingsTitle: 'Preferencias', general: 'General', writing: 'Escritura', language: 'Idioma de la interfaz', commandLang: 'Idioma de los comandos matemáticos', completion: 'Sugerencias matemáticas', completionHint: 'Ofrece comandos después de escribir @ en el documento.', appearance: 'Apariencia', dark: 'Noche de Graphia', light: 'Día de Graphia', commands: 'Todas las ecuaciones comienzan con @', cmdHint: 'Escribí @ seguido de raíz, fracción, potencia o integral.', searchEmpty: 'No encontramos documentos con ese nombre.', today: 'HOY', noRecent: 'Todavía no hay actividad reciente.', restore: 'Restaurar', moveTrash: 'Mover a papelera', permanentlyDelete: 'Eliminar para siempre', lastEdited: 'Editado', untitledPlaceholder: 'Sin título', back: 'Volver a documentos', diagramTitle: 'Diagrama científico', export: 'Exportar PDF', import: 'Importar documento', emptyTrash: 'Vaciar papelera' },
  en: { home: 'Home', all: 'All documents', recent: 'Recent', favorites: 'Favorites', trash: 'Trash', settings: 'Settings', work: 'WORKSPACE', library: 'LIBRARY', new: 'New document', search: 'Search documents…', greeting: 'A space to think', sub: 'Your ideas deserve room to unfold.', welcome: 'Pick up where your thinking left off.', recentDocs: 'You were working on this', seeAll: 'See all', untitled: 'Untitled document', updated: 'Updated', empty: 'No documents yet', emptyHint: 'Begin with an idea. The rest takes shape along the way.', createFirst: 'Create your first document', saved: 'All changes saved', saving: 'Saving changes…', failed: 'Could not save', settingsTitle: 'Preferences', general: 'General', writing: 'Writing', language: 'Interface language', commandLang: 'Mathematical command language', completion: 'Math suggestions', completionHint: 'Offer commands after typing @ in the document.', appearance: 'Appearance', dark: 'Graphia night', light: 'Graphia day', commands: 'Every equation begins with @', cmdHint: 'Type @ followed by root, fraction, power, or integral.', searchEmpty: 'No documents found with that name.', today: 'TODAY', noRecent: 'No recent activity yet.', restore: 'Restore', moveTrash: 'Move to trash', permanentlyDelete: 'Delete permanently', lastEdited: 'Edited', untitledPlaceholder: 'Untitled', back: 'Back to documents', diagramTitle: 'Scientific diagram', export: 'Export PDF', import: 'Import document', emptyTrash: 'Empty trash' },
}
const navigation: { id: View; icon: typeof Home }[] = [{ id: 'home', icon: Home }, { id: 'all', icon: Grid2X2 }, { id: 'recent', icon: Clock3 }, { id: 'favorites', icon: Star }, { id: 'trash', icon: Trash2 }]
const formatDate = (timestamp: number, language: 'es' | 'en') => new Intl.DateTimeFormat(language === 'es' ? 'es-UY' : 'en-US', { month: 'short', day: 'numeric' }).format(timestamp)

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences)
  const [documents, setDocuments] = useState<Doc[]>([])
  const [currentId, setCurrentId] = useState<string | null>(() => new URLSearchParams(window.location.hash.slice(1)).get('document'))
  const [view, setView] = useState<View>('home')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [sortByName, setSortByName] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [showPalette, setShowPalette] = useState(false)
  const [exportNotice, setExportNotice] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [importError, setImportError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const t = copy[preferences.language]
  const current = documents.find((document) => document.id === currentId) ?? null

  const refresh = useCallback(async () => {
    try { setDocuments(await getDocuments()) }
    catch (error) { console.error('Graphia storage unavailable', error); setSaveState('error') }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const syncDocumentFromHash = () => {
      const id = new URLSearchParams(window.location.hash.slice(1)).get('document')
      setCurrentId(id)
      if (id) setView('all')
    }
    window.addEventListener('hashchange', syncDocumentFromHash)
    return () => window.removeEventListener('hashchange', syncDocumentFromHash)
  }, [])
  useEffect(() => { savePreferences(preferences); document.documentElement.dataset.theme = preferences.theme }, [preferences])
  useEffect(() => {
    const close = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuId(null) }
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); void createNew() }
      if (event.key === 'Escape') { setMenuId(null); setShowPalette(false) }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); setShowPalette(true) }
    }
    window.addEventListener('mousedown', close); window.addEventListener('keydown', shortcut)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', shortcut) }
  })

  const createNew = useCallback(async () => {
    const doc = blankDocument(preferences.language === 'es' ? 'Notas sin título' : 'Untitled notes')
    try { await saveDocument(doc); await refresh(); setCurrentId(doc.id); setView('all') }
    catch { setSaveState('error') }
  }, [preferences.language, refresh])
  const patchDocument = useCallback((id: string, patch: Partial<Doc>) => setDocuments((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item)), [])
  const saveDoc = useCallback(async (doc: Doc) => {
    setSaveState('saving')
    try { await saveDocument({ ...doc, updatedAt: Date.now() }); setSaveState('saved') }
    catch { setSaveState('error') }
  }, [])
  const updateContent = useCallback((id: string, content: string) => {
    const preview = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140)
    const next = documents.find((item) => item.id === id)
    if (!next) return
    const doc = { ...next, content, preview, updatedAt: Date.now() }
    patchDocument(id, doc); setSaveState('saving')
    window.clearTimeout((updateContent as typeof updateContent & { timer?: number }).timer)
    ;(updateContent as typeof updateContent & { timer?: number }).timer = window.setTimeout(() => { void saveDoc(doc) }, 550)
  }, [documents, patchDocument, saveDoc])
  const rename = useCallback((id: string, title: string) => {
    const doc = documents.find((item) => item.id === id)
    if (!doc) return
    const next = { ...doc, title: title.trim() || t.untitledPlaceholder, updatedAt: Date.now() }
    patchDocument(id, next); void saveDoc(next)
  }, [documents, patchDocument, saveDoc, t.untitledPlaceholder])
  const openDoc = (id: string) => { window.location.hash = `document=${encodeURIComponent(id)}`; setCurrentId(id); setView('all'); setQuery('') }
  const closeDoc = () => { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`); setCurrentId(null); setView('all') }
  const moveToTrash = async (doc: Doc) => { const next = { ...doc, trashed: true, updatedAt: Date.now() }; patchDocument(doc.id, next); await saveDoc(next); setMenuId(null) }
  const restoreDoc = async (doc: Doc) => { const next = { ...doc, trashed: false, updatedAt: Date.now() }; patchDocument(doc.id, next); await saveDoc(next); setMenuId(null) }
  const toggleFavorite = async (doc: Doc) => { const next = { ...doc, favorite: !doc.favorite, updatedAt: Date.now() }; patchDocument(doc.id, next); await saveDoc(next); setMenuId(null) }
  const duplicateDoc = async (doc: Doc) => { const next = { ...doc, id: crypto.randomUUID(), title: `${doc.title} ${preferences.language === 'es' ? '(copia)' : '(copy)'}`, createdAt: Date.now(), updatedAt: Date.now(), favorite: false, trashed: false }; await saveDoc(next); await refresh(); setMenuId(null) }
  const removePermanently = async (doc: Doc) => { await deleteDocument(doc.id); setDocuments((items) => items.filter((item) => item.id !== doc.id)); setMenuId(null) }

  const filtered = useMemo(() => {
    let list = documents.filter((doc) => view === 'trash' ? doc.trashed : !doc.trashed)
    if (view === 'favorites') list = list.filter((doc) => doc.favorite)
    if (view === 'recent') list = list.slice(0, 8)
    if (query.trim()) list = list.filter((doc) => `${doc.title} ${doc.preview ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    return list.sort((a, b) => sortByName ? a.title.localeCompare(b.title, preferences.language) : b.updatedAt - a.updatedAt)
  }, [documents, preferences.language, query, sortByName, view])
  const exportDoc = (doc: Doc) => {
    const exportWindow = window.open('', '_blank')
    if (!exportWindow) { window.alert(preferences.language === 'es' ? 'Permití las ventanas emergentes para guardar como PDF.' : 'Allow pop-ups to save as PDF.'); return }
    const safeTitle = doc.title.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
    const parsedContent = new DOMParser().parseFromString(doc.content, 'text/html')
    parsedContent.querySelectorAll('[data-formula]').forEach((formula) => {
      const rendered = parsedContent.createElement('span')
      rendered.className = 'print-formula'
      rendered.innerHTML = katex.renderToString((formula.getAttribute('data-latex') ?? '').replace(/\\placeholder\{\}/g, '\\square'), { throwOnError: false, output: 'mathml' })
      formula.replaceWith(rendered)
    })
    parsedContent.querySelectorAll('[data-scientific-diagram]').forEach((diagram) => {
      let data: CanvasData = { shapes: [] }
      try { data = JSON.parse(diagram.getAttribute('data-diagram') ?? '{"shapes":[]}') as CanvasData } catch { /* Keep an empty printable canvas for malformed legacy nodes. */ }
      const printable = parsedContent.createElement('div')
      printable.className = 'print-diagram'
      printable.innerHTML = diagramSvg(data)
      diagram.replaceWith(printable)
    })
    exportWindow.document.write(`<!doctype html><html lang="${preferences.language}"><head><meta charset="utf-8"><title>${safeTitle}</title><style>@page{size:A4;margin:22mm}*{box-sizing:border-box}body{margin:0;color:#101828;font:12pt/1.65 Arial,sans-serif}h1,h2,h3{line-height:1.25}img{max-width:100%;height:auto}table{width:100%;border-collapse:collapse}td,th{border:1px solid #98a2b3;padding:7px}math{font-size:1.1em}.print-diagram{max-width:100%;margin:18px 0;break-inside:avoid}.print-diagram svg{display:block;width:100%;height:auto;border:1px solid #d0d5dd}</style></head><body>${parsedContent.body.innerHTML}</body></html>`)
    exportWindow.document.close()
    exportWindow.onafterprint = () => exportWindow.close()
    setMenuId(null); setExportNotice(true); window.setTimeout(() => { setExportNotice(false); exportWindow.focus(); exportWindow.print() }, 950)
  }
  const importDoc = async (file: File) => {
    setImportError('')
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Doc>
      if (typeof parsed.title !== 'string' || typeof parsed.content !== 'string') throw new Error('invalid')
      const now = Date.now(); const doc: Doc = { id: crypto.randomUUID(), title: parsed.title, content: parsed.content, preview: parsed.preview ?? '', favorite: false, createdAt: now, updatedAt: now }
      await saveDocument(doc); await refresh(); openDoc(doc.id)
    } catch { setImportError(preferences.language === 'es' ? 'El archivo no es un documento Graphia válido.' : 'This is not a valid Graphia document.') }
  }

  return <div className="app-frame">
    <aside className={`sidebar${sidebarCollapsed ? ' is-collapsed' : ''}`}>
      <div className="brand-row"><button className="brand-mark" aria-label={sidebarCollapsed ? (preferences.language === 'es' ? 'Abrir panel lateral' : 'Open sidebar') : (preferences.language === 'es' ? 'Contraer panel lateral' : 'Collapse sidebar')} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 21 12 13l5 5 8-12" /><circle cx="25" cy="6" r="2.5" /></svg></button><span className="brand-name">Graphia</span><button className="sidebar-toggle" aria-label={sidebarCollapsed ? (preferences.language === 'es' ? 'Abrir panel lateral' : 'Open sidebar') : (preferences.language === 'es' ? 'Contraer panel lateral' : 'Collapse sidebar')} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button></div>
      <button className="new-document" onClick={() => void createNew()}><FilePlus2 /><span>{t.new}</span><kbd>⌘ N</kbd></button>
      <div className="sidebar-group-label">{t.work}</div><nav className="side-nav">{navigation.slice(0, 1).map(({ id, icon: Icon }) => <button key={id} className={`nav-item${view === id ? ' selected' : ''}`} onClick={() => { setView(id); setCurrentId(null) }}><span className="active-rail" /><Icon /><span>{t[id]}</span></button>)}</nav>
      <div className="sidebar-group-label library-label">{t.library}<button title={t.new} onClick={() => void createNew()}><PlusGlyph /></button></div><nav className="side-nav">{navigation.slice(1).map(({ id, icon: Icon }) => <button key={id} className={`nav-item${view === id ? ' selected' : ''}`} onClick={() => { setView(id); setCurrentId(null) }}><span className="active-rail" /><Icon /><span>{t[id]}</span>{id === 'all' && <span className="nav-count">{documents.filter((doc) => !doc.trashed).length}</span>}</button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-note"><div className="note-orbit"><span /><span /><span /></div><div><strong>{t.commands}</strong><p>{t.cmdHint}</p></div></div>
      <div className="sidebar-bottom"><button className={`nav-item${view === 'settings' ? ' selected' : ''}`} onClick={() => { setView('settings'); setCurrentId(null) }}><span className="active-rail" /><Settings2 /><span>{t.settings}</span></button></div>
    </aside>

    <main className="main-pane">
      {current ? <>
        <header className="topbar editor-topbar"><div className="topbar-left"><button className={`tools-toggle${toolsOpen?' is-active':''}`} aria-label={preferences.language === 'es' ? 'Herramientas' : 'Tools'} aria-expanded={toolsOpen} onClick={() => setToolsOpen(!toolsOpen)}><Wrench size={16}/><span>{preferences.language === 'es'?'Herramientas':'Tools'}</span></button><button className="back-button" onClick={closeDoc} aria-label={t.back}><ArrowLeft /></button><span className="crumb-divider" /><span className="topbar-brand-crumb">{current.title || t.untitled}</span><span className={`save-indicator ${saveState}`} title={saveState === 'saved' ? t.saved : saveState === 'saving' ? t.saving : t.failed}><SaveMark state={saveState} /><span>{saveState === 'saved' ? (preferences.language === 'es' ? 'Guardado' : 'Saved') : saveState === 'saving' ? (preferences.language === 'es' ? 'Guardando' : 'Saving') : (preferences.language === 'es' ? 'Error' : 'Error')}</span></span></div><div className="topbar-right"><button className="share-button" onClick={() => exportDoc(current)}><Upload /><span>{preferences.language === 'es' ? 'Exportar PDF' : 'Export PDF'}</span></button></div></header>
        <div className="document-stage"><ScientificEditor key={current.id} title={current.title} onTitleChange={(title) => patchDocument(current.id, { title })} onTitleCommit={() => rename(current.id, current.title)} content={current.content} update={(content) => updateContent(current.id, content)} suggestions={preferences.autocomplete} language={preferences.language} toolsOpen={toolsOpen} toggleTools={() => setToolsOpen(!toolsOpen)} /><div className="stage-status"><span><span className="stage-dot" />{preferences.language === 'es' ? 'GUARDADO LOCALMENTE' : 'SAVED LOCALLY'}</span><span>{preferences.language === 'es' ? 'TODOS LOS CAMBIOS SE GUARDAN EN ESTE DISPOSITIVO' : 'ALL CHANGES SAVED ON THIS DEVICE'}</span><span>100%</span></div></div>
      </> : <>
        <header className="topbar library-topbar"><button className="sidebar-reopen" aria-label={preferences.language === 'es' ? 'Abrir/cerrar panel lateral' : 'Toggle sidebar'} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}><PanelLeftOpen /></button><div className="topbar-right"><button className="topbar-help" title="Keyboard shortcuts" onClick={() => setShowPalette(true)}><HelpCircle /></button></div></header>
        {view === 'settings' ? <SettingsView preferences={preferences} setPreferences={setPreferences} t={t} /> : <div className="library-page">
          <section className="page-heading"><div><div className="overline"><span className="overline-mark" />{view === 'home' ? 'THINKING SPACE / 01' : `${t.library} / ${view.toUpperCase()}`}</div><h1>{view === 'home' ? <>{t.greeting}<span className="heading-period">.</span></> : t[view]}</h1><p>{view === 'home' ? t.sub : view === 'recent' ? t.welcome : view === 'trash' ? (preferences.language === 'es' ? 'Los documentos eliminados se conservan aquí hasta que decidas.' : 'Deleted documents stay here until you decide.') : view === 'favorites' ? (preferences.language === 'es' ? 'Tus ideas a las que querés volver.' : 'Ideas you want to return to.') : (preferences.language === 'es' ? 'Un registro de todo lo que estás desarrollando.' : 'A record of everything you are developing.')}</p></div><button className="primary-cta" onClick={() => void createNew()}><FilePlus2 /><span>{t.new}</span><kbd>⌘ N</kbd></button></section>
          <div className="library-controls"><div className="search-field"><Search /><input id="document-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} /><kbd>⌘ K</kbd></div><button className="sort-control" onClick={() => setSortByName((value) => !value)} title={preferences.language === 'es' ? 'Cambiar orden' : 'Change sort order'}><ArrowDownUp /><span>{sortByName ? (preferences.language === 'es' ? 'Nombre' : 'Name') : (preferences.language === 'es' ? 'Última edición' : 'Last edited')}</span><ChevronDown /></button><span className="result-count">{filtered.length.toString().padStart(2, '0')} <span>{preferences.language === 'es' ? 'DOCUMENTOS' : 'DOCUMENTS'}</span></span></div>
          {view === 'home' && <>
            <div className="section-caption"><span>{t.today}</span><span className="caption-rule" /></div>
            {documents.filter((doc) => !doc.trashed).length === 0 ? <EmptyState t={t} create={() => void createNew()} /> : <>
              <button className="continue-card" onClick={() => openDoc(documents.find((doc) => !doc.trashed)!.id)}><div className="continue-art"><div className="art-orbit art-a"/><div className="art-orbit art-b"/><div className="art-grid"/><span className="art-core">∫</span><span className="art-coord">x² + y²</span></div><div className="continue-info"><div className="continue-label"><span className="continue-dot" />{t.recentDocs}</div><strong>{documents.find((doc) => !doc.trashed)?.title}</strong><p>{documents.find((doc) => !doc.trashed)?.preview || (preferences.language === 'es' ? 'Seguí desarrollando tus notas científicas.' : 'Continue developing your scientific notes.')}</p><span className="continue-date"><Clock3 />{t.lastEdited} {formatDate(documents.find((doc) => !doc.trashed)!.updatedAt, preferences.language)}</span></div><span className="continue-arrow"><ArrowUpRight /></span></button>
              <div className="subsection-heading"><h2>{preferences.language === 'es' ? 'Tus documentos recientes' : 'Your recent documents'}</h2><button onClick={() => { setView('all'); setCurrentId(null) }}>{t.seeAll}<ArrowUpRight /></button></div><DocumentGrid documents={documents.filter((doc) => !doc.trashed).slice(0, 4)} language={preferences.language} t={t} open={openDoc} menuId={menuId} setMenuId={setMenuId} menuRef={menuRef} favorite={toggleFavorite} duplicate={duplicateDoc} trash={moveToTrash} restore={restoreDoc} exportDoc={exportDoc} remove={removePermanently} />
            </>}
          </>}
          {view !== 'home' && <>{importError && <div className="import-error" role="alert">{importError}<button onClick={() => setImportError('')} aria-label="Dismiss"><X /></button></div>}{filtered.length > 0 ? <DocumentGrid documents={filtered} language={preferences.language} t={t} open={openDoc} menuId={menuId} setMenuId={setMenuId} menuRef={menuRef} favorite={toggleFavorite} duplicate={duplicateDoc} trash={moveToTrash} restore={restoreDoc} exportDoc={exportDoc} remove={removePermanently} /> : <EmptyState t={t} create={() => void createNew()} searching={Boolean(query)} onImport={importDoc} />}{view === 'trash' && filtered.length > 0 && <button className="empty-trash" onClick={async () => { await Promise.all(filtered.map((doc) => deleteDocument(doc.id))); setDocuments((items) => items.filter((doc) => !doc.trashed)) }}><Trash2 />{t.emptyTrash}</button>}</>}
          <footer className="library-footer"><span>GRAPHIA <span>·</span> VERSION 0.1</span><div><span>LOCAL BY DESIGN</span><span className="footer-separator"/><span>{preferences.language === 'es' ? 'TUS IDEAS, BAJO TU CONTROL' : 'YOUR IDEAS, YOURS TO KEEP'}</span></div></footer>
        </div>}
      </>}
    </main>
    {showPalette && <div className="palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPalette(false) }}><div className="command-palette" role="dialog" aria-modal="true" aria-label="Quick actions"><div className="palette-search"><Command /><input autoFocus placeholder={preferences.language === 'es' ? 'Buscar una acción…' : 'Search for an action…'} /><kbd>ESC</kbd></div><div className="palette-section">{preferences.language === 'es' ? 'ACCIONES RÁPIDAS' : 'QUICK ACTIONS'}</div><button onClick={() => { setShowPalette(false); void createNew() }}><FilePlus2 /><span>{t.new}<small>⌘ N</small></span></button><button onClick={() => { setShowPalette(false); document.getElementById('document-search')?.focus() }}><Search /><span>{t.search}<small>⌘ K</small></span></button><button onClick={() => { setShowPalette(false); setView('settings'); setCurrentId(null) }}><Settings2 /><span>{t.settings}</span></button><div className="palette-hint"><span>↑ ↓ {preferences.language === 'es' ? 'navegar' : 'navigate'}</span><span>↵ {preferences.language === 'es' ? 'seleccionar' : 'select'}</span><span>esc {preferences.language === 'es' ? 'cerrar' : 'close'}</span></div></div></div>}
    {exportNotice && <div className="export-backdrop" role="status" aria-live="polite"><div className="export-dialog"><FaceIdSaveAnimation /><span className="export-saving-text">{preferences.language === 'es' ? 'Guardando…' : 'Saving…'}</span></div></div>}
  </div>
}

function PlusGlyph() { return <span className="plus-glyph">+</span> }
function SaveMark({ state }: { state: 'saved' | 'saving' | 'error' }) { return <span className={`save-mark ${state}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path className="floppy-outline" d="M4 3h13l4 4v14H4z"/><path className="floppy-cut" d="M8 3v6h9V3M8 21v-7h9v7"/><path className="checkmark" d="m6.5 12.5 3.1 3.1L17.8 8"/><path className="error-mark" d="m8 8 8 8m0-8-8 8"/></svg></span> }
function FaceIdSaveAnimation() { return <svg className="face-id-save" viewBox="0 0 100 100" aria-hidden="true"><path className="face-scan-ring" d="M50 5a45 45 0 1 1-31.82 13.18"/><path className="face-corner" d="M32 23h-8a6 6 0 0 0-6 6v8m50-14h8a6 6 0 0 1 6 6v8M18 63v8a6 6 0 0 0 6 6h8m50-14v8a6 6 0 0 1-6 6h-8"/><circle className="face-eye" cx="37" cy="43" r="2.5"/><circle className="face-eye" cx="63" cy="43" r="2.5"/><path className="face-smile" d="M35 58c4.5 7 10 10 15 10s10.5-3 15-10"/></svg> }

function EmptyState({ t, create, searching = false, onImport }: { t: typeof copy.es; create: () => void; searching?: boolean; onImport?: (file: File) => void }) {
  return <div className="empty-state"><div className="empty-illustration"><div className="empty-ring ring-one"/><div className="empty-ring ring-two"/><div className="empty-file"><FileText /><span/><span/><span/></div><span className="empty-spark spark-one">✳</span><span className="empty-spark spark-two">·</span></div><h2>{searching ? t.searchEmpty : t.empty}</h2><p>{searching ? '' : t.emptyHint}</p>{!searching && <div className="empty-actions"><button className="primary-cta" onClick={create}><FilePlus2 />{t.createFirst}</button>{onImport && <label className="import-button"><Upload />{t.import}<input type="file" accept=".json,.graphia.json,application/json" onChange={(event) => event.target.files?.[0] && onImport(event.target.files[0])} /></label>}</div>}</div>
}

function DocumentGrid({ documents, language, t, open, menuId, setMenuId, menuRef, favorite, duplicate, trash, restore, exportDoc, remove }: { documents: Doc[]; language: 'es' | 'en'; t: typeof copy.es; open: (id: string) => void; menuId: string | null; setMenuId: (id: string | null) => void; menuRef: React.RefObject<HTMLDivElement | null>; favorite: (doc: Doc) => void; duplicate: (doc: Doc) => void; trash: (doc: Doc) => void; restore: (doc: Doc) => void; exportDoc: (doc: Doc) => void; remove: (doc: Doc) => void }) {
  return <div className="document-grid">{documents.map((doc, index) => <article key={doc.id} className={`document-card card-tone-${index % 4}`}><button className="document-preview" onClick={() => open(doc.id)} aria-label={`${doc.title} preview`}><div className="preview-head"><span className="preview-kicker">GRAPHIA <i>·</i> {doc.favorite ? 'SAVED NOTE' : 'WORKING NOTE'}</span><span className="preview-equation">{index % 2 ? '∫ f(x) dx' : 'Δy / Δx'}</span></div><span className="preview-title-line">{doc.title}</span><span className="preview-text-line wide"/><span className="preview-text-line"/><span className="preview-math">{index % 2 ? 'lim  x → ∞' : '√ (a² + b²)'}</span><span className="preview-foot"><span>01 <i>/ 04</i></span><span><span className="preview-foot-dot"/> SAVED</span></span></button><div className="card-meta"><button className="card-title" onClick={() => open(doc.id)}>{doc.title}</button><div className="card-meta-bottom"><span className="card-date"><Clock3 />{formatDate(doc.updatedAt, language)}</span><div className="card-actions">{doc.favorite && <Star className="favorite-indicator" fill="currentColor" />}{doc.trashed && <button className="restore-icon" title={t.restore} onClick={() => restore(doc)}><ArrowUpRight /></button>}<button className="more-button" aria-label="Document actions" onClick={(event) => { event.stopPropagation(); setMenuId(menuId === doc.id ? null : doc.id) }}><MoreHorizontal /></button>{menuId === doc.id && <div className="document-menu" ref={menuRef}>{doc.trashed ? <><button onClick={() => restore(doc)}><ArrowUpRight />{t.restore}</button><button className="danger-action" onClick={() => remove(doc)}><Trash2 />{t.permanentlyDelete}</button></> : <><button onClick={() => favorite(doc)}><Star />{doc.favorite ? (language === 'es' ? 'Quitar de favoritos' : 'Remove favorite') : t.favorites}</button><button onClick={() => open(doc.id)}><Pencil />{language === 'es' ? 'Renombrar' : 'Rename'}</button><button onClick={() => duplicate(doc)}><Copy />{language === 'es' ? 'Duplicar' : 'Duplicate'}</button><button onClick={() => exportDoc(doc)}><Upload />{t.export}</button><button className="danger-action" onClick={() => trash(doc)}><Trash2 />{t.moveTrash}</button></>}</div>}</div></div></div></article>)}</div>
}

function SettingsView({ preferences, setPreferences, t }: { preferences: Preferences; setPreferences: React.Dispatch<React.SetStateAction<Preferences>>; t: typeof copy.es }) {
  const language = preferences.language
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences((current) => ({ ...current, [key]: value }))
  return <div className="settings-page"><div className="overline"><span className="overline-mark" />GRAPHIA / PREFERENCES</div><h1>{t.settingsTitle}<span className="heading-period">.</span></h1><p className="settings-intro">{language === 'es' ? 'Ajustá tu espacio de escritura a tu manera.' : 'Make your writing space feel like yours.'}</p><div className="settings-content"><div className="settings-nav"><span>{t.general.toUpperCase()}</span><span className="settings-nav-active"><Globe2 />{t.language}</span><span><Sparkles />{t.appearance}</span><span className="settings-nav-heading">{t.writing.toUpperCase()}</span><span><Sigma />{t.completion}</span></div><div className="settings-options"><section className="setting-section"><div className="setting-section-head"><Globe2 /><div><h2>{t.general}</h2><p>{language === 'es' ? 'Idioma y preferencias generales.' : 'Language and general preferences.'}</p></div></div><div className="setting-row"><div><strong>{t.language}</strong><span>{language === 'es' ? 'El idioma de los elementos de Graphia.' : 'The language of Graphia’s interface.'}</span></div><div className="segmented-control"><button className={language === 'es' ? 'active' : ''} onClick={() => set('language', 'es')}>Español</button><button className={language === 'en' ? 'active' : ''} onClick={() => set('language', 'en')}>English</button></div></div></section><section className="setting-section"><div className="setting-section-head"><Sparkles /><div><h2>{t.appearance}</h2><p>{language === 'es' ? 'Una atmósfera que acompañe tus ideas.' : 'An atmosphere that makes space for ideas.'}</p></div></div><div className="theme-options"><button className={`theme-option dark-option${preferences.theme === 'dark' ? ' active' : ''}`} onClick={() => set('theme', 'dark')}><span className="theme-preview"><i/><i/><i/><i/></span><span><strong>{t.dark}</strong><small>#080D1B · Midnight blue</small></span>{preferences.theme === 'dark' && <Check />}</button><button className={`theme-option light-option${preferences.theme === 'light' ? ' active' : ''}`} onClick={() => set('theme', 'light')}><span className="theme-preview"><i/><i/><i/><i/></span><span><strong>{t.light}</strong><small>#F5F7FC · Soft paper</small></span>{preferences.theme === 'light' && <Check />}</button></div></section><section className="setting-section"><div className="setting-section-head"><Sigma /><div><h2>{t.writing}</h2><p>{language === 'es' ? 'Elegí cómo trabajar con expresiones.' : 'Choose how to work with expressions.'}</p></div></div><div className="setting-row"><div><strong>{t.commandLang}</strong><span>{language === 'es' ? 'Los nombres de comandos en sugerencias.' : 'Command names shown in suggestions.'}</span></div><div className="segmented-control"><button className={preferences.commandLanguage === 'es' ? 'active' : ''} onClick={() => set('commandLanguage', 'es')}>Español</button><button className={preferences.commandLanguage === 'en' ? 'active' : ''} onClick={() => set('commandLanguage', 'en')}>English</button></div></div><div className="setting-row"><div><strong>{t.completion}</strong><span>{t.completionHint}</span></div><button className={`toggle${preferences.autocomplete ? ' on' : ''}`} role="switch" aria-checked={preferences.autocomplete} aria-label={t.completion} onClick={() => set('autocomplete', !preferences.autocomplete)}><span/></button></div></section><div className="settings-foot"><span><Pin />{language === 'es' ? 'Tus preferencias se guardan en este dispositivo.' : 'Your preferences are saved on this device.'}</span><span>GRAPHIA · 0.1</span></div></div></div></div>
}
