'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [report, setReport] = useState('')
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
  if (!supabase) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { window.location.href = '/'; return }
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  setProfile(data)
  setLoading(false)
  if (data) generateReport(data)
}

  const generateReport = async (p: any) => {
  setGenerating(true)
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
          if (parsed.text) setReport(prev => prev + parsed.text)
          if (parsed.error) console.error(parsed.error)
        } catch { }
      }
    }
  } catch (e) { 
    console.error(e)
    setGenerating(false)
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
        <div style={{fontSize:'18px',fontWeight:'600',color:'#2C2C2A'}}>Honest<span style={{color:'#1D9E75'}}>Hand</span></div>
        <button onClick={signOut} style={{fontSize:'12px',padding:'6px 12px',border:'1px solid #E5E7EB',borderRadius:'20px',background:'none',cursor:'pointer',color:'#6B7280'}}>Sign out</button>
      </div>
      <div style={{maxWidth:'800px',margin:'0 auto',padding:'24px'}}>
        <div style={{marginBottom:'24px'}}>
          <div style={{fontSize:'22px',fontWeight:'700',color:'#2C2C2A'}}>Welcome, {profile?.business_name} 👋</div>
          <div style={{fontSize:'14px',color:'#6B7280',marginTop:'4px'}}>{profile?.industry} · {profile?.city}, TX · {profile?.revenue_range}</div>
        </div>
        <div style={{background:'white',borderRadius:'16px',padding:'24px',border:'1px solid #E5E7EB'}}>
          <div style={{fontSize:'16px',fontWeight:'600',color:'#2C2C2A',marginBottom:'16px'}}>Your Opportunity Report</div>
          {generating ? (
            <div style={{textAlign:'center',padding:'40px 0'}}>
              <div style={{fontSize:'32px',marginBottom:'12px'}}>🔍</div>
              <div style={{fontSize:'15px',fontWeight:'500',color:'#2C2C2A',marginBottom:'4px'}}>Analyzing your business...</div>
              <div style={{fontSize:'13px',color:'#6B7280'}}>Matching against 50+ Texas programs.</div>
            </div>
          ) : report ? (
            <div style={{fontSize:'14px',color:'#374151',lineHeight:'1.8',whiteSpace:'pre-wrap'}}>{report}</div>
          ) : (
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