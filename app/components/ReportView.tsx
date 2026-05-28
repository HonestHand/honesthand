'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  parseReport,
  ParsedReport,
  ParsedSection,
  ParsedOpportunity,
  ActionPlanStep,
  SectionCategory,
  SECTION_META,
  Badge,
  BadgeVariant,
} from '../lib/parseReport'
import { renderMarkdown, renderInline } from '../lib/renderMarkdown'
import {
  getSavedOpportunities,
  toggleSavedOpportunity,
  isNewReportSinceLastView,
  markReportViewed,
} from '../lib/storage'

// ─── Badge chip ───────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<BadgeVariant, string> = {
  green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  amber:  'bg-amber-50 text-amber-700 border-amber-200',
  red:    'bg-red-50 text-red-700 border-red-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  teal:   'bg-teal-50 text-teal-700 border-teal-200',
  sky:    'bg-sky-50 text-sky-700 border-sky-200',
  gray:   'bg-gray-50 text-gray-600 border-gray-200',
}

function BadgeChip({ badge }: { badge: Badge }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border tracking-wide uppercase ${BADGE_STYLES[badge.variant]}`}
    >
      {badge.label}
    </span>
  )
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({
  report,
  reportDate,
  savedCount,
}: {
  report: ParsedReport
  reportDate: string | null
  savedCount?: number
}) {
  const dateLabel = reportDate
    ? new Date(reportDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const stats = [
    { value: report.totalOpportunities, label: 'opportunities found', color: 'text-[#1D9E75]' },
    { value: report.rollingCount,        label: 'quick apply',         color: 'text-emerald-600' },
    { value: report.highValueCount,      label: 'high value',          color: 'text-amber-600'   },
    ...(savedCount && savedCount > 0
      ? [{ value: savedCount, label: 'saved', color: 'text-amber-500' }]
      : []
    ),
  ]

  return (
    <div className="bg-[#E1F5EE] border border-[#1D9E75]/20 rounded-xl px-5 py-4 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-5">
          {stats.map(s => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-gray-600 font-medium">{s.label}</span>
            </div>
          ))}
        </div>
        {dateLabel && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span>✓</span>
            <span>Report current as of {dateLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Category filter tabs ─────────────────────────────────────────────────────

type CategoryFilter = SectionCategory | 'all' | 'saved'

function CategoryTabs({
  sections,
  active,
  onChange,
  savedCount,
}: {
  sections: ParsedSection[]
  active: CategoryFilter
  onChange: (c: CategoryFilter) => void
  savedCount?: number
}) {
  const allCount = sections
    .filter(s => !s.isActionPlan)
    .reduce((n, s) => n + (s.isParsed ? s.opportunities.length : 0), 0)

  const tabs: { key: CategoryFilter; label: string; count: number }[] = [
    { key: 'all', label: '📊 All', count: allCount },
    ...sections
      .filter(s => !s.isActionPlan)
      .map(s => ({
        key: s.category as CategoryFilter,
        label: SECTION_META[s.category].icon + ' ' + shortTitle(s.title),
        count: s.isParsed ? s.opportunities.length : 0,
      }))
      .filter(t => t.count > 0),
    ...(savedCount && savedCount > 0
      ? [{ key: 'saved' as CategoryFilter, label: '★ Saved', count: savedCount }]
      : []
    ),
  ]

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
            active === tab.key
              ? tab.key === 'saved'
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-[#1D9E75] text-white border-[#1D9E75] shadow-sm'
              : tab.key === 'saved'
                ? 'bg-white text-amber-600 border-amber-200 hover:border-amber-400'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#1D9E75]/40 hover:text-[#1D9E75]'
          }`}
        >
          {tab.label}
          <span
            className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
              active === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  )
}

function shortTitle(title: string): string {
  return title
    .replace(/^(Federal Grants? & |Texas |30-Day )/i, '')
    .replace(/ Programs?$/i, '')
    .replace(/ & Deductions?$/i, '')
    .replace(/ & SBA Programs?$/i, '')
    .slice(0, 28)
}

// ─── Trust verification ribbon ───────────────────────────────────────────────

