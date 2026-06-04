'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRIES    = ['Restaurant / Food & Beverage', 'Ranch / Farm / Agriculture', 'Construction / Trades', 'Retail', 'Real Estate', 'Professional Services', 'Other']
const REVENUE_RANGES = ['Under $100k', '$100k - $250k', '$250k - $500k', '$500k - $1M', 'Over $1M']
const ENTITY_TYPES  = ['Sole Proprietor', 'LLC', 'S-Corp', 'C-Corp', 'Partnership', 'Other']
const EMPLOYEE_COUNTS = ['Just me (1)', '2-5', '6-10', '11-25', '26-50', '51-100', '100+']

// ─── Profile completeness ─────────────────────────────────────────────────────

export const SCORED_FIELDS: Array<{ key: string; label: string; tip: string | null }> = [
  { key: 'business_name',  label: 'Business name',  tip: null },
  { key: 'industry',       label: 'Industry',        tip: null },
  { key: 'city',           label: 'City',            tip: null },
  { key: 'revenue_range',  label: 'Annual revenue',  tip: null },
  { key: 'county',         label: 'County',          tip: 'Unlocks county-level grant programs' },
  { key: 'entity_type',    label: 'Entity type',     tip: 'Improves entity-specific program matching' },
  { key: 'employee_count', label: 'Employee count',  tip: 'Required for SBA size-standard eligibility' },
]

