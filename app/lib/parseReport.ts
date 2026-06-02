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
  whyQualify: string      // raw full text — used only for Full Details
  nextStep: string        // raw full text — used only for Full Details
  rawText: string
  badges: Badge[]
  isHighValue: boolean
  isRolling: boolean
  isUrgent: boolean
  sourceAgency?: string   // extracted from nextStep (e.g. "SBA.gov", "TWC Texas")
  sourceUrl?: string      // official URL if found in nextStep
  // ── Structured display fields ─────────────────────────────────────────────
  // These are CLASSIFIED/NORMALIZED — never raw AI prose blobs
  amountDisplay: string          // dollar figure only: "Up to $5,000,000"
  fundingType: string | null     // instrument type: "SBA 7(a) Loan", "Business grant"
  fundingStyle: string | null    // structure detail: "Non-repayable", "Reduced fees"
  fundingHighlight: string | null // semantic benefit: "Veteran fee reductions"
  deadlineDisplay: string        // timing label: "Rolling", "March 31, 2025"
  deadlineContext: string | null // one-line context: "Apply anytime", "Opens quarterly"
  // ── Normalized card display fields ────────────────────────────────────────
  whyFragments: string[]         // 1–3 clean bullet reasons, no prose, no markdown
  nextStepClean: string          // one clean action sentence, no markdown, no duplicates
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
 * Hard limit: 40 chars. Strips markdown before processing.
 * "Up to **$500,000** for restaurant equipment…" → "Up to $500,000"
 * "$10,000–$25,000 (one-time, non-repayable)"    → "$10,000–$25,000"
 * "Access to sole-source federal contracts"       → "Contracting access"
 * Never returns raw prose, markdown, or truncated explanations.
 */
/**
 * Strip deadline/timing language from a raw value string.
 * The Funding Snapshot has one job — show the money. Timing belongs in the Timing section.
 *
 * Removes patterns like:
 *   "— Deadline: Rolling, apply anytime"
 *   "; typically opens fall cycle"
 *   ", rolling deadline"
 *   "— monitor next cycle"
 */
function stripDeadlineFromValue(v: string): string {
  return v
    // Hard separator + deadline keyword → strip from there to end
    .replace(/[\s—–]+(?:deadline[s]?[:\s]|rolling\b|apply\s+anytime|open\s+enrollment|opens?\s+(?:fall|spring|summer|winter|late|early|mid)|closes?\b|due\s+(?:date|by)\b|annual\s+filing|(?:fall|spring|summer|winter)\s+cycle|monitor\s+next|typically\s+opens?|verify\s+(?:at|with)|next\s+cycle|application\s+(?:window|period)).*/i, '')
    // Soft separator (semicolon, comma) + deadline keyword
    .replace(/[;,]\s*(?:deadline[s]?[:\s]|rolling\b|apply\s+anytime|opens?\s+(?:fall|spring|summer|winter)|closes?\b|annual\s+filing|monitor\s+next|typically\s+opens?).*/i, '')
    .trim()
}

