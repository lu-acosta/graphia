import { useCallback, useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import { NodeSelection } from '@tiptap/pm/state'
import { Bold, Code2, Heading1, Heading2, Italic, Link2, List, ListOrdered, Minus, Plus, Redo2, Sigma, Strikethrough, Table2, Underline as UnderlineIcon, Undo2, X, Wrench, Circle, Square, MoveUpRight, Activity, Minus as LineIcon, Type } from 'lucide-react'
import { FormulaNode } from '../math/FormulaNode'
import { DiagramNode, graphGeometry, type ShapeKind } from './DiagramNode'
import { SignChartNode, blankSignChart } from './SignChartNode'

type Props = { content: string; update: (html: string) => void; suggestions: boolean; language: 'es' | 'en'; title: string; onTitleChange: (title: string) => void; onTitleCommit: () => void; onSaved?: () => void; saveStatus?: 'saved'|'saving'|'error'; toolsOpen: boolean; toggleTools: () => void }
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
  { es: 'no existencia', en: 'does not exist', aliases: ['no existe', 'noexistencia', 'existe no'], latex: '\\nexists' },
  { es: 'unión', en: 'union', aliases: ['union'], latex: '\\cup' },
  { es: 'conjunción', en: 'conjunction', aliases: ['conjuncion', 'y lógico'], latex: '\\land' },
  { es: 'disyunción', en: 'disjunction', aliases: ['disyuncion', 'o lógico'], latex: '\\lor' },
  { es: 'entonces', en: 'therefore', aliases: ['por lo tanto', 'implica'], latex: '\\therefore' },
  { es: 'si', en: 'if', aliases: ['implicación', 'implicacion'], latex: '\\Rightarrow' },
  { es: 'si y solo si', en: 'if and only if', aliases: ['sisi', 'bicondicional'], latex: '\\Leftrightarrow' },
  { es: 'límite', en: 'limit', aliases: ['limite', 'lim'], latex: '\\lim_{x\\to\\placeholder{}}\\placeholder{}' },
  { es: 'logaritmo', en: 'logarithm', aliases: ['log', 'ln', 'logaritmo natural'], latex: '\\log_{\\placeholder{}}\\left(\\placeholder{}\\right)' },
  { es: 'número de Euler', en: 'Euler’s number', aliases: ['euler', 'numero de euler', 'constante e'], latex: 'e' },
  { es: 'identidad de Euler', en: 'Euler’s identity', aliases: ['identidad euler'], latex: 'e^{i\\pi}+1=0' },
]
const symbols = ['∞', 'π', 'Σ', '∫', '√', '≤', '≥', '±', '∈', '∉', '∄', '∪', '∧', '∨', '∴', '⇒', '⇔']
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
const matchesCommand = (command: typeof commands[number], query: string, language: 'es' | 'en') => [command[language], command.es, command.en, ...command.aliases].some((value) => normalize(value).includes(normalize(query)))
type MathCompletionField = HTMLElement & { focus: () => void; insert: (latex: string, options?: { selectionMode?: string }) => boolean; executeCommand: (command: string) => boolean }
type MathQueryEvent = CustomEvent<{ query: string | null; field: MathCompletionField | null }>

