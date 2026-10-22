import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

export type ShapeKind = 'block' | 'arrow' | 'label' | 'pulley' | 'disk' | 'sphere' | 'ring' | 'cylinder' | 'rod' | 'support' | 'lever' | 'incline' | 'spring' | 'rotation' | 'radius' | 'diameter'
type Shape = { id: string; kind: ShapeKind; x: number; y: number; text: string; angle: number; angleValue?: number }
type Connection = { id: string; from: string; fromNode: number; to: string; toNode: number }
export type CanvasData = { shapes: Shape[]; connections?: Connection[]; graph?: { expression: string } }

const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export function graphGeometry(expression: string, zoom = 1) {
  const source = expression.replace(/\s+/g, '').replace(/[−–]/g, '-')
  if (!/^[\dx.+\-*/^(),a-z]+$/i.test(source) || /(?:window|document|constructor|prototype|eval|function)/i.test(source)) return { path: '', xAxis: 240, yAxis: 220 }
  const allowedNames = new Set(['x','pi','e','sin','cos','tan','sqrt','abs','exp','log'])
  if ((source.match(/[a-z]+/gi) ?? []).some((name) => !allowedNames.has(name.toLowerCase()))) return { path: '', xAxis: 240, yAxis: 220 }
  let js = source.replace(/\bpi\b/gi, 'Math.PI').replace(/\be\b/g, 'Math.E')
  js = js.replace(/\b(sin|cos|tan|sqrt|abs|exp|log)\(/gi, 'Math.$1(')
  js = js.replace(/(\d|x|\)|Math\.PI|Math\.E)(?=(?:x|\(|Math\.))/gi, '$1*')
  js = js.replace(/\^/g, '**')
  let fn: (x: number) => number
  try { fn = new Function('x', `"use strict"; return (${js})`) as (x: number) => number } catch { return { path: '', xAxis: 240, yAxis: 220 } }
  const domain = 10 / zoom
  const samples: {x:number;y:number}[] = []
  for (let i = 0; i <= 400; i++) {
    const x = -domain + (2 * domain * i) / 400
    let y: number
    try { y = fn(x) } catch { y = NaN }
    samples.push({x,y:Number.isFinite(y)&&Math.abs(y)<1e6?y:NaN})
  }
  const values=samples.filter(p=>Number.isFinite(p.y)).map(p=>p.y)
  if(!values.length)return {path:'',xAxis:240,yAxis:220}
  let minY=Math.min(...values),maxY=Math.max(...values)
  if(Math.abs(maxY-minY)<1e-8){minY-=1;maxY+=1}
  const pad=(maxY-minY)*.08
  minY-=pad;maxY+=pad
  const toX=(x:number)=>30+(x+domain)/(2*domain)*420
  const toY=(y:number)=>220-(y-minY)/(maxY-minY)*200
  let open = false
  const path=samples.map(({x,y})=>{if(!Number.isFinite(y)){open=false;return ''}const result=`${open?'L':'M'}${toX(x).toFixed(2)},${toY(y).toFixed(2)}`;open=true;return result}).join(' ')
  const yAxis=minY<=0&&maxY>=0?toY(0):minY>0?220:20
  return {path,xAxis:240,yAxis}
}
export function graphPath(expression: string, zoom = 1) { return graphGeometry(expression,zoom).path }
export function diagramSvg(data: CanvasData) {
  const geometry = data.graph ? graphGeometry(data.graph.expression) : null
  const graph = geometry?.path ? `<path d="${geometry.path}" fill="none" stroke="#36bdf5" stroke-width="3"/>` : ''
  const shapes = data.shapes.filter((s) => (s.kind as string) !== 'rope').map((s) => {
    const label = esc(s.text)
    const common = `transform="translate(${s.x} ${s.y}) rotate(${s.angle})"`
    if (s.kind === 'arrow') return `<g ${common}><line x1="0" y1="0" x2="70" y2="0" stroke="#3982f6" stroke-width="3" marker-end="url(#arr)"/><text x="74" y="5" fill="#172033" font-size="14">${label}</text></g>`
    if (s.kind === 'label') return `<text ${common} fill="#172033" font-size="14">${label}</text>`
    if (s.kind === 'pulley') return `<g ${common}><circle r="24" fill="#e7eef8" stroke="#3982f6" stroke-width="3"/><circle r="15" fill="none" stroke="#8197b7" stroke-width="3"/><circle r="5" fill="#3982f6"/><path d="M-24 -3 Q-15 -3 -15 0 Q-15 3 -24 3 M24 -3 Q15 -3 15 0 Q15 3 24 3" fill="none" stroke="#3982f6" stroke-width="3"/></g>`
    if (s.kind === 'disk') return `<g ${common}><ellipse rx="24" ry="10" cy="10" fill="#b7c9e2" stroke="#3982f6" stroke-width="2"/><path d="M-24 0 V10 A24 10 0 0 0 24 10 V0" fill="#dce9fa" stroke="#3982f6" stroke-width="2"/><ellipse rx="24" ry="10" fill="#f4f8ff" stroke="#3982f6" stroke-width="2"/><circle r="3" fill="#3982f6"/></g>`
    if (s.kind === 'sphere') return `<g ${common}><circle r="22" fill="#dce9fa" stroke="#3982f6" stroke-width="2"/><path d="M-20 0 Q0 -16 20 0 Q0 16 -20 0 M0 -22 Q-12 0 0 22 M0 -22 Q12 0 0 22" fill="none" stroke="#8ab1e7" stroke-width="1.5"/><circle cx="-7" cy="-8" r="4" fill="#fff" opacity=".8"/></g>`
    if (s.kind === 'ring') return `<g ${common}><circle r="22" fill="none" stroke="#3982f6" stroke-width="8"/><circle r="14" fill="#fff" stroke="#9bb2d0" stroke-width="1.5"/></g>`
    if (s.kind === 'spring') return `<g ${common}><path d="M-42 0 L-32 0 L-25 -13 L-16 13 L-7 -13 L2 13 L11 -13 L20 13 L29 -13 L36 0 L42 0" fill="none" stroke="#3982f6" stroke-width="4" stroke-linejoin="round"/><path d="M-46 -7 V7 M46 -7 V7" stroke="#607894" stroke-width="3"/><text y="30" text-anchor="middle" fill="#172033" font-size="11">k</text></g>`
    if (s.kind === 'rotation') return `<g ${common}><path d="M-22 9 A24 24 0 1 1 17 20" fill="none" stroke="#3982f6" stroke-width="3" marker-end="url(#arr)"/><text y="5" text-anchor="middle" fill="#172033" font-size="14">↻</text></g>`
    if (s.kind === 'rod' || s.kind === 'lever' || s.kind === 'radius' || s.kind === 'diameter') return `<g ${common}><line x1="-40" y1="0" x2="40" y2="0" stroke="#3982f6" stroke-width="5"/><circle r="4" fill="#172033"/><text y="-9" text-anchor="middle" fill="#172033" font-size="12">${label}</text></g>`
    if (s.kind === 'incline') return `<g ${common}><path d="M-42 24 L42 24 L42 -25 Z" fill="#dce9fa" stroke="#3982f6" stroke-width="2"/><path d="M-24 22 A20 20 0 0 1 -7 12" fill="none" stroke="#e59436" stroke-width="2"/><text x="-13" y="18" fill="#172033" font-size="11">${s.angleValue ?? 30}°</text><text x="22" y="16" fill="#172033" font-size="11">${label || 'θ'}</text></g>`
    if (s.kind === 'support') return `<g ${common}><path d="M0 -25 L-22 18 L22 18 Z" fill="#dce9fa" stroke="#3982f6" stroke-width="2"/><path d="M-26 20 l6 6 m4 -6 l6 6 m4 -6 l6 6 m4 -6 l6 6 m4 -6 l6 6" stroke="#536a86" stroke-width="1.5"/></g>`
    if (s.kind === 'cylinder') return `<g ${common}><path d="M-23 -16 A23 8 0 0 1 23 -16 V16 A23 8 0 0 1 -23 16 Z" fill="#dce9fa" stroke="#3982f6" stroke-width="2"/><ellipse cy="-16" rx="23" ry="8" fill="#f4f8ff" stroke="#3982f6" stroke-width="2"/><path d="M-23 16 A23 8 0 0 0 23 16" fill="none" stroke="#3982f6" stroke-width="2"/><text text-anchor="middle" y="5" fill="#172033" font-size="12">${label}</text></g>`
    return `<g ${common}><rect x="-30" y="-22" width="60" height="44" rx="5" fill="#dce9fa" stroke="#3982f6" stroke-width="2"/><text text-anchor="middle" y="5" fill="#172033" font-size="13">${label}</text></g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240"><defs><pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#8492a6" opacity=".35"/></pattern><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#3982f6"/></marker></defs>${data.graph ? `<rect width="480" height="240" fill="#fff"/><rect width="480" height="240" fill="url(#dots)"/><line x1="30" y1="${geometry?.yAxis ?? 220}" x2="450" y2="${geometry?.yAxis ?? 220}" stroke="#8592a3"/><line x1="${geometry?.xAxis ?? 240}" y1="20" x2="${geometry?.xAxis ?? 240}" y2="220" stroke="#8592a3"/>` : ''}${graph}${shapes}</svg>`
}

function DiagramView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [draggingAnchor, setDraggingAnchor] = useState<{shapeId:string;node:number}|null>(null)
  const [anchorCursor, setAnchorCursor] = useState<[number,number]|null>(null)
  const [dragPreview, setDragPreview] = useState<{id:string;x:number;y:number}|null>(null)
  const [pan, setPan] = useState({x:0,y:0})
  const [panning, setPanning] = useState<{clientX:number;clientY:number;panX:number;panY:number}|null>(null)
  const [zoom, setZoom] = useState(1)
  const [expanded, setExpanded] = useState(false)
  const data = node.attrs.data as CanvasData
  useEffect(() => {
    const clearSelection = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as globalThis.Node)) setActive(null)
    }
    document.addEventListener('pointerdown', clearSelection)
    return () => document.removeEventListener('pointerdown', clearSelection)
  }, [])
  const persist = (shapes: Shape[], graph = data.graph, connections = data.connections ?? []) => updateAttributes({ data: { shapes, connections, ...(graph ? { graph } : {}) } })
  const add = (kind: ShapeKind) => {
    const labels: Record<ShapeKind, string> = { block: 'm', arrow: 'F', label: 'texto', pulley: 'm', disk: 'I', sphere: 'm', ring: 'R', cylinder: 'm', rod: 'L', support: '', lever: 'τ', incline: 'θ', spring: 'k', rotation: 'ω', radius: 'r', diameter: 'd' }
    const index = data.shapes.length
    const shape: Shape = { id: crypto.randomUUID(), kind, x: 104 + (index % 4) * 92, y: 72 + (Math.floor(index / 4) % 2) * 88, text: labels[kind], angle: kind === 'arrow' ? -90 : 0 }
    persist([...data.shapes, shape]); setActive(shape.id)
  }
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (panning) {
      const bounds=event.currentTarget.getBoundingClientRect()
      setPan({x:panning.panX+(event.clientX-panning.clientX)*480/bounds.width,y:panning.panY+(event.clientY-panning.clientY)*240/bounds.height})
      return
    }
    if (!dragging && !draggingAnchor) return
    const [x,y] = coord(event)
    if (draggingAnchor) { setAnchorCursor([x,y]); return }
    setDragPreview({id:dragging!,x,y})
  }
  const coord = (event: React.PointerEvent<SVGSVGElement>): [number,number] => { const b=event.currentTarget.getBoundingClientRect(); return [(event.clientX-b.left)*480/b.width, (event.clientY-b.top)*240/b.height] }
  const currentShapes = data.shapes.map(s=>s.id===dragPreview?.id?{...s,x:dragPreview.x,y:dragPreview.y}:s)
  const anchors = (s: Shape): [number,number][] => s.kind === 'arrow' ? [[s.x,s.y]] : [[s.x-32,s.y],[s.x+32,s.y],[s.x,s.y-22],[s.x,s.y+22]]
  const finishAnchor = (event: React.PointerEvent<SVGSVGElement>) => {
    if (draggingAnchor) {
      const [x,y]=coord(event)
      const target=currentShapes.filter(s=>s.id!==draggingAnchor.shapeId).flatMap(s=>anchors(s).map((p,node)=>({s,node,p,d:Math.hypot(x-p[0],y-p[1])}))).sort((a,b)=>a.d-b.d)[0]
      if(target && target.d<30) {
        const source=currentShapes.find(s=>s.id===draggingAnchor.shapeId)!
        const origin=anchors(source)[draggingAnchor.node]
        const dx=target.p[0]-origin[0],dy=target.p[1]-origin[1]
        const snapped=currentShapes.map(s=>s.id===source.id?{...s,x:s.x+dx,y:s.y+dy}:s)
        persist(snapped,data.graph,[...(data.connections??[]),{id:crypto.randomUUID(),from:source.id,fromNode:draggingAnchor.node,to:target.s.id,toNode:target.node}])
      }
      else if(dragging) persist(currentShapes)
      setDraggingAnchor(null);setAnchorCursor(null)
    } else if (dragging && dragPreview) persist(currentShapes)
    setDragging(null);setDragPreview(null)
  }
  const updateText = (id: string, text: string) => persist(data.shapes.map((shape) => shape.id === id ? { ...shape, text } : shape))
  return (
    <NodeViewWrapper ref={wrapperRef} className={`diagram-node${data.graph ? ' function-plot' : ' physics-scene'}`}>
      {data.graph && <><div className="diagram-head"><span><span className="diagram-dot" />y = {data.graph.expression}</span><div><button onClick={() => setZoom((z) => Math.max(.6, z - .2))} aria-label="Alejar">−</button><button onClick={() => setZoom((z) => Math.min(2.4, z + .2))} aria-label="Acercar">+</button><button onClick={() => setExpanded(!expanded)} aria-label="Expandir gráfica">⤢</button><button onClick={deleteNode} aria-label="Quitar gráfica">×</button></div></div></>}
      {data.graph && <div className="diagram-actions">
        <button onClick={() => add('block')}>□ <span>Bloque</span></button>
        <button onClick={() => add('arrow')}>↗ <span>Vector</span></button>
        <button onClick={() => add('label')}>T <span>Texto</span></button>
        {active && <button className="remove-shape" onClick={() => { persist(data.shapes.filter((shape) => shape.id !== active)); setActive(null) }}>Remove selected</button>}
      </div>}
      <svg className={`${expanded ? 'diagram-expanded' : ''}${panning ? ' is-panning' : ''}`} viewBox="0 0 480 240" role="img" aria-label={data.graph ? 'Gráfica de función' : 'Elementos de física sin marco'} onPointerDown={(event)=>{if(data.graph && !(event.target as Element).closest('.shape')){event.currentTarget.setPointerCapture(event.pointerId);setPanning({clientX:event.clientX,clientY:event.clientY,panX:pan.x,panY:pan.y})}}} onPointerMove={move} onPointerUp={(event)=>{if(panning)setPanning(null);finishAnchor(event)}} onPointerLeave={() => {setDragging(null);setDragPreview(null);setDraggingAnchor(null);setAnchorCursor(null);setPanning(null)}}>
        <defs><pattern id="grid-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="currentColor" opacity=".18" /></pattern><marker id="vector-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker></defs>
        {data.graph && <g className="graph-plane" transform={`translate(${pan.x} ${pan.y})`}><rect width="480" height="240" fill="url(#grid-dots)"/><>{(() => { const geometry=graphGeometry(data.graph!.expression,zoom); return <><line x1="30" y1={geometry.yAxis} x2="450" y2={geometry.yAxis} className="diagram-axis"/><line x1={geometry.xAxis} y1="20" x2={geometry.xAxis} y2="220" className="diagram-axis"/><text x="452" y={geometry.yAxis-5} className="axis-label">x</text><text x={geometry.xAxis+5} y="18" className="axis-label">y</text><path d={geometry.path} className="function-graph"/></> })()}</></g>}
        {currentShapes.filter((shape) => (shape.kind as string) !== 'rope').map((shape) => <g key={shape.id} className={`shape ${active === shape.id ? 'active' : ''}`} onPointerDown={(event) => { event.stopPropagation(); setActive(shape.id); setDragging(shape.id); event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId) }}>
          <rect x={shape.x-48} y={shape.y-36} width="96" height="72" fill="transparent" className="shape-hit-area" />
          {shape.kind === 'block' && <><rect x={shape.x - 34} y={shape.y - 23} width="68" height="46" rx="7" className="diagram-block" /><foreignObject x={shape.x - 22} y={shape.y - 10} width="44" height="22"><input className="shape-label" value={shape.text} aria-label="Block label" onPointerDown={(event) => { setActive(shape.id); setDragging(shape.id); (event.currentTarget.closest('svg') as SVGSVGElement | null)?.setPointerCapture(event.pointerId) }} onChange={(event) => updateText(shape.id, event.target.value)} /></foreignObject></>}
          {shape.kind === 'arrow' && <><line x1={shape.x} y1={shape.y} x2={shape.x + Math.cos(shape.angle * Math.PI / 180) * 78} y2={shape.y + Math.sin(shape.angle * Math.PI / 180) * 78} className="vector-line" markerEnd="url(#vector-head)" /><foreignObject x={shape.x + Math.cos(shape.angle * Math.PI / 180) * 82 - 14} y={shape.y + Math.sin(shape.angle * Math.PI / 180) * 82 - 14} width="56" height="28"><input className="shape-label vector-label" value={shape.text} aria-label="Vector label" onPointerDown={(event) => { setActive(shape.id); setDragging(shape.id); (event.currentTarget.closest('svg') as SVGSVGElement | null)?.setPointerCapture(event.pointerId) }} onChange={(event) => updateText(shape.id, event.target.value)} /></foreignObject><circle cx={shape.x} cy={shape.y} r="4" className="vector-origin" /></>}
          {shape.kind === 'label' && <foreignObject x={shape.x - 48} y={shape.y - 15} width="96" height="30"><input className="shape-label free-label" value={shape.text} aria-label="Diagram text" onPointerDown={(event) => { event.stopPropagation(); setActive(shape.id) }} onChange={(event) => updateText(shape.id, event.target.value)} /></foreignObject>}
          {!['block','arrow','label','pulley','disk','sphere','ring','cylinder','spring','rotation','rod','lever','radius','diameter','incline','support'].includes(shape.kind) && <circle cx={shape.x} cy={shape.y} r="17" className="physics-object"/>}
          {['pulley','disk','sphere','ring','cylinder','spring','rotation','rod','lever','radius','diameter','incline','support'].includes(shape.kind) && <g transform={`translate(${shape.x} ${shape.y}) rotate(${shape.angle})`} className="physics-object-drawing">
            {shape.kind==='pulley'&&<><circle r="24" className="object-fill"/><circle r="15" className="object-inner"/><circle r="4" className="object-hub"/><path d="M-24 -3 Q-15 -3 -15 0 Q-15 3 -24 3 M24 -3 Q15 -3 15 0 Q15 3 24 3" className="object-detail"/></>}
            {shape.kind==='disk'&&<><path d="M-24 0 V10 A24 10 0 0 0 24 10 V0" className="object-side"/><ellipse rx="24" ry="10" className="object-fill"/><circle r="3" className="object-hub"/></>}
            {shape.kind==='sphere'&&<><circle r="22" className="object-fill"/><path d="M-20 0 Q0 -16 20 0 Q0 16 -20 0 M0 -22 Q-12 0 0 22 M0 -22 Q12 0 0 22" className="object-detail"/></>}
            {shape.kind==='ring'&&<><circle r="20" className="object-ring"/><circle r="12" className="object-hole"/></>}
            {shape.kind==='cylinder'&&<><path d="M-23 -16 A23 8 0 0 1 23 -16 V16 A23 8 0 0 1 -23 16 Z" className="object-fill"/><ellipse cy="-16" rx="23" ry="8" className="object-top"/><path d="M-23 16 A23 8 0 0 0 23 16" className="object-detail"/></>}
            {shape.kind==='spring'&&<><path d="M-42 0 L-32 0 L-25 -13 L-16 13 L-7 -13 L2 13 L11 -13 L20 13 L29 -13 L36 0 L42 0" className="spring-path"/><path d="M-46 -7 V7 M46 -7 V7" className="object-detail"/></>}
            {shape.kind==='rotation'&&<path d="M-22 9 A24 24 0 1 1 17 20" className="vector-line" markerEnd="url(#vector-head)"/>}
            {shape.kind==='rod'&&<><rect x="-40" y="-5" width="80" height="10" rx="5" className="object-fill"/><circle r="3" className="object-hub"/></>}
            {shape.kind==='lever'&&<><rect x="-40" y="-4" width="80" height="8" rx="4" className="object-fill"/><path d="M0 5 L-12 22 H12 Z" className="object-side"/></>}
            {shape.kind==='radius'&&<><circle r="21" className="object-outline"/><line x1="0" y1="0" x2="39" y2="0" className="object-detail"/><text x="18" y="-5" className="physics-svg-label">r</text></>}
            {shape.kind==='diameter'&&<><circle r="21" className="object-outline"/><line x1="-38" y1="0" x2="38" y2="0" className="object-detail" markerStart="url(#vector-head)" markerEnd="url(#vector-head)"/><text x="0" y="-5" textAnchor="middle" className="physics-svg-label">d</text></>}
            {shape.kind==='incline'&&<><path d="M-42 24 L42 24 L42 -25 Z" className="object-fill"/><path d="M-24 22 A20 20 0 0 1 -7 12" fill="none" stroke="#e59436" strokeWidth="2"/><text x="-14" y="18" className="physics-svg-label">{shape.angleValue??30}°</text></>}
            {shape.kind==='support'&&<><path d="M0 -25 L-22 18 L22 18 Z" className="object-fill"/><path d="M-26 20 l6 6 m4 -6 l6 6 m4 -6 l6 6 m4 -6 l6 6 m4 -6 l6 6" className="object-detail"/></>}
          </g>}
          {!['block','arrow','label','spring','rotation','radius','diameter','incline','support'].includes(shape.kind) && <text x={shape.x} y={shape.y+39} textAnchor="middle" className="axis-label">{shape.text}</text>}
          {active === shape.id && <>{anchors(shape).map(([x,y],i) => <circle key={i} cx={x} cy={y} r="6" className={`diagram-anchor${draggingAnchor?.shapeId===shape.id&&draggingAnchor.node===i?' is-dragging':''}`} onPointerDown={(event)=>{event.stopPropagation();event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);setDragging(null);setDragPreview(null);setDraggingAnchor({shapeId:shape.id,node:i});setAnchorCursor([x,y])}} />)}</>}
        </g>)}
        {draggingAnchor&&anchorCursor&&<><line x1={anchors(data.shapes.find(s=>s.id===draggingAnchor.shapeId)!)[draggingAnchor.node][0]} y1={anchors(data.shapes.find(s=>s.id===draggingAnchor.shapeId)!)[draggingAnchor.node][1]} x2={anchorCursor[0]} y2={anchorCursor[1]} className="anchor-drag-line"/><circle cx={anchorCursor[0]} cy={anchorCursor[1]} r="7" className="anchor-cursor"/></>}
      </svg>
      {data.graph && <div className="diagram-foot">Arrastrá los objetos; los vectores se adhieren a los puntos de anclaje.</div>}
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


