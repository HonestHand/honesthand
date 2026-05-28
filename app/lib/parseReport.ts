// ─── Types ────────────────────────────────────────────────────────────────────

export type SectionCategory =
  | 'federal' | 'state' | 'local' | 'tax'
  | 'certification' | 'contracting' | 'industry'
  | 'veteran' | 'action-plan' | 'other'

export type BadgeVariant = 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'teal' | 'sky' | 'gray'

export interface Badge {
  label: string
  variant: BadgeVariant
}

export interface ParsedOpportunity {
  id: string
  name: string
  value: string
  valueNum: number
  deadline: string
  deadlineDate?: Date     // parsed Date when a specific deadline is extractable
  whyQualify: string
  nextStep: string
  rawText: string
  badges: Badge[]
  isHighValue: boolean
  isRolling: boolean
  isUrgent: boolean
  sourceAgency?: string   // extracted from nextStep (e.g. "SBA.gov", "TWC Texas")
  sourceUrl?: string      // official URL if found in nextStep
}

export interface ActionPlanStep {
  num: number
  title: string
  detail: string
  raw: string
}

export interface ParsedSection {
  id: string
  title: string
  category: SectionCategory
  icon: string
  color: string
  opportunities: ParsedOpportunity[]
  actionSteps: ActionPlanStep[]
  rawText: string
  isActionPlan: boolean
  isParsed: boolean
}

export interface ParsedReport {
  sections: ParsedSection[]
  totalOpportunities: number
  highValueCount: number
  urgentCount: number
  rollingCount: number
}

// ─── Section metadata ─────────────────────────────────────────────────────────

export const SECTION_META: Record<SectionCategory, {
  icon: string; color: string; badgeLabel: string; badgeVariant: BadgeVariant
}> = {
  federal:       { icon: '🏛️', color: '#3B82F6', badgeLabel: 'Federal Program',     badgeVariant: 'blue'   },
  state:         { icon: '⭐', color: '#F97316', badgeLabel: 'TX State Program',     badgeVariant: 'amber'  },
  local:         { icon: '📍', color: '#8B5CF6', badgeLabel: 'Local Program',        badgeVariant: 'purple' },
  tax:           { icon: '🧾', color: '#10B981', badgeLabel: 'Tax Credit',           badgeVariant: 'green'  },
  certification: { icon: '📜', color: '#14B8A6', badgeLabel: 'Certification',        badgeVariant: 'teal'   },
  contracting:   { icon: '🤝', color: '#1E40AF', badgeLabel: "Gov't Contracting",   badgeVariant: 'blue'   },
  industry:      { icon: '🏗️', color: '#F59E0B', badgeLabel: 'Industry Program',    badgeVariant: 'amber'  },
  veteran:       { icon: '🎖️', color: '#EF4444', badgeLabel: 'Veteran Program',     badgeVariant: 'red'    },
  'action-plan': { icon: '✅', color: '#059669', badgeLabel: 'Action Plan',          badgeVariant: 'green'  },
  other:         { icon: '📋', color: '#6B7280', badgeLabel: 'Program',              badgeVariant: 'gray'   },
}

// ─── Source extraction ────────────────────────────────────────────────────────

