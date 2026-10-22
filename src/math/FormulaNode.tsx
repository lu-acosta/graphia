import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import React, { useLayoutEffect, useRef } from 'react'
import 'mathlive'

type MathfieldElement = HTMLElement & { value: string; mathVirtualKeyboardPolicy: string; executeCommand: (command: string) => boolean; insert: (latex: string, options?: { selectionMode?: string }) => boolean }

function FormulaView({ node, updateAttributes, selected }: NodeViewProps) {
  const mathRef = useRef<MathfieldElement>(null)
  const commandRef = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (mathRef.current && mathRef.current.value !== node.attrs.latex) mathRef.current.value = node.attrs.latex
  }, [node.attrs.latex])
  const handleInput = (event: Event) => updateAttributes({ latex: (event.target as MathfieldElement).value })
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const mathfield = mathRef.current
    if (event.key === '@' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      commandRef.current = ''
      window.dispatchEvent(new CustomEvent('graphia:math-query', { detail: { query: '', field: mathfield } }))
      return
    }
    if (commandRef.current !== null) {
      if (event.key === 'Backspace') {
        event.preventDefault()
        commandRef.current = commandRef.current.slice(0, -1)
        window.dispatchEvent(new CustomEvent('graphia:math-query', { detail: { query: commandRef.current, field: mathfield } }))
        return
      }
      if (/^[\p{L}\p{N}]$/u.test(event.key)) {
        event.preventDefault()
        commandRef.current += event.key
        window.dispatchEvent(new CustomEvent('graphia:math-query', { detail: { query: commandRef.current, field: mathfield } }))
        return
      }
      if (event.key === 'Escape' || event.key === ' ') {
        commandRef.current = null
        window.dispatchEvent(new CustomEvent('graphia:math-query', { detail: { query: null, field: mathfield } }))
        if (event.key === 'Escape') { event.preventDefault(); return }
      }
    }
    if (event.key === 'ArrowRight' && (event.currentTarget as HTMLElement).matches(':focus')) {
      event.preventDefault()
      document.execCommand('insertText', false, ' ')
    }
  }
  return (
    <NodeViewWrapper as="span" className={`formula-node${selected ? ' is-selected' : ''}`}>
      {React.createElement('math-field', { ref: mathRef, className: 'mathfield', 'aria-label': 'Editable mathematical expression', onInput: handleInput, onKeyDown: handleKeyDown, onBlur: () => { commandRef.current = null; window.dispatchEvent(new CustomEvent('graphia:math-query', { detail: { query: null, field: mathRef.current } })) }, 'virtual-keyboard-mode': 'manual' })}
    </NodeViewWrapper>
  )
}

export const FormulaNode = Node.create({
  name: 'formula',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      latex: { default: 'x^2', parseHTML: (element) => element.getAttribute('data-latex') ?? 'x^2', renderHTML: (attributes) => ({ 'data-latex': attributes.latex }) },
    }
  },
  parseHTML() { return [{ tag: 'span[data-formula]' }] },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { 'data-formula': '' })] },
  addNodeView() { return ReactNodeViewRenderer(FormulaView) },
})
