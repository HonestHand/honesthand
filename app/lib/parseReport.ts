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
  deadlineDate?: Date
  whyQualify: string
  nextStep: string
  rawText: string
  badges: Badge[]
  isHighValue: boolean
  isRolling: boolean
  isUrgent: boolean
  sourceAgency?: string
  sourceUrl?: string
  amountDisplay: string
  fundingType: string | null
  fundingStyle: string | null
  fundingHighlight: string | null
  deadlineDisplay: string
  deadlineContext: string | null
  whyFragments: string[]
  nextStepClean: string
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
  federal:       { icon: '🏛️', color: '#3B82F6', badgeLabel: 'Federal Program',    badgeVariant: 'blue'   },
  state:         { icon: '⭐', color: '#F97316', badgeLabel: 'TX State Program',    badgeVariant: 'amber'  },
  local:         { icon: '📍', color: '#8B5CF6', badgeLabel: 'Local Program',       badgeVariant: 'purple' },
  tax:           { icon: '🧾', color: '#10B981', badgeLabel: 'Tax Credit',          badgeVariant: 'green'  },
  certification: { icon: '📜', color: '#14B8A6', badgeLabel: 'Certification',       badgeVariant: 'teal'   },
  contracting:   { icon: '🤝', color: '#1E40AF', badgeLabel: "Gov't Contracting",  badgeVariant: 'blue'   },
  industry:      { icon: '🏗️', color: '#F59E0B', badgeLabel: 'Industry Program',   badgeVariant: 'amber'  },
  veteran:       { icon: '🎖️', color: '#EF4444', badgeLabel: 'Veteran Program',    badgeVariant: 'red'    },
  'action-plan': { icon: '✅', color: '#059669', badgeLabel: 'Action Plan',         badgeVariant: 'green'  },
  other:         { icon: '📋', color: '#6B7280', badgeLabel: 'Program',             badgeVariant: 'gray'   },
}

// ─── JSON opportunity schema (what the LLM returns) ───────────────────────────

interface JsonDeadline {
  type?: 'fixed' | 'rolling' | 'ongoing' | 'seasonal'
  headline?: string
  supporting_text?: string
  urgency?: 'high' | 'medium' | 'low'
}

interface JsonFundingSnapshot {
  amount?: string
  funding_type?: string
}

interface JsonOpportunity {
  id?: string
  title?: string
  category?: string
  program_type?: string
  tags?: string[]
  funding_snapshot?: JsonFundingSnapshot
  deadline?: JsonDeadline
  why_you_qualify?: string[]
  next_step?: string
  qualification_detail?: string
  official_url?: string
  official_source_name?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

export function parseDeadlineDate(deadline: string): Date | undefined {
  if (!deadline) return undefined
  const dl = deadline.toLowerCase()
  if (
    dl.includes('rolling') || dl.includes('anytime') ||
    dl.includes('open enrollment') || dl.includes('verify') || dl.includes('typically')
  ) return undefined

  const MONTHS: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  }
  const longM = deadline.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/)
  if (longM) {
    const m = MONTHS[longM[1].toLowerCase()]
    if (m !== undefined) {
      const d = new Date(parseInt(longM[3]), m, parseInt(longM[2]))
      if (!isNaN(d.getTime())) return d
    }
  }
  const slashM = deadline.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashM) {
    const d = new Date(parseInt(slashM[3]), parseInt(slashM[1]) - 1, parseInt(slashM[2]))
    if (!isNaN(d.getTime())) return d
  }
  return undefined
}

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

// ─── JSON parse with fallback ─────────────────────────────────────────────────

function parseJsonResponse(raw: string): JsonOpportunity[] {
  // Attempt 1: direct JSON.parse
  try {
    const parsed = JSON.parse(raw.trim())
    if (Array.isArray(parsed)) return parsed
  } catch { /* fall through */ }

  // Attempt 2: extract JSON array via regex
  const match = raw.match(/\[[\s\S]*\]/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed)) return parsed
    } catch { /* fall through */ }
  }

  // Attempt 3: recover partial array — walk backward through every } until JSON.parse succeeds.
  // A single lastIndexOf is insufficient because the last } may close a nested sub-object
  // inside an incomplete top-level object (e.g. a truncated qualification_detail field).
  // Walking backward guarantees we find the last COMPLETE top-level object.
  let pos = raw.lastIndexOf('}')
  while (pos > 0) {
    const sliced    = raw.substring(0, pos + 1)
    const candidate = (sliced.trimStart().startsWith('[') ? sliced : '[' + sliced) + ']'
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch { /* try the previous } */ }
    pos = raw.lastIndexOf('}', pos - 1)
  }

  // All three attempts failed — throw structured error
  throw { error: 'PARSE_FAILURE', raw }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['id', 'title', 'next_step', 'why_you_qualify', 'qualification_detail'] as const