function extractAmount(rawValue: string, programName?: string): string {
  if (!rawValue || rawValue === 'See program details') return 'See program details'

  // 1. Strip markdown bold/links, then strip any deadline language that bled in
  const v = stripDeadlineFromValue(
    rawValue
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()
  )

  // ── Allocation guard ──────────────────────────────────────────────────────
  // Detect statewide / total-fund allocations — these are NOT per-business amounts.
  //   "Texas Small Business Credit Initiative: $472 million" → "Varies by lender"
  //   "$850 million total SSBCI allocation"                  → "Varies by program"
  const guardCtx        = v + ' ' + (programName || '')
  const largeDollar     = parseDollarMax(v)
  const allocationWord  = /\b(?:total\s+(?:program|state|statewide|fund(?:ing)?|allocation)|statewide|ssbci|credit\s+initiative|initiative\s+(?:fund|allocation)|program\s+(?:pool|fund|size)|allocated\s+(?:to|for)|appropriated)\b/i.test(guardCtx)
  const lenderFundName  = /\b(?:credit\s+initiative|ssbci|revolving\s+(?:loan\s+)?fund|loan\s+(?:guarantee\s+)?fund|capital\s+access)\b/i.test(programName || '')

  if (largeDollar >= 10_000_000 && (allocationWord || lenderFundName)) {
    const isLoanBased = /\b(?:loan|credit|lend|bank|borrow|financing)\b/i.test(guardCtx)
    return isLoanBased ? 'Varies by lender' : 'Varies by program'
  }

  // 2. Dollar amount at/near start (stops before explanation prose)
  const amountRe = /^((?:up\s+to\s+|at\s+least\s+|as\s+much\s+as\s+|from\s+|approximately\s+|max(?:imum)?\s+of\s+)?(?:\$[\d,]+(?:\.\d+)?\s*(?:billion|million|thousand|[KMBkmb])?(?:\s*[+])?(?:\s*(?:–|-|to)\s*\$[\d,]+(?:\.\d+)?\s*(?:billion|million|thousand|[KMBkmb])?)?))/i
  const amtMatch = v.match(amountRe)
  if (amtMatch?.[1].includes('$')) {
    // Strip trailing parentheticals and qualifiers, then hard-cap at 70
    const amt = amtMatch[1].trim().replace(/\s*\([^)]{1,60}\)\s*$/, '').trim()
    if (amt.length <= 70) return amt
    const shorter = amt.replace(/\s+(?:per\s+\w+|annually|yearly|monthly|in\s+\w+).*$/i, '').trim()
    return shorter.length <= 70 ? shorter : shorter.slice(0, 68).replace(/\s+\S+$/, '') + '…'
  }

  // 2. Dollar amount anywhere in the string (e.g. after "Fee-waived; loans up to $5M")
  const anyDollar = v.match(/\$[\d,]+(?:\.\d+)?\s*(?:billion|million|thousand|[KMBkmb])?(?:\s*(?:–|-|to)\s*\$[\d,]+(?:\.\d+)?\s*(?:billion|million|thousand|[KMBkmb])?)?/i)
  if (anyDollar) {
    const amt = anyDollar[0].trim()
    return amt.length <= 70 ? amt : amt.slice(0, 68).replace(/\s+\S+$/, '') + '…'
  }

  // 3. Percentage (tax credits): "20% of qualified wages"
  const pctMatch = v.match(/^(\d+(?:\.\d+)?%(?:\s+of\s+[\w\s]{3,20})?)/i)
  if (pctMatch) return pctMatch[1].trim()

  // 4. Varies / Variable / Negotiable
  const varMatch = v.match(/^(varies|variable|negotiable)/i)
  if (varMatch) return varMatch[1].trim()

  // 5. Semantic labels for non-monetary programs (no truncation, always concise)
  if (/sole-source|set-aside|contract(?:ing)?/i.test(v))                     return 'Contracting access'
  if (/certif/i.test(v))                                                      return 'Certification benefit'
  if (/technical\s+assistance|free\s+(?:training|help|mentor)/i.test(v))     return 'Free assistance'
  if (/fee\s*(?:waiv|reduc|exempt)/i.test(v))                                return 'Fee reduction'
  if (/priority\s+(?:access|consideration)/i.test(v))                        return 'Priority access'
  if (/no\s+(?:direct\s+)?(?:cash\s+)?grant/i.test(v))                       return 'Non-monetary benefit'

  // 6. Short enough as-is
  if (v.length <= 70) return v

  // 7. Hard cap — word-boundary truncate at 68 chars
  return v.slice(0, 68).replace(/\s+\S+$/, '') + '…'
}

/**
 * Classify the funding instrument type from the opportunity name, value text,
 * and section category. Returns a short label — never raw prose.
 */
