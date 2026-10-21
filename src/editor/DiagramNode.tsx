import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { useState } from 'react'

type Shape = { id: string; kind: 'block' | 'arrow' | 'label'; x: number; y: number; text: string; angle: number }
type CanvasData = { shapes: Shape[] }

function DiagramView({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const [active, setActive] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const data = node.attrs.data as CanvasData
  const persist = (shapes: Shape[]) => updateAttributes({ data: { shapes } })
  const add = (kind: Shape['kind']) => {
    const shape: Shape = { id: crypto.randomUUID(), kind, x: 210, y: 112, text: kind === 'block' ? 'm' : kind === 'arrow' ? 'F' : 'label', angle: kind === 'arrow' ? -90 : 0 }
    persist([...data.shapes, shape]); setActive(shape.id)
  }
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) * 480 / bounds.width
    const y = (event.clientY - bounds.top) * 240 / bounds.height
    persist(data.shapes.map((shape) => shape.id === dragging ? { ...shape, x, y } : shape))
  }
  const updateText = (id: string, text: string) => persist(data.shapes.map((shape) => shape.id === id ? { ...shape, text } : shape))
  return (
    <NodeViewWrapper className={`diagram-node${selected ? ' is-selected' : ''}`}>
      <div className="diagram-head"><span><span className="diagram-dot" />Force diagram</span><button onClick={deleteNode} aria-label="Remove diagram">×</button></div>
      <div className="diagram-actions">
        <button onClick={() => add('block')}>□ <span>Block</span></button>
        <button onClick={() => add('arrow')}>↗ <span>Vector</span></button>
        <button onClick={() => add('label')}>T <span>Label</span></button>
        {active && <button className="remove-shape" onClick={() => { persist(data.shapes.filter((shape) => shape.id !== active)); setActive(null) }}>Remove selected</button>}
      </div>
      <svg viewBox="0 0 480 240" role="img" aria-label="Editable force diagram canvas" onPointerMove={move} onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)}>
        <defs><pattern id="grid-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="currentColor" opacity=".18" /></pattern><marker id="vector-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker></defs>
        <rect width="480" height="240" fill="url(#grid-dots)" />
        <line x1="36" y1="204" x2="444" y2="204" className="diagram-axis" /><line x1="84" y1="224" x2="84" y2="18" className="diagram-axis" />
        <text x="428" y="194" className="axis-label">x</text><text x="91" y="26" className="axis-label">y</text>
        {data.shapes.map((shape) => <g key={shape.id} className={`shape ${active === shape.id ? 'active' : ''}`} onPointerDown={(event) => { event.stopPropagation(); setActive(shape.id); setDragging(shape.id); event.currentTarget.setPointerCapture(event.pointerId) }}>
          {shape.kind === 'block' && <><rect x={shape.x - 34} y={shape.y - 23} width="68" height="46" rx="7" className="diagram-block" /><foreignObject x={shape.x - 22} y={shape.y - 10} width="44" height="22"><input className="shape-label" value={shape.text} aria-label="Block label" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => updateText(shape.id, event.target.value)} /></foreignObject></>}
          {shape.kind === 'arrow' && <><line x1={shape.x} y1={shape.y} x2={shape.x + Math.cos(shape.angle * Math.PI / 180) * 78} y2={shape.y + Math.sin(shape.angle * Math.PI / 180) * 78} className="vector-line" markerEnd="url(#vector-head)" /><foreignObject x={shape.x + Math.cos(shape.angle * Math.PI / 180) * 82 - 14} y={shape.y + Math.sin(shape.angle * Math.PI / 180) * 82 - 14} width="56" height="28"><input className="shape-label vector-label" value={shape.text} aria-label="Vector label" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => updateText(shape.id, event.target.value)} /></foreignObject><circle cx={shape.x} cy={shape.y} r="4" className="vector-origin" /></>}
          {shape.kind === 'label' && <foreignObject x={shape.x - 48} y={shape.y - 15} width="96" height="30"><input className="shape-label free-label" value={shape.text} aria-label="Diagram text" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => updateText(shape.id, event.target.value)} /></foreignObject>}
        </g>)}
      </svg>
      <div className="diagram-foot">Drag an object to reposition · select and remove</div>
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
