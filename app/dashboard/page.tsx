'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import ReportView from '../components/ReportView'

// ─── Rotating loading messages ────────────────────────────────────────────────

const LOADING_MESSAGES = [
  { icon: '🔍', primary: 'Analyzing your business profile…',        sub: 'Matching against programs for your industry.' },
  { icon: '🌐', primary: 'Scanning SBA program databases…',          sub: 'Checking active federal loans, grants, and resources.' },
  { icon: '🏛️', primary: 'Reviewing Texas state incentive programs…', sub: 'TWC, TDA, Governor\'s Office, and more.' },
  { icon: '📍', primary: 'Checking county-level opportunities…',      sub: 'Local EDC programs, city grants, and municipal incentives.' },
  { icon: '🎖️', primary: 'Verifying veteran-owned business programs…', sub: 'TVC, SBA VOSB, set-aside contracts, and resources.' },
  { icon: '💡', primary: 'Analyzing industry-specific funding…',      sub: 'Trade associations, sector grants, and niche programs.' },
  { icon: '🧾', primary: 'Identifying tax credits and deductions…',   sub: 'WOTC, Section 179, R&D credits, energy incentives.' },
  { icon: '📋', primary: 'Verifying current deadlines…',              sub: 'Confirming which programs are open and accepting applications.' },
  { icon: '✅', primary: 'Building your personalized report…',        sub: 'Ranking opportunities by easiest win first.' },
]

function LoadingState({ searching }: { searching: boolean }) {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    if (!searching) return
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length)
    }, 3200)
    return () => clearInterval(interval)
  }, [searching])

  const msg = searching ? LOADING_MESSAGES[msgIndex] : LOADING_MESSAGES[0]

  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: '36px', marginBottom: '16px' }}>{msg.icon}</div>
      <div style={{ fontSize: '15px', fontWeight: '600', color: '#2C2C2A', marginBottom: '6px' }}>
        {msg.primary}
      </div>
      <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.6', maxWidth: '320px', margin: '0 auto' }}>
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
              background: i === msgIndex % 3 ? '#1D9E75' : '#E5E7EB',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Minimum section count to identify a Pro report ──────────────────────────
// Free reports have 3 sections; Pro reports have 8+. We use 5 as the threshold
// so that upgrading users automatically get a fresh Pro report generated.
const MIN_PRO_SECTION_COUNT = 5

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [profile,      setProfile]      = useState<any>(null)
  const [report,       setReport]       = useState('')
  const [reportDate,   setReportDate]   = useState<string | null>(null)
  const [generating,   setGenerating]   = useState(false)
  const [searching,    setSearching]    = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [user,         setUser]         = useState<any>(null)
  const [isPro,        setIsPro]        = useState(false)
  const [upgrading,    setUpgrading]    = useState(false)
  const [upgradeError, setUpgradeError] = useState('')
  const [refreshConfirm, setRefreshConfirm] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    if (!supabase) return
    const params       = new URLSearchParams(window.location.search)
    const upgraded     = params.get('upgraded') === 'true'
    const stripeSessionId = params.get('session_id') || undefined

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/'; return }
    setUser(session.user)

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
      .select('content, generated_at')
      .eq('user_id', session.user.id)
      .single()

    if (storedReport?.content) {
      const sectionCount = (storedReport.content.match(/^## /gm) || []).length
      const isProReport  = sectionCount >= MIN_PRO_SECTION_COUNT

      if (proStatus && !isProReport) {
        // User upgraded but stored report is the old free preview — regenerate
        generateReport(profileData, session.user.id)
      } else {
        // Show cached report immediately — no API call
        setReport(storedReport.content)
        setReportDate(storedReport.generated_at ?? null)
      }
    } else {
      // No stored report — generate for the first time
      generateReport(profileData, session.user.id)
    }
  }

  const generateReport = async (p: any, userId?: string) => {
    const uid = userId || user?.id
    setGenerating(true)
    setSearching(false)
    setReport('')
    setReportDate(null)
    setRefreshConfirm(false)

    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let fullReport = ''
      setGenerating(false)

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
            if (parsed.status === 'searching') setSearching(true)
            if (parsed.text) {
              setSearching(false)
              fullReport += parsed.text
              setReport(prev => prev + parsed.text)
            }
            if (parsed.error) {
              setSearching(false)
              setReport('Error: ' + parsed.error)
            }
          } catch { /* ignore parse errors in SSE stream */ }
        }
      }

      // Persist completed report
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
    } catch (e: any) {
      setReport('Error: ' + (e?.message || 'Unknown error occurred'))
      setGenerating(false)
    }
  }

  const handleRefreshRequest = () => {
    if (refreshConfirm) {
      generateReport(profile)
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

  const signOut = async () => {
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

  const isActive = generating || searching

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'system-ui' }}>

      {/* ── Nav ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="hh-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#2C2C2A' }}>
            Honest<span style={{ color: '#1D9E75' }}>Hand</span>
          </div>
          {isPro && (
            <a href="/community" className="hh-nav-link" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none', fontWeight: '500' }}>
              Community
            </a>
          )}
          <a href="/profile" className="hh-nav-link" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none', fontWeight: '500' }}>
            Profile
          </a>
          <a href="/contact" className="hh-nav-link" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none', fontWeight: '500' }}>
            Contact Us
          </a>
        </div>
        <button
          onClick={signOut}
          style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: '20px', background: 'none', cursor: 'pointer', color: '#6B7280' }}
        >
          Sign out
        </button>
      </div>

      {/* ── Page body ── */}
      <div className="hh-page-body" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#2C2C2A' }}>
              Welcome, {profile?.business_name} 👋
            </div>
            <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
              {profile?.industry} · {profile?.city}, TX · {profile?.revenue_range}
            </div>
            {/* Profile completeness nudge — shown when optional fields are missing */}
            {profile && (() => {
              const missing = ['county', 'entity_type', 'employee_count'].filter(k => !profile[k])
              if (missing.length === 0) return null
              const labels: Record<string, string> = { county: 'county', entity_type: 'entity type', employee_count: 'employee count' }
              return (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#F59E0B' }}>⚡</span>
                  <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                    Add {missing.map(k => labels[k]).join(' and ')} for better-matched results
                  </span>
                  <a href="/profile" style={{ fontSize: '12px', color: '#1D9E75', fontWeight: '500', textDecoration: 'none' }}>
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
                  background: refreshConfirm ? '#FEF3C7' : 'white',
                  border: `1.5px solid ${refreshConfirm ? '#F59E0B' : '#E5E7EB'}`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: refreshConfirm ? '#92400E' : '#6B7280',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {refreshConfirm ? '⚠️ Confirm refresh?' : '↻ Refresh Report'}
              </button>
              {refreshConfirm && (
                <div style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'right' }}>
                  This will regenerate your full report.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Report card */}
        <div className="hh-card" style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #E5E7EB', marginBottom: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#2C2C2A', marginBottom: '16px' }}>
            Your Opportunity Report
          </div>

          {/* Generating / searching state */}
          {isActive && <LoadingState searching={searching} />}

          {/* Report content */}
          {!isActive && report && (
            <ReportView
              report={report}
              isPro={isPro}
              reportDate={reportDate}
              onUpgrade={handleUpgrade}
              upgrading={upgrading}
              upgradeError={upgradeError}
              userId={user?.id}
            />
          )}

          {/* Empty / error state */}
          {!isActive && !report && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '12px' }}>
                Unable to load report.
              </div>
              <button
                onClick={() => profile && generateReport(profile)}
                style={{ padding: '8px 16px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
              >
                Generate Report
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
