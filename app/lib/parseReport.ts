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
  value: string           // raw full value text (kept for badge/value logic)
  valueNum: number
  deadline: string        // raw full deadline text (kept for badge/urgency logic)
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
  // ── Structured display fields ─────────────────────────────────────────────
  // These are CLASSIFIED from name/category/badges — never raw AI prose blobs
  amountDisplay: string          // dollar figure only: "Up to $5,000,000"
  fundingType: string | null     // instrument type: "SBA 7(a) Loan", "Business grant"
  fundingStyle: string | null    // structure detail: "Non-repayable", "Reduced fees"
  fundingHighlight: string | null // semantic benefit: "Veteran fee reductions"
  deadlineDisplay: string        // timing label: "Rolling", "March 31, 2025"
  deadlineContext: string | null // one-line context: "Apply anytime", "Opens quarterly"
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

// ─── Structured field classifiers ────────────────────────────────────────────
// These derive clean UI metadata from name / category / badges / raw text.
// They intentionally do NOT render prose — they classify and label.

/**
 * Strict dollar-amount extractor.
 * Matches the monetary figure at the start of the value string and stops there.
 * "Up to $5,000,000 for restaurant equipment…" → "Up to $5,000,000"
 * "$10,000–$25,000 (one-time, non-repayable)"  → "$10,000–$25,000"
 * Never returns trailing prose or parentheticals.
 */
function extractAmount(rawValue: string): string {
  if (!rawValue || rawValue === 'See program details') return rawValue || 'See program details'

  // 1. Try to match an explicit amount pattern at the start
  const amountRe = /^((?:up\s+to\s+|at\s+least\s+|as\s+much\s+as\s+|from\s+|approximately\s+|max(?:imum)?\s+of\s+)?(?:\$[\d,]+(?:\.\d+)?\s*(?:million|billion|thousand|[KMBkmb])?(?:\s*[+])?(?:\s*(?:–|-|to)\s*\$[\d,]+(?:\.\d+)?\s*(?:million|billion|thousand|[KMBkmb])?)?))/i
  const amtMatch = rawValue.match(amountRe)
  if (amtMatch && amtMatch[1].includes('$'))
    return amtMatch[1].trim().replace(/\s*\([^)]{1,60}\)\s*$/, '').trim()

  // 2. Percentage-based (tax credits): "20% of qualified wages"
  const pctMatch = rawValue.match(/^(\d+(?:\.\d+)?%(?:\s+of\s+[\w\s]{3,30})?)/i)
  if (pctMatch) return pctMatch[1].trim()

  // 3. "Varies" / "Variable" / "Negotiable"
  const varMatch = rawValue.match(/^(varies|variable|negotiable)/i)
  if (varMatch) return varMatch[1].trim()

  // 4. Fallback: first sentence if short
  const dot = rawValue.search(/\.\s/)
  if (dot > 3 && dot < 60) return rawValue.slice(0, dot).trim()

  // 5. Last resort: short as-is, longer gets hard cut
  return rawValue.length <= 60 ? rawValue : rawValue.slice(0, 58).trim() + '…'
}

/**
 * Classify the funding instrument type from the opportunity name, value text,
 * and section category. Returns a short label — never raw prose.
 */
function inferFundingType(name: string, rawValue: string, category: SectionCategory): string | null {
  const c = (name + ' ' + rawValue).toLowerCase()

  if (c.includes('7(a)') || c.includes('7a loan'))           return 'SBA 7(a) Loan'
  if (c.includes('504') && c.includes('sba'))                return 'SBA 504 Loan'
  if (c.includes('microloan') || c.includes('micro loan'))   return 'SBA Microloan'
  if (c.includes('sbir') || c.includes('sttr'))              return 'Research grant (SBIR/STTR)'
  if (c.includes('sba'))                                      return 'SBA-backed financing'
  if (category === 'tax' || c.includes('tax credit'))        return 'Tax credit'
  if (c.includes('tax deduction'))                           return 'Tax deduction'
  if (c.includes('rebate'))                                  return 'Rebate program'
  if (category === 'certification' || c.includes('certif'))  return 'Certification program'
  if (category === 'contracting' || c.includes('set-aside')) return "Gov't contract opportunity"
  if (c.includes('grant') && !c.includes('loan'))            return 'Business grant'
  if (c.includes('loan'))                                    return 'Business loan'
  if (c.includes('bond'))                                    return 'Surety bond program'

  return null
}