function inferFundingType(name: string, rawValue: string, category: SectionCategory): string | null {
  const c = (name + ' ' + rawValue).toLowerCase()

  // SBA loan products — most specific first
  if (c.includes('7(a)') || c.includes('7a loan'))             return 'SBA 7(a) Loan'
  if (c.includes('504') && c.includes('sba'))                  return 'SBA 504 Loan'
  if (c.includes('microloan') || c.includes('micro loan'))     return 'SBA Microloan'
  if (c.includes('sbir') || c.includes('sttr'))                return 'Research grant (SBIR/STTR)'
  if (c.includes('sba'))                                        return 'SBA-backed financing'

  // Tax credits — specific before generic
  if (c.includes('section 179') || c.includes('sec. 179'))     return 'Section 179 deduction'
  if (c.includes('bonus depreciation'))                        return 'Bonus depreciation'
  if (c.includes('work opportunity') || c.includes('wotc'))    return 'WOTC hiring credit'
  if (c.includes('employee retention') || /\bertc\b|\berc\b/.test(c)) return 'Employee retention credit'
  if (c.includes('r&d') || c.includes('research and dev'))     return 'R&D tax credit'
  if ((c.includes('childcare') || c.includes('child care')) && c.includes('credit')) return 'Childcare tax credit'
  if ((c.includes('energy') || c.includes('solar') || c.includes('efficiency')) && c.includes('credit')) return 'Energy tax credit'
  if (c.includes('veteran') && (c.includes('hire') || c.includes('hiring'))) return 'Veteran hiring credit'
  if (c.includes('franchise tax') || (c.includes('texas') && c.includes('franchise'))) return 'Texas franchise tax'
  if (c.includes('home office') || c.includes('schedule c'))   return 'Business use deduction'
  if (c.includes('self-employ') && c.includes('health'))       return 'Self-employed health deduction'
  if (c.includes('self-employ') && c.includes('tax'))          return 'SE tax deduction'
  if (category === 'tax' && c.includes('deduction'))           return 'Tax deduction'
  if (category === 'tax' || c.includes('tax credit'))          return 'Tax credit'

  if (c.includes('rebate'))                                    return 'Rebate program'
  if (category === 'certification' || c.includes('certif'))    return 'Certification program'
  if (category === 'contracting' || c.includes('set-aside'))   return "Gov't contract opportunity"
  if (c.includes('grant') && !c.includes('loan'))              return 'Business grant'
  if (c.includes('loan'))                                      return 'Business loan'
  if (c.includes('bond'))                                      return 'Surety bond program'

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

// ── Deadline contamination guards ────────────────────────────────────────────

/** Action verbs that indicate the "Deadline" field actually contains a Next Step */
const DEADLINE_ACTION_PREFIX = /^(?:file|submit|contact|register|call|visit|use\s+the|go\s+to|email|complete|discuss|review|prepare|gather|request|obtain|check\s+(?:with|the)|ask\s+your|find\s+(?:a|an|the)|search|apply\s+for|fill\s+out|get\s+started|schedule|attend|meet\s+with|obtain|locate)\b/i

/** Text that suggests real deadline/timing content */
const HAS_TIMING_SIGNAL = /\b(?:rolling|anytime|year.?round|open\s+enrollment|january|february|march|april|may|june|july|august|september|october|november|december|20\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|quarterly|annually|annual|cycle|deadline|opens?|closes?|due\s+(?:date|by)|apply\s+by|apply\s+before|spring|summer|fall|winter|ongoing|continuous|first\s+of\s+the|each\s+(?:year|month)|every\s+(?:year|quarter))\b/i

/**
 * Extract just the timing label from raw deadline prose.
 * Strips markdown artifacts and rejects action-instruction contamination.
 *
 * "Rolling. Applications accepted year-round…"      → "Rolling"
 * "March 31, 2025. Submissions must be…"            → "March 31, 2025"
 * "Typically opens in late 2026 — monitor…"         → "Opens Late 2026"
 * "File IRS Form 8850 within 28 days"               → "Verify with agency" (action, not deadline)
 * "Submit your application by October 1, 2026"      → "October 1, 2026" (has date)
 */
function extractDeadlineDisplay(rawDeadline: string): string {
  if (!rawDeadline) return 'Verify with agency'
  if (rawDeadline === 'Verify with agency') return 'Verify with agency'

  // ── Step 1: Strip ALL markdown before any logic runs ──────────────────────
  const cleaned = rawDeadline
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (!cleaned) return 'Verify with agency'

  const dl = cleaned.toLowerCase()

  // ── Step 2: Strip cross-field bleed BEFORE any length check or truncation ──
  // Claude occasionally runs the deadline field into "Why you qualify:" or
  // "Next step:" text. Use indexOf (not regex) to guarantee the cut regardless
  // of Unicode dash variants or asterisk formatting.
  const BLEED_MARKERS = [
    'why you qualify',
    'next step:',
    'next steps:',
    '- why you',
    '— why you',
    '– why you',
  ]
  let cutAt = cleaned.length
  const lc = cleaned.toLowerCase()
  for (const marker of BLEED_MARKERS) {
    const idx = lc.indexOf(marker)
    if (idx > 4 && idx < cutAt) cutAt = idx
  }
  const work = cleaned.slice(0, cutAt).replace(/[\s\-—–]+$/, '').trim() || cleaned

  const workLower = work.toLowerCase()

  // ── Step 3: Rolling / open enrollment ─────────────────────────────────────
  if (workLower.startsWith('rolling') || workLower.includes('open enrollment') || workLower.startsWith('anytime')) return 'Rolling'

  // ── Step 4: Contamination guard (use de-contaminated `work`) ────────────
  if (DEADLINE_ACTION_PREFIX.test(work) && !HAS_TIMING_SIGNAL.test(work)) {
    return 'Verify with agency'
  }

  // ── Step 5: Extract timing from prose (always use `work`, never raw `cleaned`) ──
  const typM = work.match(/typically\s+opens?\s+(?:in\s+)?((?:(?:early|mid|late)\s+)?\d{4}|(?:early|mid|late)\s+\d{4}|(?:fall|spring|summer|winter)(?:\s+\d{4})?)/i)
  if (typM) return `Opens ${toTitleCase(typM[1])}`

  const antM = work.match(/(?:anticipated|expected)\s+(?:in\s+)?((?:(?:early|mid|late)\s+)?\d{4}|(?:early|mid|late)\s+\d{4}|(?:fall|spring|summer|winter)(?:\s+\d{4})?)/i)
  if (antM) return toTitleCase(antM[1])

  const seasonM = work.match(/((?:early|mid|late)\s+\d{4}|(?:fall|spring|summer|winter)\s+\d{4})/i)
  if (seasonM) return toTitleCase(seasonM[1])

  // Cut at first sentence boundary when it's short and clean
  const dot = work.search(/\.\s/)
  if (dot > 2 && dot < 80) return work.slice(0, dot).trim()

  // No hard truncation — let the card grow vertically rather than hide information.
  // The card container has no fixed height so this is always safe.
  return work
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

// ─── Normalized card display helpers ─────────────────────────────────────────
// These run at parse time and produce clean UI text — never called in the renderer.

/**
 * Strip markdown formatting for plain-text card display.
 *   [text](url)  → "text"   (URL discarded — agency link shown separately via sourceAgency)
 *   **bold**     → "bold"
 *   bare URLs    → ""       (removed entirely)
 *   .gov domains → ""       (removed — shown via sourceAgency chip)
 *   heading-style bold prefix (e.g. "**Why you qualify:**") → removed
 */
function stripMarkdownText(text: string): string {
  return text
    .replace(/^\*\*\s*(?:why you qualify|next step|recommended next step|action|overview|summary)[:\s]*\*\*\s*/i, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')        // [text](url) → text
    .replace(/\*\*/g, '')                             // **bold** → bold
    .replace(/https?:\/\/\S+/g, '')                  // bare https URLs
    .replace(/\b[\w-]+(?:\.[\w-]+)*\.gov\b/gi, '')   // bare .gov domains
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * True when a sentence is an action/navigation directive — belongs in nextStep, not whyQualify.
 * Catches "Next step:", "Use the SBA…", "Search for…", URL-bearing sentences, etc.
 */
function isActionSentence(s: string): boolean {
  const t = s.trim()
  return (
    // Starts with an action verb or "Next step(s):"
    /^(?:next\s*steps?\s*[:.—]?|visit|contact|apply|register|call|email|submit|download|complete|use(?:\s+the|\s+your|\s+a)?\s|go\s+to|learn\s+more|find\s+out|click|check(?:\s+the)?\s|access|log\s+in|sign\s+up|get\s+started|search(?:\s+for)?\s|prepare|gather|request|obtain|review\s+the|verify\s+at|confirm\s+(?:with|at)|schedule|attend|meet\s+with|fill\s+out|register\s+(?:at|with|on)|ask\s+your)\b/i.test(t) ||
    // Contains a bare URL or .gov domain
    /https?:\/\/|\b[\w-]+(?:\.[\w-]+)*\.gov\b/i.test(t) ||
    // Contains "next step" anywhere
    /\bnext\s*steps?\b/i.test(t)
  )
}

/** Capitalize first letter of a string. */
function cap(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Word-boundary cut to maxLen chars — never adds an ellipsis.
 * Strips the last partial word so the result is always a clean whole word.
 */
function wordCut(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen).replace(/\s+\S*$/, '').trim()
}

/**
 * Strip trailing geographic/bureaucratic filler from a qualifier phrase.
 * Keeps revenue, employee count, and sector info — removes location boilerplate.
 *   "veteran-owned LLC in Texas"           → "veteran-owned LLC"
 *   "minority-owned as defined by the SBA" → "minority-owned"
 */
function stripTrailingFiller(s: string): string {
  return s
    .replace(/[\s,]+(?:operating|based|located)\s+in\s+[\w\s,.]+$/i, '')
    .replace(/[\s,]+in\s+(?:the\s+)?(?:U\.S\.?A?\.?|United\s+States|Texas|TX)\s*$/i, '')
    .replace(/[\s,]+as\s+defined\s+by\b.+$/i, '')
    .replace(/[\s,]+(?:per|under)\s+(?:the\s+)?(?:SBA|IRS|federal)\s+.+$/i, '')
    .trim()
}

/** Business entity nouns — used to locate the "main noun" of a qualifier phrase. */
const BUSINESS_NOUN_PAT = /\b(LLC|L\.L\.C\.|businesses|business|companies|company|startup|start-up|firm|shop|nonprofit|non-profit|organization|retailer|entity|venture|enterprise|co-op|cooperative)\b/i

function findBusinessNoun(s: string): { noun: string; idx: number } | null {
  const m = s.match(BUSINESS_NOUN_PAT)
  if (!m || m.index === undefined) return null
  return { noun: m[0], idx: m.index }
}

/**
 * Expand one qualification phrase into 1–3 clean bullet fragments.
 *
 * Handles:
 * - Comma/and lists: "minority-owned, veteran-owned LLC" → 2 bullets
 * - Chained hyphenated descriptors: "veteran-owned single-person LLC" → 2 bullets
 * - Lone descriptors: "minority-owned" → appends "business"
 * - Hard max 40 chars per fragment — NO ellipses, word-boundary cut only
 */
function expandQualPhrase(phrase: string): string[] {
  const core = stripTrailingFiller(phrase.trim().replace(/\.$/, ''))
  if (!core || core.length < 3) return []

  // Split on commas and "and"
  const rawSegments = core
    .split(/,\s*(?:and\s+)?|\s+and\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 3)

  if (rawSegments.length === 0) return []

  // Shared business noun — inherited by segments that have none
  let sharedNoun: string | null = null
  for (const seg of rawSegments) {
    const n = findBusinessNoun(seg)
    if (n) { sharedNoun = n.noun; break }
  }

  const results: string[] = []

  function addBullet(s: string): void {
    if (results.length >= 3) return
    const f = wordCut(cap(s.trim()), 60)
    if (f.length >= 3 && !results.includes(f)) results.push(f)
  }

  function processWithNoun(seg: string, noun: { noun: string; idx: number }): void {
    const beforeNoun = seg.slice(0, noun.idx).trim()
    // Detect two or more chained hyphenated descriptors before the noun
    const hyphenated = [...beforeNoun.matchAll(/\b[\w]+-[\w]+\b/g)].map(m => m[0])
    if (hyphenated.length >= 2) {
      // Each descriptor + noun → its own bullet
      for (const h of hyphenated) addBullet(`${h} ${noun.noun}`)
    } else {
      // Keep phrase through to the noun end (drops after-noun filler)
      addBullet(seg.slice(0, noun.idx + noun.noun.length).trim())
    }
  }

  // Hiring target groups (WOTC, etc.) describe who to hire, not what the
  // business IS. Never append the entity noun (e.g. "LLC") to these segments.
  const HIRING_TARGET_PAT = /\b(snap|food\s+stamp|felon|ex.?felon|recipient|long.?term\s+unemployed|parolee|veteran\s+hire|new\s+employee|target\s+group|wotc|work\s+opportunity)\b/i

  for (const seg of rawSegments) {
    if (results.length >= 3) break
    const segNoun = findBusinessNoun(seg)

    if (segNoun) {
      processWithNoun(seg, segNoun)
    } else if (HIRING_TARGET_PAT.test(seg)) {
      // Hiring target group — add as-is, never pollute with entity noun
      addBullet(seg)
    } else {
      // Attach shared noun or "business" for ownership-signal words
      const attached = sharedNoun
        ? `${seg} ${sharedNoun}`
        : /\b(?:owned|operated|led|managed)\b/i.test(seg)
          ? `${seg} business`
          : seg
      const attachedNoun = findBusinessNoun(attached)
      if (attachedNoun) {
        processWithNoun(attached, attachedNoun)
      } else {
        addBullet(seg)
      }
    }
  }

  // Final fallback
  if (results.length === 0) addBullet(core)

  return results
}

/**
 * Convert raw whyQualify text into 1–3 concise qualification bullet fragments.
 *
 * Rules:
 * - Strip markdown and embedded "Next step:" blocks before splitting
 * - Filter action/navigation sentences
 * - Remove preamble prefixes ("You are a", "As a", etc.)
 * - Expand compound phrases: commas, "and", chained hyphenated descriptors
 * - Hard max 40 chars per fragment — NO ellipses, NO truncation indicator
 */
function toWhyFragments(rawWhy: string): string[] {
  if (!rawWhy) return []

  const cleaned = stripMarkdownText(rawWhy)
  if (!cleaned) return []

  // Remove embedded "Next step:" tail
  const noNextStep = cleaned
    .replace(/\bnext\s*steps?\s*[:.—].*/is, '')
    .trim()

  if (!noNextStep) return []

  // Split on sentence boundaries
  const sentences = noNextStep
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)

  const fragments: string[] = []

  function addFromSentence(s: string): void {
    if (fragments.length >= 3) return
    if (isActionSentence(s)) return

    const core = s
      .replace(/^You(?:'re| are) (?:a|an) /i, '')
      .replace(/^You(?:'re| are) /i, '')
      .replace(/^Your (?:business|organization|company|nonprofit) (?:is|has|operates|qualifies|meets)\b/i, '')
      .replace(/^This (?:business|organization|company|nonprofit) (?:is|has|operates|qualifies|meets)\b/i, '')
      .replace(/^As (?:a|an) /i, '')
      .replace(/^(?:being|having) (?:a|an) /i, '')
      .replace(/\.$/, '')
      .trim()

    if (core.length < 3) return

    for (const f of expandQualPhrase(core)) {
      if (fragments.length >= 3) break
      if (!fragments.includes(f)) fragments.push(f)
    }
  }

  for (const s of sentences) {
    if (fragments.length >= 3) break
    addFromSentence(s)
  }

  // Fallback: first sentence chunk as one phrase
  if (fragments.length === 0) {
    const fallback = noNextStep.split(/[.!?]/)[0]?.trim() || ''
    const core = fallback
      .replace(/^You(?:'re| are) (?:a|an) /i, '')
      .replace(/^You(?:'re| are) /i, '')
      .trim()
    if (core.length >= 3) {
      for (const f of expandQualPhrase(core)) {
        if (fragments.length >= 3) break
        if (f.length >= 3) fragments.push(f)
      }
    }
  }

  return fragments
}

/**
 * Extract one clean, validated action sentence from raw nextStep text.
 *
 * Hard rules (universal generation spec):
 *   - One action only — never combine multiple steps
 *   - 70 characters maximum
 *   - https:// URLs → root domain only (e.g., sba.gov — never /path/to/page)
 *   - No semicolons, no slash-path URLs, no "search for" instructions
 *   - No chained actions joined by "then" or em-dash
 *   - Word-boundary cut — never truncated with `…`
 */
function cleanNextStep(rawNext: string): string {
  if (!rawNext) return ''

  // Strip "**Next step:**" / "**Recommended next step:**" heading prefix
  let s = rawNext
    .replace(/^\*\*\s*(?:next step|recommended next step|action)[:\s—]*\*\*\s*/i, '')
    .trim()

  // [label](url) → label text (label is more descriptive; source shown via chip)
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // Strip markdown bold/italic
  s = s.replace(/\*\*/g, '').replace(/\*/g, '')

  // https:// URLs → root domain only (strip scheme + path + query)
  s = s.replace(/https?:\/\/([\w.-]+)(?:\/\S*)?/g, (_, host) => host.replace(/^www\./, ''))

  // Bare domains with slash-paths → strip path, keep root domain
  //   "sba.gov/funding-programs/loans" → "sba.gov"
  s = s.replace(/\b([\w-]+(?:\.[\w-]+)*\.(?:gov|org|com|net|edu))(\/[^\s,;.!?]+)/g, '$1')

  // Strip orphaned slash-paths (no domain prefix, e.g. "/funding-programs/apply")
  s = s.replace(/\s\/[\w/-]+/g, '')

  // Cut at semicolons — never two actions in one step
  s = s.replace(/\s*;.*/g, '')

  // Cut at em/en-dash when it introduces a second imperative action
  s = s.replace(/\s[—–]\s+(?:then|and|register|search|apply|visit|contact|submit|sign|find|get|use|go|download|click|check|complete|call|email|prepare|gather|review)\b.*/i, '')

  // Cut secondary actions joined by "then" / "and then"
  s = s.replace(/[,]?\s+(?:and\s+)?then\b.*/i, '')

  // Discard unusable instructions entirely
  if (/^\s*(?:search(?:\s+for)?|look\s+up|copy\s+(?:and\s+paste|this|the\s+(?:text|link|url|following))|paste\s+the\s+following)\b/i.test(s)) return ''

  // Strip mid-sentence search/copy-paste instructions
  s = s.replace(/[,;—]\s*(?:search(?:\s+for)?|look\s+up|copy\s+and\s+paste)\b.*/i, '')

  // Collapse whitespace
  s = s.replace(/\s{2,}/g, ' ').trim()
  if (!s) return ''

  // First sentence only
  const m = s.match(/^(.+?[.!?])(?:\s|$)/)
  const result = (m ? m[1] : s).trim()

  // No hard character truncation — let the card grow. The 140 limit was
  // cutting legitimate single-action instructions that happen to be verbose.
  return result
}

// ─── Profile-summary detector ─────────────────────────────────────────────────

/**
 * Returns true when a bold line is a business/nonprofit profile context header
 * rather than a real fundable opportunity.
 *
 * Claude sometimes emits a context block like:
 *   **Veteran-Owned Western Hat Shop | Gruene, Comal County, TX**
 *
 * Detection signals:
 *   1. Pipe separator " | " + Texas location suffix
 *   2. "-Owned" ownership flag + location suffix
 *   3. No value AND no deadline (pure context, not a program)
 */
function isProfileSummary(name: string, value: string, deadline: string): boolean {
  // Pipe + Texas location: "BusinessType | City, County, TX"
  if (
    name.includes(' | ') &&
    (/,\s*(TX|Texas)\s*$/.test(name) || /\bCounty\b/.test(name))
  ) return true

  // Ownership flag + location suffix
  const hasOwnershipFlag   = /-owned\b/i.test(name)
  const hasLocationSuffix  = /,\s*(TX|Texas)/.test(name) || /\bCounty\b/.test(name)
  if (hasOwnershipFlag && hasLocationSuffix) return true

  // No value AND no deadline AND (pipe separator OR ownership flag) → context block
  const noValue    = !value    || value    === 'See program details'
  const noDeadline = !deadline || deadline === 'Verify with agency'
  if (noValue && noDeadline && (name.includes(' | ') || hasOwnershipFlag)) return true

  return false
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

    // Skip "Not Applicable" entries — Claude sometimes includes programs it has
    // already ruled out as context. These must never render as opportunity cards
    // or count toward opportunity totals.
    if (/not applicable|does not apply|not eligible|n\/a —/i.test(name)) continue

    const value      = extractField(block, 'Value')      || extractField(block, 'value')
    const deadline   = extractField(block, 'Deadline')   || extractField(block, 'deadline')

    // Skip profile context blocks that Claude sometimes emits as the first bold line
    if (isProfileSummary(name, value, deadline)) continue

    // Strip residual ** markdown from text fields so the UI never sees bold artifacts
    const stripBold  = (s: string) => s.replace(/\*\*/g, '').trim()
    const whyQualify = stripBold(extractField(block, 'Why you qualify') || extractField(block, 'Why You Qualify'))
    const nextStep   = stripBold(extractField(block, 'Next step')  || extractField(block, 'Next Step'))

    // Strip markdown from deadline before any processing — prevents ** artifacts
    // and ensures contamination guards in extractDeadlineDisplay see clean text
    const deadlineClean = (deadline || '')
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    const valueNum    = parseDollarMax(value)
    const dl          = deadlineClean.toLowerCase()
    const isRolling   = dl.includes('rolling') || dl.includes('anytime') || dl.includes('open enrollment')
    const isHighValue = valueNum >= 10_000
    // isUrgent only when a specific date can actually be parsed — not for vague
    // annual/filing deadlines like "Claimed at tax filing" which aren't time-sensitive
    const deadlineDateForUrgency = parseDeadlineDate(deadlineClean)
    const isUrgent    = !!deadlineDateForUrgency && !isRolling

    const badges       = deriveBadges(name, value, deadlineClean, block, category)
    const src          = extractSource(nextStep)
    const deadlineStr  = deadlineClean || 'Verify with agency'
    const deadlineDate = parseDeadlineDate(deadlineStr)

    // ── Structured display fields ────────────────────────────────────────────
    // Strip markdown from value BEFORE any classifier sees it — prevents **$500K**
    const rawValue = ((value || '')
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim()) || 'See program details'

    const amountDisplay    = extractAmount(rawValue, name)
    const fundingType      = inferFundingType(name, rawValue, category)
    const fundingStyle     = inferFundingStyle(name, rawValue, category)
    const fundingHighlight = deriveFundingHighlight(name, category, badges)
    const deadlineDisplay  = extractDeadlineDisplay(deadlineStr)
    const deadlineContext  = extractDeadlineContext(deadlineStr)

    // ── Normalized card display fields ───────────────────────────────────────
    const whyFragments  = toWhyFragments(whyQualify)
    const nextStepClean = cleanNextStep(nextStep)

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
      whyFragments,
      nextStepClean,
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

// ─── Nonprofit language filter ───────────────────────────────────────────────

const NONPROFIT_BLOCKLIST = [
  'nonprofit', 'non-profit', '501(c)', '501c3', '501c ',
  'tax-exempt', 'charitable organization', 'not-for-profit',
  'donor-funded', 'foundation-supported',
]

function containsNonprofitLanguage(text: string): boolean {
  const lower = text.toLowerCase()
  return NONPROFIT_BLOCKLIST.some(term => lower.includes(term))
}

/**
 * Post-parse filter: removes nonprofit-only opportunities from FOR-PROFIT profiles.
 * Also strips nonprofit-language fragments from whyFragments.
 * Safe to call on nonprofit profiles — returns report unchanged.
 */
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

  if (isNonprofit) return report // nonprofits see everything unchanged

  // FOR-PROFIT: remove opportunities whose NAME or ELIGIBILITY fields contain
  // nonprofit language. We intentionally exclude rawText / description — many
  // legitimate for-profit programs (SBA Microloan, USDA B&I) mention that
  // nonprofits can *also* apply. Suppressing those would be a false positive.
  // We only suppress when the program name or why-qualify field signals that
  // the opportunity itself is nonprofit-only.
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
