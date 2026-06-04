'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabase'
import ReportView, { ProfileSummary } from '../components/ReportView'
import { trackEvent } from '../lib/analytics'

// ─── Report phase state machine ───────────────────────────────────────────────
// Single source of truth for all report generation states.
// Only ONE phase is active at any time — no overlapping banners.
type ReportPhase =
  | 'idle'         // No generation in progress; showing cached report or nothing
  | 'generating'   // Fetch initiated, waiting for first SSE byte
  | 'searching'    // Actively streaming (web searches + text generation)
  | 'retrying'     // Transient failure, auto-retrying — keep cached report visible
  | 'in_progress'  // Server-side job already running for this user
  | 'success'      // Generation complete
  | 'failed'       // Terminal failure — show error + cached report if available

// ─── Rotating loading messages ────────────────────────────────────────────────

const LOADING_MESSAGES_BUSINESS = [
  { icon: '🔍', primary: 'Analyzing your business profile…',         sub: 'Matching against programs for your industry.' },
  { icon: '🌐', primary: 'Scanning SBA program databases…',           sub: 'Checking active federal loans, grants, and resources.' },
  { icon: '🏛️', primary: 'Reviewing Texas state incentive programs…', sub: 'TWC, TDA, Governor\'s Office, and more.' },
  { icon: '📍', primary: 'Checking county-level opportunities…',       sub: 'Local EDC programs, city grants, and municipal incentives.' },
  { icon: '🎖️', primary: 'Verifying veteran-owned business programs…', sub: 'TVC, SBA VOSB, set-aside contracts, and resources.' },
  { icon: '💡', primary: 'Analyzing industry-specific funding…',       sub: 'Trade associations, sector grants, and niche programs.' },
  { icon: '🧾', primary: 'Identifying tax credits and deductions…',    sub: 'WOTC, Section 179, R&D credits, energy incentives.' },
  { icon: '📋', primary: 'Verifying current deadlines…',               sub: 'Confirming which programs are open and accepting applications.' },
  { icon: '✅', primary: 'Building your personalized report…',         sub: 'Ranking opportunities by easiest win first.' },
]

const LOADING_MESSAGES_NONPROFIT = [
  { icon: '🔍', primary: 'Analyzing your organization profile…',      sub: 'Matching against grants for your mission area.' },
  { icon: '🌐', primary: 'Scanning federal grant databases…',          sub: 'Checking HHS, DOJ, HUD, AmeriCorps, NEA, and more.' },
  { icon: '🏛️', primary: 'Reviewing Texas nonprofit programs…',        sub: 'HHSC, TEA, TCA, Governor\'s Office, and more.' },
  { icon: '📍', primary: 'Checking local foundation opportunities…',   sub: 'Community foundations, city allocations, and county programs.' },
  { icon: '🤝', primary: 'Identifying corporate giving programs…',     sub: 'Texas companies with giving programs aligned to your mission.' },
  { icon: '💡', primary: 'Finding mission-aligned funders…',           sub: 'National foundations, issue-specific funders, capacity grants.' },
  { icon: '🧾', primary: 'Reviewing capacity-building resources…',     sub: 'Tech grants, training programs, and org development funding.' },
  { icon: '📋', primary: 'Verifying current grant cycles…',            sub: 'Confirming which foundations are accepting applications.' },
  { icon: '✅', primary: 'Building your nonprofit funding report…',    sub: 'Ranking opportunities by grant readiness and mission fit.' },
]

// Pick the right set based on profile type (called with isNonprofit flag)
function getLoadingMessages(isNonprofit: boolean) {
  return isNonprofit ? LOADING_MESSAGES_NONPROFIT : LOADING_MESSAGES_BUSINESS
}

// Keep a single alias for the legacy default so the component still compiles
const LOADING_MESSAGES = LOADING_MESSAGES_BUSINESS