/**
 * Classify the funding structure — adds info NOT already obvious from the type.
 * e.g. "Non-repayable", "Matching required", "Reduced guarantee fees".
 * Returns null when there's nothing additive to say.
 */
function inferFundingStyle(name: string, rawValue: string, category: SectionCategory): string | null {
  const c = (name + ' ' + rawValue).toLowerCase()

  if (c.includes('one-time') || c.includes('one time'))return 'One-time grant'
  if (c.includes('non-repayable') || c.includes('does not need to be repaid')) return 'Non-repayable grant'
  if (c.includes('forgivable'))                        return 'Potentially forgivable'
  if (c.includes('matching') && (c.includes('grant') || c.includes('required'))) return 'Matching grant required'
  if (c.includes('fee reduction') || c.includes('fee waiver') || c.includes('reduced fee')) return 'Reduced guarantee fees'
  if (category === 'certification')                    return 'Unlocks set-aside contracts'
  if (category === 'contracting')                      return 'Competitive bid process'
  // Don't state the obvious: "Repayment required" for loans, "Reduces tax" for credits
  return null
}

/**
 * Derive a semantic one-line benefit/highlight from name, category, and badges.
 * This is CLASSIFICATION, not extraction — it never reads prose.
 */
function deriveFundingHighlight(
  name: string,
  category: SectionCategory,
  badges: Badge[],
): string | null {
  const n = name.toLowerCase()
  const bl = badges.map(b => b.label.toLowerCase()).join(' ')
  const c = n + ' ' + bl

  // Veteran
  if (c.includes('sdvosb') || c.includes('service-disabled'))   return 'Service-disabled veteran set-aside'
  if (c.includes('veteran advantage'))                           return 'Reduced SBA guarantee fees'
  if (c.includes('veteran') || bl.includes('veteran'))          return 'Veteran-owned business priority'

  // Diversity
  if (c.includes('wosb') || c.includes('women-owned') || c.includes('women owned')) return 'Women-owned business program'
  if (c.includes('8(a)') || c.includes('hubzone'))              return 'Minority / HUBZone priority'
  if (c.includes('minority'))                                    return 'Minority-owned business priority'

  // Local / city
  if (category === 'local') {
    if (c.includes('austin'))       return 'Austin-based program'
    if (c.includes('houston'))      return 'Houston-based program'
    if (c.includes('dallas'))       return 'Dallas-based program'
    if (c.includes('san antonio'))  return 'San Antonio program'
    if (c.includes('fort worth'))   return 'Fort Worth program'
    return 'City / county program'
  }

  // Industry keywords in the name
  if (n.includes('restaurant') || n.includes('food service')) return 'Restaurant & food service eligible'
  if (n.includes('technology') || n.includes('tech'))        return 'Technology business eligible'
  if (n.includes('construction'))                             return 'Construction eligible'
  if (n.includes('healthcare') || n.includes('medical'))     return 'Healthcare eligible'
  if (n.includes('energy') || n.includes('solar'))           return 'Clean energy eligible'
  if (n.includes('hiring') || n.includes('workforce') || n.includes('training')) return 'Hiring & workforce program'

  return null
}

/** Title-case a short string for display labels. */
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Extract just the timing label from raw deadline prose.
 * "Rolling. Applications accepted year-round…"      → "Rolling"
 * "March 31, 2025. Submissions must be…"            → "March 31, 2025"
 * "Typically opens in late 2026 — monitor…"         → "Opens Late 2026"
 * "Next cycle anticipated late 2026 — monitor…"     → "Late 2026"
 * "Expected Fall 2026"                              → "Fall 2026"
 */
