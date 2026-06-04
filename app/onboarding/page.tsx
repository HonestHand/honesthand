/**
 * Onboarding — supports both Small Business and Nonprofit flows.
 *
 * REQUIRED SQL MIGRATIONS (run once in Supabase → SQL Editor):
 *
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type          text    DEFAULT 'business';
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ein                text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_501c3           boolean DEFAULT false;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mission_area       text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS populations_served text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS annual_budget      text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS years_operating    text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_programs   text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS funding_goals      text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grant_history      text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS org_focus             text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS funding_type_needs   text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_description text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS customer_segments    text;
 */
'use client'
import { useState } from 'react'
import { supabase } from '../supabase'
import { trackEvent } from '../lib/analytics'

type UserType = 'business' | 'nonprofit'

// ── Nonprofit constants ────────────────────────────────────────────────────────

const MISSION_AREAS = [
  'Education & Youth Development',
  'Food Security & Hunger Relief',
  'Housing & Homelessness',
  'Health & Mental Health',
  'Veterans & Military Families',
  'Environment & Conservation',
  'Arts, Culture & Humanities',
  'Animal Welfare',
  'Faith-Based Community Services',
  'Economic Development & Workforce',
  'Disaster Relief & Emergency Services',
  'Other',
]

const BUDGET_RANGES = [
  'Under $50,000',
  '$50,000 – $250,000',
  '$250,000 – $500,000',
  '$500,000 – $1M',
  '$1M – $5M',
  'Over $5M',
]

const YEARS_OPERATING = [
  'Less than 1 year',
  '1–3 years',
  '3–5 years',
  '5–10 years',
  'Over 10 years',
]

const GRANT_HISTORY_OPTIONS = [
  "None — we haven't applied",
  'Some — applied but not awarded',
  'Moderate — a few successful grants',
  'Experienced — active grant recipient',
]

const ORG_FOCUS_OPTIONS = [
  { key: 'faith_based',   label: 'Faith-Based',          icon: '✝️' },
  { key: 'veteran',       label: 'Veterans',              icon: '🎖️' },
  { key: 'youth',         label: 'Youth / Children',      icon: '👶' },
  { key: 'education',     label: 'Education',             icon: '📚' },
  { key: 'animal_welfare',label: 'Animal Welfare',        icon: '🐾' },
  { key: 'minority_led',  label: 'Minority-Led',          icon: '🌍' },
  { key: 'woman_led',     label: 'Woman-Led',             icon: '👩' },
  { key: 'rural',         label: 'Rural / Underserved',   icon: '🌾' },
  { key: 'immigrant',     label: 'Immigrant / Refugee',   icon: '🤝' },
  { key: 'disability',    label: 'Disability Services',   icon: '♿' },
]

const FUNDING_TYPE_OPTIONS = [
  { key: 'operating',  label: 'Operating / General Support' },
  { key: 'program',    label: 'Program / Project Funding'   },
  { key: 'capital',    label: 'Capital / Equipment'          },
  { key: 'staffing',   label: 'Staffing / Salaries'          },
  { key: 'capacity',   label: 'Capacity Building'            },
  { key: 'event',      label: 'Events / Fundraising'         },
]

// ── Business constants ─────────────────────────────────────────────────────────

const INDUSTRIES      = ['Restaurant / Food & Beverage', 'Ranch / Farm / Agriculture', 'Construction / Trades', 'Retail', 'Real Estate', 'Professional Services', 'Other']
const REVENUE_RANGES  = ['Under $100k', '$100k - $250k', '$250k - $500k', '$500k - $1M', 'Over $1M']
const ENTITY_TYPES    = ['Sole Proprietor', 'LLC', 'S-Corp', 'C-Corp', 'Partnership', 'Other']
const EMPLOYEE_COUNTS = ['Just me (1)', '2-5', '6-10', '11-25', '26-50', '51-100', '100+']

/** Dynamic placeholder text changes based on selected industry — keeps the field conversational */
const BUSINESS_DESCRIPTION_PLACEHOLDERS: Record<string, string> = {
  'Restaurant / Food & Beverage': 'e.g. Tex-Mex taqueria, BBQ smokehouse, coffee shop, food truck',
  'Ranch / Farm / Agriculture':   'e.g. Cattle ranch, pecan orchard, goat dairy, honey producer',
  'Construction / Trades':        'e.g. Roofing company, excavation contractor, HVAC, electrical',
  'Retail':                       'e.g. Western apparel store, hardware store, boutique gift shop',
  'Real Estate':                  'e.g. Residential brokerage, property management, commercial leasing',
  'Professional Services':        'e.g. CPA firm, IT consulting, marketing agency, staffing',
  'Other':                        'e.g. Custom trailer fabrication, auto body shop, dog grooming',
}

