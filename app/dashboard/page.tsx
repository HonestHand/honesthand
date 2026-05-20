'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const SAFE_DOMAINS = ['sba.gov','grants.gov','sam.gov','irs.gov','twc.texas.gov','gov.texas.gov','tvc.texas.gov','rd.usda.gov','texaswideopenforbusiness.com','treasury.gov','dol.gov','energy.gov']

function isSafeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return SAFE_DOMAINS.some(d => host === d || host.endsWith('.' + d))
  } catch { return false }
}

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
      const rowStyle = isTotal
        ? 'background:#F0FDF8;font-weight:700'
        : 'background:white'
      html += '<tr>' + cells.map(c =>
        `<td style="padding:8px 12px;border:1px solid #E5E7EB;${rowStyle};color:#374151">${c}</td>`
      ).join('') + '</tr>'
    }
  }
  html += '</tbody></table></div>'
  return html
}

function renderMarkdown(text: string): string {
  // Normalize line endings first
  let result = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Replace markdown tables before other processing
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
    .replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul style="margin:6px 0 10px 20px;padding:0">${m}</ul>`)
    .replace(/^[ \t]*---[ \t]*$/gm, '<hr style="border:none;border-top:1px solid #F3F4F6;margin:8px 0">')
    .replace(/\n\n/g, '<br/>')
}

function getPreview(text: string): string {
  const lines = text.split('\n')
  let preview = ''
  let headerCount = 0
  for (const line of lines) {
    if (line.startsWith('## ')) headerCount++
    if (headerCount >= 3) break
    preview += line + '\n'
  }
  return preview || text.slice(0, 1200)
}

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [report, setReport] = useState('')
  const [generating, setGenerating] = useState(false)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isPro, setIsPro] = useState<boolean>(false)
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeError, setUpgradeError] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    if (!supabase) return
    const params = new URLSearchParams(window.location.search)
    const upgraded = params.get('upgraded') === 'true'
    const stripeSessionId = params.get('session_id') || undefined

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/'; return }
    setUser(session.user)

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

    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (!data || !data.business_name) {
      window.location.href = '/onboarding'
      return
    }
    setProfile(data)
    setIsPro(activatedPro || data?.is_pro === true || data?.is_pro === 'true')
    setLoading(false)
    generateReport(data)
  }

  const generateReport = async (p: any) => {
    setGenerating(true)
    setSearching(false)
    setReport('')
    try {
      const res = await fetch('/api/generate-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
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
            if (parsed.text) { setSearching(false); setReport(prev => prev + parsed.text) }
            if (parsed.error) { setSearching(false); setReport('Error:' + parsed.error) }
          } catch { }
        }
      }
    } catch (e: any) {
      setReport('Error:' + (e?.message || 'Unknown error occurred'))
      setGenerating(false)
    }
  }

  const handleUpgrade = async () => {
    if (!user) return
    setUpgrading(true)
    setUpgradeError('')
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email, origin: window.location.origin }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        const msg = data.error || 'Could not start checkout. Please try again.'
        console.error('[handleUpgrade] No URL in response:', data)
        setUpgradeError(msg)
        setUpgrading(false)
      }
    } catch (e: any) {
      const msg = e?.message || 'Network error. Please try again.'
      console.error('[handleUpgrade] fetch failed:', e)
      setUpgradeError(msg)
      setUpgrading(false)
    }
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',fontFamily:'system-ui'}}>Loading...</div>

  return (
    <div style={{minHeight:'100vh',background:'#F9FAFB',fontFamily:'system-ui'}}>
      <div style={{background:'white',borderBottom:'1px solid #E5E7EB',padding:'14px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:'24px'}}>
          <div style={{fontSize:'18px',fontWeight:'600',color:'#2C2C2A'}}>Honest<span style={{color:'#1D9E75'}}>Hand</span></div>
          {isPro && <a href="/community" style={{fontSize:'13px',color:'#6B7280',textDecoration:'none',fontWeight:'500'}}>Community</a>}
          <a href="/contact" style={{fontSize:'13px',color:'#6B7280',textDecoration:'none',fontWeight:'500'}}>Contact Us</a>
        </div>
        <button onClick={signOut} style={{fontSize:'12px',padding:'6px 12px',border:'1px solid #E5E7EB',borderRadius:'20px',background:'none',cursor:'pointer',color:'#6B7280'}}>Sign out</button>
      </div>

      <div style={{maxWidth:'800px',margin:'0 auto',padding:'24px'}}>
        <div style={{marginBottom:'24px'}}>
          <div style={{fontSize:'22px',fontWeight:'700',color:'#2C2C2A'}}>Welcome, {profile?.business_name} 👋</div>
          <div style={{fontSize:'14px',color:'#6B7280',marginTop:'4px'}}>{profile?.industry} · {profile?.city}, TX · {profile?.revenue_range}</div>
        </div>

        <div style={{background:'white',borderRadius:'16px',padding:'24px',border:'1px solid #E5E7EB',marginBottom:'24px'}}>
          <div style={{fontSize:'16px',fontWeight:'600',color:'#2C2C2A',marginBottom:'16px'}}>Your Opportunity Report</div>

          {(generating || searching) && (
            <div style={{textAlign:'center',padding:'40px 0'}}>
              <div style={{fontSize:'32px',marginBottom:'12px'}}>{searching ? '🌐' : '🔍'}</div>
              <div style={{fontSize:'15px',fontWeight:'500',color:'#2C2C2A',marginBottom:'4px'}}>
                {searching ? 'Searching live program databases...' : 'Analyzing your business...'}
              </div>
              <div style={{fontSize:'13px',color:'#6B7280'}}>
                {searching ? 'Verifying current deadlines and funding amounts.' : 'Matching against 50+ Texas programs.'}
              </div>
            </div>
          )}

          {!generating && !searching && report && (
            <div>
              <div style={{fontSize:'14px',color:'#374151',lineHeight:'1.8'}}>
                <div dangerouslySetInnerHTML={{__html: renderMarkdown(isPro ? report : getPreview(report))}} />
              </div>

              {isPro && (
                <div style={{marginTop:'24px',padding:'14px 16px',background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:'8px',fontSize:'12px',color:'#6B7280',lineHeight:'1.6'}}>
                  <strong style={{color:'#374151'}}>Disclaimer:</strong> This report is for informational purposes only and does not constitute legal, financial, or tax advice. Program availability, funding amounts, and deadlines change frequently — always verify directly with the administering agency before applying. Eligibility determinations are estimates based on the information you provided. HonestHand is not a licensed attorney, CPA, or financial advisor. Consult a qualified professional before making business or financial decisions.
                </div>
              )}

              {!isPro && (
                <>
                  <div style={{margin:'24px 0 0',padding:'20px',background:'#FFFBEB',border:'2px dashed #F59E0B',borderRadius:'12px',textAlign:'center'}}>
                    <div style={{fontSize:'16px',fontWeight:'700',color:'#92400E',marginBottom:'4px'}}>⚠️ You're only seeing a fraction of your report</div>
                    <div style={{fontSize:'13px',color:'#B45309'}}>Your full report includes more federal programs, Texas state grants, local incentives, tax credits you're likely missing, and a personalized 30-day action plan. This preview is just the beginning.</div>
                  </div>

                  <div style={{marginTop:'16px',background:'linear-gradient(135deg, #1D9E75 0%, #157a5a 100%)',borderRadius:'12px',padding:'28px',color:'white'}}>
                    <div style={{textAlign:'center',marginBottom:'20px'}}>
                      <div style={{fontSize:'22px',fontWeight:'700',marginBottom:'6px'}}>Your full report is ready</div>
                      <div style={{fontSize:'14px',opacity:'0.9'}}>HonestHand Pro — the financial partner that earns its keep.</div>
                    </div>

                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'24px'}}>
                      {[
                        {icon:'📋', title:'Full Opportunity Report', desc:'Every federal, state, and local program you qualify for — not just the top 3'},
                        {icon:'⏰', title:'Deadline Reminders', desc:'Never miss a grant window. We alert you before applications close'},
                        {icon:'🔄', title:'Monthly Updates', desc:'Programs change. Your report refreshes every month with new opportunities'},
                        {icon:'🎖️', title:'Veteran & Minority Programs', desc:'Exclusive set-aside contracts and grants most owners never find'},
                        {icon:'💰', title:'Tax Credit Finder', desc:'WOTC, R&D credits, Section 179, energy credits — we find what your accountant missed'},
                        {icon:'📍', title:'Local Intelligence', desc:'City and county programs specific to your area that national tools never surface'},
                        {icon:'📞', title:'30-Day Action Plan', desc:'Step-by-step with real phone numbers, URLs, and contacts — not just program names'},
                        {icon:'📈', title:'Priority Ranking', desc:'Opportunities sorted by easiest win first so you know exactly where to start'},
                      ].map(({icon, title, desc}) => (
                        <div key={title} style={{background:'rgba(255,255,255,0.12)',borderRadius:'10px',padding:'14px'}}>
                          <div style={{fontSize:'20px',marginBottom:'6px'}}>{icon}</div>
                          <div style={{fontSize:'13px',fontWeight:'700',marginBottom:'4px'}}>{title}</div>
                          <div style={{fontSize:'12px',opacity:'0.85',lineHeight:'1.5'}}>{desc}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{textAlign:'center'}}>
                      <button onClick={handleUpgrade} disabled={upgrading} style={{background:'white',color:'#1D9E75',border:'none',borderRadius:'10px',padding:'16px 40px',fontSize:'17px',fontWeight:'700',cursor:upgrading?'wait':'pointer',width:'100%',maxWidth:'360px',opacity:upgrading?0.8:1}}>
                        {upgrading ? 'Redirecting to checkout...' : 'Unlock Full Report — $49/mo'}
                      </button>
                      <div style={{fontSize:'12px',opacity:'0.7',marginTop:'10px'}}>Cancel anytime. No contracts. Pays for itself with one credit.</div>
                      {upgradeError && <div style={{fontSize:'13px',color:'#FCA5A5',marginTop:'8px'}}>{upgradeError}</div>}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {!generating && !searching && !report && (
            <div style={{textAlign:'center',padding:'40px 0'}}>
              <div style={{fontSize:'14px',color:'#6B7280',marginBottom:'12px'}}>Unable to generate report.</div>
              <button onClick={() => profile && generateReport(profile)} style={{padding:'8px 16px',background:'#1D9E75',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Retry</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}