// Ordered: specific domain patterns first, abbreviation fallbacks last
const KNOWN_AGENCIES: Array<{ pattern: RegExp; label: string; url: string }> = [
  { pattern: /\bsba\.gov\b/i,             label: 'SBA.gov',                     url: 'https://sba.gov'                         },
  { pattern: /\birs\.gov\b/i,             label: 'IRS.gov',                     url: 'https://irs.gov'                         },
  { pattern: /\bgrants\.gov\b/i,          label: 'Grants.gov',                  url: 'https://grants.gov'                      },
  { pattern: /\bsam\.gov\b/i,             label: 'SAM.gov',                     url: 'https://sam.gov'                         },
  { pattern: /\btwc\.texas\.gov\b/i,      label: 'TWC Texas',                   url: 'https://twc.texas.gov'                   },
  { pattern: /\btvc\.texas\.gov\b/i,      label: 'TVC Texas',                   url: 'https://tvc.texas.gov'                   },
  { pattern: /\bgov\.texas\.gov\b/i,      label: 'Texas.gov',                   url: 'https://gov.texas.gov'                   },
  { pattern: /\brd\.usda\.gov\b/i,        label: 'USDA',                        url: 'https://rd.usda.gov'                     },
  { pattern: /\btreasury\.gov\b/i,        label: 'Treasury.gov',                url: 'https://treasury.gov'                    },
  { pattern: /\bdol\.gov\b/i,             label: 'DOL.gov',                     url: 'https://dol.gov'                         },
  { pattern: /\benergy\.gov\b/i,          label: 'Energy.gov',                  url: 'https://energy.gov'                      },
  { pattern: /texaswideopenforbusiness/i, label: 'Texas Wide Open for Business', url: 'https://texaswideopenforbusiness.com'    },
  // Abbreviation fallbacks (match agency acronyms when no domain is present)
  { pattern: /\bSBA\b/,                   label: 'SBA.gov',                     url: 'https://sba.gov'                         },
  { pattern: /\bUSDA\b/,                  label: 'USDA',                        url: 'https://rd.usda.gov'                     },
  { pattern: /\bTWC\b/,                   label: 'TWC Texas',                   url: 'https://twc.texas.gov'                   },
  { pattern: /\bTVC\b/,                   label: 'TVC Texas',                   url: 'https://tvc.texas.gov'                   },
  { pattern: /\bIRS\b/,                   label: 'IRS.gov',                     url: 'https://irs.gov'                         },
  { pattern: /\bEDA\b/,                   label: 'EDA.gov',                     url: 'https://eda.gov'                         },
  { pattern: /\bSBIR\b|\bSTTR\b/,         label: 'SBIR.gov',                    url: 'https://sbir.gov'                        },
]

function isOfficialSource(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host.endsWith('.gov') || host === 'texaswideopenforbusiness.com'
  } catch { return false }
}

/**
 * Extract source agency from a nextStep field.
 * Priority: markdown links with .gov URLs → bare .gov domains → known abbreviations.
 */
function extractSource(nextStep: string): { agency: string; url?: string } | null {
  if (!nextStep) return null

  // 1. Markdown links: [text](https://agency.gov/...)
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
  for (const m of nextStep.matchAll(linkRe)) {
    const url = m[2]
    if (isOfficialSource(url)) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, '')
        return { agency: host, url }
      } catch { /* continue */ }
    }
  }

  // 2. Bare .gov domains in plain text (e.g. "visit twc.texas.gov")
  const domainRe = /([\w-]+(?:\.[\w-]+)*\.gov)/gi
  for (const m of nextStep.matchAll(domainRe)) {
    const domain = m[1].toLowerCase()
    const known  = KNOWN_AGENCIES.find(a => a.pattern.test(domain))
    if (known) return { agency: known.label, url: known.url }
    return { agency: domain }
  }

  // 3. Known agency abbreviations / names
  for (const { pattern, label, url } of KNOWN_AGENCIES) {
    if (pattern.test(nextStep)) return { agency: label, url }
  }

  return null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categorizeSection(title: string): SectionCategory {
  const t = title.toLowerCase()
  if (t.includes('action plan') || t.includes('30-day') || t.includes('30 day')) return 'action-plan'
  if (t.includes('veteran')) return 'veteran'
  if (t.includes('federal') || t.includes('sba') || t.includes('usda') || t.includes('sbir') || t.includes('sttr')) return 'federal'
  if (t.includes('texas state') || t.includes('state program') || t.includes('texas program')) return 'state'
  if (t.includes('local') || t.includes('city') || t.includes('county') || t.includes('municipal')) return 'local'
  if (t.includes('tax') || t.includes('deduction') || t.includes('credit')) return 'tax'
  if (t.includes('certif')) return 'certification'
  if (t.includes('contract') || t.includes('sam.gov') || t.includes('procurement') || t.includes('set-aside')) return 'contracting'
  if (t.includes('industry') || t.includes('sector') || t.includes('niche') || t.includes('specific')) return 'industry'
  return 'other'
}

function extractField(text: string, fieldName: string): string {
  // Handles **FieldName:** content — stops at next **Field: or double newline
  const regex = new RegExp(
    `\\*\\*${fieldName}:\\*\\*\\s*(.+?)(?=\\n\\s*\\*\\*(?:Value|Deadline|Why you qualify|Next step|Why You Qualify|Next Step):|\\n\\n|$)`,
    'si'
  )
  const match = text.match(regex)
  return match ? match[1].trim().replace(/\n/g, ' ') : ''
}