const VALID_DEADLINE_TYPES = new Set(['fixed', 'rolling', 'ongoing', 'seasonal'])

function validateOpportunity(opp: unknown, index: number): opp is JsonOpportunity {
  if (!opp || typeof opp !== 'object') {
    console.warn(`[parseReport] Opportunity at index ${index} is not an object — filtered out`)
    return false
  }
  const o = opp as Record<string, unknown>

  for (const field of REQUIRED_FIELDS) {
    if (o[field] === undefined || o[field] === null || o[field] === '') {
      console.warn(`[parseReport] Opportunity ${index} ("${o.title ?? 'unknown'}") missing required field: "${field}" — filtered out`)
      return false
    }
  }

  if (!Array.isArray(o.why_you_qualify)) {
    console.warn(`[parseReport] Opportunity ${index} ("${o.title}") why_you_qualify is not an array — filtered out`)
    return false
  }

  if (o.deadline && typeof o.deadline === 'object') {
    const dl = (o.deadline as Record<string, unknown>).type
    if (dl !== undefined && !VALID_DEADLINE_TYPES.has(dl as string)) {
      console.warn(`[parseReport] Opportunity ${index} ("${o.title}") invalid deadline.type: "${dl}"`)
    }
  }

  return true
}

// ─── Sanitizer ────────────────────────────────────────────────────────────────

function sanitizeStr(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/##/g, '')
    .replace(/--/g, '—')
    .replace(/\* /g, '')
    .trim()
}

function sanitizeOpportunity(opp: JsonOpportunity): JsonOpportunity {
  return {
    ...opp,
    title:                sanitizeStr(opp.title),
    next_step:            sanitizeStr(opp.next_step),
    qualification_detail: sanitizeStr(opp.qualification_detail),
    why_you_qualify:      (opp.why_you_qualify || []).map(sanitizeStr).filter(Boolean),
    funding_snapshot: opp.funding_snapshot ? {
      amount:       sanitizeStr(opp.funding_snapshot.amount),
      funding_type: sanitizeStr(opp.funding_snapshot.funding_type),
    } : undefined,
    deadline: opp.deadline ? {
      ...opp.deadline,
      headline:        sanitizeStr(opp.deadline.headline),
      supporting_text: sanitizeStr(opp.deadline.supporting_text),
    } : undefined,
    official_source_name: sanitizeStr(opp.official_source_name),
  }
}

// ─── Map JSON opportunity → ParsedOpportunity ────────────────────────────────

function mapOpportunity(opp: JsonOpportunity, category: SectionCategory, idx: number): ParsedOpportunity {
  const isRolling     = opp.deadline?.type === 'rolling' || opp.deadline?.type === 'ongoing'
  const isUrgent      = opp.deadline?.urgency === 'high' && !isRolling
  const amountDisplay = sanitizeStr(opp.funding_snapshot?.amount) || 'See program details'
  const valueNum      = parseDollarMax(amountDisplay)
  const deadlineDisplay = sanitizeStr(opp.deadline?.headline) || 'Verify with agency'
  const deadlineContext = sanitizeStr(opp.deadline?.supporting_text) || null
  const deadlineDate  = parseDeadlineDate(deadlineDisplay)

  const meta  = SECTION_META[category]
  const tags  = opp.tags || []
  const badges: Badge[] = [{ label: meta.badgeLabel, variant: meta.badgeVariant }]
  if (isRolling)                                     badges.push({ label: 'Quick Apply',      variant: 'green'  })
  else if (deadlineDate)                             badges.push({ label: 'Deadline Set',     variant: 'amber'  })
  if      (tags.some(t => /veteran/i.test(t)))       badges.push({ label: 'Veteran Friendly', variant: 'red'    })
  else if (tags.some(t => /women|woman/i.test(t)))   badges.push({ label: 'Women Owned',      variant: 'purple' })
  else if (tags.some(t => /minority/i.test(t)))      badges.push({ label: 'Minority Owned',   variant: 'teal'   })
  else if (valueNum >= 100_000)                      badges.push({ label: 'High Funding',     variant: 'green'  })

  const id = sanitizeStr(opp.id) ||
    `${category}-${idx}-${sanitizeStr(opp.title).slice(0, 16).replace(/\W/g, '-')}`

  return {
    id,
    name:             sanitizeStr(opp.title),
    value:            amountDisplay,
    valueNum,
    deadline:         deadlineDisplay,
    deadlineDate,
    whyQualify:       sanitizeStr(opp.qualification_detail),
    nextStep:         sanitizeStr(opp.next_step),
    rawText:          JSON.stringify(opp),
    badges:           badges.slice(0, 3),
    isHighValue:      valueNum >= 10_000,
    isRolling,
    isUrgent,
    sourceAgency:     sanitizeStr(opp.official_source_name) || undefined,
    sourceUrl:        sanitizeStr(opp.official_url) || undefined,
    amountDisplay,
    fundingType:      sanitizeStr(opp.funding_snapshot?.funding_type) || null,
    fundingStyle:     null,
    fundingHighlight: null,
    deadlineDisplay,
    deadlineContext,
    whyFragments:     (opp.why_you_qualify || []).map(sanitizeStr).filter(Boolean),
    nextStepClean:    sanitizeStr(opp.next_step),
  }
}

