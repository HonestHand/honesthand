// ─── Safe domain allowlist ────────────────────────────────────────────────────
const SAFE_DOMAINS = [
  'sba.gov', 'grants.gov', 'sam.gov', 'irs.gov', 'twc.texas.gov',
  'gov.texas.gov', 'tvc.texas.gov', 'rd.usda.gov', 'texaswideopenforbusiness.com',
  'treasury.gov', 'dol.gov', 'energy.gov',
]

export function isSafeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return SAFE_DOMAINS.some(d => host === d || host.endsWith('.' + d))
  } catch { return false }
}

// ─── Markdown table renderer ──────────────────────────────────────────────────
function parseMarkdownTable(block: string): string {
  const lines = block.trim().split('\n').filter(l => l.trim().startsWith('|'))
  if (lines.length < 2) return block

  const parseRow = (line: string) =>
    line.split('|').slice(1, -1).map(cell => cell.trim())

  const isSeparator = (line: string) => /^\|[\s|:-]+\|$/.test(line.trim())

  let html = '<div style="overflow-x:auto;margin:12px 0 16px">'
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px">'

  let headerDone = false
  for (const line of lines) {
    if (isSeparator(line)) { headerDone = true; continue }
    const cells = parseRow(line)
    if (!headerDone) {
      html += '<thead><tr>' + cells.map(c =>
        `<th style="text-align:left;padding:8px 12px;background:#F3F4F6;border:1px solid #E5E7EB;font-weight:700;color:#2C2C2A;white-space:nowrap">${c}</th>`
      ).join('') + '</tr></thead><tbody>'
    } else {
      const isTotal = cells.some(c => c.toLowerCase().includes('total'))
      const rowStyle = isTotal ? 'background:#F0FDF8;font-weight:700' : 'background:white'
      html += '<tr>' + cells.map(c =>
        `<td style="padding:8px 12px;border:1px solid #E5E7EB;${rowStyle};color:#374151">${c}</td>`
      ).join('') + '</tr>'
    }
  }
  html += '</tbody></table></div>'
  return html
}

// ─── Full markdown → HTML (for raw/fallback rendering) ───────────────────────
export function renderMarkdown(text: string): string {
  let result = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  result = result.replace(/((?:[ \t]*\|.+\|\n?){2,})/g, (match) => {
    const lines = match.trim().split('\n')
    const hasTableRow = lines.some(l => l.trim().startsWith('|'))
    const hasSeparator = lines.some(l => /^\|[\s|:-]+\|$/.test(l.trim()))
    return (hasTableRow && hasSeparator) ? parseMarkdownTable(match) : match
  })

  return result
    .replace(/^[ \t]*# (.+?)[ \t]*$/gm, '<h1 style="font-size:16px;font-weight:700;color:#2C2C2A;margin:0 0 4px">$1</h1>')
    .replace(/^[ \t]*## (.+?)[ \t]*$/gm, '<h2 style="font-size:15px;font-weight:700;color:#1D9E75;margin:16px 0 6px;border-bottom:2px solid rgba(29,158,117,0.15);padding-bottom:4px">$1</h2>')
    .replace(/^[ \t]*### (.+?)[ \t]*$/gm, '<h3 style="font-size:14px;font-weight:600;margin:12px 0 4px">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) =>
      isSafeUrl(url)
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#1D9E75;text-decoration:underline">${label}</a>`
        : `${label} (${url})`
    )
    .replace(/^[ \t]*(\d+)\. (.+)$/gm, '<li style="margin-bottom:6px">$2</li>')
    .replace(/^[ \t]*- (.+)$/gm, '<li style="margin-bottom:4px">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, m => `<ul style="margin:6px 0 10px 20px;padding:0">${m}</ul>`)
    .replace(/^[ \t]*---[ \t]*$/gm, '<hr style="border:none;border-top:1px solid #F3F4F6;margin:8px 0">')
    .replace(/\n\n/g, '<br/>')
}

// ─── Inline-only renderer (bold + safe links) for card fields ─────────────────
export function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) =>
      isSafeUrl(url)
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#1D9E75;font-weight:500;text-decoration:underline">${label}</a>`
        : `${label} (${url})`
    )
}