function TrustRibbon({ reportDate, isNew }: { reportDate: string | null; isNew?: boolean }) {
  const [showDetail, setShowDetail] = useState(false)

  const dateLabel = reportDate
    ? new Date(reportDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1D9E75]">
            <span>🔍</span> Live search verified
          </span>
          <span className="text-gray-200 hidden sm:inline">|</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>🏛️</span> Official .gov sources only
          </span>
          {dateLabel && (
            <>
              <span className="text-gray-200 hidden sm:inline">|</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>📅</span> Current as of {dateLabel}
                {isNew && (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 animate-pulse">
                    ✨ Updated
                  </span>
                )}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => setShowDetail(v => !v)}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#1D9E75] transition-colors flex-shrink-0"
        >
          ℹ️ How we verify
          <span className={`text-[9px] transition-transform duration-200 ${showDetail ? 'rotate-180' : ''}`}>▼</span>
        </button>
      </div>

      {showDetail && (
        <div className="mt-1.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3.5 text-[12px] text-blue-900 leading-relaxed">
          <strong>Live web search:</strong> Each report is generated with real-time web search to confirm current program status, funding amounts, and deadlines as of the date shown. All linked sources are official government domains (.gov). We do not use static databases or cached program lists.
          <br />
          <br />
          <strong>Important:</strong> Programs change. Always verify directly with the administering agency before applying. HonestHand is not a licensed attorney, CPA, or financial advisor and does not guarantee program availability or your eligibility.
        </div>
      )}
    </div>
  )
}

// ─── Upcoming deadlines ───────────────────────────────────────────────────────