function parseDollarMax(text: string): number {
  let max = 0
  const re = /\$([0-9,]+(?:\.[0-9]+)?)\s*(billion|B|million|M|thousand|K)?/gi
  for (const m of text.matchAll(re)) {
    let val = parseFloat(m[1].replace(/,/g, ''))
    const s = (m[2] || '').toLowerCase()
    if (s.startsWith('b')) val *= 1e9
    else if (s.startsWith('m')) val *= 1e6
    else if (s === 'k' || s.startsWith('t')) val *= 1e3
    if (!isNaN(val) && val > max) max = val
  }
  return max
}

// ─── Deadline date parser ─────────────────────────────────────────────────────

/**
 * Attempt to extract a concrete Date from a deadline string.
 * Returns undefined for rolling, unverified, or unparseable deadlines.
 */
export function parseDeadlineDate(deadline: string): Date | undefined {
  if (!deadline) return undefined
  const dl = deadline.toLowerCase()

  // Skip non-specific / rolling deadlines
  if (
    dl.includes('rolling') ||
    dl.includes('anytime') ||
    dl.includes('open enrollment') ||
    dl.includes('verify') ||
    dl.includes('typically') ||
    dl === 'verify with agency'
  ) return undefined

  const MONTHS: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3,
    jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  }

  // "Month DD, YYYY" or "Month DD YYYY" (handles "Apply by: September 30, 2026")
  const longM = deadline.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/)
  if (longM) {
    const m = MONTHS[longM[1].toLowerCase()]
    if (m !== undefined) {
      const d = new Date(parseInt(longM[3]), m, parseInt(longM[2]))
      if (!isNaN(d.getTime())) return d
    }
  }

  // "MM/DD/YYYY"
  const slashM = deadline.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashM) {
    const d = new Date(parseInt(slashM[3]), parseInt(slashM[1]) - 1, parseInt(slashM[2]))
    if (!isNaN(d.getTime())) return d
  }

  return undefined
}

function deriveBadges(
  name: string,
  value: string,
  deadline: string,
  rawText: string,
  category: SectionCategory,
): Badge[] {
  const badges: Badge[] = []
  const meta = SECTION_META[category]
  const combined = (name + ' ' + rawText).toLowerCase()
  const dl = deadline.toLowerCase()

  // 1. Category badge (always first)
  badges.push({ label: meta.badgeLabel, variant: meta.badgeVariant })

  // 2. Timing badge
  if (dl.includes('rolling') || dl.includes('anytime') || dl.includes('open enrollment')) {
    badges.push({ label: 'Quick Apply', variant: 'green' })
  } else if (deadline && !dl.includes('verify') && !dl.includes('typically') && deadline !== 'Verify with agency') {
    badges.push({ label: 'Deadline Set', variant: 'amber' })
  }

  // 3. Audience badge (pick at most one)
  if (combined.includes('veteran') || combined.includes('vosb') || combined.includes('sdvosb')) {
    if (category !== 'veteran') badges.push({ label: 'Veteran Friendly', variant: 'red' })
  } else if (combined.includes('woman-owned') || combined.includes('wosb') || combined.includes('women-owned')) {
    badges.push({ label: 'Women Owned', variant: 'purple' })
  } else if (combined.includes('minority') || combined.includes('8(a)') || combined.includes('minority-owned')) {
    badges.push({ label: 'Minority Owned', variant: 'teal' })
  } else {
    const valueNum = parseDollarMax(value)
    if (valueNum >= 100_000) badges.push({ label: 'High Funding', variant: 'green' })
  }

  return badges.slice(0, 3)
}

// ─── Opportunity parser ───────────────────────────────────────────────────────

