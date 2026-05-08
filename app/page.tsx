'use client'
import { useState } from 'react'
import { supabase } from './supabase'

export default function Home() {
  const [showAuth, setShowAuth] = useState(false)
  const [isLogin, setIsLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAuth = async () => {
    if (!supabase) return
    setLoading(true)
    setError('')
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.href = '/dashboard'
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        window.location.href = '/onboarding'
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  if (showAuth) return (
    <div style={{minHeight:'100vh',background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:'system-ui'}}>
      <style>{`
        .hh-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1.5px solid #D1D5DB;
          margin-bottom: 12px;
          font-size: 16px;
          outline: none;
          box-sizing: border-box;
          display: block;
          background: #ffffff !important;
          color: #111827 !important;
          -webkit-text-fill-color: #111827 !important;
          -webkit-appearance: none;
          appearance: none;
        }
        .hh-input::placeholder {
          color: #374151 !important;
          -webkit-text-fill-color: #374151 !important;
          opacity: 1 !important;
        }
        .hh-input:-webkit-autofill,
        .hh-input:-webkit-autofill:hover,
        .hh-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px #ffffff inset !important;
          -webkit-text-fill-color: #111827 !important;
          background-color: #ffffff !important;
        }
        .hh-input:focus {
          border-color: #1D9E75;
          box-shadow: 0 0 0 3px rgba(29,158,117,0.15);
        }
      `}</style>
      <div style={{width:'100%',maxWidth:'400px'}}>
        <div style={{textAlign:'center',marginBottom:'32px'}}>
          <div style={{fontSize:'24px',fontWeight:'600',color:'#2C2C2A',marginBottom:'8px'}}>Honest<span style={{color:'#1D9E75'}}>Hand</span></div>
          <div style={{fontSize:'14px',color:'#6B7280'}}>{isLogin ? 'Welcome back' : 'Find out what your business is missing'}</div>
        </div>
        <div style={{background:'#ffffff',borderRadius:'16px',padding:'24px',border:'1px solid #E5E7EB'}}>
          <input className="hh-input" type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" />
          <input className="hh-input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" style={{marginBottom:'16px'}} />
          {error && <div style={{color:'#DC2626',fontSize:'13px',marginBottom:'12px'}}>{error}</div>}
          <button onClick={handleAuth} disabled={loading} style={{width:'100%',padding:'12px',background:'#1D9E75',color:'white',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'600',cursor:'pointer',marginBottom:'12px'}}>
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Free Account'}
          </button>
          <div style={{textAlign:'center',fontSize:'13px',color:'#6B7280'}}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span onClick={()=>setIsLogin(!isLogin)} style={{color:'#1D9E75',cursor:'pointer',fontWeight:'500'}}>{isLogin ? 'Sign up free' : 'Sign in'}</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{fontFamily:'system-ui',background:'#fff',minHeight:'100vh'}}>
      <div style={{padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #F3F4F6'}}>
        <div style={{fontSize:'20px',fontWeight:'600',color:'#2C2C2A'}}>Honest<span style={{color:'#1D9E75'}}>Hand</span></div>
        <button onClick={()=>{setShowAuth(true);setIsLogin(true)}} style={{padding:'8px 16px',background:'transparent',border:'1px solid #1D9E75',borderRadius:'20px',color:'#1D9E75',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>Sign In</button>
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
        <div style={{fontSize:'12px',color:'#6B7280'}}>The financial partner that earns its keep · yourhonesthand.com · Texas · Est. 2026</div>
      </div>
    </div>
  )
}