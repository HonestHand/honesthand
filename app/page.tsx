'use client'
import { useState, useEffect } from 'react'
import { supabase } from './supabase'

function FloatInput({ label, type, value, onChange, autoComplete }: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{marginBottom:'16px'}}>
      <input
        type={type}
        value={value}
        placeholder={label}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        style={{
          width:'100%',
          padding:'15px 14px',
          borderRadius:'8px',
          border:`1.5px solid ${focused ? '#1D9E75' : '#D1D5DB'}`,
          fontSize:'15px',
          outline:'none',
          boxSizing:'border-box' as const,
          background:'white',
          color:'#111827',
          WebkitTextFillColor:'#111827',
          WebkitAppearance:'none',
          appearance:'none' as const,
          transition:'border-color 0.15s ease',
          display:'block',
        }}
      />
    </div>
  )
}

// ─── Disposable email domain blocklist ───────────────────────────────────────
// Conservative list — only well-known temp-mail services. Not aggressive.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','guerrillamail.net','guerrillamail.org',
  'guerrillamail.biz','guerrillamail.de','guerrillamail.info','sharklasers.com',
  'guerrillamailblock.com','grr.la','spam4.me','yopmail.com','tempmail.com',
  'temp-mail.org','throwaway.email','maildrop.cc','trashmail.com','trashmail.me',
  'dispostable.com','fakeinbox.com','mailnull.com','spamgourmet.com',
  'mintemail.com','spamherelots.com','trashmail.at','discard.email',
])

function validateEmail(raw: string): string | null {
  const addr = raw.trim().toLowerCase()
  if (!addr) return 'Please enter your email address.'
  // RFC-5321-ish check (generous but catches obvious fakes)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr)) {
    return 'Please enter a valid email address so we can send your report and account updates.'
  }
  const domain = addr.split('@')[1]
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return 'Temporary email addresses cannot be used. Please sign up with a permanent business or personal email.'
  }
  return null
}

// ─── Password strength rules ──────────────────────────────────────────────────

interface PasswordRule { label: string; test: (p: string) => boolean }
const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters',         test: p => p.length >= 8            },
  { label: 'One uppercase letter (A–Z)',     test: p => /[A-Z]/.test(p)          },
  { label: 'One lowercase letter (a–z)',     test: p => /[a-z]/.test(p)          },
  { label: 'One number (0–9)',               test: p => /[0-9]/.test(p)          },
  { label: 'One special character (!@#…)',   test: p => /[^A-Za-z0-9]/.test(p)  },
]
function passwordStrength(p: string): number {
  return PASSWORD_RULES.filter(r => r.test(p)).length
}
function passwordValid(p: string): boolean {
  return PASSWORD_RULES.every(r => r.test(p))
}

// ─── Auth panel ───────────────────────────────────────────────────────────────

