import type { ReactNode } from 'react'

// Mirrors customer-web's LegalDoc (src/components/LegalDoc.tsx) — same
// fixed-subset Markdown renderer for the two legal docs (#/## headings,
// "- " bullet lists with indented continuation lines, **bold**, `code`,
// [text](url) links, and bare https:// URLs). Not a general Markdown parser.
//
// Trimmed relative to customer-web's copy: vendor-web has no standalone
// /legal/terms or /legal/privacy routes, only the footer's LegalModal, so
// there's no non-modal fallback to support — onNavigate is always provided.

const DOC_BY_FILENAME: Record<string, 'terms' | 'privacy'> = {
  'terms-and-conditions.md': 'terms',
  'privacy-policy.md': 'privacy',
}

const INLINE_RE = /(\*\*(.+?)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(https?:\/\/[^\s)]+)/g

function renderInline(text: string, keyPrefix: string, onNavigate: (doc: 'terms' | 'privacy') => void): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let idx = 0
  let match: RegExpExecArray | null
  INLINE_RE.lastIndex = 0
  while ((match = INLINE_RE.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const key = `${keyPrefix}-${idx++}`
    if (match[1]) {
      nodes.push(<strong key={key}>{match[2]}</strong>)
    } else if (match[3]) {
      nodes.push(<code key={key}>{match[4]}</code>)
    } else if (match[5]) {
      const linkText = match[6]
      const url = match[7]
      const filename = url.replace(/^\.\//, '')
      const doc = DOC_BY_FILENAME[filename]
      nodes.push(
        doc ? (
          // Switch the modal's own content instead of a real navigation —
          // there's no standalone page here to land on.
          <button key={key} type="button" className="inline-link" onClick={() => onNavigate(doc)}>{linkText}</button>
        ) : (
          <a key={key} href={url} target="_blank" rel="noopener noreferrer">{linkText}</a>
        )
      )
    } else if (match[8]) {
      nodes.push(
        <a key={key} href={match[8]} target="_blank" rel="noopener noreferrer">{match[8]}</a>
      )
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

type Block = { type: 'h1' | 'h2' | 'p'; text: string } | { type: 'ul'; items: string[] }

function parseBlocks(md: string): Block[] {
  const lines = md.split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    if (line.startsWith('# ')) { blocks.push({ type: 'h1', text: line.slice(2).trim() }); i++; continue }
    if (line.startsWith('## ')) { blocks.push({ type: 'h2', text: line.slice(3).trim() }); i++; continue }

    if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length) {
        const l = lines[i]
        if (l.startsWith('- ')) { items.push(l.slice(2).trim()); i++; continue }
        if (l.startsWith('  ') && items.length > 0) { items[items.length - 1] += ` ${l.trim()}`; i++; continue }
        break
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // A standalone "**Label:**" line (e.g. "**Effective date:** ...") reads
    // better as its own paragraph than merged into the next line.
    if (/^\*\*[^*]+:\*\*/.test(line)) {
      blocks.push({ type: 'p', text: line.trim() })
      i++
      continue
    }

    let text = line.trim()
    i++
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('- ')) {
      text += ` ${lines[i].trim()}`
      i++
    }
    blocks.push({ type: 'p', text })
  }
  return blocks
}

interface Props {
  content: string
  onNavigate: (doc: 'terms' | 'privacy') => void
}

export function LegalDoc({ content, onNavigate }: Props) {
  const blocks = parseBlocks(content)
  return (
    <div className="card legal-doc">
      {blocks.map((block, i) => {
        const key = `block-${i}`
        if (block.type === 'h1') return <h1 key={key}>{block.text}</h1>
        if (block.type === 'h2') return <h2 key={key} className="section">{block.text}</h2>
        if (block.type === 'ul') {
          return (
            <ul key={key}>
              {block.items.map((item, j) => (
                <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`, onNavigate)}</li>
              ))}
            </ul>
          )
        }
        return <p key={key}>{renderInline(block.text, key, onNavigate)}</p>
      })}
    </div>
  )
}
