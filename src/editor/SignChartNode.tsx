import { Fragment } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'

type LegacySign = 'unknown' | 'positive' | 'negative' | 'zero' | 'undefined' | 'custom'
type Entry = { id: string; result?: string; sign?: LegacySign; note?: string }
type Point = Entry & { value: string }
type Interval = Entry
export type SignChartData = { points: Point[]; intervals: Interval[] }

const newInterval = (): Interval => ({ id: crypto.randomUUID(), result: '' })
export const blankSignChart = (): SignChartData => ({ points: [], intervals: [newInterval()] })
const legacyResult = (item: Entry) => item.result ?? (item.sign === 'positive' ? '+' : item.sign === 'negative' ? '−' : item.sign === 'zero' ? '0' : item.sign === 'undefined' ? '∄' : item.sign === 'custom' ? item.note ?? '' : '')
const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]!)

export function signChartPrintHtml(data: SignChartData) {
  const points = data.points ?? []
  const intervals = data.intervals ?? []
  const width = 120 * (points.length + 1) + 80 * points.length + 100
  const parts: string[] = [
    '<defs><marker id="sign-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8" fill="none" stroke="#98a1ad" stroke-width="1.5"/></marker></defs>',
    `<line x1="45" y1="62" x2="${width - 45}" y2="62" stroke="#c7c7c7" stroke-width="2" marker-start="url(#sign-arrow)" marker-end="url(#sign-arrow)"/>`,
    '<text x="12" y="68" font-size="18">−∞</text>',
    `<text x="${width - 35}" y="68" font-size="18">+∞</text>`,
  ]
  let cursor = 50
  points.forEach((point, index) => {
    parts.push(`<text x="${cursor + 60}" y="34" text-anchor="middle" font-size="18">${esc(legacyResult(intervals[index] ?? {}))}</text>`)
    cursor += 120
    parts.push(`<line x1="${cursor + 40}" y1="52" x2="${cursor + 40}" y2="72" stroke="#b9b9b9" stroke-width="2"/>`)
    parts.push(`<text x="${cursor + 40}" y="34" text-anchor="middle" font-size="15">${esc(legacyResult(point))}</text>`)
    parts.push(`<text x="${cursor + 40}" y="98" text-anchor="middle" font-size="18">${esc(point.value)}</text>`)
    cursor += 80
  })
  parts.push(`<text x="${cursor + 60}" y="34" text-anchor="middle" font-size="18">${esc(legacyResult(intervals[points.length] ?? {}))}</text>`)
  return `<svg class="print-sign-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 110" style="display:block;width:100%;height:auto;max-width:100%;margin:16px 0" role="img" aria-label="Esquema de signos">${parts.join('')}</svg>`
}

function SignChartView({ node, updateAttributes }: NodeViewProps) {
  const data = node.attrs.data as SignChartData
  const points = data.points ?? []
  const intervals = Array.from({ length: points.length + 1 }, (_, index) => data.intervals?.[index] ?? newInterval())
  const save = (nextPoints: Point[], nextIntervals: Interval[]) => updateAttributes({ data: { points: nextPoints, intervals: nextIntervals } })
  const changePoint = (id: string, patch: Partial<Point>) => save(points.map(point => point.id === id ? { ...point, ...patch } : point), intervals)
  const changeInterval = (id: string, result: string) => save(points, intervals.map(interval => interval.id === id ? { ...interval, result } : interval))
  const addPoint = () => save([...points, { id: crypto.randomUUID(), value: '', result: '' }], [...intervals, newInterval()])
  const removePoint = (index: number) => save(points.filter((_, position) => position !== index), intervals.filter((_, position) => position !== index + 1))
  const intervalView = (interval: Interval, index: number) => <div className="sign-axis-interval" key={interval.id}>
    <input aria-label={`Signo o valor del intervalo ${index + 1}`} value={legacyResult(interval)} onChange={event => changeInterval(interval.id, event.target.value)} placeholder="+" />
    <span className="sign-axis-line" />
  </div>
  return <NodeViewWrapper className="sign-chart-node" contentEditable={false}>
    <div className="sign-chart-head"><strong>Esquema de signos</strong><button type="button" onClick={addPoint}>+ Agregar valor</button></div>
    <div className="sign-chart-scroll"><div className="sign-chart-axis">
      <span className="sign-axis-boundary">−∞ <span>←</span></span>
      {points.map((point, index) => <Fragment key={point.id}>
        {intervalView(intervals[index], index)}
        <div className="sign-axis-point">
          <input aria-label={`Signo o valor en ${point.value || 'el punto'}`} value={legacyResult(point)} onChange={event => changePoint(point.id, { result: event.target.value })} placeholder="0" />
          <span className="sign-axis-tick" />
          <input aria-label="Valor del punto" value={point.value} onChange={event => changePoint(point.id, { value: event.target.value })} placeholder="−1" />
          <button type="button" aria-label="Quitar valor" onClick={() => removePoint(index)}>×</button>
        </div>
      </Fragment>)}
      {intervalView(intervals[points.length], points.length)}
      <span className="sign-axis-boundary"><span>→</span> +∞</span>
    </div></div>
    <p className="sign-chart-hint">Escribí el signo o resultado arriba de cada tramo y el valor debajo de cada marca.</p>
  </NodeViewWrapper>
}

export const SignChartNode = Node.create({
  name: 'signChart', group: 'block', atom: true, selectable: true,
  addAttributes() { return { data: { default: { points: [], intervals: [] }, parseHTML: element => { try { return JSON.parse(element.getAttribute('data-sign-chart') ?? '{}') } catch { return blankSignChart() } }, renderHTML: attributes => ({ 'data-sign-chart': JSON.stringify(attributes.data) }) } } },
  parseHTML() { return [{ tag: 'div[data-sign-chart]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-sign-chart': '' })] },
  addNodeView() { return ReactNodeViewRenderer(SignChartView) },
})