function parseOpportunities(sectionText: string, category: SectionCategory): ParsedOpportunity[] {
  const opportunities: ParsedOpportunity[] = []
  const lines = sectionText.split('\n')

  // Find lines that are a standalone bold program name:
  //   **Program Name**    (entire trimmed line is bold, no field-label colon)
  const startLines: number[] = []

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (
      /^\*\*[^*]+\*\*\s*$/.test(trimmed) &&
      !/^\*\*(Value|Deadline|Why you qualify|Next step|Why You Qualify|Next Step)\s*:/i.test(trimmed)
    ) {
      startLines.push(i)
    }
  }

  if (startLines.length === 0) return []

  for (let i = 0; i < startLines.length; i++) {
    const start = startLines[i]
    const end = i + 1 < startLines.length ? startLines[i + 1] : lines.length
    const block = lines.slice(start, end).join('\n')

    const name = lines[start].replace(/\*\*/g, '').trim()
    if (!name) continue

    const value      = extractField(block, 'Value')      || extractField(block, 'value')
    const deadline   = extractField(block, 'Deadline')   || extractField(block, 'deadline')
    const whyQualify = extractField(block, 'Why you qualify') || extractField(block, 'Why You Qualify')
    const nextStep   = extractField(block, 'Next step')  || extractField(block, 'Next Step')

    const valueNum   = parseDollarMax(value)
    const dl         = deadline.toLowerCase()
    const isRolling  = dl.includes('rolling') || dl.includes('anytime') || dl.includes('open enrollment')
    const isHighValue = valueNum >= 10_000
    const isUrgent   = !!deadline && !isRolling && !dl.includes('verify') && !dl.includes('typically') && deadline !== ''

    const badges       = deriveBadges(name, value, deadline, block, category)
    const src          = extractSource(nextStep)
    const deadlineStr  = deadline || 'Verify with agency'
    const deadlineDate = parseDeadlineDate(deadlineStr)

    opportunities.push({
      id: `${category}-${i}-${name.slice(0, 16).replace(/\W/g, '-')}`,
      name,
      value:      value || 'See program details',
      valueNum,
      deadline:   deadlineStr,
      deadlineDate,
      whyQualify,
      nextStep,
      rawText: block,
      badges,
      isHighValue,
      isRolling,
      isUrgent,
      sourceAgency: src?.agency,
      sourceUrl:    src?.url,
    })
  }

  return opportunities
}

// ─── Action plan step parser ──────────────────────────────────────────────────

function parseActionPlanSteps(text: string): ActionPlanStep[] {
  const steps: ActionPlanStep[] = []
  // Split on lines that start a numbered item
  const chunks = text.split(/\n(?=\d+\.\s)/).filter(Boolean)

  for (const chunk of chunks) {
    const m = chunk.match(/^(\d+)\.\s+(.+)/s)
    if (!m) continue

    const num     = parseInt(m[1])
    const content = m[2].trim()

    // Extract title: bold text OR text before em-dash OR first clause
    let title = ''
    let detail = content

    const boldM = content.match(/^\*\*([^*]+)\*\*/)
    if (boldM) {
      title  = boldM[1].trim()
      detail = content.slice(boldM[0].length).replace(/^\s*[—–-]\s*/, '').trim()
    } else {
      const dashIdx = content.search(/\s[—–]\s/)
      if (dashIdx > 0) {
        title  = content.slice(0, dashIdx).trim()
        detail = content.slice(dashIdx).replace(/^\s*[—–]\s*/, '').trim()
      } else {
        const periodIdx = content.indexOf('. ')
        title  = periodIdx > 0 ? content.slice(0, periodIdx) : content.slice(0, 80)
        detail = periodIdx > 0 ? content.slice(periodIdx + 2).trim() : ''
      }
    }

    steps.push({ num, title, detail, raw: chunk })
  }

  return steps
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseReport(markdown: string): ParsedReport {
  const text = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Split on lines beginning with ##
  const rawSections = text.split(/\n(?=## )/)

  const sections: ParsedSection[] = []

  for (const raw of rawSections) {
    const trimmed = raw.trimStart()
    if (!trimmed.startsWith('##')) continue   // skip intro text before first header

    const nl = trimmed.indexOf('\n')
    if (nl === -1) continue

    const title    = trimmed.slice(0, nl).replace(/^##\s*/, '').trim()
    const body     = trimmed.slice(nl + 1)
    if (!title) continue

    const category    = categorizeSection(title)
    const isActionPlan = category === 'action-plan'
    const meta        = SECTION_META[category]

    let opportunities: ParsedOpportunity[] = []
    let actionSteps:   ActionPlanStep[]    = []
    let isParsed = false

    if (isActionPlan) {
      actionSteps = parseActionPlanSteps(body)
      isParsed    = actionSteps.length > 0
    } else {
      opportunities = parseOpportunities(body, category)
      isParsed      = opportunities.length > 0
    }

    sections.push({
      id:          `s${sections.length}-${category}`,
      title,
      category,
      icon:        meta.icon,
      color:       meta.color,
      opportunities,
      actionSteps,
      rawText:     body,
      isActionPlan,
      isParsed,
    })
  }

  const allOpps = sections.filter(s => !s.isActionPlan).flatMap(s => s.opportunities)

  return {
    sections,
    totalOpportunities: allOpps.length,
    highValueCount:     allOpps.filter(o => o.isHighValue).length,
    urgentCount:        allOpps.filter(o => o.isUrgent && !o.isRolling).length,
    rollingCount:       allOpps.filter(o => o.isRolling).length,
  }
}