function UpcomingDeadlines({ sections }: { sections: ParsedSection[] }) {
  const now = new Date()

  const upcoming = useMemo(() => {
    return sections
      .filter(s => !s.isActionPlan)
      .flatMap(s => s.opportunities)
      .filter(o => o.deadlineDate && o.deadlineDate > now)
      .sort((a, b) => a.deadlineDate!.getTime() - b.deadlineDate!.getTime())
      .slice(0, 3)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections])

  if (upcoming.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm">⏰</span>
        <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Upcoming Deadlines</span>
      </div>
      <div className="space-y-2.5">
        {upcoming.map(opp => {
          const daysLeft = Math.ceil((opp.deadlineDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          const isUrgent = daysLeft <= 30

          return (
            <div key={opp.id} className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-amber-900 truncate">{opp.name}</div>
                <div className="text-[11px] text-amber-700 mt-0.5">{opp.deadline}</div>
              </div>
              <div className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                isUrgent ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}>
                {daysLeft}d left
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Opportunity card ─────────────────────────────────────────────────────────

function OpportunityCard({
  opp,
  isFirst,
  isSaved,
  onToggleSave,
}: {
  opp: ParsedOpportunity
  isFirst?: boolean
  isSaved?: boolean
  onToggleSave?: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden mb-3 last:mb-0">
      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-[15px] font-semibold text-[#2C2C2A] leading-snug flex-1">
            {isFirst && (
              <span className="inline-flex items-center mr-2 px-2 py-0.5 rounded text-[10px] font-bold bg-[#1D9E75] text-white tracking-wide uppercase">
                Recommended First
              </span>
            )}
            {opp.name}
          </h3>
          {/* Save / bookmark button — -m-1 p-2 gives ~40 px touch target */}
          {onToggleSave && (
            <button
              onClick={e => { e.stopPropagation(); onToggleSave(opp.id) }}
              className={`flex-shrink-0 text-xl -m-1 p-2 rounded-lg transition-all duration-150 active:scale-95 ${
                isSaved ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'
              }`}
              aria-label={isSaved ? 'Remove from saved' : 'Save opportunity'}
              title={isSaved ? 'Remove from saved' : 'Save opportunity'}
            >
              {isSaved ? '★' : '☆'}
            </button>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {opp.badges.map((b, i) => <BadgeChip key={i} badge={b} />)}
        </div>

        {/* Value + Deadline chips */}
        <div className="flex flex-wrap gap-2">
          {opp.value && opp.value !== 'See program details' && (
            <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2 flex-1 min-w-[140px]">
              <span className="text-base">💰</span>
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Funding Value</div>
                <div className="text-[13px] font-semibold text-[#2C2C2A] leading-tight">{opp.value}</div>
              </div>
            </div>
          )}
          {opp.deadline && (
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-2 flex-1 min-w-[140px] ${
              opp.isUrgent && !opp.isRolling ? 'bg-amber-50' : 'bg-gray-50'
            }`}>
              <span className="text-base">{opp.isRolling ? '🟢' : '📅'}</span>
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Deadline</div>
                <div className={`text-[13px] font-semibold leading-tight ${
                  opp.isUrgent && !opp.isRolling ? 'text-amber-700' : 'text-[#2C2C2A]'
                }`}>
                  {opp.deadline}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-50 mx-4" />

      {/* Why you qualify */}
      {opp.whyQualify && (
        <div className="px-4 py-3">
          <div className="text-[11px] font-semibold text-[#1D9E75] uppercase tracking-wide mb-1">
            Why you qualify
          </div>
          <p
            className="text-[13px] text-gray-600 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderInline(opp.whyQualify) }}
          />
        </div>
      )}

      {/* Next step — collapsible */}
      {opp.nextStep && (
        <div className="border-t border-gray-50 mx-4" />
      )}
      {opp.nextStep && (
        <div className="px-4 py-3">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center justify-between w-full group"
          >
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide group-hover:text-[#1D9E75] transition-colors">
              Next step
            </div>
            <span className={`text-gray-400 text-xs transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          {expanded && (
            <p
              className="text-[13px] text-gray-700 leading-relaxed mt-2"
              dangerouslySetInnerHTML={{ __html: renderInline(opp.nextStep) }}
            />
          )}
          {!expanded && (
            <p className="text-[12px] text-gray-400 mt-1 truncate">
              {opp.nextStep.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 80)}…
            </p>
          )}
        </div>
      )}

      {/* Official source footer */}
      {opp.sourceAgency && (
        <>
          <div className="border-t border-gray-50 mx-4" />
          <div className="px-4 py-2.5 flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wide">✓ Official Source</span>
            {opp.sourceUrl ? (
              <a
                href={opp.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#1D9E75] font-medium hover:underline flex items-center gap-0.5"
              >
                {opp.sourceAgency}
                <span className="text-[10px]">↗</span>
              </a>
            ) : (
              <span className="text-[11px] text-gray-500">{opp.sourceAgency}</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Action plan view ─────────────────────────────────────────────────────────

function ActionPlanView({ steps, rawText }: { steps: ActionPlanStep[]; rawText: string }) {
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const toggleCheck = (num: number) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })
  }

  if (steps.length === 0) {
    return (
      <div
        className="text-sm text-gray-600 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(rawText) }}
      />
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-3">
        Ranked easiest win first. Check off steps as you complete them.
      </p>
      {steps.map(step => {
        const done = checked.has(step.num)
        const open = expandedStep === step.num

        return (
          <div
            key={step.num}
            className={`border rounded-xl overflow-hidden transition-all duration-150 ${
              done ? 'border-[#1D9E75]/30 bg-[#F0FDF8]' : 'border-gray-100 bg-white'
            }`}
          >
            <div className="flex items-start gap-3 px-4 py-3">
              {/* Number + checkbox */}
              <button
                onClick={() => toggleCheck(step.num)}
                className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all duration-150 ${
                  done
                    ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
                    : 'border-gray-300 text-gray-500 hover:border-[#1D9E75]'
                }`}
                aria-label={done ? 'Mark incomplete' : 'Mark complete'}
              >
                {done ? (
                  <span className="text-xs font-bold">✓</span>
                ) : (
                  <span className="text-xs font-semibold">{step.num}</span>
                )}
              </button>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[14px] font-semibold leading-snug transition-colors ${
                    done ? 'text-[#1D9E75] line-through decoration-[#1D9E75]/40' : 'text-[#2C2C2A]'
                  }`}
                >
                  {step.title}
                </div>

                {step.detail && (
                  <button
                    onClick={() => setExpandedStep(open ? null : step.num)}
                    className="text-[12px] text-gray-400 hover:text-[#1D9E75] mt-0.5 py-1 text-left transition-colors"
                  >
                    {open ? '▲ hide detail' : '▼ show detail'}
                  </button>
                )}

                {open && step.detail && (
                  <p
                    className="text-[13px] text-gray-600 leading-relaxed mt-2"
                    dangerouslySetInnerHTML={{ __html: renderInline(step.detail) }}
                  />
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Section card (collapsible) ───────────────────────────────────────────────

function SectionCard({
  section,
  isOpen,
  onToggle,
  showAll,
  savedIds,
  onToggleSave,
}: {
  section: ParsedSection
  isOpen: boolean
  onToggle: () => void
  showAll: boolean
  savedIds?: Set<string>
  onToggleSave?: (id: string) => void
}) {
  const oppCount  = section.isParsed ? section.opportunities.length : 0
  const stepCount = section.actionSteps.length

  return (
    <div className="mb-4">
      {/* Section header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow transition-shadow duration-150 group"
        style={{ borderLeft: `4px solid ${section.color}` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{section.icon}</span>
          <div className="text-left">
            <div className="text-[15px] font-semibold text-[#2C2C2A] group-hover:text-[#1D9E75] transition-colors">
              {section.title}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {section.isActionPlan
                ? stepCount > 0 ? `${stepCount} action steps` : 'Personalized roadmap'
                : section.isParsed
                  ? `${oppCount} program${oppCount !== 1 ? 's' : ''} identified`
                  : 'Details inside'}
            </div>
          </div>
        </div>
        <span className={`text-gray-400 text-sm transition-transform duration-200 ml-3 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Section body */}
      {isOpen && (
        <div className="mt-2 pl-0">
          {section.isActionPlan ? (
            <ActionPlanView steps={section.actionSteps} rawText={section.rawText} />
          ) : section.isParsed ? (
            <div>
              {section.opportunities.map((opp, idx) => (
                <OpportunityCard
                  key={opp.id}
                  opp={opp}
                  isFirst={idx === 0 && showAll}
                  isSaved={savedIds?.has(opp.id)}
                  onToggleSave={onToggleSave}
                />
              ))}
            </div>
          ) : (
            /* Fallback: raw markdown for sections that didn't parse cleanly */
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <div
                className="text-sm text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(section.rawText) }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Free user upgrade wall ───────────────────────────────────────────────────

function UpgradeWall({
  onUpgrade,
  upgrading,
  upgradeError,
}: {
  onUpgrade: () => void
  upgrading: boolean
  upgradeError: string
}) {
  const lockedSections = [
    { icon: '📍', title: 'Local / City / County Programs',     count: '3–5 programs' },
    { icon: '🧾', title: 'Tax Credits & Deductions',           count: '4–5 programs' },
    { icon: '📜', title: 'Certification Pathways',             count: '3–4 programs' },
    { icon: '🤝', title: "Gov't Contracting Opportunities",    count: '2–3 programs' },
    { icon: '🏗️', title: 'Industry-Specific Programs',         count: '3–4 programs' },
    { icon: '✅', title: '30-Day Action Plan',                  count: '8 action steps' },
  ]

  return (
    <div className="mt-6">
      {/* Locked section previews */}
      <div className="mb-1 px-1">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">
          Locked — Pro only
        </p>
        <div className="space-y-2 mb-6 opacity-50 pointer-events-none select-none">
          {lockedSections.map(s => (
            <div
              key={s.title}
              className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-5 py-3.5 shadow-sm"
              style={{ borderLeft: '4px solid #D1D5DB' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl grayscale">{s.icon}</span>
                <div>
                  <div className="text-[14px] font-semibold text-gray-400">{s.title}</div>
                  <div className="text-[11px] text-gray-300 mt-0.5">{s.count}</div>
                </div>
              </div>
              <span className="text-gray-300 text-sm">🔒</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade CTA */}
      <div
        className="rounded-2xl p-7 text-white text-center"
        style={{ background: 'linear-gradient(135deg, #1D9E75 0%, #157a5a 100%)' }}
      >
        <div className="text-[22px] font-bold mb-2">Your full report is ready</div>
        <div className="text-sm opacity-90 mb-6 leading-relaxed max-w-sm mx-auto">
          25+ verified opportunities — federal, state, local, tax credits, certifications, and a 30-day action plan built for your business.
        </div>

        <div className="grid grid-cols-2 gap-3 mb-7 max-w-lg mx-auto">
          {[
            { icon: '📋', title: 'Full Report',       desc: 'Every program you qualify for — not just 3' },
            { icon: '⏰', title: 'Deadline Alerts',   desc: 'Never miss a grant window'                  },
            { icon: '🔄', title: 'Monthly Updates',   desc: 'Report refreshes every month'               },
            { icon: '🎖️', title: 'Veteran & Minority', desc: 'Exclusive set-aside programs'              },
            { icon: '💰', title: 'Tax Credit Finder', desc: 'What your accountant missed'                },
            { icon: '📍', title: 'Local Intelligence', desc: 'City and county programs'                  },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-white/10 rounded-xl p-3 text-left">
              <div className="text-lg mb-1">{icon}</div>
              <div className="text-[13px] font-bold mb-0.5">{title}</div>
              <div className="text-[11px] opacity-80 leading-tight">{desc}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onUpgrade}
          disabled={upgrading}
          className="bg-white text-[#1D9E75] font-bold text-[17px] rounded-xl py-4 w-full max-w-xs mx-auto block transition-opacity"
          style={{ opacity: upgrading ? 0.8 : 1 }}
        >
          {upgrading ? 'Redirecting to checkout…' : 'Unlock Full Report — $49/mo'}
        </button>
        <p className="text-[12px] opacity-70 mt-3">Cancel anytime. No contracts. Pays for itself with one credit.</p>
        {upgradeError && (
          <p className="text-[13px] text-red-200 mt-2">{upgradeError}</p>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mt-5 px-1 text-[11px] text-gray-400 leading-relaxed">
        <strong className="text-gray-500">Disclaimer:</strong> This preview is for informational purposes only and does not constitute legal, financial, or tax advice. Program availability and deadlines change frequently — always verify directly with the administering agency. Eligibility determinations are estimates. HonestHand is not a licensed attorney, CPA, or financial advisor.
      </div>
    </div>
  )
}

// ─── Main ReportView component ────────────────────────────────────────────────

interface ReportViewProps {
  report: string
  isPro: boolean
  reportDate: string | null
  onUpgrade: () => void
  upgrading: boolean
  upgradeError: string
  userId?: string
}

export default function ReportView({
  report,
  isPro,
  reportDate,
  onUpgrade,
  upgrading,
  upgradeError,
  userId,
}: ReportViewProps) {
  const parsed = useMemo(() => parseReport(report), [report])

  // ── Save / bookmark state ──────────────────────────────────────────────────
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [isNewReport, setIsNewReport] = useState(false)

  // Hydrate saved set from localStorage once userId is known
  useEffect(() => {
    if (!userId) return
    setSavedIds(getSavedOpportunities(userId))
  }, [userId])

  // Detect "new report since last visit" and schedule view-marking
  useEffect(() => {
    if (!userId || !reportDate) return
    const isNew = isNewReportSinceLastView(userId, reportDate)
    setIsNewReport(isNew)
    // Give the user ~3 s to register the "✨ Updated" badge before we mark it seen
    const t = setTimeout(() => markReportViewed(userId, reportDate), 3000)
    return () => clearTimeout(t)
  }, [userId, reportDate])

  const handleToggleSave = useCallback((id: string) => {
    if (!userId) return
    toggleSavedOpportunity(userId, id)
    setSavedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [userId])

  // ── Section open/close state ───────────────────────────────────────────────
  const defaultOpen = useMemo(() => {
    const ids = new Set<string>()
    parsed.sections.slice(0, 2).forEach(s => ids.add(s.id))
    return ids
  }, [parsed])

  const [openSections,  setOpenSections]  = useState<Set<string>>(defaultOpen)
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const expandAll   = () => setOpenSections(new Set(parsed.sections.map(s => s.id)))
  const collapseAll = () => setOpenSections(new Set())

  // ── Derived data ───────────────────────────────────────────────────────────

  // Flat list of saved opps — used in the 'saved' filter view
  const savedOpportunities = useMemo(() =>
    parsed.sections
      .filter(s => !s.isActionPlan)
      .flatMap(s => s.opportunities)
      .filter(o => savedIds.has(o.id))
  , [parsed, savedIds])

  const visibleSections = useMemo(() => {
    if (activeCategory === 'all' || activeCategory === 'saved') return parsed.sections
    return parsed.sections.filter(s => s.category === activeCategory || s.isActionPlan)
  }, [parsed, activeCategory])

  // ── Edge case: no parsed sections ─────────────────────────────────────────
  if (parsed.sections.length === 0) {
    return (
      <div>
        <TrustRibbon reportDate={reportDate} isNew={isNewReport} />
        <div
          className="text-sm text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
        />
        {!isPro && (
          <UpgradeWall onUpgrade={onUpgrade} upgrading={upgrading} upgradeError={upgradeError} />
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Trust verification ribbon — shown for all users */}
      <TrustRibbon reportDate={reportDate} isNew={isNewReport} />

      {/* Summary bar — Pro only */}
      {isPro && parsed.totalOpportunities > 0 && (
        <SummaryBar
          report={parsed}
          reportDate={reportDate}
          savedCount={savedIds.size > 0 ? savedIds.size : undefined}
        />
      )}

      {/* Upcoming deadlines — Pro only, rendered above tabs */}
      {isPro && <UpcomingDeadlines sections={parsed.sections} />}

      {/* Category filter tabs — Pro only */}
      {isPro && parsed.sections.length > 2 && (
        <CategoryTabs
          sections={parsed.sections}
          active={activeCategory}
          onChange={setActiveCategory}
          savedCount={savedIds.size > 0 ? savedIds.size : undefined}
        />
      )}

      {/* Expand / collapse all — hidden when in saved view */}
      {isPro && parsed.sections.length > 2 && activeCategory !== 'saved' && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400">
            {openSections.size} of {parsed.sections.length} sections open
          </span>
          <div className="flex gap-3">
            <button onClick={expandAll}   className="text-xs text-[#1D9E75] hover:underline">Expand all</button>
            <button onClick={collapseAll} className="text-xs text-gray-400 hover:underline">Collapse all</button>
          </div>
        </div>
      )}

      {/* ── Content area ── */}
      {activeCategory === 'saved' ? (
        /* Saved filter — flat list of bookmarked opportunities */
        <div>
          {savedOpportunities.length > 0 ? (
            savedOpportunities.map(opp => (
              <OpportunityCard
                key={opp.id}
                opp={opp}
                isSaved={true}
                onToggleSave={handleToggleSave}
              />
            ))
          ) : (
            <div className="text-center py-14 text-gray-400">
              <div className="text-4xl mb-3">☆</div>
              <div className="text-sm font-medium text-gray-500">No saved opportunities yet</div>
              <div className="text-xs mt-1.5">Tap the ☆ on any opportunity card to save it here</div>
            </div>
          )}
        </div>
      ) : (
        /* Normal section view */
        visibleSections.map((section, idx) => (
          <SectionCard
            key={section.id}
            section={section}
            isOpen={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
            showAll={activeCategory === 'all' && idx === 0}
            savedIds={savedIds}
            onToggleSave={userId ? handleToggleSave : undefined}
          />
        ))
      )}

      {/* Pro disclaimer */}
      {isPro && activeCategory !== 'saved' && (
        <div
          className="mt-4 p-4 rounded-xl text-xs text-gray-500 leading-relaxed"
          style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
        >
          <strong className="text-gray-600">Disclaimer:</strong> This report is for informational purposes only and does not constitute legal, financial, or tax advice. Program availability, funding amounts, and deadlines change frequently — always verify directly with the administering agency before applying. Eligibility determinations are estimates based on the information you provided. HonestHand is not a licensed attorney, CPA, or financial advisor. Consult a qualified professional before making business or financial decisions.
        </div>
      )}

      {/* Free user upgrade wall */}
      {!isPro && (
        <UpgradeWall onUpgrade={onUpgrade} upgrading={upgrading} upgradeError={upgradeError} />
      )}
    </div>
  )
}
