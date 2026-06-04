'use client'
/**
 * Email verification callback handler.
 *
 * Supabase redirects here after the user clicks the verification link in their
 * inbox. The URL will contain either:
 *   - ?code=xxx           (PKCE / OAuth flow)
 *   - ?token_hash=xxx&type=signup  (OTP flow)
 *   - #access_token=xxx   (implicit flow — handled automatically by Supabase client)
 *
 * IMPORTANT: Add https://yourhonesthand.com/auth/confirm to your Supabase project
 * Redirect URLs allowlist:  Dashboard → Auth → URL Configuration → Redirect URLs
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'

type Status = 'verifying' | 'success' | 'error'

export default function AuthConfirmPage() {
  const [status,  setStatus]  = useState<Status>('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const run = async () => {
      if (!supabase) { setStatus('error'); setMessage('Client not available.'); return }

      const params            = new URLSearchParams(window.location.search)
      const code              = params.get('code')
      const tokenHash         = params.get('token_hash')
      const type              = params.get('type')
      const errorParam        = params.get('error')
      const errorDescription  = params.get('error_description')

      if (errorParam) {
        console.error('[auth/confirm]', errorParam, errorDescription)
        setStatus('error')
        setMessage(
          errorDescription?.replace(/_/g, ' ') ||
          'The verification link has expired or is invalid.'
        )
        return
      }

      if (code) {
        // PKCE flow
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setStatus('error')
          setMessage('The verification link has expired or already been used.')
          return
        }
      } else if (tokenHash && type) {
        // OTP flow
        const { error } = await (supabase.auth as any).verifyOtp({
          token_hash: tokenHash,
          type,
        })
        if (error) {
          setStatus('error')
          setMessage('The verification link has expired or already been used.')
          return
        }
      }
      // Implicit flow: Supabase client auto-processes the hash fragment when
      // the page loads — no explicit action needed here.

      // Confirm session is established
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus('error')
        setMessage('Could not establish session. Please try signing in directly.')
        return
      }

      setStatus('success')

      // Fire welcome email (non-blocking)
      fetch('/api/emails/welcome', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: user.id, email: user.email }),
      }).catch(() => {})

      // Redirect: onboarding if profile not complete, dashboard otherwise
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('id', user.id)
        .single()

      window.location.href = profile?.business_name ? '/dashboard' : '/onboarding'
    }

    run()
  }, [])

  return (
    <div style={{minHeight:'100vh',background:'#F9FAFB',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:'system-ui'}}>
      <div style={{textAlign:'center',maxWidth:'360px'}}>
        <div style={{fontSize:'24px',fontWeight:'600',color:'#2C2C2A',marginBottom:'24px'}}>
          Honest<span style={{color:'#C9A96E'}}>Hand</span>
        </div>

        {status === 'verifying' && (
          <>
            <div style={{fontSize:'32px',marginBottom:'16px'}}>🔐</div>
            <div style={{fontSize:'17px',fontWeight:'600',color:'#2C2C2A',marginBottom:'8px'}}>Verifying your email…</div>
            <div style={{fontSize:'14px',color:'#6B7280'}}>Just a moment — setting up your account.</div>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{fontSize:'32px',marginBottom:'16px'}}>✅</div>
            <div style={{fontSize:'17px',fontWeight:'600',color:'#2C2C2A',marginBottom:'8px'}}>Email verified!</div>
            <div style={{fontSize:'14px',color:'#6B7280'}}>Redirecting you now…</div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{fontSize:'32px',marginBottom:'16px'}}>⚠️</div>
            <div style={{fontSize:'17px',fontWeight:'600',color:'#2C2C2A',marginBottom:'8px'}}>Verification failed</div>
            <div style={{fontSize:'14px',color:'#6B7280',lineHeight:'1.6',marginBottom:'24px'}}>{message}</div>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <a
                href="/verify-email"
                style={{padding:'12px',background:'#1C2B3A',color:'white',borderRadius:'10px',textDecoration:'none',fontSize:'14px',fontWeight:'600'}}
              >
                Request a new link
              </a>
              <a
                href="/"
                style={{padding:'12px',background:'transparent',color:'#6B7280',border:'1px solid #E5E7EB',borderRadius:'10px',textDecoration:'none',fontSize:'14px'}}
              >
                Back to home
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
