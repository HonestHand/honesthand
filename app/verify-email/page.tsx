'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function VerifyEmailPage() {
  const [email,       setEmail]       = useState('')
  const [resending,   setResending]   = useState(false)
  const [resent,      setResent]      = useState(false)
  const [resentError, setResentError] = useState('')
  const [checking,    setChecking]    = useState(false)

  useEffect(() => {
    // Pull email from URL param (?email=...)
    const params = new URLSearchParams(window.location.search)
    const addr = params.get('email')
    if (addr) setEmail(addr)
  }, [])

  const handleResend = async () => {
    setResending(true)
    setResent(false)
    setResentError('')
    try {
      const res  = await fetch('/api/emails/resend-verification', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setResent(true)
      } else {
        setResentError(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setResentError('Network error. Please try again.')
    }
    setResending(false)
  }

  // Let the user check their current session — if they already verified, go to onboarding
  const handleAlreadyVerified = async () => {
    if (!supabase) return
    setChecking(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email_confirmed_at) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('id', user.id)
        .single()
      window.location.href = profile?.business_name ? '/dashboard' : '/onboarding'
    } else {
      setResentError("Your email hasn't been verified yet. Check your inbox and click the link.")
      setChecking(false)
    }
  }

  return (
    <div style={{minHeight:'100vh',background:'#F9FAFB',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:'system-ui'}}>
      <div style={{width:'100%',maxWidth:'440px'}}>

        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:'32px'}}>
          <a href="/" style={{textDecoration:'none'}}>
            <div style={{fontSize:'24px',fontWeight:'600',color:'#2C2C2A'}}>
              Honest<span style={{color:'#1D9E75'}}>Hand</span>
            </div>
          </a>
        </div>

        {/* Card */}
        <div style={{background:'white',borderRadius:'20px',padding:'36px 32px',border:'1px solid #E5E7EB',boxShadow:'0 4px 16px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:'40px',textAlign:'center',marginBottom:'16px'}}>📬</div>
          <h1 style={{fontSize:'20px',fontWeight:'700',color:'#2C2C2A',textAlign:'center',marginBottom:'8px',margin:'0 0 8px'}}>
            Check your inbox
          </h1>
          <p style={{fontSize:'14px',color:'#6B7280',textAlign:'center',lineHeight:'1.7',margin:'0 0 24px'}}>
            We sent a verification link to{' '}
            {email ? (
              <strong style={{color:'#2C2C2A'}}>{email}</strong>
            ) : (
              'your email address'
            )}
            . Click the link to verify your account and access your Honest Hand report.
          </p>

          {/* Steps */}
          <div style={{background:'#F9FAFB',borderRadius:'12px',padding:'16px',marginBottom:'24px'}}>
            {[
              { icon: '1️⃣', text: 'Open the email from HonestHand' },
              { icon: '2️⃣', text: 'Click "Verify my email"' },
              { icon: '3️⃣', text: "You'll be taken to complete your profile" },
            ].map((step, i, arr) => (
              <div key={step.icon} style={{display:'flex',alignItems:'center',gap:'10px',marginBottom: i < arr.length - 1 ? '10px' : 0}}>
                <span style={{fontSize:'16px',flexShrink:0}}>{step.icon}</span>
                <span style={{fontSize:'13px',color:'#4B5563',lineHeight:'1.5'}}>{step.text}</span>
              </div>
            ))}
          </div>

          {/* Resent confirmation */}
          {resent && (
            <div style={{background:'#E1F5EE',border:'1px solid #1D9E75',borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'13px',color:'#065F46',lineHeight:'1.6'}}>
              ✓ Verification email resent. Check your inbox (and spam/junk folder).
            </div>
          )}

          {resentError && (
            <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'13px',color:'#DC2626',lineHeight:'1.6'}}>
              {resentError}
            </div>
          )}

          {/* Resend button */}
          <button
            onClick={handleResend}
            disabled={resending || !email}
            style={{width:'100%',padding:'13px',background:'#1D9E75',color:'white',border:'none',borderRadius:'10px',fontSize:'15px',fontWeight:'600',cursor:resending||!email?'not-allowed':'pointer',opacity:resending||!email?0.6:1,marginBottom:'12px'}}
          >
            {resending ? 'Resending…' : 'Resend Verification Email'}
          </button>

          {/* Already verified */}
          <button
            onClick={handleAlreadyVerified}
            disabled={checking}
            style={{width:'100%',padding:'12px',background:'transparent',color:'#6B7280',border:'1px solid #E5E7EB',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:'pointer',marginBottom:'20px'}}
          >
            {checking ? 'Checking…' : "I already verified — continue →"}
          </button>

          {/* Spam reminder + support */}
          <div style={{borderTop:'1px solid #F3F4F6',paddingTop:'16px'}}>
            <div style={{fontSize:'12px',color:'#9CA3AF',lineHeight:'1.7',textAlign:'center'}}>
              <strong style={{color:'#6B7280'}}>Didn't get the email?</strong> Check your spam or junk folder first.
              The email comes from <em>onboarding@resend.dev</em> with the subject "Confirm your email".
            </div>
            <div style={{fontSize:'12px',color:'#9CA3AF',lineHeight:'1.7',textAlign:'center',marginTop:'8px'}}>
              Still having trouble?{' '}
              <a href="/contact" style={{color:'#1D9E75',textDecoration:'underline'}}>Contact support</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
