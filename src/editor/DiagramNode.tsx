import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { useState } from 'react'

export type ShapeKind = 'block' | 'arrow' | 'label' | 'pulley' | 'disk' | 'sphere' | 'ring' | 'cylinder' | 'rope' | 'rod' | 'support' | 'lever' | 'incline' | 'spring' | 'rotation' | 'radius' | 'diameter'
type Shape = { id: string; kind: ShapeKind; x: number; y: number; text: string; angle: number }
export type CanvasData = { shapes: Shape[]; graph?: { expression: string } }

const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export function graphPath(expression: string, zoom = 1) {
  const source = expression.replace(/\s+/g, '')
  if (!/^[\dx.+\-*/^(),a-z]+$/i.test(source) || /(?:window|document|constructor|prototype|eval|function)/i.test(source)) return ''
  const js = source.replace(/\b(sin|cos|tan|sqrt|abs|exp|log)\(/gi, 'Math.$1(').replace(/\bpi\b/gi, 'Math.PI').replace(/\be\b/g, 'Math.E').replace(/\^/g, '**')
  let fn: (x: number) => number
  try { fn = new Function('x', `"use strict"; return (${js})`) as (x: number) => number } catch { return '' }
  const points: string[] = []
  for (let px = 0; px <= 480; px += 2) {
    const x = ((px - 240) / (24 / zoom))
    let y: number
    try { y = fn(x) } catch { y = NaN }
    const py = 120 - y * (24 / zoom)
    points.push(Number.isFinite(py) && Math.abs(py) < 1200 ? `${px},${py.toFixed(2)}` : 'break')
  }
  let open = false
  return points.map((point) => { if (point === 'break') { open = false; return '' } const result = `${open ? 'L' : 'M'}${point}`; open = true; return result }).join(' ')
}
export function diagramSvg(data: CanvasData) {
  const graph = data.graph ? `<path d="${graphPath(data.graph.expression)}" fill="none" stroke="#36bdf5" stroke-width="3"/>` : ''
  const shapes = data.shapes.map((s) => {
    const label = esc(s.text)
    const common = `transform="translate(${s.x} ${s.y}) rotate(${s.angle})"`
    if (s.kind === 'arrow') return `<g ${common}><line x1="0" y1="0" x2="70" y2="0" stroke="#3982f6" stroke-width="3" marker-end="url(#arr)"/><text x="74" y="5" fill="#172033" font-size="14">${label}</text></g>`
    if (s.kind === 'label') return `<text ${common} fill="#172033" font-size="14">${label}</text>`
    if (s.kind === 'pulley' || s.kind === 'disk' || s.kind === 'sphere' || s.kind === 'ring') return `<g ${common}><circle r="${s.kind === 'ring' ? 21 : 24}" fill="${s.kind === 'ring' ? 'none' : '#dce9fa'}" stroke="#3982f6" stroke-width="${s.kind === 'ring' ? 5 : 2}"/><text x="0" y="5" text-anchor="middle" fill="#172033" font-size="12">${label || s.kind}</text></g>`
    if (s.kind === 'rope' || s.kind === 'spring' || s.kind === 'rotation') return `<g ${common}><path d="${s.kind === 'spring' ? 'M-34 0 l8 -12 8 24 8 -24 8 24 8 -24 8 12' : s.kind === 'rotation' ? 'M-24 10 A26 26 0 1 1 15 20' : 'M-44 0 Q0 -8 44 0'}" fill="none" stroke="#3982f6" stroke-width="3" marker-end="url(#arr)"/><text y="34" text-anchor="middle" fill="#172033" font-size="12">${label}</text></g>`
    if (s.kind === 'rod' || s.kind === 'lever' || s.kind === 'radius' || s.kind === 'diameter') return `<g ${common}><line x1="-40" y1="0" x2="40" y2="0" stroke="#3982f6" stroke-width="5"/><circle r="4" fill="#172033"/><text y="-9" text-anchor="middle" fill="#172033" font-size="12">${label}</text></g>`
    if (s.kind === 'incline') return `<g ${common}><path d="M-42 24 L42 24 L42 -25 Z" fill="#dce9fa" stroke="#3982f6" stroke-width="2"/><text x="15" y="18" fill="#172033" font-size="12">${label || 'θ'}</text></g>`
    if (s.kind === 'support') return `<g ${common}><path d="M0 -25 L-22 20 L22 20 Z" fill="#dce9fa" stroke="#3982f6" stroke-width="2"/><line x1="-28" y1="24" x2="28" y2="24" stroke="#3982f6" stroke-width="2"/></g>`
    if (s.kind === 'cylinder') return `<g ${common}><rect x="-24" y="-24" width="48" height="48" rx="8" fill="#dce9fa" stroke="#3982f6" stroke-width="2"/><text text-anchor="middle" y="5" fill="#172033" font-size="12">${label}</text></g>`
    return `<g ${common}><rect x="-30" y="-22" width="60" height="44" rx="5" fill="#dce9fa" stroke="#3982f6" stroke-width="2"/><text text-anchor="middle" y="5" fill="#172033" font-size="13">${label}</text></g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240"><defs><pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#8492a6" opacity=".35"/></pattern><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#3982f6"/></marker></defs><rect width="480" height="240" fill="#fff"/><rect width="480" height="240" fill="url(#dots)"/><line x1="36" y1="204" x2="444" y2="204" stroke="#8592a3"/><line x1="84" y1="224" x2="84" y2="18" stroke="#8592a3"/>${graph}${shapes}</svg>`
}

function DiagramView({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const [active, setActive] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [expanded, setExpanded] = useState(false)
  const data = node.attrs.data as CanvasData
  const persist = (shapes: Shape[], graph = data.graph) => updateAttributes({ data: { shapes, ...(graph ? { graph } : {}) } })
  const add = (kind: ShapeKind) => {
    const labels: Record<ShapeKind, string> = { block: 'm', arrow: 'F', label: 'texto', pulley: 'm', disk: 'I', sphere: 'm', ring: 'R', cylinder: 'm', rope: '', rod: 'L', support: '', lever: 'τ', incline: 'θ', spring: 'k', rotation: 'ω', radius: 'r', diameter: 'd' }
    const shape: Shape = { id: crypto.randomUUID(), kind, x: 210, y: 112, text: labels[kind], angle: kind === 'arrow' ? -90 : 0 }
    persist([...data.shapes, shape]); setActive(shape.id)
  }
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const w = 480 / zoom, h = 240 / zoom
    const x = (480 - w) / 2 + (event.clientX - bounds.left) * w / bounds.width
    const y = (240 - h) / 2 + (event.clientY - bounds.top) * h / bounds.height
    let snapped = { x, y }
    const target = data.shapes.find((shape) => shape.id !== dragging && ['block', 'pulley', 'disk', 'sphere', 'ring', 'cylinder', 'support'].includes(shape.kind))
    if (target && Math.hypot(x - target.x, y - target.y) < 22) snapped = { x: target.x, y: target.y }
    persist(data.shapes.map((shape) => shape.id === dragging ? { ...shape, ...snapped } : shape))
  }
  const updateText = (id: string, text: string) => persist(data.shapes.map((shape) => shape.id === id ? { ...shape, text } : shape))
  return (
    <NodeViewWrapper className={`diagram-node${selected ? ' is-selected' : ''}`}>
      <div className="diagram-head"><span><span className="diagram-dot" />{data.graph ? `y = ${data.graph.expression}` : 'Diagrama científico'}</span><div><button onClick={() => setZoom((z) => Math.max(.6, z - .2))} aria-label="Alejar">−</button><button onClick={() => setZoom((z) => Math.min(2.4, z + .2))} aria-label="Acercar">+</button><button onClick={() => setExpanded(!expanded)} aria-label="Expandir gráfica">⤢</button><button onClick={deleteNode} aria-label="Quitar diagrama">×</button></div></div>
      <div className="diagram-actions">
        <button onClick={() => add('block')}>□ <span>Bloque</span></button>
        <button onClick={() => add('arrow')}>↗ <span>Vector</span></button>
        <button onClick={() => add('label')}>T <span>Texto</span></button>
        {active && <button className="remove-shape" onClick={() => { persist(data.shapes.filter((shape) => shape.id !== active)); setActive(null) }}>Remove selected</button>}
      </div>
      <svg className={expanded ? 'diagram-expanded' : ''} viewBox={`${(480 - 480 / zoom) / 2} ${(240 - 240 / zoom) / 2} ${480 / zoom} ${240 / zoom}`} role="img" aria-label="Lienzo editable de física y gráficas" onPointerMove={move} onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)}>
        <defs><pattern id="grid-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="currentColor" opacity=".18" /></pattern><marker id="vector-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker></defs>
        <rect width="480" height="240" fill="url(#grid-dots)" />
        <line x1="36" y1="204" x2="444" y2="204" className="diagram-axis" /><line x1="84" y1="224" x2="84" y2="18" className="diagram-axis" />
        <text x="428" y="194" className="axis-label">x</text><text x="91" y="26" className="axis-label">y</text>
        {data.graph && <><line x1="240" y1="14" x2="240" y2="226" className="diagram-axis"/><path d={graphPath(data.graph.expression, zoom)} className="function-graph"/></>}
        {data.shapes.map((shape) => <g key={shape.id} className={`shape ${active === shape.id ? 'active' : ''}`} onPointerDown={(event) => { event.stopPropagation(); setActive(shape.id); setDragging(shape.id); event.currentTarget.setPointerCapture(event.pointerId) }}>
          {shape.kind === 'block' && <><rect x={shape.x - 34} y={shape.y - 23} width="68" height="46" rx="7" className="diagram-block" /><foreignObject x={shape.x - 22} y={shape.y - 10} width="44" height="22"><input className="shape-label" value={shape.text} aria-label="Block label" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => updateText(shape.id, event.target.value)} /></foreignObject></>}
          {shape.kind === 'arrow' && <><line x1={shape.x} y1={shape.y} x2={shape.x + Math.cos(shape.angle * Math.PI / 180) * 78} y2={shape.y + Math.sin(shape.angle * Math.PI / 180) * 78} className="vector-line" markerEnd="url(#vector-head)" /><foreignObject x={shape.x + Math.cos(shape.angle * Math.PI / 180) * 82 - 14} y={shape.y + Math.sin(shape.angle * Math.PI / 180) * 82 - 14} width="56" height="28"><input className="shape-label vector-label" value={shape.text} aria-label="Vector label" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => updateText(shape.id, event.target.value)} /></foreignObject><circle cx={shape.x} cy={shape.y} r="4" className="vector-origin" /></>}
          {shape.kind === 'label' && <foreignObject x={shape.x - 48} y={shape.y - 15} width="96" height="30"><input className="shape-label free-label" value={shape.text} aria-label="Diagram text" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => updateText(shape.id, event.target.value)} /></foreignObject>}
          {!['block','arrow','label'].includes(shape.kind) && <><circle cx={shape.x} cy={shape.y} r={shape.kind === 'ring' ? 22 : 17} className={shape.kind === 'ring' ? 'physics-ring' : 'physics-object'}/><text x={shape.x} y={shape.y + 4} textAnchor="middle" className="physics-label">{shape.kind === 'incline' ? '△' : shape.kind === 'spring' ? '⌁' : shape.kind === 'rotation' ? '↻' : shape.kind === 'pulley' ? '○' : shape.kind === 'support' ? '▲' : shape.kind === 'rope' ? '∿' : shape.text}</text><text x={shape.x} y={shape.y + 35} textAnchor="middle" className="axis-label">{shape.text || shape.kind}</text></>}
          {active === shape.id && <>{[[-22,-22],[22,-22],[-22,22],[22,22]].map(([dx,dy]) => <circle key={`${dx}-${dy}`} cx={shape.x+dx} cy={shape.y+dy} r="3.5" className="diagram-anchor" />)}</>}
        </g>)}
      </svg>
      <div className="diagram-foot">Arrastrá los objetos; los vectores se adhieren a los puntos de anclaje.</div>
    </NodeViewWrapper>
  )
}

export const DiagramNode = Node.create({
  name: 'scientificDiagram', group: 'block', atom: true, selectable: true, draggable: true,
  addAttributes() { return { data: { default: { shapes: [] }, parseHTML: (element) => { try { return JSON.parse(element.getAttribute('data-diagram') ?? '{"shapes":[]}') } catch { return { shapes: [] } } }, renderHTML: (attributes) => ({ 'data-diagram': JSON.stringify(attributes.data) }) } } },
  parseHTML() { return [{ tag: 'div[data-scientific-diagram]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-scientific-diagram': '' })] },
  addNodeView() { return ReactNodeViewRenderer(DiagramView) },
})
