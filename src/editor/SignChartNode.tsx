import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'

type Sign = 'unknown' | 'positive' | 'negative' | 'zero' | 'undefined' | 'custom'
type Point = { id: string; value: string; sign: Sign; note: string }
type Interval = { id: string; sign: Sign; note: string }
export type SignChartData = { points: Point[]; intervals: Interval[] }

const newInterval = (): Interval => ({ id: crypto.randomUUID(), sign: 'unknown', note: '' })
export const blankSignChart = (): SignChartData => ({ points: [], intervals: [newInterval()] })
const options: { value: Sign; label: string; symbol: string }[] = [
  { value: 'unknown', label: 'Sin definir', symbol: '?' },
  { value: 'positive', label: 'Positivo', symbol: '+' },
  { value: 'negative', label: 'Negativo', symbol: '−' },
  { value: 'zero', label: 'Cero', symbol: '0' },
  { value: 'undefined', label: 'No existe', symbol: '∄' },
  { value: 'custom', label: 'Depende de…', symbol: '⋯' },
]
const symbol = (sign: Sign) => options.find(option => option.value === sign)?.symbol ?? '?'
const description = (item: { sign: Sign; note: string }) => item.sign === 'custom' ? item.note || 'Depende de…' : options.find(option => option.value === item.sign)?.label ?? 'Sin definir'
const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]!)

export function signChartPrintHtml(data: SignChartData) {
  const points = data.points ?? []
  const intervals = data.intervals ?? []
  const cells = points.flatMap((point, index) => [
    `<td><strong>${esc(description(intervals[index] ?? { sign:'unknown', note:'' }))}</strong></td>`,
    `<td><strong>${esc(point.value || '?')}</strong><br>${esc(description(point))}</td>`,
  ])
  cells.push(`<td><strong>${esc(description(intervals[points.length] ?? { sign:'unknown', note:'' }))}</strong></td>`)
  return `<table class="print-sign-chart"><caption>Esquema de signos</caption><tbody><tr>${cells.join('')}</tr></tbody></table>`
}

function SignChartView({ node, updateAttributes }: NodeViewProps) {
  const data = node.attrs.data as SignChartData
  const points = data.points ?? []
  const intervals = data.intervals?.length === points.length + 1 ? data.intervals : Array.from({ length: points.length + 1 }, (_, index) => data.intervals?.[index] ?? newInterval())
  const save = (nextPoints: Point[], nextIntervals: Interval[]) => updateAttributes({ data: { points: nextPoints, intervals: nextIntervals } })
  const changePoint = (id: string, patch: Partial<Point>) => save(points.map(point => point.id === id ? { ...point, ...patch } : point), intervals)
  const changeInterval = (id: string, patch: Partial<Interval>) => save(points, intervals.map(interval => interval.id === id ? { ...interval, ...patch } : interval))
  const addPoint = () => save([...points, { id: crypto.randomUUID(), value: '', sign: 'zero', note: '' }], [...intervals, newInterval()])
  const removePoint = (index: number) => save(points.filter((_, position) => position !== index), intervals.filter((_, position) => position !== index + 1))
  const signPicker = (item: Point | Interval, change: (patch: { sign?: Sign; note?: string }) => void) => <>
    <select aria-label="Estado del signo" value={item.sign} onChange={event => change({ sign: event.target.value as Sign })}>{options.map(option => <option key={option.value} value={option.value}>{option.symbol} {option.label}</option>)}</select>
    {item.sign === 'custom' && <input aria-label="Condición del signo" value={item.note} onChange={event => change({ note: event.target.value })} placeholder="Depende de…" />}
  </>
  return <NodeViewWrapper className="sign-chart-node" contentEditable={false}>
    <div className="sign-chart-head"><strong>Esquema de signos</strong><button type="button" onClick={addPoint}>+ Agregar valor</button></div>
    <div className="sign-chart-scroll"><div className="sign-chart-track">
      {points.map((point, index) => <div className="sign-chart-pair" key={point.id}>
        <div className={`sign-chart-interval sign-${intervals[index].sign}`}><span className="sign-chart-symbol">{symbol(intervals[index].sign)}</span>{signPicker(intervals[index], patch => changeInterval(intervals[index].id, patch))}</div>
        <div className={`sign-chart-point sign-${point.sign}`}><input aria-label="Valor crítico" value={point.value} onChange={event => changePoint(point.id, { value: event.target.value })} placeholder="x = 0" />{signPicker(point, patch => changePoint(point.id, patch))}<button type="button" aria-label="Quitar valor" title="Quitar valor" onClick={() => removePoint(index)}>×</button></div>
      </div>)}
      <div className={`sign-chart-interval sign-${intervals[points.length].sign}`}><span className="sign-chart-symbol">{symbol(intervals[points.length].sign)}</span>{signPicker(intervals[points.length], patch => changeInterval(intervals[points.length].id, patch))}</div>
    </div></div>
    <p className="sign-chart-hint">Los intervalos van de izquierda a derecha. Escribí valores como −2, 0 o π y asigná el signo a cada tramo.</p>
  </NodeViewWrapper>
}

export const SignChartNode = Node.create({
  name: 'signChart', group: 'block', atom: true, selectable: true,
  addAttributes() { return { data: { default: { points: [], intervals: [] }, parseHTML: element => { try { return JSON.parse(element.getAttribute('data-sign-chart') ?? '{}') } catch { return blankSignChart() } }, renderHTML: attributes => ({ 'data-sign-chart': JSON.stringify(attributes.data) }) } } },
  parseHTML() { return [{ tag: 'div[data-sign-chart]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-sign-chart': '' })] },
  addNodeView() { return ReactNodeViewRenderer(SignChartView) },
})