const CUSTOMER_SEGMENT_OPTIONS = [
  { key: 'consumers',   label: 'Consumers',              icon: '👤' },
  { key: 'businesses',  label: 'Other Businesses',       icon: '🏢' },
  { key: 'government',  label: 'Government',             icon: '🏛️' },
  { key: 'nonprofits',  label: 'Nonprofits',             icon: '🤝' },
  { key: 'agriculture', label: 'Agriculture / Ranching', icon: '🌾' },
  { key: 'tourism',     label: 'Tourism / Hospitality',  icon: '🏨' },
  { key: 'healthcare',  label: 'Healthcare Orgs',        icon: '🏥' },
  { key: 'education',   label: 'Education',              icon: '📚' },
  { key: 'mixed',       label: 'Mixed / Other',          icon: '⚡' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [userType, setUserType] = useState<UserType | ''>('')
  const [step,     setStep]     = useState(0)   // 0 = type selector
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [industryOther, setIndustryOther] = useState('')
  const [missionOther,  setMissionOther]  = useState('')

  const [form, setForm] = useState({
    // shared
    business_name:     '',
    city:              '',
    county:            '',
    user_type:         'business' as UserType,
    // business-only
    industry:             '',
    revenue_range:        '',
    entity_type:          '',
    employee_count:       '',
    is_veteran:           false,
    is_minority:          false,
    is_woman:             false,
    business_description: '',
    customer_segments:    [] as string[],
    // nonprofit-only
    ein:               '',
    is_501c3:          false,
    mission_area:      '',
    populations_served:'',
    annual_budget:     '',
    years_operating:   '',
    current_programs:  '',
    funding_goals:     '',
    grant_history:     '',
    org_focus:         [] as string[],
    funding_type_needs:[] as string[],
  })

  const effectiveIndustry = form.industry === 'Other'
    ? (industryOther.trim() || 'Other')
    : form.industry

  const effectiveMission = form.mission_area === 'Other'
    ? (missionOther.trim() || 'Other')
    : form.mission_area

  const totalSteps = 3

  const toggleArray = (field: 'org_focus' | 'funding_type_needs' | 'customer_segments', val: string) => {
    const arr = form[field]
    setForm({ ...form, [field]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] })
  }

  const validateStep = (s: number): string => {
    if (userType === 'business') {
      if (s === 1) {
        if (!form.business_name.trim()) return 'Please enter your business name'
        if (!form.industry) return 'Please select your industry'
        if (form.industry === 'Other' && !industryOther.trim()) return 'Please describe your industry'
      }
      if (s === 2) {
        if (!form.city.trim()) return 'Please enter your city'
        if (!form.revenue_range) return 'Please select your annual revenue range'
      }
    }
    if (userType === 'nonprofit') {
      if (s === 1) {
        if (!form.business_name.trim()) return 'Please enter your organization name'
        if (!form.mission_area) return 'Please select your primary mission area'
        if (form.mission_area === 'Other' && !missionOther.trim()) return 'Please describe your mission area'
      }
      if (s === 2) {
        if (!form.city.trim()) return 'Please enter your city'
        if (!form.populations_served.trim()) return 'Please describe the populations you serve'
      }
    }
    return ''
  }

  const handleSelectType = (type: UserType) => {
    setUserType(type)
    setForm({ ...form, user_type: type })
    setStep(1)
    setError('')
    trackEvent('onboarding_type_selected', { user_type: type })
  }

  const handleNext = () => {
    const msg = validateStep(step)
    if (msg) { setError(msg); return }
    setError('')
    setStep(step + 1)
  }

  const handleSubmit = async () => {
    if (!supabase) return
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const payload: Record<string, unknown> = {
        id:        user.id,
        user_type: form.user_type,
        city:      form.city,
        county:    form.county,
      }

      if (userType === 'business') {
        Object.assign(payload, {
          business_name:        form.business_name,
          industry:             effectiveIndustry,
          entity_type:          form.entity_type,
          employee_count:       form.employee_count,
          revenue_range:        form.revenue_range,
          is_veteran:           form.is_veteran,
          is_minority:          form.is_minority,
          is_woman:             form.is_woman,
          business_description: form.business_description || null,
          customer_segments:    form.customer_segments.join(',') || null,
        })
      } else {
        Object.assign(payload, {
          business_name:      form.business_name,  // reuses existing column for org name
          ein:                form.ein              || null,
          is_501c3:           form.is_501c3,
          mission_area:       effectiveMission,
          populations_served: form.populations_served,
          annual_budget:      form.annual_budget    || null,
          years_operating:    form.years_operating  || null,
          current_programs:   form.current_programs || null,
          funding_goals:      form.funding_goals    || null,
          grant_history:      form.grant_history    || null,
          org_focus:          form.org_focus.join(',')          || null,
          funding_type_needs: form.funding_type_needs.join(',') || null,
        })
        trackEvent('nonprofit_onboarding_completed', {
          mission_area: effectiveMission,
          is_501c3:     form.is_501c3,
          city:         form.city,
        }, user.id)
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })
      if (upsertError) throw upsertError
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  // ── Shared styles ────────────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '8px',
    border: '1px solid #E5E7EB', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box' as const, marginBottom: '12px',
    background: 'white', color: '#2C2C2A',
  }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  const checkboxRow = (
    label: string,
    sub: string,
    key: 'is_veteran' | 'is_minority' | 'is_woman' | 'is_501c3',
  ) => (
    <div
      key={key}
      style={{ padding: '16px', background: '#F9FAFB', borderRadius: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      onClick={() => setForm({ ...form, [key]: !form[key] })}
    >
      <div>
        <div style={{ fontSize: '14px', fontWeight: '500', color: '#2C2C2A' }}>{label}</div>
        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{sub}</div>
      </div>
      <div style={{ width: '24px', height: '24px', borderRadius: '6px', border: '2px solid', borderColor: form[key] ? '#C9A96E' : '#E5E7EB', background: form[key] ? '#1C2B3A' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '14px', flexShrink: 0 }}>
        {form[key] ? '✓' : ''}
      </div>
    </div>
  )

  const pillTag = (
    selected: boolean,
    onClick: () => void,
    icon: string | undefined,
    label: string,
  ) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: '20px',
        border: `1.5px solid ${selected ? '#C9A96E' : '#E5E7EB'}`,
        background: selected ? '#F7F4EF' : 'white',
        color: selected ? '#6B6560' : '#6B7280',
        fontSize: '12px', fontWeight: '500', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </button>
  )

  const logo = (
    <div style={{ textAlign: 'center', marginBottom: '32px', paddingTop: '24px' }}>
      <div style={{ fontSize: '22px', fontWeight: '600', color: '#2C2C2A' }}>
        Honest<span style={{ color: '#C9A96E' }}>Hand</span>
      </div>
    </div>
  )

  const footer = (
    <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: '#9CA3AF', lineHeight: '1.6', maxWidth: '380px', margin: '16px auto 0' }}>
      Your information is secure and never shared. HonestHand provides informational research only — not legal, financial, or tax advice.
    </div>
  )

  // ── Step 0: Type selector ────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          {logo}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#2C2C2A', marginBottom: '4px' }}>
              Who are you signing up as?
            </div>
            <div style={{ fontSize: '14px', color: '#6B7280' }}>
              We'll customize your report based on your type of organization.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Business card */}
            <button
              onClick={() => handleSelectType('business')}
              style={{ padding: '24px', background: 'white', border: '2px solid #E5E7EB', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', width: '100%' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A96E'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(201,169,110,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏢</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#2C2C2A', marginBottom: '4px' }}>Small Business</div>
              <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.5' }}>
                Grants, tax credits, SBA programs, certifications, and government contracts for Texas businesses.
              </div>
            </button>

            {/* Nonprofit card */}
            <button
              onClick={() => handleSelectType('nonprofit')}
              style={{ padding: '24px', background: 'white', border: '2px solid #E5E7EB', borderRadius: '16px', textAlign: 'left', cursor: 'pointer', width: '100%' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A96E'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(201,169,110,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🤝</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#2C2C2A', marginBottom: '4px' }}>Nonprofit Organization</div>
              <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.5' }}>
                Foundation grants, government funding, corporate sponsorships, and capacity-building resources for Texas nonprofits.
              </div>
            </button>
          </div>

          {footer}
        </div>
      </div>
    )
  }

  // ── Steps 1–3: intake ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {logo}

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#2C2C2A', marginBottom: '4px' }}>
            {userType === 'nonprofit' ? 'Tell us about your organization' : 'Tell us about your business'}
          </div>
          <div style={{ fontSize: '14px', color: '#6B7280' }}>
            Takes 2 minutes. We'll find what you're eligible for.
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ flex: 1, height: '4px', borderRadius: '2px', background: s <= step ? '#C9A96E' : '#E5E7EB' }} />
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #E5E7EB' }}>

          {/* ── BUSINESS STEP 1 ── */}
          {userType === 'business' && step === 1 && (
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#2C2C2A', marginBottom: '16px' }}>Basic information</div>
              <input style={inputStyle} placeholder="Business name" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} />
              <select style={selectStyle} value={form.industry} onChange={e => { setForm({ ...form, industry: e.target.value }); setIndustryOther('') }}>
                <option value="">Select your industry</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              {form.industry === 'Other' && (
                <input style={{ ...inputStyle, borderColor: '#C9A96E' }} placeholder="Describe your industry (e.g. Auto Repair, Daycare, Landscaping)" value={industryOther} onChange={e => setIndustryOther(e.target.value)} autoFocus />
              )}
              {/* Business description — shows once an industry is selected */}
              {form.industry && (
                <input
                  style={inputStyle}
                  placeholder={BUSINESS_DESCRIPTION_PLACEHOLDERS[form.industry] || 'What specifically does your business do?'}
                  value={form.business_description}
                  onChange={e => setForm({ ...form, business_description: e.target.value })}
                />
              )}
              <select style={selectStyle} value={form.entity_type} onChange={e => setForm({ ...form, entity_type: e.target.value })}>
                <option value="">Select entity type</option>
                {ENTITY_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select style={selectStyle} value={form.employee_count} onChange={e => setForm({ ...form, employee_count: e.target.value })}>
                <option value="">Number of employees</option>
                {EMPLOYEE_COUNTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* ── BUSINESS STEP 2 ── */}
          {userType === 'business' && step === 2 && (
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#2C2C2A', marginBottom: '16px' }}>Location & revenue</div>
              <input style={inputStyle} placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <input style={inputStyle} placeholder="County" value={form.county} onChange={e => setForm({ ...form, county: e.target.value })} />
              <select style={selectStyle} value={form.revenue_range} onChange={e => setForm({ ...form, revenue_range: e.target.value })}>
                <option value="">Select annual revenue range</option>
                {REVENUE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          {/* ── BUSINESS STEP 3 ── */}
          {userType === 'business' && step === 3 && (
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#2C2C2A', marginBottom: '16px' }}>Ownership & final details</div>

              {/* Audience segmentation */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#2C2C2A', marginBottom: '4px' }}>
                  Who do you primarily serve?
                </div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '10px' }}>
                  Select all that apply — improves your recommendations.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {CUSTOMER_SEGMENT_OPTIONS.map(opt =>
                    pillTag(
                      form.customer_segments.includes(opt.key),
                      () => toggleArray('customer_segments', opt.key),
                      opt.icon,
                      opt.label,
                    )
                  )}
                </div>
              </div>

              {checkboxRow('Veteran-owned business?', 'Unlocks exclusive veteran programs', 'is_veteran')}
              {checkboxRow('Minority-owned business?', 'Unlocks minority business grants', 'is_minority')}
              {checkboxRow('Woman-owned business?', 'Unlocks women entrepreneur programs', 'is_woman')}
              <div style={{ padding: '16px', background: '#F7F4EF', borderRadius: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#6B6560', marginBottom: '4px' }}>Your report is almost ready</div>
                <div style={{ fontSize: '12px', color: '#C9A96E', lineHeight: '1.6' }}>We'll match your business against 50+ Texas programs and show you exactly what you qualify for.</div>
                <div style={{ fontSize: '11px', color: '#6B9E8A', lineHeight: '1.6', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(201,169,110,0.2)' }}>
                  Results are for informational purposes only and do not constitute financial, legal, or tax advice. Always verify program eligibility directly with the administering agency.
                </div>
              </div>
            </div>
          )}

          {/* ── NONPROFIT STEP 1 ── */}
          {userType === 'nonprofit' && step === 1 && (
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#2C2C2A', marginBottom: '16px' }}>About your organization</div>
              <input style={inputStyle} placeholder="Organization name" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} />
              <select style={selectStyle} value={form.mission_area} onChange={e => { setForm({ ...form, mission_area: e.target.value }); setMissionOther('') }}>
                <option value="">Select your primary mission area</option>
                {MISSION_AREAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {form.mission_area === 'Other' && (
                <input style={{ ...inputStyle, borderColor: '#C9A96E' }} placeholder="Describe your mission area" value={missionOther} onChange={e => setMissionOther(e.target.value)} autoFocus />
              )}
              {checkboxRow('501(c)(3) status confirmed?', 'Unlocks foundation and government grant eligibility', 'is_501c3')}
              <input style={{ ...inputStyle, marginTop: '4px' }} placeholder="EIN (optional, e.g. 12-3456789)" value={form.ein} onChange={e => setForm({ ...form, ein: e.target.value })} />
            </div>
          )}

          {/* ── NONPROFIT STEP 2 ── */}
          {userType === 'nonprofit' && step === 2 && (
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#2C2C2A', marginBottom: '16px' }}>Location & community</div>
              <input style={inputStyle} placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <input style={inputStyle} placeholder="County" value={form.county} onChange={e => setForm({ ...form, county: e.target.value })} />
              <textarea
                style={{ ...inputStyle, height: '80px', resize: 'none', fontFamily: 'system-ui' } as React.CSSProperties}
                placeholder="Who do you serve? (e.g. low-income families, homeless youth, veterans in rural Texas)"
                value={form.populations_served}
                onChange={e => setForm({ ...form, populations_served: e.target.value })}
              />
              <select style={selectStyle} value={form.annual_budget} onChange={e => setForm({ ...form, annual_budget: e.target.value })}>
                <option value="">Annual operating budget</option>
                {BUDGET_RANGES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select style={selectStyle} value={form.years_operating} onChange={e => setForm({ ...form, years_operating: e.target.value })}>
                <option value="">Years operating</option>
                {YEARS_OPERATING.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* ── NONPROFIT STEP 3 ── */}
          {userType === 'nonprofit' && step === 3 && (
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#2C2C2A', marginBottom: '16px' }}>Programs & funding needs</div>

              <select style={selectStyle} value={form.grant_history} onChange={e => setForm({ ...form, grant_history: e.target.value })}>
                <option value="">Grant history</option>
                {GRANT_HISTORY_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>

              {/* Org focus tags */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#2C2C2A', marginBottom: '8px' }}>
                  Organization focus areas <span style={{ fontWeight: '400', color: '#9CA3AF' }}>(select all that apply)</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {ORG_FOCUS_OPTIONS.map(opt =>
                    pillTag(
                      form.org_focus.includes(opt.key),
                      () => toggleArray('org_focus', opt.key),
                      opt.icon,
                      opt.label,
                    )
                  )}
                </div>
              </div>

              {/* Funding type needs */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#2C2C2A', marginBottom: '8px' }}>
                  What type of funding do you need? <span style={{ fontWeight: '400', color: '#9CA3AF' }}>(select all that apply)</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {FUNDING_TYPE_OPTIONS.map(opt =>
                    pillTag(
                      form.funding_type_needs.includes(opt.key),
                      () => toggleArray('funding_type_needs', opt.key),
                      undefined,
                      opt.label,
                    )
                  )}
                </div>
              </div>

              <div style={{ padding: '16px', background: '#F7F4EF', borderRadius: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#6B6560', marginBottom: '4px' }}>Your funding report is almost ready</div>
                <div style={{ fontSize: '12px', color: '#C9A96E', lineHeight: '1.6' }}>
                  We'll match your organization against foundation grants, government funding, corporate sponsorships, and local programs across Texas.
                </div>
                <div style={{ fontSize: '11px', color: '#6B9E8A', lineHeight: '1.6', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(201,169,110,0.2)' }}>
                  Results are for informational purposes only. Always verify grant eligibility directly with the funding organization.
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#DC2626' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={() => { setError(''); step === 1 ? setStep(0) : setStep(step - 1) }}
              style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontWeight: '500', color: '#6B7280', cursor: 'pointer' }}
            >
              Back
            </button>
            <button
              onClick={() => step < totalSteps ? handleNext() : handleSubmit()}
              disabled={loading}
              style={{ flex: 1, padding: '12px', background: '#1C2B3A', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Setting up…' : step < totalSteps ? 'Continue' : 'Generate My Report →'}
            </button>
          </div>
        </div>

        {footer}
      </div>
    </div>
  )
}