export function ScientificEditor({ content, update, suggestions, language, title, onTitleChange, onTitleCommit, onSaved, saveStatus='saved', toolsOpen, toggleTools }: Props) {
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
    extensions: [StarterKit, Underline, Link.configure({ openOnClick: false }), Image.configure({ inline: false, allowBase64: true }), Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, Placeholder.configure({ placeholder: language === 'es' ? 'Empezá a escribir…' : 'Start writing…' }), FormulaNode, DiagramNode, SignChartNode],
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
  const addDiagram = useCallback((kind?: ShapeKind, angleValue = -90, label?: string) => {
    if (!editor) return
    const textByKind: Partial<Record<ShapeKind,string>> = { block:'Objeto', arrow:label ?? 'Fuerza', line:'', circle:'', rectangle:'Objeto', label:'Texto' }
    const createShape = (shapeKind: ShapeKind, x: number, y: number) => ({ id: crypto.randomUUID(), kind: shapeKind, x, y, text: textByKind[shapeKind] ?? '', angle: shapeKind === 'arrow' ? angleValue : 0, ...(shapeKind === 'arrow' ? { length: 78 } : {}), ...(shapeKind === 'incline' ? { angleValue } : {}) })
    const selection = editor.state.selection
    if (selection instanceof NodeSelection && selection.node.type.name === 'scientificDiagram') {
      const data = selection.node.attrs.data as { shapes: Array<{id:string;kind:ShapeKind;x:number;y:number;text:string;angle:number}>; graph?: {expression:string}; mermaid?: string }
      if (data.graph) {
        editor.chain().focus().insertContent({ type: 'scientificDiagram', attrs: { data: { shapes: [createShape(kind ?? 'block', 240, 120)], mermaid: 'flowchart LR\\n  objeto["Objeto"]' } } }).run()
        return
      }
      const body = (data.shapes ?? []).find(shape => ['block','circle','rectangle'].includes(shape.kind))
      const shapes = kind ? [...(data.shapes ?? []), createShape(kind, kind === 'arrow' ? (body?.x ?? 240) : 104 + ((data.shapes ?? []).length % 4) * 92, kind === 'arrow' ? (body?.y ?? 120) : 72 + (Math.floor((data.shapes ?? []).length / 4) % 2) * 88)] : data.shapes ?? [createShape('block', 240, 120)]
      editor.commands.updateAttributes('scientificDiagram', { data: { ...data, shapes } }); editor.commands.focus(); return
    }
    const shapes = [createShape(kind ?? 'block', 240, 120)]
    editor.chain().focus().insertContent({ type: 'scientificDiagram', attrs: { data: { shapes, mermaid: 'flowchart LR\\n  objeto["Objeto"]' } } }).run()
  }, [editor])
  const insertGraph = useCallback((expression: string) => {
    if (!editor) return
    editor.chain().focus().insertContent({ type: 'scientificDiagram', attrs: { data: { shapes: [], graph: { expression: expression.trim() } } } }).run()
  }, [editor])
  const addSignChart = useCallback(() => editor?.chain().focus().insertContent({ type: 'signChart', attrs: { data: blankSignChart() } }).run(), [editor])
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

  const completionStyle = useMemo(() => {
    if (completionQuery === null || !editor) return undefined
    const rect = mathCompletion ? mathCompletion.field.getBoundingClientRect() : editor.view.coordsAtPos(editor.state.selection.from)
    const top = rect.bottom + 6
    return { position: 'fixed' as const, top, left: Math.max(8, Math.min(rect.left, window.innerWidth - 278)), maxHeight: Math.max(56, window.innerHeight - top - 8), overflowY: 'auto' as const }
  }, [completionQuery, editor, mathCompletion])

  if (!editor) return <div className="editor-loading" />
  return (
    <div className={`editor-shell editor-layout${toolsOpen ? ' tools-open' : ''}`}>
      <section className="editor-main-column">
        <div className="document-title-row"><div className="document-heading"><input aria-label={language === 'es' ? 'Título del documento' : 'Document title'} value={title} onChange={(event) => onTitleChange(event.target.value)} onBlur={onTitleCommit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /><span>{saveStatus==='saving'?(language==='es'?'Guardando cambios…':'Saving changes…'):saveStatus==='error'?(language==='es'?'No se pudieron guardar los cambios':'Changes could not be saved'):(language==='es'?'Guardado en este dispositivo':'Saved on this device')}</span></div></div>
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
          {completionQuery !== null && available.length > 0 && <div className="suggestion-menu" role="listbox" aria-label={language === 'es' ? 'Sugerencias matemáticas' : 'Math suggestions'} style={completionStyle}>{available.map((item, index) => <button key={item.es} role="option" aria-selected={index === selectedSuggestion} onMouseDown={(event) => { event.preventDefault(); insertCommand(item.latex) }}><span className="suggestion-glyph">{item.latex.includes('sqrt') ? '√' : item.latex.includes('sum') ? 'Σ' : '∑'}</span><span>{item[commandLanguage]}</span><kbd>↵</kbd></button>)}</div>}
        </div></div></div>
      </section>
      {toolsOpen && <ToolsPanel language={language} addDiagram={addDiagram} insertGraph={insertGraph} addSignChart={addSignChart} close={toggleTools} />}
    </div>
  )
}

const physicsTools: { kind: ShapeKind; es: string; en: string; icon: typeof Circle }[] = [
  {kind:'block',es:'Objeto central',en:'Central object',icon:Square},{kind:'arrow',es:'Fuerza (flecha)',en:'Force (arrow)',icon:MoveUpRight},{kind:'line',es:'Línea',en:'Line',icon:LineIcon},{kind:'circle',es:'Círculo',en:'Circle',icon:Circle},{kind:'rectangle',es:'Caja',en:'Box',icon:Square},{kind:'label',es:'Texto',en:'Text',icon:Type},
]
function ToolsPanel({ language, addDiagram, insertGraph, addSignChart, close }: {language:'es'|'en';addDiagram:(kind?:ShapeKind,angleValue?:number,label?:string)=>void;insertGraph:(expression:string)=>void;addSignChart:()=>void;close:()=>void}) {
  const [expression,setExpression] = useState('sin(x)')
  const [toolMode,setToolMode] = useState<'functions'|'physics'|'signs'>('functions')
  const es=language==='es'
  const validExpression=expression.trim()==='' || Boolean(graphGeometry(expression).path)
  return <aside className="tools-panel">
    <header><div><Wrench size={16}/><strong>{es?'Herramientas':'Tools'}</strong></div><button aria-label={es?'Cerrar herramientas':'Close tools'} onClick={close}><X size={16}/></button></header>
    <div className="tool-mode-switch" role="tablist" aria-label={es?'Tipo de herramienta':'Tool type'}><button role="tab" aria-selected={toolMode==='functions'} onClick={()=>setToolMode('functions')}>{es?'Funciones':'Functions'}</button><button role="tab" aria-selected={toolMode==='physics'} onClick={()=>setToolMode('physics')}>{es?'Física':'Physics'}</button><button role="tab" aria-selected={toolMode==='signs'} onClick={()=>setToolMode('signs')}>{es?'Signos':'Signs'}</button></div>
    {toolMode==='signs' ? <section className="tools-section"><h3>{es?'Esquema de signos':'Sign chart'}</h3><p className="tools-hint">{es?'Marcá valores críticos y asigná positivo, negativo, cero, no existe o una condición propia a cada intervalo.':'Mark critical values and assign a sign or custom condition to every interval.'}</p><button className="new-diagram-tool" onClick={addSignChart}>{es?'Insertar esquema de signos':'Insert sign chart'}</button></section> : toolMode==='functions' ? <section className="tools-section">
      <h3>{es?'Graficar una función':'Graph a function'}</h3>
      <p className="tools-hint">{es?'Escribí una expresión y se insertará como un plano interactivo en el documento.':'Enter an expression to insert an interactive coordinate plane into the document.'}</p>
      <label className="function-input"><span>f(x) =</span><input aria-label={es?'Expresión de la función':'Function expression'} aria-invalid={!validExpression} value={expression} onChange={e=>setExpression(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&validExpression)insertGraph(expression)}} placeholder="2x^2"/><button onClick={()=>insertGraph(expression)} disabled={!validExpression}><Activity size={15}/>{expression.trim()?(es?'Graficar':'Graph'):(es?'Insertar plano':'Insert plane')}</button></label>
      {!validExpression&&<p className="function-error" role="status">{es?'Revisá la expresión; no se pudo interpretar.':'Check the expression; it could not be parsed.'}</p>}
      <p className="tools-hint">{es?'Ejemplos: 2x^2, sin(x), (x+1)(x-2). Usá x, π, e, +, −, ×, /, ^, sqrt, abs, exp y log.':'Examples: 2x^2, sin(x), (x+1)(x-2). Use x, π, e, +, −, ×, /, ^, sqrt, abs, exp and log.'}</p>
      <button className="new-diagram-tool" onClick={()=>insertGraph('')}>{es?'Insertar bloque de función vacío':'Insert empty function block'}</button>
    </section> : <><section className="tools-section"><h3>{es?'Diagrama de cuerpo libre (DCL)':'Free-body diagram (FBD)'}</h3><p className="tools-hint">{es?'Insertá un objeto y agregá fuerzas como flechas. Estirá, girá y recoloreá cada forma; arrastrá la punta de una flecha para orientar el vector.':'Add a body and force arrows. Stretch, rotate, and recolor each shape; drag an arrow tip to set its direction.'}</p><button className="new-diagram-tool" onClick={()=>addDiagram(undefined)}>{es?'Nuevo DCL':'New free-body diagram'}</button><div className="physics-grid">{physicsTools.map(item=><button key={item.kind} onClick={()=>addDiagram(item.kind)}><item.icon size={15}/><span>{es?item.es:item.en}</span></button>)}</div></section><section className="tools-section"><h3>{es?'Fuerzas frecuentes':'Common forces'}</h3><div className="physics-grid force-presets">{[['Peso','Peso','Weight',90],['Normal','Normal','Normal',-90],['Tensión','Tensión','Tension',-45],['Fricción','Fricción','Friction',180]].map(([key,labelEs,labelEn,angle])=><button key={String(key)} onClick={()=>addDiagram('arrow',Number(angle),es?String(labelEs):String(labelEn))}><MoveUpRight size={15}/><span>{es?labelEs:labelEn}</span></button>)}</div><p className="tools-hint">{es?'Las direcciones son un punto de partida: podés mover la punta para ajustarlas a la situación física.':'Directions are starting points; drag each tip to match the physical setup.'}</p></section></>}
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

