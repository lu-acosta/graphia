import { useCallback, useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import { Bold, ChevronDown, ChevronRight, Code2, Heading1, Heading2, Italic, Link2, List, ListOrdered, Minus, Plus, Redo2, Search, Sigma, Sparkles, Strikethrough, Table2, Underline as UnderlineIcon, Undo2 } from 'lucide-react'
import { FormulaNode } from '../math/FormulaNode'
import { DiagramNode } from './DiagramNode'

type Props = { content: string; update: (html: string) => void; suggestions: boolean; language: 'es' | 'en'; title: string; onTitleChange: (title: string) => void; onTitleCommit: () => void; onSaved?: () => void }
const labels = {
  es: { paragraph: 'Texto normal', heading: 'Título', formula: 'Fórmula', table: 'Tabla', diagram: 'Diagrama', link: 'Añadir enlace', image: 'Imagen' },
  en: { paragraph: 'Paragraph', heading: 'Heading', formula: 'Formula', table: 'Table', diagram: 'Diagram', link: 'Add link', image: 'Image' },
}
const commands = [
  { es: 'raíz cuadrada', en: 'square root', latex: '\\sqrt{\Box}' }, { es: 'raíz cúbica', en: 'cube root', latex: '\\sqrt[3]{\Box}' }, { es: 'raíz enésima', en: 'nth root', latex: '\\sqrt[n]{\Box}' },
  { es: 'fracción', en: 'fraction', latex: '\\frac{\Box}{\Box}' }, { es: 'potencia', en: 'power', latex: '{\Box}^{\Box}' }, { es: 'integral', en: 'integral', latex: '\\int_{\Box}^{\Box} \Box \\, d x' },
  { es: 'sumatoria', en: 'summation', latex: '\\sum_{i=1}^{n} \Box' }, { es: 'derivada', en: 'derivative', latex: '\\frac{d}{d x} \Box' }, { es: 'infinito', en: 'infinity', latex: '\\infty' },
]
const templateContent = (name: string, index: number) => {
  const starter = ['f(x) = ', 'lim ', 'f derivative = ', '∫ ', 'y + equation = '][index] ?? ''
  return `<h2>${name}</h2><p>${starter}</p><p></p>`
}

export function ScientificEditor({ content, update, suggestions, language, title, onTitleChange, onTitleCommit, onSaved }: Props) {
  const text = labels[language]
  const [query, setQuery] = useState<string | null>(null)
  const [commandLanguage, setCommandLanguage] = useState(language)
  const [toolQuery, setToolQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(language === 'es' ? 'Funciones' : 'Functions')
  const [expanded, setExpanded] = useState({ functions: true, symbols: true, templates: true })
  useEffect(() => setCommandLanguage(language), [language])
  const editor = useEditor({
    extensions: [StarterKit, Underline, Link.configure({ openOnClick: false }), Image.configure({ inline: false, allowBase64: true }), Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, Placeholder.configure({ placeholder: language === 'es' ? 'Comenzá a desarrollar tus ideas…' : 'Start developing your ideas…' }), FormulaNode, DiagramNode],
    content,
    onUpdate: ({ editor: instance }) => {
      update(instance.getHTML())
      if (!suggestions) { setQuery(null); return }
      const { from } = instance.state.selection
      const before = instance.state.doc.textBetween(Math.max(0, from - 32), from, '\n')
      const match = before.match(/(?:^|\s)@([\p{L}\p{N} ]{1,28})$/u)
      setQuery(match ? match[1].trimStart() : null)
    },
    editorProps: {
      attributes: { class: 'document-prose', spellcheck: 'false' },
      handleKeyDown: (_view, event) => {
        if (query === null) return false
        const matches = commands.filter((item) => `${item[commandLanguage]} ${item.es} ${item.en}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
        if (event.key === 'Escape') { setQuery(null); return true }
        if (event.key === 'Enter' && matches[0] && editor) { event.preventDefault(); editor.chain().focus().deleteRange({ from: editor.state.selection.from - query.length - 1, to: editor.state.selection.from }).insertContent({ type: 'formula', attrs: { latex: matches[0].latex } }).run(); setQuery(null); return true }
        return false
      },
    },
  })
  useEffect(() => {
    if (!editor || editor.getHTML() === content) return
    const selection = editor.state.selection
    editor.commands.setContent(content, { emitUpdate: false })
    editor.commands.setTextSelection(Math.min(selection.from, editor.state.doc.content.size))
  }, [content, editor])
  const addFormula = useCallback((latex: string) => { editor?.chain().focus().insertContent({ type: 'formula', attrs: { latex } }).run(); onSaved?.() }, [editor, onSaved])
  const addDiagram = useCallback(() => editor?.chain().focus().insertContent({ type: 'scientificDiagram', attrs: { data: { shapes: [] } } }).run(), [editor])
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
  const available = useMemo(() => commands.filter((item) => query !== null && `${item[commandLanguage]} ${item.es} ${item.en}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 6), [query, commandLanguage])

  if (!editor) return <div className="editor-loading" />
  return (
    <div className="editor-shell editor-layout">
      <section className="editor-main-column">
      <div className="document-title-row"><div className="document-heading"><input aria-label={language === 'es' ? 'Título del documento' : 'Document title'} value={title} onChange={(event) => onTitleChange(event.target.value)} onBlur={onTitleCommit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /><span>{language === 'es' ? 'Última edición: ' : 'Last edited: '}{new Intl.DateTimeFormat(language === 'es' ? 'es-UY' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(Date.now())}</span></div><div className="document-quick-actions"><button aria-label="Editor settings" title="Editor settings"><Code2 /></button><button className="quick-math" aria-label="Insert formula" title="Insert formula" onClick={() => addFormula('f(x)')}><span>ƒx</span></button><button aria-label="Insert graph" title="Insert graph" onClick={addDiagram}><span className="mini-chart">⌁</span></button><button aria-label="Insert link" title="Insert link" onClick={addLink}><Link2 /></button></div></div>
      <div className="paper-scroll"><div className="paper" onClick={() => editor.commands.focus('end')}><div className="paper-inner"><div className="editor-kicker"><span />{language === 'es' ? 'NOTAS DE INVESTIGACIÓN' : 'RESEARCH NOTES'}</div><EditorContent editor={editor} />
        {query !== null && available.length > 0 && <div className="suggestion-menu" role="listbox" aria-label="Math suggestions">{available.map((item, index) => <button key={item.es} role="option" aria-selected={index === 0} onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().deleteRange({ from: editor.state.selection.from - query.length - 1, to: editor.state.selection.from }).insertContent({ type: 'formula', attrs: { latex: item.latex } }).run(); setQuery(null) }}><span className="suggestion-glyph">∑</span><span>{item[commandLanguage]}<small>{language === 'es' ? 'Insertar estructura editable' : 'Insert editable structure'}</small></span><kbd>↵</kbd></button>)}</div>}
        <div className="paper-end"><span className="end-line" /><span>{language === 'es' ? 'TU RAZONAMIENTO, EN DESARROLLO' : 'YOUR THINKING, IN PROGRESS'}</span><span className="end-line" /></div>
      </div></div></div>
      <div className="toolbar bottom-toolbar" role="toolbar" aria-label="Editor formatting">
        <div className="toolbar-group"><button className="tool-icon" aria-label="Undo" title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 /></button><button className="tool-icon" aria-label="Redo" title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 /></button></div>
        <span className="toolbar-divider" />
        <label className="style-select"><span className="sr-only">Text style</span><select defaultValue="paragraph" onChange={(event) => { if (event.target.value === 'heading') editor.chain().focus().toggleHeading({ level: 1 }).run(); else if (event.target.value === 'subheading') editor.chain().focus().toggleHeading({ level: 2 }).run(); else editor.chain().focus().setParagraph().run() }}><option value="paragraph">{text.paragraph}</option><option value="heading">{text.heading}</option><option value="subheading">{language === 'es' ? 'Subtítulo' : 'Subheading'}</option></select></label>
        <div className="toolbar-group"><button className={`tool-icon ${editor.isActive('bold') ? 'is-active' : ''}`} aria-label="Bold" title="Bold (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></button><button className={`tool-icon ${editor.isActive('italic') ? 'is-active' : ''}`} aria-label="Italic" title="Italic (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></button><button className={`tool-icon ${editor.isActive('underline') ? 'is-active' : ''}`} aria-label="Underline" title="Underline (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon /></button><button className={`tool-icon ${editor.isActive('strike') ? 'is-active' : ''}`} aria-label="Strikethrough" title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></button></div>
        <span className="toolbar-divider" />
        <div className="toolbar-group"><button className={`tool-icon ${editor.isActive('bulletList') ? 'is-active' : ''}`} aria-label="Bulleted list" title="Bulleted list" onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></button><button className={`tool-icon ${editor.isActive('orderedList') ? 'is-active' : ''}`} aria-label="Numbered list" title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></button></div>
        <span className="toolbar-divider" />
        <div className="toolbar-group"><button className="tool-icon" aria-label="Insert formula" title="Insert formula" onClick={() => addFormula('x^2')}><Sigma /></button><button className="tool-icon" aria-label="Insert table" title="Insert table" onClick={addTable}><Table2 /></button><button className="tool-icon" aria-label="Insert link" title="Insert link" onClick={addLink}><Link2 /></button><button className="tool-icon" aria-label="Insert diagram" title="Insert diagram" onClick={addDiagram}><Code2 /></button><button className="tool-icon" aria-label="Insert image" title="Insert image" onClick={setImage}><Plus /></button></div>
        <span className="toolbar-divider optional-divider" />
        <div className="toolbar-group optional-tools"><button className="tool-icon" aria-label="Heading 1" title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 /></button><button className="tool-icon" aria-label="Heading 2" title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></button><button className="tool-icon" aria-label="Horizontal rule" title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus /></button></div>
        <span className="toolbar-spacer" />
        <button className="publish-button" aria-label={language === 'es' ? 'Guardar documento' : 'Save document'} title={language === 'es' ? 'Guardado automáticamente' : 'Saved automatically'}><span>✓</span></button>
      </div>
      </section>
      <aside className="science-panel">
        <div className="science-panel-head"><div><Sparkles /><h2>{language === 'es' ? 'Herramientas matemáticas' : 'Mathematical tools'}</h2></div><button aria-label={language === 'es' ? 'Contraer panel' : 'Collapse panel'} onClick={() => setExpanded((state) => ({ ...state, functions: !state.functions, symbols: !state.symbols, templates: !state.templates }))}><ChevronDown /></button></div>
        <div className="science-search"><Search /><input value={toolQuery} onChange={(event) => setToolQuery(event.target.value)} placeholder={language === 'es' ? 'Buscar herramientas…' : 'Search tools…'} /></div>
        <div className="science-categories">{(language === 'es' ? ['Funciones', 'Derivadas', 'Integrales', 'Álgebra', 'Matrices', 'Ecuaciones'] : ['Functions', 'Derivatives', 'Integrals', 'Algebra', 'Matrices', 'Equations']).map((category) => <button className={activeCategory === category ? 'active' : ''} key={category} onClick={() => setActiveCategory(category)}>{category}</button>)}</div>
        <section className="science-section"><button className="science-section-title" onClick={() => setExpanded((state) => ({ ...state, functions: !state.functions }))}><span className="science-section-icon">ƒ(x)</span><strong>{activeCategory}</strong>{expanded.functions ? <ChevronDown /> : <ChevronRight />}</button>{expanded.functions && <div className="science-command-list">{commands.filter((item) => `${item[commandLanguage]} ${item.es} ${item.en}`.toLocaleLowerCase().includes(toolQuery.toLocaleLowerCase())).map((item) => <button key={item.es} onClick={() => addFormula(item.latex)}><span className="command-preview">{item.latex.includes('sqrt') ? '√' : item.latex.includes('frac') ? 'a/b' : item.latex.includes('int') ? '∫' : item.latex.includes('sum') ? 'Σ' : item.latex.replaceAll('\\', '')}</span><span>{item[commandLanguage]}</span><ChevronRight /></button>)}</div>}</section>
        <section className="science-section symbol-section"><button className="science-section-title" onClick={() => setExpanded((state) => ({ ...state, symbols: !state.symbols }))}><span className="science-section-icon">Σ</span><strong>{language === 'es' ? 'Símbolos' : 'Symbols'}</strong>{expanded.symbols ? <ChevronDown /> : <ChevronRight />}</button>{expanded.symbols && <div className="symbol-grid">{['∞', 'π', 'Σ', '∫', '√', '≤', '≥', '±', '∈', '∉'].filter((symbol) => !toolQuery || symbol.includes(toolQuery) || 'infinity pi sigma integral root less greater plus minus element'.includes(toolQuery.toLocaleLowerCase())).map((symbol) => <button key={symbol} title={`${language === 'es' ? 'Insertar' : 'Insert'} ${symbol}`} onClick={() => addFormula(symbol)}>{symbol}</button>)}</div>}</section>
        <section className="science-section template-section"><button className="science-section-title" onClick={() => setExpanded((state) => ({ ...state, templates: !state.templates }))}><span className="science-section-icon">▤</span><strong>{language === 'es' ? 'Plantillas' : 'Templates'}</strong>{expanded.templates ? <ChevronDown /> : <ChevronRight />}</button>{expanded.templates && <div className="template-list">{(language === 'es' ? ['Función y dominio', 'Límites', 'Derivadas', 'Integrales', 'Ecuaciones diferenciales'] : ['Function and domain', 'Limits', 'Derivatives', 'Integrals', 'Differential equations']).filter((name) => name.toLocaleLowerCase().includes(toolQuery.toLocaleLowerCase())).map((name, index) => <button key={name} onClick={() => editor.chain().focus().insertContent(templateContent(name, index)).run()}><span>▤</span>{name}</button>)}</div>}</section>
        <div className="panel-footnote"><span />{language === 'es' ? 'Las herramientas insertan elementos editables' : 'Tools insert editable elements'}</div>
      </aside>
    </div>
  )
}
