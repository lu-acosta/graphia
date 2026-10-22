import { useCallback, useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import { NodeSelection } from '@tiptap/pm/state'
import { Bold, Code2, Heading1, Heading2, Italic, Link2, List, ListOrdered, Minus, Plus, Redo2, Sigma, Strikethrough, Table2, Underline as UnderlineIcon, Undo2, X, Wrench, Orbit, Circle, CircleDot, Disc3, Cylinder, Cable, Ruler, Triangle, MoveUpRight, Activity } from 'lucide-react'
import { FormulaNode } from '../math/FormulaNode'
import { DiagramNode, type ShapeKind } from './DiagramNode'

type Props = { content: string; update: (html: string) => void; suggestions: boolean; language: 'es' | 'en'; title: string; onTitleChange: (title: string) => void; onTitleCommit: () => void; onSaved?: () => void; toolsOpen: boolean; toggleTools: () => void }
const labels = {
  es: { paragraph: 'Texto normal', heading: 'Título', formula: 'Fórmula', table: 'Tabla', link: 'Añadir enlace' },
  en: { paragraph: 'Paragraph', heading: 'Heading', formula: 'Formula', table: 'Table', link: 'Add link' },
}
const commands = [
  { es: 'raíz cuadrada', en: 'square root', aliases: ['raiz', 'root'], latex: '\\sqrt{\\placeholder{}}' },
  { es: 'raíz cúbica', en: 'cube root', aliases: ['raiz cubica'], latex: '\\sqrt[3]{\\placeholder{}}' },
  { es: 'raíz enésima', en: 'nth root', aliases: ['raiz enesima'], latex: '\\sqrt[n]{\\placeholder{}}' },
  { es: 'fracción', en: 'fraction', aliases: ['fraccion'], latex: '\\frac{\\placeholder{}}{\\placeholder{}}' },
  { es: 'potencia', en: 'power', aliases: ['exponente'], latex: '\\placeholder{}^{\\placeholder{}}' },
  { es: 'integral', en: 'integral', aliases: [], latex: '\\int_{\\placeholder{}}^{\\placeholder{}}\\placeholder{}\\,dx' },
  { es: 'sumatoria', en: 'summation', aliases: ['suma'], latex: '\\sum_{i=1}^{n}\\placeholder{}' },
  { es: 'derivada', en: 'derivative', aliases: [], latex: '\\frac{d}{dx}\\placeholder{}' },
  { es: 'variación delta', en: 'delta variation', aliases: ['delta', 'variacion'], latex: '\\Delta' },
  { es: 'velocidad angular', en: 'angular velocity', aliases: ['gama', 'gamma', 'omega'], latex: '\\omega' },
  { es: 'velocidad lineal', en: 'linear velocity', aliases: ['velocidad'], latex: 'v' },
  { es: 'aceleración angular', en: 'angular acceleration', aliases: ['aceleracion angular', 'alfa'], latex: '\\alpha' },
  { es: 'aceleración lineal', en: 'linear acceleration', aliases: ['aceleracion'], latex: 'a' },
  { es: 'momento de inercia', en: 'moment of inertia', aliases: ['inercia'], latex: 'I' },
  { es: 'torque tau', en: 'torque tau', aliases: ['torque', 'tau'], latex: '\\tau' },
  { es: 'radio', en: 'radius', aliases: ['r'], latex: 'r' },
  { es: 'diámetro', en: 'diameter', aliases: ['diametro'], latex: 'd' },
  { es: 'giro antihorario', en: 'counterclockwise rotation', aliases: ['flecha curva izquierda'], latex: '\\circlearrowleft' },
  { es: 'giro horario', en: 'clockwise rotation', aliases: ['flecha curva derecha'], latex: '\\circlearrowright' },
  { es: 'infinito', en: 'infinity', aliases: [], latex: '\\infty' },
]
const symbols = ['∞', 'π', 'Σ', '∫', '√', '≤', '≥', '±', '∈', '∉']
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
const matchesCommand = (command: typeof commands[number], query: string, language: 'es' | 'en') => [command[language], command.es, command.en, ...command.aliases].some((value) => normalize(value).includes(normalize(query)))
type MathCompletionField = HTMLElement & { focus: () => void; insert: (latex: string, options?: { selectionMode?: string }) => boolean; executeCommand: (command: string) => boolean }
type MathQueryEvent = CustomEvent<{ query: string | null; field: MathCompletionField | null }>

export function ScientificEditor({ content, update, suggestions, language, title, onTitleChange, onTitleCommit, onSaved, toolsOpen, toggleTools }: Props) {
  const text = labels[language]
  const [query, setQuery] = useState<string | null>(null)
  const [mathCompletion, setMathCompletion] = useState<{ query: string; field: MathCompletionField } | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [showMathMenu, setShowMathMenu] = useState(false)
  const [commandLanguage, setCommandLanguage] = useState(language)
  useEffect(() => setCommandLanguage(language), [language])
  useEffect(() => {
    const onMathQuery = (event: Event) => {
      const { query: nextQuery, field } = (event as MathQueryEvent).detail
      setMathCompletion(nextQuery === null || !field ? null : { query: nextQuery, field })
      setSelectedSuggestion(0)
    }
    window.addEventListener('graphia:math-query', onMathQuery)
    return () => window.removeEventListener('graphia:math-query', onMathQuery)
  }, [])
  const editor = useEditor({
    extensions: [StarterKit, Underline, Link.configure({ openOnClick: false }), Image.configure({ inline: false, allowBase64: true }), Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, Placeholder.configure({ placeholder: language === 'es' ? 'Empezá a escribir…' : 'Start writing…' }), FormulaNode, DiagramNode],
    content,
    onUpdate: ({ editor: instance }) => {
      update(instance.getHTML())
      if (!suggestions) { setQuery(null); return }
      const { from } = instance.state.selection
      const before = instance.state.doc.textBetween(Math.max(0, from - 40), from, '\n')
      const match = before.match(/(?:^|\s)@([\p{L}\p{N} ]{1,28})$/u)
      const nextQuery = match ? match[1].trimStart() : null
      setQuery(nextQuery)
      setSelectedSuggestion(0)
    },
    editorProps: {
      attributes: { class: 'document-prose', spellcheck: 'false' },
      handleKeyDown: (_view, event) => {
        const completionQuery = mathCompletion?.query ?? query
        if (completionQuery === null) return false
        if (event.key === 'Escape') { setQuery(null); setMathCompletion(null); return true }
        if (available.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault()
          setSelectedSuggestion((index) => (index + (event.key === 'ArrowDown' ? 1 : available.length - 1)) % available.length)
          return true
        }
        if (event.key === 'Enter' && available[selectedSuggestion] && editor) {
          event.preventDefault()
          insertCommand(available[selectedSuggestion].latex)
          return true
        }
        return false
      },
    },
  })
  const completionQuery = mathCompletion?.query ?? query
  const available = useMemo(() => commands.filter((item) => completionQuery !== null && matchesCommand(item, completionQuery, commandLanguage)).slice(0, 6), [completionQuery, commandLanguage])
  const insertCommand = useCallback((latex: string) => {
    if (mathCompletion) {
      mathCompletion.field.focus()
      mathCompletion.field.insert(latex, { selectionMode: 'after' })
      window.requestAnimationFrame(() => {
        mathCompletion.field.focus()
        try { mathCompletion.field.executeCommand('moveToNextPlaceholder') } catch { /* Commands without editable slots stay at the insertion point. */ }
      })
      setMathCompletion(null)
      onSaved?.()
      return
    }
    if (!editor || query === null) return
    const { from, to } = editor.state.selection
    const insertionPosition = from - query.length - 1
    editor.chain().focus().insertContentAt({ from: insertionPosition, to }, { type: 'formula', attrs: { latex } }).run()
    focusInsertedFormula(editor, insertionPosition)
    setQuery(null)
    onSaved?.()
  }, [editor, mathCompletion, onSaved, query])
  useEffect(() => {
    if (!editor || editor.getHTML() === content) return
    const selection = editor.state.selection
    editor.commands.setContent(content, { emitUpdate: false })
    editor.commands.setTextSelection(Math.min(selection.from, editor.state.doc.content.size))
  }, [content, editor])
  const addFormula = useCallback((latex: string) => {
    if (!editor) return
    const insertionPosition = editor.state.selection.from
    editor.chain().focus().insertContent({ type: 'formula', attrs: { latex } }).run()
    focusInsertedFormula(editor, insertionPosition)
    setShowMathMenu(false); onSaved?.()
  }, [editor, onSaved])
  const addDiagram = useCallback((kind?: ShapeKind, angleValue = 30) => {
    if (!editor) return
    const selection = editor.state.selection
    if (selection instanceof NodeSelection && selection.node.type.name === 'scientificDiagram') {
      const data = selection.node.attrs.data as { shapes: Array<{id:string;kind:ShapeKind;x:number;y:number;text:string;angle:number}>; graph?: {expression:string} }
      const textByKind: Partial<Record<ShapeKind,string>> = { block:'m', arrow:'F', pulley:'m', disk:'I', sphere:'m', ring:'R', cylinder:'m', rod:'L', lever:'τ', incline:'θ', spring:'k', rotation:'ω', radius:'r', diameter:'d' }
      const index = (data.shapes ?? []).length
      const shapes = kind ? [...(data.shapes ?? []), { id: crypto.randomUUID(), kind, x: 104 + (index % 4) * 92, y: 72 + (Math.floor(index / 4) % 2) * 88, text: textByKind[kind] ?? '', angle: kind === 'arrow' ? -90 : 0, ...(kind === 'incline' ? { angleValue } : {}) }] : data.shapes ?? []
      editor.commands.updateAttributes('scientificDiagram', { data: { ...data, shapes } }); editor.commands.focus(); return
    }
    const textByKind: Partial<Record<ShapeKind,string>> = { block:'m', arrow:'F', pulley:'m', disk:'I', sphere:'m', ring:'R', cylinder:'m', rod:'L', lever:'τ', incline:'θ', spring:'k', rotation:'ω', radius:'r', diameter:'d' }
    const shapes = kind ? [{ id: crypto.randomUUID(), kind, x: 210, y: 112, text: textByKind[kind] ?? '', angle: kind === 'arrow' ? -90 : 0, ...(kind === 'incline' ? { angleValue } : {}) }] : []
    editor.chain().focus().insertContent({ type: 'scientificDiagram', attrs: { data: { shapes } } }).run()
  }, [editor])
  const insertGraph = useCallback((expression: string) => {
    if (!editor || !expression.trim()) return
    editor.chain().focus().insertContent({ type: 'scientificDiagram', attrs: { data: { shapes: [], graph: { expression: expression.trim() } } } }).run()
  }, [editor])
  const addTable = useCallback(() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), [editor])
  const addLink = useCallback(() => {
    if (!editor) return
    const current = editor.getAttributes('link').href as string | undefined
    const url = window.prompt(text.link, current ?? 'https://')
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else if (/^https?:\/\//i.test(url)) editor.chain().focus().setLink({ href: url }).run()
  }, [editor, text.link])
  const setImage = useCallback(() => {
    if (!editor) return
    const picker = document.createElement('input')
    picker.type = 'file'; picker.accept = 'image/*'
    picker.onchange = () => {
      const file = picker.files?.[0]
      if (!file) return
      if (file.size > 3_000_000) { window.alert(language === 'es' ? 'La imagen debe pesar menos de 3 MB.' : 'Image must be under 3 MB.'); return }
      const reader = new FileReader()
      reader.onload = () => editor.chain().focus().setImage({ src: String(reader.result), alt: file.name }).run()
      reader.readAsDataURL(file)
    }
    picker.click()
  }, [editor, language])

  if (!editor) return <div className="editor-loading" />
  return (
    <div className={`editor-shell editor-layout${toolsOpen ? ' tools-open' : ''}`}>
      <section className="editor-main-column">
        <div className="document-title-row"><div className="document-heading"><input aria-label={language === 'es' ? 'Título del documento' : 'Document title'} value={title} onChange={(event) => onTitleChange(event.target.value)} onBlur={onTitleCommit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /><span>{language === 'es' ? 'Todos los cambios guardados' : 'All changes saved'}</span></div></div>
        <div className="toolbar bottom-toolbar" role="toolbar" aria-label={language === 'es' ? 'Formato del documento' : 'Document formatting'}>
          <div className="toolbar-group"><button className="tool-icon" aria-label="Undo" title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 /></button><button className="tool-icon" aria-label="Redo" title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 /></button></div>
          <span className="toolbar-divider" />
          <label className="style-select"><span className="sr-only">Text style</span><select defaultValue="paragraph" onChange={(event) => { if (event.target.value === 'heading') editor.chain().focus().toggleHeading({ level: 1 }).run(); else if (event.target.value === 'subheading') editor.chain().focus().toggleHeading({ level: 2 }).run(); else editor.chain().focus().setParagraph().run() }}><option value="paragraph">{text.paragraph}</option><option value="heading">{text.heading}</option><option value="subheading">{language === 'es' ? 'Subtítulo' : 'Subheading'}</option></select></label>
          <div className="toolbar-group"><button className={`tool-icon ${editor.isActive('bold') ? 'is-active' : ''}`} aria-label="Bold" title="Bold (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></button><button className={`tool-icon ${editor.isActive('italic') ? 'is-active' : ''}`} aria-label="Italic" title="Italic (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></button><button className={`tool-icon ${editor.isActive('underline') ? 'is-active' : ''}`} aria-label="Underline" title="Underline (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon /></button><button className={`tool-icon ${editor.isActive('strike') ? 'is-active' : ''}`} aria-label="Strikethrough" title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></button></div>
          <span className="toolbar-divider" />
          <div className="toolbar-group"><button className={`tool-icon ${editor.isActive('bulletList') ? 'is-active' : ''}`} aria-label="Bulleted list" title="Bulleted list" onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></button><button className={`tool-icon ${editor.isActive('orderedList') ? 'is-active' : ''}`} aria-label="Numbered list" title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></button></div>
          <span className="toolbar-divider" />
          <div className="toolbar-group"><div className="math-menu-anchor"><button className={`tool-icon ${showMathMenu ? 'is-active' : ''}`} aria-label={language === 'es' ? 'Insertar matemática' : 'Insert math'} title={language === 'es' ? 'Insertar matemática' : 'Insert math'} aria-expanded={showMathMenu} onClick={() => setShowMathMenu(!showMathMenu)}><Sigma /></button>{showMathMenu && <div className="math-insert-menu"><div className="math-menu-head"><strong>{language === 'es' ? 'Insertar matemática' : 'Insert math'}</strong><button aria-label="Close" onClick={() => setShowMathMenu(false)}><X /></button></div><div className="math-command-grid">{commands.map((item) => <button key={item.es} onClick={() => addFormula(item.latex)}><span>{item.latex.includes('sqrt') ? '√' : item.latex.includes('frac') ? 'a⁄b' : item.latex.includes('int') ? '∫' : item.latex.includes('sum') ? 'Σ' : item[commandLanguage]}</span>{item[commandLanguage]}</button>)}</div><div className="math-symbol-grid">{symbols.map((symbol) => <button key={symbol} title={`${language === 'es' ? 'Insertar' : 'Insert'} ${symbol}`} onClick={() => addFormula(symbol)}>{symbol}</button>)}</div></div>}</div><button className="tool-icon" aria-label="Insert table" title={language === 'es' ? 'Insertar tabla' : 'Insert table'} onClick={addTable}><Table2 /></button><button className="tool-icon" aria-label="Insert link" title={text.link} onClick={addLink}><Link2 /></button><button className="tool-icon" aria-label="Insert diagram" title={language === 'es' ? 'Insertar diagrama' : 'Insert diagram'} onClick={() => addDiagram()}><Code2 /></button><button className="tool-icon" aria-label="Insert image" title={language === 'es' ? 'Insertar imagen' : 'Insert image'} onClick={setImage}><Plus /></button></div>
          <span className="toolbar-divider optional-divider" />
          <div className="toolbar-group optional-tools"><button className="tool-icon" aria-label="Heading 1" title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 /></button><button className="tool-icon" aria-label="Heading 2" title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></button><button className="tool-icon" aria-label="Horizontal rule" title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus /></button></div>
        </div>
        <div className="paper-scroll"><div className="paper" onClick={(event) => { if (!(event.target as HTMLElement).closest('.document-prose')) editor.commands.focus('end') }}><div className="paper-inner"><EditorContent editor={editor} />
          {completionQuery !== null && available.length > 0 && <div className="suggestion-menu" role="listbox" aria-label={language === 'es' ? 'Sugerencias matemáticas' : 'Math suggestions'} style={mathCompletion ? (() => { const rect = mathCompletion.field.getBoundingClientRect(); return { position: 'fixed' as const, top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 230)), left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)) } })() : undefined}>{available.map((item, index) => <button key={item.es} role="option" aria-selected={index === selectedSuggestion} onMouseDown={(event) => { event.preventDefault(); insertCommand(item.latex) }}><span className="suggestion-glyph">{item.latex.includes('sqrt') ? '√' : item.latex.includes('sum') ? 'Σ' : '∑'}</span><span>{item[commandLanguage]}</span><kbd>↵</kbd></button>)}</div>}
        </div></div></div>
      </section>
      {toolsOpen && <ToolsPanel language={language} addDiagram={addDiagram} insertGraph={insertGraph} close={toggleTools} />}
    </div>
  )
}