function LoadingState({ searching, isNonprofit = false }: { searching: boolean; isNonprofit?: boolean }) {
  const [msgIndex, setMsgIndex] = useState(0)
  const messages = getLoadingMessages(isNonprofit)

  useEffect(() => {
    if (!searching) return
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % messages.length)
    }, 3200)
    return () => clearInterval(interval)
  }, [searching, messages.length])

  const msg = searching ? messages[msgIndex] : messages[0]

  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: '36px', marginBottom: '16px' }}>{msg.icon}</div>
      <div style={{ fontSize: '15px', fontWeight: '600', color: '#1C1C1A', marginBottom: '6px' }}>
        {msg.primary}
      </div>
      <div style={{ fontSize: '13px', color: '#6B6560', lineHeight: '1.6', maxWidth: '320px', margin: '0 auto' }}>
        {msg.sub}
      </div>
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '6px' }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: i === msgIndex % 3 ? '#C9A96E' : '#E5E0D8',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}


// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [profile,      setProfile]      = useState<any>(null)
  const [report,       setReport]       = useState('')
  const [reportDate,   setReportDate]   = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [user,         setUser]         = useState<any>(null)
  const [isPro,        setIsPro]        = useState(false)
  const [upgrading,    setUpgrading]    = useState(false)
  const [upgradeError, setUpgradeError] = useState('')
  const [refreshConfirm, setRefreshConfirm] = useState(false)
  const [emailUnverified,  setEmailUnverified]  = useState(false)
  const [resendingVerify,  setResendingVerify]  = useState(false)
  const [verifyResentOk,   setVerifyResentOk]   = useState(false)
  const paywallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Single canonical report phase — no mixed state possible ──────────────
  const [reportPhase,   setReportPhase]   = useState<ReportPhase>('idle')
  const [phaseMessage,  setPhaseMessage]  = useState('')

  // Derived convenience flags — always consistent with reportPhase
  const isActive  = reportPhase === 'generating' || reportPhase === 'searching' || reportPhase === 'retrying'
  const isSearching = reportPhase === 'searching'

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    if (!supabase) return
    const params       = new URLSearchParams(window.location.search)
    const upgraded     = params.get('upgraded') === 'true'
    const stripeSessionId = params.get('session_id') || undefined

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/'; return }
    setUser(session.user)
    // Soft verification check — show banner if not confirmed, but don't block access
    if (!session.user.email_confirmed_at) {
      setEmailUnverified(true)
    }

    // ── Handle post-checkout upgrade activation ──
    let activatedPro = false
    if (upgraded) {
      try {
        const res = await fetch('/api/activate-pro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: session.user.email, userId: session.user.id, sessionId: stripeSessionId }),
        })
        const result = await res.json()
        if (res.ok && result.is_pro === true) {
          window.location.href = '/dashboard/welcome'
          return
        } else {
          console.error('[activate-pro]', result.error ?? 'is_pro not set')
        }
      } catch (e) {
        console.error('[activate-pro] fetch failed:', e)
      }
      window.history.replaceState({}, '', '/dashboard')
    }

    // ── Load profile ──
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (!profileData || !profileData.business_name) {
      window.location.href = '/onboarding'
      return
    }
    setProfile(profileData)

    const proStatus = activatedPro || profileData?.is_pro === true || profileData?.is_pro === 'true'
    setIsPro(proStatus)
    setLoading(false)

    // ── Load stored report ──
    const { data: storedReport } = await supabase
      .from('reports')
      .select('report_text, created_at')
      .eq('user_id', session.user.id)
      .single()

    if (storedReport?.report_text) {
      // Detect format: attempt to parse first 500 chars to confirm JSON array
      let isJsonReport = false
      try {
        const sample = JSON.parse(storedReport.report_text.slice(0, 500))
        if (Array.isArray(sample)) isJsonReport = true
      } catch { /* not JSON — old markdown format */ }

      if (!isJsonReport) {
        // Old markdown format — discard and regenerate as JSON
        generateReport(profileData, session.user.id)
      } else {
        // JSON format — parse full text to get real opportunity count for pro check
        let fullLength = 0
        try {
          const full = JSON.parse(storedReport.report_text)
          if (Array.isArray(full)) fullLength = full.length
        } catch { /* malformed — will regenerate below */ }

        if (proStatus && fullLength < 8) {
          // Too few opportunities for a pro report — regenerate
          generateReport(profileData, session.user.id)
        } else {
          // Valid cached JSON report — show immediately
          setReport(storedReport.report_text)
          setReportDate(storedReport.created_at ?? null)
        }
      }
    } else {
      // No stored report — generate for the first time
      generateReport(profileData, session.user.id)
    }
  }

  const generateReport = async (p: any, userId?: string, isRefresh = false) => {
    const uid = userId || user?.id

    // ── ATOMIC: transition to generating, clear ALL previous state ───────────
    // This is the ONLY place state is written at generation start.
    // No old error, retry notice, or phase can survive into the new cycle.
    setReportPhase('generating')
    setPhaseMessage('')
    setRefreshConfirm(false)

    // First-time: clear the report so the loading screen shows.
    // Refresh: keep cached report visible beneath the loading state.
    if (!isRefresh) {
      setReport('')
      setReportDate(null)
    }

    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer     = ''
      let fullReport = ''
      let hadError   = false

      // Transition to 'searching' the moment the stream opens — never idle during read
      setReportPhase('searching')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(line.slice(6))

            // ── Phase transitions — one at a time, never overlapping ──────────
            if (parsed.status === 'searching') {
              setReportPhase('searching')
              setPhaseMessage('')
            }

            if (parsed.status === 'retrying') {
              // Auto-retry: show retrying phase. Cached report stays visible.
              setReportPhase('retrying')
              setPhaseMessage('Verifying current program data — this may take a moment longer.')
            }

            if (parsed.text) {
              // Text arriving means retry succeeded — back to active streaming
              setReportPhase('searching')
              setPhaseMessage('')
              fullReport += parsed.text
              setReport(prev => prev + parsed.text)
            }

            if (parsed.error) {
              // Terminal error: choose the right failed phase
              hadError = true
              const code = parsed.errorCode ?? ''
              if (code === 'REPORT_IN_PROGRESS') {
                setReportPhase('in_progress')
              } else {
                setReportPhase('failed')
              }
              setPhaseMessage(parsed.error)
            }
          } catch { /* ignore SSE parse errors */ }
        }
      }

      // Stream ended without a terminal error event → success
      if (!hadError) {
        setReportPhase('success')
        if (fullReport && uid) {
          try {
            await fetch('/api/save-report', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: uid, content: fullReport }),
            })
            setReportDate(new Date().toISOString())
          } catch (e) {
            console.error('[save-report] failed:', e)
          }
        }
      }
    } catch {
      // Network / fetch-level failure
      setReportPhase('failed')
      setPhaseMessage("We're having trouble reaching the report service. Please try again in a moment.")
    }
  }

  const handleRefreshRequest = () => {
    if (refreshConfirm) {
      generateReport(profile, undefined, true)  // isRefresh=true → preserve cached report
    } else {
      setRefreshConfirm(true)
      setTimeout(() => setRefreshConfirm(false), 5000)
    }
  }

  const handleUpgrade = async () => {
    if (!user) return
    setUpgrading(true)
    setUpgradeError('')
    try {
      const res  = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email, origin: window.location.origin }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setUpgradeError(data.error || 'Could not start checkout. Please try again.')
        setUpgrading(false)
      }
    } catch (e: any) {
      setUpgradeError(e?.message || 'Network error. Please try again.')
      setUpgrading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!user?.email) return
    setResendingVerify(true)
    try {
      await fetch('/api/emails/resend-verification', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: user.email }),
      })
      trackEvent('verification_resend_clicked', {}, user?.id)
      setVerifyResentOk(true)
    } catch { /* non-fatal */ }
    setResendingVerify(false)
  }

  // Abandoned-paywall trigger: fire after 12 s of the upgrade wall being visible
  const handlePaywallVisible = (userId: string) => {
    if (paywallTimerRef.current) return   // already scheduled
    trackEvent('paywall_viewed', {}, userId)
    paywallTimerRef.current = setTimeout(() => {
      fetch('/api/emails/abandoned-paywall', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      }).catch(() => {})
    }, 12_000)
  }

  const signOut = async () => {
    if (paywallTimerRef.current) clearTimeout(paywallTimerRef.current)
    if (supabase) await supabase.auth.signOut()
    window.location.href = '/'
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
        Loading…
      </div>
    )
  }

  const isNonprofit = profile?.user_type === 'nonprofit'

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4EF', fontFamily: 'system-ui' }}>

      {/* ── Nav ── */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E0D8', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="hh-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#1C1C1A' }}>
            Honest<span style={{ color: '#C9A96E' }}>Hand</span>
          </div>
          {isPro && (
            <a href="/community" className="hh-nav-link" style={{ fontSize: '13px', color: '#6B6560', textDecoration: 'none', fontWeight: '500' }}>
              Community
            </a>
          )}
          <a href="/profile" className="hh-nav-link" style={{ fontSize: '13px', color: '#6B6560', textDecoration: 'none', fontWeight: '500' }}>
            Profile
          </a>
          <a href="/contact" className="hh-nav-link" style={{ fontSize: '13px', color: '#6B6560', textDecoration: 'none', fontWeight: '500' }}>
            Contact Us
          </a>
        </div>
        <button
          onClick={signOut}
          style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #E5E0D8', borderRadius: '20px', background: 'none', cursor: 'pointer', color: '#6B6560' }}
        >
          Sign out
        </button>
      </div>

      {/* ── Email verification banner ── */}
      {emailUnverified && (
        <div style={{ background: '#FEF3C7', borderBottom: '1px solid #FCD34D', padding: '12px 24px' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📬</span>
              <span style={{ fontSize: '13px', color: '#92400E', fontWeight: '500' }}>
                Check your inbox to verify your email before accessing your full Honest Hand report.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
              {verifyResentOk ? (
                <span style={{ fontSize: '12px', color: '#065F46', fontWeight: '600' }}>✓ Email sent — check your inbox</span>
              ) : (
                <button
                  onClick={handleResendVerification}
                  disabled={resendingVerify}
                  style={{ fontSize: '12px', padding: '6px 14px', background: '#F59E0B', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', opacity: resendingVerify ? 0.7 : 1 }}
                >
                  {resendingVerify ? 'Sending…' : 'Resend verification email'}
                </button>
              )}
              <button
                onClick={() => setEmailUnverified(false)}
                style={{ fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', lineHeight: 1 }}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page body ── */}
      <div className="hh-page-body" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#1C1C1A' }}>
              Welcome, {profile?.business_name} 👋
            </div>
            <div style={{ fontSize: '14px', color: '#6B6560', marginTop: '4px' }}>
              {isNonprofit
                ? `${profile?.mission_area || 'Nonprofit'} · ${profile?.city}, TX${profile?.annual_budget ? ` · ${profile.annual_budget}` : ''}`
                : `${profile?.industry} · ${profile?.city}, TX · ${profile?.revenue_range}`
              }
            </div>
            {/* Profile completeness nudge */}
            {profile && (() => {
              const missing = isNonprofit
                ? ['county', 'populations_served', 'annual_budget'].filter(k => !profile[k])
                : ['county', 'entity_type', 'employee_count'].filter(k => !profile[k])
              if (missing.length === 0) return null
              const labels: Record<string, string> = {
                county:             'county',
                entity_type:        'entity type',
                employee_count:     'employee count',
                populations_served: 'populations served',
                annual_budget:      'annual budget',
              }
              return (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#F59E0B' }}>⚡</span>
                  <span style={{ fontSize: '12px', color: '#6B6560' }}>
                    Add {missing.map(k => labels[k]).join(' and ')} for better-matched results
                  </span>
                  <a href="/profile" style={{ fontSize: '12px', color: '#C9A96E', fontWeight: '500', textDecoration: 'none' }}>
                    Edit Profile →
                  </a>
                </div>
              )
            })()}
          </div>

          {/* Refresh control — Pro only, when report is ready */}
          {report && !isActive && isPro && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <button
                onClick={handleRefreshRequest}
                style={{
                  padding: '8px 16px',
                  background: refreshConfirm ? '#FEF3C7' : '#FFFFFF',
                  border: `1.5px solid ${refreshConfirm ? '#F59E0B' : '#E5E0D8'}`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: refreshConfirm ? '#92400E' : '#6B6560',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {refreshConfirm ? '⚠️ Confirm refresh?' : '↻ Refresh Report'}
              </button>
              {refreshConfirm && (
                <div style={{ fontSize: '11px', color: '#6B6560', textAlign: 'right' }}>
                  This will regenerate your full report.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Report card */}
        <div className="hh-card" style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', border: '1px solid #E5E0D8', marginBottom: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#1C1C1A', marginBottom: '16px' }}>
            {isNonprofit ? 'Nonprofit Funding Opportunities' : 'Your Opportunity Report'}
          </div>

          {/* ── Report area — SINGLE phase-driven renderer, states are mutually exclusive ── */}
          {(() => {
            const profileSummary: ProfileSummary | undefined = profile ? {
              businessName:  profile.business_name,
              description:   profile.business_description || undefined,
              city:          profile.city,
              county:        profile.county        || undefined,
              industry:      profile.industry      || undefined,
              revenue:       profile.revenue_range || undefined,
              entityType:    profile.entity_type   || undefined,
              employeeCount: profile.employee_count || undefined,
              isVeteran:     profile.is_veteran  === true,
              isMinority:    profile.is_minority === true,
              isWoman:       profile.is_woman    === true,
              userType:      profile.user_type   === 'nonprofit' ? 'nonprofit' : 'business',
              missionArea:   profile.mission_area   || undefined,
              annualBudget:  profile.annual_budget  || undefined,
              is501c3:       profile.is_501c3       === true,
            } : undefined

            const reportView = report ? (
              <ReportView
                report={report}
                isPro={isPro}
                reportDate={reportDate}
                onUpgrade={handleUpgrade}
                upgrading={upgrading}
                upgradeError={upgradeError}
                userId={user?.id}
                profile={profileSummary}
                onPaywallVisible={!isPro && user?.id ? () => handlePaywallVisible(user.id) : undefined}
              />
            ) : null

            // ── Phase: GENERATING — fetch initiated, no stream yet ───────────
            if (reportPhase === 'generating') {
              return <LoadingState searching={false} isNonprofit={isNonprofit} />
            }

            // ── Phase: SEARCHING — streaming active ──────────────────────────
            if (reportPhase === 'searching') {
              return <LoadingState searching={true} isNonprofit={isNonprofit} />
            }

            // ── Phase: RETRYING — auto-retry, cached report stays visible ────
            if (reportPhase === 'retrying') {
              return (
                <>
                  <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#F7F4EF', border: '1px solid #E5E0D8', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🔄</span>
                    <span style={{ fontSize: '13px', color: '#6B6560' }}>{phaseMessage}</span>
                  </div>
                  {reportView}
                </>
              )
            }

            // ── Phase: IN_PROGRESS — server job already running ───────────────
            if (reportPhase === 'in_progress') {
              return (
                <>
                  <div style={{ marginBottom: report ? '16px' : '0', padding: '10px 14px', background: '#F7F4EF', border: '1px solid #E5E0D8', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🔄</span>
                    <span style={{ fontSize: '13px', color: '#6B6560' }}>{phaseMessage || "We're checking for the latest funding opportunities now."}</span>
                  </div>
                  {reportView}
                </>
              )
            }

            // ── Phase: FAILED — terminal error ───────────────────────────────
            if (reportPhase === 'failed') {
              return (
                <>
                  <div style={{ marginBottom: report ? '16px' : '0', padding: '10px 14px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>⏳</span>
                    <div>
                      <div style={{ fontSize: '13px', color: '#1C1C1A' }}>{phaseMessage}</div>
                      {report && <div style={{ fontSize: '12px', color: '#6B6560', marginTop: '3px' }}>Showing your most recent report below.</div>}
                    </div>
                  </div>
                  {reportView || (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <button onClick={() => profile && generateReport(profile)}
                        style={{ padding: '8px 18px', background: '#1C2B3A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        Try Again
                      </button>
                    </div>
                  )}
                </>
              )
            }

            // ── Phase: SUCCESS / IDLE — show report or first-time empty ──────
            if (reportView) return reportView

            // Truly empty — no report yet and idle (shouldn't normally reach here)
            return (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
                <div style={{ fontSize: '14px', color: '#6B6560', marginBottom: '16px' }}>Your report is being prepared.</div>
                <button onClick={() => profile && generateReport(profile)}
                  style={{ padding: '8px 16px', background: '#1C2B3A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  Generate Report
                </button>
              </div>
            )
          })()}
        </div>

      </div>
    </div>
  )
}