function extractDeadlineDisplay(rawDeadline: string): string {
  if (!rawDeadline) return 'Verify with agency'
  if (rawDeadline === 'Verify with agency') return 'Verify with agency'

  const dl = rawDeadline.toLowerCase()
  if (dl.startsWith('rolling') || dl.includes('open enrollment') || dl.startsWith('anytime')) return 'Rolling'

  // "Typically opens [in] [period]" → "Opens [Period]"
  const typM = rawDeadline.match(/typically\s+opens?\s+(?:in\s+)?((?:(?:early|mid|late)\s+)?\d{4}|(?:early|mid|late)\s+\d{4}|(?:fall|spring|summer|winter)(?:\s+\d{4})?)/i)
  if (typM) return `Opens ${toTitleCase(typM[1])}`

  // "[anticipated|expected] [period]" — may be prefixed with "next cycle" etc.
  const antM = rawDeadline.match(/(?:anticipated|expected)\s+(?:in\s+)?((?:(?:early|mid|late)\s+)?\d{4}|(?:early|mid|late)\s+\d{4}|(?:fall|spring|summer|winter)(?:\s+\d{4})?)/i)
  if (antM) return toTitleCase(antM[1])

  // Standalone season + year anywhere: "Fall 2026", "Late 2026"
  const seasonM = rawDeadline.match(/((?:early|mid|late)\s+\d{4}|(?:fall|spring|summer|winter)\s+\d{4})/i)
  if (seasonM) return toTitleCase(seasonM[1])

  const dot = rawDeadline.search(/\.\s/)
  if (dot > 2 && dot < 50) return rawDeadline.slice(0, dot).trim()
  if (rawDeadline.length <= 50) return rawDeadline

  return rawDeadline.slice(0, 48).trim() + '…'
}

/**
 * Derive a one-line timing context from raw deadline prose.
 */
function extractDeadlineContext(rawDeadline: string): string | null {
  if (!rawDeadline) return null
  const dl = rawDeadline.toLowerCase()

  if (dl.includes('rolling') || dl.includes('anytime'))       return 'Apply anytime'
  if (dl.includes('quarterly'))                                return 'Opens quarterly'
  if (dl.includes('annually') || dl.includes('annual'))       return 'Renews annually'
  if (dl.includes('typically') || dl.includes('anticipated') || dl.includes('expected')) return 'Monitor next cycle'
  const seasonMatch = rawDeadline.match(/(fall|spring|summer|winter)\s+20\d\d/i)
  if (seasonMatch)                                             return 'Monitor next cycle'
  if (dl.includes('reminder'))                                 return 'Set a reminder'
  if (dl.includes('verify'))                                   return 'Confirm with agency'

  return null
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

    // Strip residual ** markdown from text fields so the UI never sees bold artifacts
    const stripBold  = (s: string) => s.replace(/\*\*/g, '').trim()
    const whyQualify = stripBold(extractField(block, 'Why you qualify') || extractField(block, 'Why You Qualify'))
    const nextStep   = stripBold(extractField(block, 'Next step')  || extractField(block, 'Next Step'))

    const valueNum    = parseDollarMax(value)
    const dl          = deadline.toLowerCase()
    const isRolling   = dl.includes('rolling') || dl.includes('anytime') || dl.includes('open enrollment')
    const isHighValue = valueNum >= 10_000
    const isUrgent    = !!deadline && !isRolling && !dl.includes('verify') && !dl.includes('typically') && deadline !== ''

    const badges       = deriveBadges(name, value, deadline, block, category)
    const src          = extractSource(nextStep)
    const deadlineStr  = deadline || 'Verify with agency'
    const deadlineDate = parseDeadlineDate(deadlineStr)

    // ── Structured display fields ────────────────────────────────────────────
    // Classified from name/category/badges — never raw AI prose blobs
    const rawValue         = value || 'See program details'
    const amountDisplay    = extractAmount(rawValue)
    const fundingType      = inferFundingType(name, rawValue, category)
    const fundingStyle     = inferFundingStyle(name, rawValue, category)
    const fundingHighlight = deriveFundingHighlight(name, category, badges)
    const deadlineDisplay  = extractDeadlineDisplay(deadlineStr)
    const deadlineContext  = extractDeadlineContext(deadlineStr)

    opportunities.push({
      id: `${category}-${i}-${name.slice(0, 16).replace(/\W/g, '-')}`,
      name,
      value:      rawValue,
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
      amountDisplay,
      fundingType,
      fundingStyle,
      fundingHighlight,
      deadlineDisplay,
      deadlineContext,
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