export function calcCompleteness(profile: Record<string, unknown>): {
  score: number
  missing: typeof SCORED_FIELDS
} {
  const missing = SCORED_FIELDS.filter(f => !profile[f.key])
  const score   = Math.round(((SCORED_FIELDS.length - missing.length) / SCORED_FIELDS.length) * 100)
  return { score, missing }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FormState = {
  business_name: string
  industry: string
  city: string
  county: string
  revenue_range: string
  entity_type: string
  employee_count: string
  is_veteran: boolean
  is_minority: boolean
  is_woman: boolean
}

export default function ProfilePage() {
  const [pageLoading, setPageLoading] = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState('')
  const [isPro,       setIsPro]       = useState(false)
  const [userId,      setUserId]      = useState('')
  const [industryOther, setIndustryOther] = useState('')

  // Email preferences
  type EmailPrefs = {
    email_monthly_reports:    boolean
    email_midmonth_insights:  boolean
    email_deadline_reminders: boolean
    email_marketing:          boolean
  }
  const DEFAULT_PREFS: EmailPrefs = {
    email_monthly_reports:    true,
    email_midmonth_insights:  true,
    email_deadline_reminders: true,
    email_marketing:          true,
  }
  const [emailPrefs,       setEmailPrefs]       = useState<EmailPrefs>(DEFAULT_PREFS)
  const [savingPrefs,      setSavingPrefs]      = useState(false)
  const [savedPrefs,       setSavedPrefs]       = useState(false)
  const [prefSaveError,    setPrefSaveError]    = useState('')

  const [form, setForm] = useState<FormState>({
    business_name: '',
    industry: '',
    city: '',
    county: '',
    revenue_range: '',
    entity_type: '',
    employee_count: '',
    is_veteran: false,
    is_minority: false,
    is_woman: false,
  })

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/'; return }
    setUserId(session.user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (!profile?.business_name) { window.location.href = '/onboarding'; return }

    setIsPro(profile.is_pro === true || profile.is_pro === 'true')

    // Load email preferences (columns may not exist yet — graceful defaults)
    setEmailPrefs({
      email_monthly_reports:    profile.email_monthly_reports    !== false,
      email_midmonth_insights:  profile.email_midmonth_insights  !== false,
      email_deadline_reminders: profile.email_deadline_reminders !== false,
      email_marketing:          profile.email_marketing          !== false,
    })

    // Restore industry — detect "Other" (a custom industry not in the predefined list)
    const knownIndustries = INDUSTRIES.slice(0, -1) // everything except 'Other'
    const isKnown = knownIndustries.includes(profile.industry)

    setForm({
      business_name:  profile.business_name  || '',
      industry:       isKnown ? profile.industry : (profile.industry ? 'Other' : ''),
      city:           profile.city           || '',
      county:         profile.county         || '',
      revenue_range:  profile.revenue_range  || '',
      entity_type:    profile.entity_type    || '',
      employee_count: profile.employee_count || '',
      is_veteran:     profile.is_veteran  === true,
      is_minority:    profile.is_minority === true,
      is_woman:       profile.is_woman    === true,
    })

    // If industry was a custom value, restore it to the "other" text field
    if (!isKnown && profile.industry && profile.industry !== 'Other') {
      setIndustryOther(profile.industry)
    }

    setPageLoading(false)
  }

  const effectiveIndustry = form.industry === 'Other'
    ? (industryOther.trim() || 'Other')
    : form.industry

  const handleSave = async () => {
    if (!supabase || !userId) return
    if (!form.business_name.trim()) { setError('Business name is required'); return }
    if (!form.industry)             { setError('Industry is required'); return }
    if (form.industry === 'Other' && !industryOther.trim()) { setError('Please describe your industry'); return }
    if (!form.city.trim())          { setError('City is required'); return }
    if (!form.revenue_range)        { setError('Annual revenue is required'); return }

    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const { error: upsertErr } = await supabase
        .from('profiles')
        .upsert(
          { id: userId, ...form, industry: effectiveIndustry },
          { onConflict: 'id' }
        )
      if (upsertErr) throw upsertErr
      setSaved(true)
      setTimeout(() => setSaved(false), 5000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
    setSaving(false)
  }

  const handleSavePrefs = async () => {
    if (!supabase || !userId) return
    setSavingPrefs(true)
    setPrefSaveError('')
    setSavedPrefs(false)
    try {
      const { error } = await supabase
        .from('profiles')
        .update(emailPrefs)
        .eq('id', userId)
      if (error) throw error
      setSavedPrefs(true)
      setTimeout(() => setSavedPrefs(false), 4000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save preferences.'
      // If columns don't exist yet, show a friendly note rather than a raw DB error
      setPrefSaveError(
        msg.includes('column') || msg.includes('does not exist')
          ? 'Email preference columns are not set up yet. Run the SQL migration in your Supabase dashboard to enable this feature.'
          : msg
      )
    }
    setSavingPrefs(false)
  }

  // ── Completeness ──────────────────────────────────────────────────────────
  const profileForScore: Record<string, unknown> = { ...form, industry: effectiveIndustry }
  const { score, missing } = calcCompleteness(profileForScore)
  const meterColor = score >= 86 ? '#C9A96E' : score >= 57 ? '#F59E0B' : '#EF4444'

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputCls  = 'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-[#2C2C2A] bg-white outline-none focus:border-[#C9A96E] transition-colors'
  const selectCls = `${inputCls} cursor-pointer`
  const labelCls  = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5'

  if (pageLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* Nav */}
      <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#2C2C2A' }}>
            Honest<span style={{ color: '#C9A96E' }}>Hand</span>
          </div>
          <a href="/dashboard" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none', fontWeight: '500' }}>
            ← Dashboard
          </a>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-xl mx-auto px-6 py-8">

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-[#2C2C2A] mb-1">Business Profile</h1>
          <p className="text-sm text-gray-500">Accurate profile = better-matched opportunities. Keep it up to date.</p>
        </div>

        {/* ── Completeness meter ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#2C2C2A]">Profile completeness</span>
            <span className="text-sm font-bold" style={{ color: meterColor }}>{score}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${score}%`, background: meterColor }}
            />
          </div>

          {missing.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Fill in to improve your report
              </p>
              {missing.map(f => (
                <div key={f.key} className="flex items-start gap-2 text-xs text-gray-500">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">●</span>
                  <span>
                    <span className="font-medium text-gray-600">{f.label}</span>
                    {f.tip && <span className="text-gray-400"> — {f.tip}</span>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-medium text-[#C9A96E]">
              ✓ Complete — you're getting the most precisely matched report possible
            </p>
          )}
        </div>

        {/* ── Edit form ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-[15px] font-semibold text-[#2C2C2A] mb-5">Business Information</h2>

          <div className="space-y-4">

            {/* Business name */}
            <div>
              <label className={labelCls}>Business Name</label>
              <input
                className={inputCls}
                value={form.business_name}
                onChange={e => setForm({ ...form, business_name: e.target.value })}
                placeholder="Business name"
              />
            </div>

            {/* Industry */}
            <div>
              <label className={labelCls}>Industry</label>
              <select
                className={selectCls}
                value={form.industry}
                onChange={e => { setForm({ ...form, industry: e.target.value }); setIndustryOther('') }}
              >
                <option value="">Select your industry</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              {form.industry === 'Other' && (
                <input
                  className={`${inputCls} mt-2`}
                  style={{ borderColor: '#C9A96E' }}
                  placeholder="Describe your industry (e.g. Auto Repair, Daycare, Landscaping)"
                  value={industryOther}
                  onChange={e => setIndustryOther(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            {/* City + County */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>City</label>
                <input
                  className={inputCls}
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div>
                <label className={labelCls}>
                  County{' '}
                  {!form.county && (
                    <span className="text-amber-400 normal-case tracking-normal font-normal">
                      recommended
                    </span>
                  )}
                </label>
                <input
                  className={inputCls}
                  value={form.county}
                  onChange={e => setForm({ ...form, county: e.target.value })}
                  placeholder="County"
                />
              </div>
            </div>

            {/* Annual revenue */}
            <div>
              <label className={labelCls}>Annual Revenue</label>
              <select
                className={selectCls}
                value={form.revenue_range}
                onChange={e => setForm({ ...form, revenue_range: e.target.value })}
              >
                <option value="">Select annual revenue range</option>
                {REVENUE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Entity type + Employee count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Entity Type{' '}
                  {!form.entity_type && (
                    <span className="text-amber-400 normal-case tracking-normal font-normal">
                      recommended
                    </span>
                  )}
                </label>
                <select
                  className={selectCls}
                  value={form.entity_type}
                  onChange={e => setForm({ ...form, entity_type: e.target.value })}
                >
                  <option value="">Select entity type</option>
                  {ENTITY_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  Employees{' '}
                  {!form.employee_count && (
                    <span className="text-amber-400 normal-case tracking-normal font-normal">
                      recommended
                    </span>
                  )}
                </label>
                <select
                  className={selectCls}
                  value={form.employee_count}
                  onChange={e => setForm({ ...form, employee_count: e.target.value })}
                >
                  <option value="">Number of employees</option>
                  {EMPLOYEE_COUNTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Ownership flags */}
            <div>
              <label className={labelCls}>Ownership</label>
              <div className="space-y-2">
                {(
                  [
                    { key: 'is_veteran' as const,  label: 'Veteran-owned',  sub: 'Unlocks TVC, VOSB, and veteran set-asides'        },
                    { key: 'is_minority' as const, label: 'Minority-owned', sub: 'Unlocks minority business grants'                  },
                    { key: 'is_woman' as const,    label: 'Woman-owned',    sub: 'Unlocks WOSB and women entrepreneur programs'      },
                  ] as const
                ).map(({ key, label, sub }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-[#F7F4EF] transition-colors"
                    onClick={() => setForm({ ...form, [key]: !form[key] })}
                  >
                    <div>
                      <div className="text-sm font-medium text-[#2C2C2A]">{label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
                    </div>
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0 ml-4"
                      style={{
                        background:   form[key] ? '#1C2B3A' : 'white',
                        borderColor:  form[key] ? '#C9A96E' : '#D1D5DB',
                        color: 'white',
                      }}
                    >
                      {form[key] && <span className="text-[10px] font-bold leading-none">✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 w-full py-3 rounded-lg text-sm font-semibold text-white transition-opacity"
            style={{ background: '#1C2B3A', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>

          {/* Success */}
          {saved && (
            <div className="mt-4 px-4 py-3.5 bg-[#F7F4EF] border border-[#C9A96E]/20 rounded-lg text-sm text-[#6B6560] leading-relaxed">
              ✓ Profile saved.
              {isPro && (
                <span>
                  {' '}Your dashboard report still shows your previous results —{' '}
                  <a href="/dashboard" className="font-semibold underline text-[#C9A96E]">
                    go to dashboard
                  </a>
                  {' '}and use{' '}
                  <span className="font-semibold">↻ Refresh Report</span>
                  {' '}to regenerate with your updated profile.
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Email Preferences ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mt-5">
          <h2 className="text-[15px] font-semibold text-[#2C2C2A] mb-1">Email Preferences</h2>
          <p className="text-xs text-gray-400 mb-5 leading-relaxed">
            Transactional emails (verification, password reset, subscription receipts) cannot be disabled.
          </p>

          {/*
            SQL migration required before these toggles save successfully.
            Run in Supabase Dashboard → SQL Editor:

            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_monthly_reports    boolean DEFAULT true;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_midmonth_insights  boolean DEFAULT true;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_deadline_reminders boolean DEFAULT true;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_marketing          boolean DEFAULT true;
          */}

          <div className="space-y-3">
            {(
              [
                {
                  key:   'email_monthly_reports'    as const,
                  label: 'Monthly report emails',
                  sub:   'Get notified when your monthly report is refreshed',
                },
                {
                  key:   'email_midmonth_insights'  as const,
                  label: 'Mid-month check-ins',
                  sub:   'Useful reminders and tips around the 15th of each month',
                },
                {
                  key:   'email_deadline_reminders' as const,
                  label: 'Deadline reminders',
                  sub:   'Alerts for upcoming application and program deadlines',
                },
                {
                  key:   'email_marketing'          as const,
                  label: 'Product updates',
                  sub:   'New features, platform improvements, and announcements',
                },
              ] as const
            ).map(({ key, label, sub }) => (
              <div
                key={key}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-[#F7F4EF] transition-colors"
                onClick={() => setEmailPrefs(prev => ({ ...prev, [key]: !prev[key] }))}
              >
                <div>
                  <div className="text-sm font-medium text-[#2C2C2A]">{label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
                </div>
                {/* Toggle pill */}
                <div
                  className="flex-shrink-0 ml-4 w-10 h-5 rounded-full relative transition-colors"
                  style={{ background: emailPrefs[key] ? '#1C2B3A' : '#D1D5DB' }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200"
                    style={{ left: emailPrefs[key] ? '22px' : '2px' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {prefSaveError && (
            <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
              {prefSaveError}
            </div>
          )}

          <button
            onClick={handleSavePrefs}
            disabled={savingPrefs}
            className="mt-5 w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity"
            style={{ background: '#1C2B3A', opacity: savingPrefs ? 0.7 : 1 }}
          >
            {savingPrefs ? 'Saving…' : 'Save Email Preferences'}
          </button>

          {savedPrefs && (
            <div className="mt-3 px-4 py-2.5 bg-[#F7F4EF] border border-[#C9A96E]/20 rounded-lg text-xs text-[#6B6560]">
              ✓ Email preferences saved.
            </div>
          )}
        </div>

        {/* Back link */}
        <div className="mt-5 text-center">
          <a
            href="/dashboard"
            className="text-sm text-gray-400 hover:text-[#C9A96E] transition-colors"
          >
            ← Back to dashboard
          </a>
        </div>

      </div>
    </div>
  )
}