const physicsTools: { kind: ShapeKind; es: string; en: string; icon: typeof Circle }[] = [
  {kind:'pulley',es:'Polea',en:'Pulley',icon:CircleDot},{kind:'disk',es:'Disco',en:'Disk',icon:Disc3},{kind:'sphere',es:'Esfera',en:'Sphere',icon:Circle},{kind:'ring',es:'Aro',en:'Ring',icon:CircleDot},{kind:'cylinder',es:'Cilindro',en:'Cylinder',icon:Cylinder},{kind:'rope',es:'Cuerda',en:'Rope',icon:Cable},{kind:'rod',es:'Barra',en:'Rod',icon:Minus},{kind:'support',es:'Apoyo',en:'Support',icon:Triangle},{kind:'lever',es:'Palanca',en:'Lever',icon:MoveUpRight},{kind:'incline',es:'Plano inclinado',en:'Incline',icon:Triangle},{kind:'spring',es:'Resorte',en:'Spring',icon:Activity},{kind:'block',es:'Bloque',en:'Block',icon:MoveUpRight},{kind:'arrow',es:'Vector',en:'Vector',icon:MoveUpRight},{kind:'rotation',es:'Sentido de giro',en:'Rotation',icon:Orbit},{kind:'radius',es:'Radio',en:'Radius',icon:Ruler},{kind:'diameter',es:'Diámetro',en:'Diameter',icon:Ruler},
]
function ToolsPanel({ language, addDiagram, insertGraph, close }: {language:'es'|'en';addDiagram:(kind?:ShapeKind,angleValue?:number)=>void;insertGraph:(expression:string)=>void;close:()=>void}) {
  const [expression,setExpression] = useState('sin(x)')
  const [angle,setAngle] = useState(30)
  const es=language==='es'
  return <aside className="tools-panel">
    <header><div><Wrench size={16}/><strong>{es?'Herramientas':'Tools'}</strong></div><button aria-label={es?'Cerrar herramientas':'Close tools'} onClick={close}><X size={16}/></button></header>
    <section className="tools-section"><h3>{es?'Funciones matemáticas':'Mathematical functions'}</h3><label className="function-input"><span>f(x) =</span><input value={expression} onChange={e=>setExpression(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')insertGraph(expression)}} placeholder="x^2"/><button onClick={()=>insertGraph(expression)}><Activity size={15}/>{es?'Graficar':'Graph'}</button></label><p className="tools-hint">{es?'Usá x, + − × / ^ y sin, cos, tan, sqrt, log.':'Use x, + − × / ^ and sin, cos, tan, sqrt, log.'}</p></section>
    <section className="tools-section"><h3>{es?'Física':'Physics'}</h3><div className="physics-grid">{physicsTools.map(item=><button key={item.kind} onClick={()=>addDiagram(item.kind)}><item.icon size={15}/><span>{es?item.es:item.en}</span></button>)}</div><label className="angle-control">{es?'Ángulo del plano':'Surface angle'} <input type="range" min="5" max="85" value={angle} onChange={e=>setAngle(+e.target.value)}/><span>{angle}°</span></label><button className="incline-insert" onClick={()=>addDiagram('incline',angle)}>{es?'Insertar plano con ángulo':'Insert angled plane'} {angle}°</button></section>
    <section className="tools-section"><h3>{es?'Diagrama':'Diagram'}</h3><p className="tools-hint">{es?'Seleccioná un objeto para agregarlo al diagrama seleccionado. Los vectores se ajustan a los nodos magnéticos.':'Add objects to the selected diagram. Vectors snap to magnetic anchor points.'}</p><button className="new-diagram-tool" onClick={()=>addDiagram(undefined)}>{es?'Nuevo diagrama físico':'New physics diagram'}</button></section>
  </aside>
}

function focusInsertedFormula(editor: NonNullable<ReturnType<typeof useEditor>>, position: number) {
  window.requestAnimationFrame(() => {
    const node = editor.view.nodeDOM(position) as HTMLElement | null
    const mathfield = node?.querySelector('math-field') as (HTMLElement & { executeCommand?: (command: string) => boolean }) | null
    mathfield?.focus()
    try { mathfield?.executeCommand?.('moveToNextPlaceholder') } catch { /* The formula stays editable if a command has no placeholder. */ }
  })
}