export default function Home() {
  const [showAuth, setShowAuth] = useState(false)
  const [isLogin, setIsLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [showPwRules, setShowPwRules] = useState(false)

  // Auto-open signup when linked from pricing page (?signup=true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('signup') === 'true') {
      setIsLogin(false)
      setShowAuth(true)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const handleAuth = async () => {
    if (!supabase) return
    setError('')

    const normalizedEmail = email.trim().toLowerCase()

    if (isLogin) {
      setLoading(true)
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email:    normalizedEmail,
          password,
        })
        if (error) throw error
        window.location.href = '/dashboard'
      } catch (err: any) {
        setError(err.message)
      }
      setLoading(false)
      return
    }

    // ── Signup validation ──
    const emailErr = validateEmail(normalizedEmail)
    if (emailErr) { setError(emailErr); return }

    if (!passwordValid(password)) {
      setError('Your password needs to meet all the requirements shown below.')
      setShowPwRules(true)
      return
    }

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email:    normalizedEmail,
        password,
        options:  {
          // After the user clicks the verification link, they land on /auth/confirm.
          // Make sure https://yourhonesthand.com/auth/confirm is in
          // Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      })
      if (signUpError) throw signUpError

      // Fire welcome email (non-blocking)
      const userId = data?.user?.id
      if (userId) {
        fetch('/api/emails/welcome', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ userId, email: normalizedEmail }),
        }).catch(() => {})
      }

      // Detect whether email confirmation is required
      const isAutoConfirmed = !!data?.user?.email_confirmed_at

      if (isAutoConfirmed) {
        // Email confirmation disabled in Supabase project — proceed directly
        window.location.href = '/onboarding'
      } else {
        // Email confirmation required — show verify-email page
        const params = new URLSearchParams({ email: normalizedEmail })
        window.location.href = `/verify-email?${params.toString()}`
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const pwStrength = passwordStrength(password)

  if (showAuth) return (
    <div style={{minHeight:'100vh',background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:'system-ui'}}>
      <div style={{width:'100%',maxWidth:'400px'}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{fontSize:'24px',fontWeight:'600',color:'#2C2C2A',marginBottom:'8px'}}>Honest<span style={{color:'#1D9E75'}}>Hand</span></div>
          <div style={{fontSize:'14px',color:'#6B7280'}}>{isLogin ? 'Welcome back' : 'Find out what your business is missing'}</div>
        </div>
        <div style={{background:'#ffffff',borderRadius:'16px',padding:'24px',border:'1px solid #E5E7EB'}}>
          {/* Email */}
          <FloatInput
            label="Email address"
            type="email"
            value={email}
            onChange={v => setEmail(v.trim().toLowerCase())}
            autoComplete="email"
          />

          {/* Password */}
          <FloatInput
            label="Password"
            type="password"
            value={password}
            onChange={v => { setPassword(v); if (!isLogin) setShowPwRules(true) }}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />

          {/* Password strength indicator — signup only */}
          {!isLogin && (showPwRules || password.length > 0) && (
            <div style={{marginTop:'-8px',marginBottom:'16px',padding:'12px',background:'#F9FAFB',borderRadius:'8px',border:'1px solid #F3F4F6'}}>
              <div style={{fontSize:'11px',fontWeight:'600',color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'8px'}}>
                Password requirements
              </div>
              {/* Strength bar */}
              <div style={{display:'flex',gap:'3px',marginBottom:'10px'}}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{flex:1,height:'3px',borderRadius:'2px',background: i <= pwStrength ? (pwStrength <= 2 ? '#EF4444' : pwStrength <= 3 ? '#F59E0B' : '#1D9E75') : '#E5E7EB',transition:'background 0.2s'}} />
                ))}
              </div>
              {PASSWORD_RULES.map(rule => {
                const met = rule.test(password)
                return (
                  <div key={rule.label} style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                    <span style={{fontSize:'11px',color: met ? '#1D9E75' : '#9CA3AF',fontWeight:'600',width:'12px',flexShrink:0}}>
                      {met ? '✓' : '○'}
                    </span>
                    <span style={{fontSize:'12px',color: met ? '#2C2C2A' : '#9CA3AF'}}>{rule.label}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Forgot password */}
          {isLogin && (
            <div style={{marginTop:'-8px',marginBottom:'12px',textAlign:'right'}}>
              <span
                onClick={async () => {
                  if (!supabase || !email.trim()) return
                  await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase())
                  setResetSent(true)
                }}
                style={{fontSize:'13px',color:'#6B7280',cursor:'pointer',textDecoration:'underline'}}
              >
                Forgot password?
              </span>
              {resetSent && <div style={{fontSize:'13px',color:'#1D9E75',marginTop:'6px'}}>Password reset email sent! Check your inbox.</div>}
            </div>
          )}

          {error && (
            <div style={{color:'#DC2626',fontSize:'13px',marginBottom:'12px',padding:'10px 12px',background:'#FEF2F2',borderRadius:'8px',border:'1px solid #FECACA'}}>
              {error}
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={loading}
            style={{width:'100%',padding:'14px',background:'#1D9E75',color:'white',border:'none',borderRadius:'8px',fontSize:'15px',fontWeight:'600',cursor:loading?'not-allowed':'pointer',marginBottom:'12px',marginTop:'4px',opacity:loading?0.7:1}}
          >
            {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Free Account'}
          </button>

          <div style={{textAlign:'center',fontSize:'13px',color:'#6B7280',marginBottom:'12px'}}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span
              onClick={() => { setIsLogin(!isLogin); setError(''); setShowPwRules(false) }}
              style={{color:'#1D9E75',cursor:'pointer',fontWeight:'500'}}
            >
              {isLogin ? 'Sign up free' : 'Sign in'}
            </span>
          </div>

          {/* Trust copy — signup only */}
          {!isLogin && (
            <div style={{borderTop:'1px solid #F3F4F6',paddingTop:'12px',marginTop:'4px'}}>
              <div style={{fontSize:'11px',color:'#9CA3AF',lineHeight:'1.6',textAlign:'center'}}>
                🔒 Honest Hand uses your business information only to match relevant funding opportunities and improve your report accuracy.
              </div>
              <div style={{fontSize:'11px',color:'#9CA3AF',lineHeight:'1.6',textAlign:'center',marginTop:'4px'}}>
                Verify your email to protect your account and make sure your reports reach the right inbox.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{fontFamily:'system-ui',background:'#fff',minHeight:'100vh'}}>
      <div style={{padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #F3F4F6'}}>
        <div style={{fontSize:'20px',fontWeight:'600',color:'#2C2C2A'}}>Honest<span style={{color:'#1D9E75'}}>Hand</span></div>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <a href="/pricing" style={{fontSize:'13px',color:'#6B7280',textDecoration:'none',fontWeight:'500'}}>Pricing</a>
          <button onClick={()=>{setShowAuth(true);setIsLogin(true)}} style={{padding:'8px 16px',background:'transparent',border:'1px solid #1D9E75',borderRadius:'20px',color:'#1D9E75',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>Sign In</button>
        </div>
      </div>
      <div style={{padding:'64px 24px 48px',textAlign:'center',maxWidth:'600px',margin:'0 auto'}}>
        <div style={{fontSize:'11px',fontWeight:'600',color:'#1D9E75',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'16px'}}>Built for Texas business owners</div>
        <div style={{fontSize:'36px',fontWeight:'700',color:'#2C2C2A',lineHeight:'1.2',marginBottom:'12px',letterSpacing:'-0.5px'}}>Your business is leaving money on the table.</div>
        <div style={{fontSize:'28px',fontWeight:'700',color:'#1D9E75',marginBottom:'20px'}}>We'll find it.</div>
        <div style={{fontSize:'16px',color:'#6B7280',lineHeight:'1.7',marginBottom:'32px'}}>HonestHand scans thousands of Texas grants, tax credits, and government incentives — then shows you exactly which ones your business qualifies for and how to claim them.</div>
        <button onClick={()=>{setShowAuth(true);setIsLogin(false)}} style={{padding:'14px 32px',background:'#1D9E75',color:'white',border:'none',borderRadius:'30px',fontSize:'16px',fontWeight:'600',cursor:'pointer',marginBottom:'12px',width:'100%',maxWidth:'320px'}}>Get My Free Report</button>
        <div style={{fontSize:'12px',color:'#1D9E75'}}>Free report · No credit card · Results in 24 hours</div>
      </div>
      <div style={{borderTop:'1px solid #F3F4F6',borderBottom:'1px solid #F3F4F6',padding:'32px 24px'}}>
        {[{num:'$31,000',label:'Average missed per Texas business per year'},{num:'2 min',label:'To complete your free intake form'},{num:'$49/mo',label:"To start claiming what you're owed"}].map((stat,i)=>(
          <div key={i} style={{textAlign:'center',marginBottom:i<2?'24px':'0'}}>
            <div style={{fontSize:'28px',fontWeight:'700',color:'#1D9E75'}}>{stat.num}</div>
            <div style={{fontSize:'13px',color:'#6B7280',marginTop:'4px'}}>{stat.label}</div>
          </div>
        ))}
      </div>
      <div style={{padding:'24px',background:'#F9FAFB',borderTop:'1px solid #F3F4F6',borderBottom:'1px solid #F3F4F6'}}>
        {[
          {icon:'🏛️',label:'Official .gov sources only',sub:'Every opportunity links to a verified government agency'},
          {icon:'🔍',label:'Live search verified',sub:'We check current program status before every report'},
          {icon:'📅',label:'Current deadlines & funding',sub:'Real amounts and real dates — no outdated databases'},
        ].map((t,i)=>(
          <div key={i} style={{display:'flex',alignItems:'flex-start',gap:'12px',marginBottom:i<2?'16px':'0',maxWidth:'480px',margin:i<2?'0 auto 16px':'0 auto'}}>
            <div style={{width:'36px',height:'36px',background:'white',borderRadius:'50%',border:'1px solid #E5E7EB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',flexShrink:0}}>{t.icon}</div>
            <div>
              <div style={{fontSize:'13px',fontWeight:'600',color:'#2C2C2A'}}>{t.label}</div>
              <div style={{fontSize:'12px',color:'#6B7280',marginTop:'2px',lineHeight:'1.5'}}>{t.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:'48px 24px',maxWidth:'600px',margin:'0 auto'}}>
        <div style={{fontSize:'22px',fontWeight:'700',color:'#2C2C2A',textAlign:'center',marginBottom:'32px'}}>How It Works</div>
        {[{num:'1',title:'Tell us about your business',desc:"Fill out a 5-minute form. Industry, location, revenue range. That's all we need."},{num:'2',title:"We find what you're owed",desc:'HonestHand matches your business against thousands of grants, tax credits, and incentives — federal, state, and local.'},{num:'3',title:'Claim it with confidence',desc:'You get a personalized report with every opportunity, its dollar value, its deadline, and exactly how to claim it.'}].map((step,i)=>(
          <div key={i} style={{display:'flex',gap:'16px',marginBottom:'28px'}}>
            <div style={{width:'36px',height:'36px',background:'#E1F5EE',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:'700',color:'#1D9E75',flexShrink:0}}>{step.num}</div>
            <div>
              <div style={{fontSize:'15px',fontWeight:'600',color:'#2C2C2A',marginBottom:'4px'}}>{step.title}</div>
              <div style={{fontSize:'13px',color:'#6B7280',lineHeight:'1.6'}}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{background:'#F9FAFB',padding:'48px 24px'}}>
        <div style={{fontSize:'22px',fontWeight:'700',color:'#2C2C2A',textAlign:'center',marginBottom:'8px'}}>Real wins from Texas businesses</div>
        <div style={{fontSize:'14px',color:'#6B7280',textAlign:'center',marginBottom:'24px'}}>Join thousands of owners who found money they didn't know existed</div>
        {[{biz:'Mesa Bites LLC',industry:'Restaurant',city:'Dallas',amount:'$12,400',program:'Texas Restaurant Revitalization Fund'},{biz:'Cimarron Ranch',industry:'Agriculture',city:'Sutton County',amount:'$67,000',program:'USDA EQIP Program'},{biz:'Lone Star Electric',industry:'Construction',city:'San Antonio',amount:'$8,500',program:'Texas Enterprise Fund'}].map((win,i)=>(
          <div key={i} style={{background:'white',borderRadius:'12px',padding:'16px',marginBottom:'12px',border:'1px solid #E5E7EB'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:'600',color:'#2C2C2A'}}>{win.biz}</div>
                <div style={{fontSize:'12px',color:'#6B7280'}}>{win.industry} · {win.city}</div>
              </div>
              <div style={{fontSize:'18px',fontWeight:'700',color:'#1D9E75'}}>{win.amount}</div>
            </div>
            <div style={{fontSize:'12px',color:'#6B7280',background:'#F3F4F6',padding:'6px 10px',borderRadius:'6px'}}>{win.program}</div>
          </div>
        ))}
      </div>
      <div style={{padding:'48px 24px',textAlign:'center'}}>
        <div style={{fontSize:'24px',fontWeight:'700',color:'#2C2C2A',marginBottom:'8px'}}>Find out what your business is missing.</div>
        <div style={{fontSize:'14px',color:'#6B7280',marginBottom:'24px',lineHeight:'1.6'}}>Built for every Texas business owner — restaurants, ranches, contractors, farms, retail, veteran-owned businesses, and everyone in between.</div>
        <button onClick={()=>{setShowAuth(true);setIsLogin(false)}} style={{padding:'14px 32px',background:'#1D9E75',color:'white',border:'none',borderRadius:'30px',fontSize:'16px',fontWeight:'600',cursor:'pointer',width:'100%',maxWidth:'320px'}}>Get My Free Report</button>
      </div>
      <div style={{borderTop:'1px solid #F3F4F6',padding:'24px',textAlign:'center'}}>
        <div style={{fontSize:'14px',fontWeight:'600',color:'#2C2C2A',marginBottom:'4px'}}>Honest<span style={{color:'#1D9E75'}}>Hand</span></div>
        <div style={{fontSize:'12px',color:'#6B7280',marginBottom:'12px'}}>The financial partner that earns its keep · yourhonesthand.com · Texas · Est. 2026</div>
        <div style={{fontSize:'11px',color:'#9CA3AF',lineHeight:'1.7',maxWidth:'480px',margin:'0 auto'}}>
          For informational purposes only. Not financial, legal, or tax advice. Program availability and eligibility not guaranteed. Always verify directly with the administering agency before applying.
        </div>
      </div>
    </div>
  )
}