// ─── Nonprofit language filter (kept exactly as original) ─────────────────────

const NONPROFIT_BLOCKLIST = [
  'nonprofit', 'non-profit', '501(c)', '501c3', '501c ',
  'tax-exempt', 'charitable organization', 'not-for-profit',
  'donor-funded', 'foundation-supported',
]

function containsNonprofitLanguage(text: string): boolean {
  const lower = text.toLowerCase()
  return NONPROFIT_BLOCKLIST.some(term => lower.includes(term))
}

export function filterReportForProfile(
  report: ParsedReport,
  opts: { userType?: string; is501c3?: boolean; entityType?: string } | null | undefined,
): ParsedReport {
  if (!opts) return report

  const isNonprofit =
    opts.is501c3 === true ||
    opts.userType === 'nonprofit' ||
    (opts.entityType || '').toLowerCase().includes('nonprofit') ||
    (opts.entityType || '').toLowerCase().includes('non-profit')

  if (isNonprofit) return report

  const filteredSections = report.sections.map(section => {
    const filteredOpps = section.opportunities
      .filter(opp => {
        const eligibilityText = [opp.name, opp.whyQualify].join(' ')
        return !containsNonprofitLanguage(eligibilityText)
      })
      .map(opp => ({
        ...opp,
        whyFragments: opp.whyFragments.filter(f => !containsNonprofitLanguage(f)),
      }))
    return { ...section, opportunities: filteredOpps }
  })

  const allOpps = filteredSections
    .filter(s => !s.isActionPlan)
    .flatMap(s => s.opportunities)

  return {
    sections: filteredSections,
    totalOpportunities: allOpps.length,
    highValueCount:     allOpps.filter(o => o.isHighValue).length,
    urgentCount:        allOpps.filter(o => o.isUrgent && !o.isRolling).length,
    rollingCount:       allOpps.filter(o => o.isRolling).length,
  }
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseReport(raw: string): ParsedReport {
  // Step 1: Parse JSON — throws { error: 'PARSE_FAILURE', raw } on total failure
  const jsonOpps = parseJsonResponse(raw)

  // Step 2: Validate — filter out any opportunity missing required fields
  const validated = jsonOpps.filter((opp, i) => validateOpportunity(opp, i)) as JsonOpportunity[]

  // Step 3: Sanitize — strip all markdown artifacts from every string field
  const sanitized = validated.map(sanitizeOpportunity)

  // Step 4: Group by category into ParsedSections
  const sectionMap = new Map<string, JsonOpportunity[]>()
  for (const opp of sanitized) {
    const cat = opp.category || 'Other'
    if (!sectionMap.has(cat)) sectionMap.set(cat, [])
    sectionMap.get(cat)!.push(opp)
  }

  const sections: ParsedSection[] = []
  let sIdx = 0

  for (const [catTitle, opps] of sectionMap) {
    const category     = categorizeSection(catTitle)
    const isActionPlan = category === 'action-plan'
    const meta         = SECTION_META[category]

    const opportunities: ParsedOpportunity[] = isActionPlan
      ? []
      : opps.map((o, i) => mapOpportunity(o, category, i))

    const actionSteps: ActionPlanStep[] = isActionPlan
      ? opps.map((o, i) => ({
          num:    i + 1,
          title:  sanitizeStr(o.title),
          detail: sanitizeStr(o.qualification_detail) || sanitizeStr(o.next_step) || '',
          raw:    JSON.stringify(o),
        }))
      : []

    sections.push({
      id:          `s${sIdx++}-${category}`,
      title:       catTitle,
      category,
      icon:        meta.icon,
      color:       meta.color,
      opportunities,
      actionSteps,
      rawText:     JSON.stringify(opps),
      isActionPlan,
      isParsed:    isActionPlan ? actionSteps.length > 0 : opportunities.length > 0,
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
