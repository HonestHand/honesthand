'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

type Category = 'bug' | 'billing' | 'report' | 'other'

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'bug',     label: 'Something is broken' },
  { value: 'billing', label: 'Billing or subscription' },
  { value: 'report',  label: 'Question about my report' },
  { value: 'other',   label: 'Something else' },
]

export default function Contact() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState<Category>('bug')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const init = async () => {
      if (!supabase) { setLoading(false); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        setEmail(session.user.email || '')
        const { data: profile } = await supabase
          .from('profiles')
          .select('business_name')
          .eq('id', session.user.id)
          .single()
        if (profile?.business_name) setName(profile.business_name)
      }
      setLoading(false)
    }
    init()
  }, [])

  const handleSubmit = async () => {
    if (!message.trim() || !email.trim()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, category, message, userId: user?.id || null }),
      })
      if (!res.ok) throw new Error('Server error')
      setSent(true)
    } catch {
      setSubmitError('Something went wrong. Please email us directly at support@yourhonesthand.com')
    }
    setSubmitting(false)
  }

  const isLoggedIn = !!user

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'system-ui' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <a href="/" style={{ fontSize: '18px', fontWeight: '600', color: '#2C2C2A', textDecoration: 'none' }}>
            Honest<span style={{ color: '#C9A96E' }}>Hand</span>
          </a>
          {isLoggedIn && (
            <>
              <a href="/dashboard" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none', fontWeight: '500' }}>My Report</a>
              <a href="/community" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none', fontWeight: '500' }}>Community</a>
              <span style={{ fontSize: '13px', color: '#C9A96E', fontWeight: '600' }}>Contact Us</span>
            </>
          )}
        </div>
        {isLoggedIn && (
          <button
            onClick={async () => { if (supabase) { await supabase.auth.signOut(); window.location.href = '/' } }}
            style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: '20px', background: 'none', cursor: 'pointer', color: '#6B7280' }}
          >
            Sign out
          </button>
        )}
      </div>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#2C2C2A' }}>Contact Us</div>
          <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>We read every message and usually respond within 1 business day.</div>
        </div>

        {sent ? (
          <div style={{ background: '#F7F4EF', border: '1px solid #E5E0D8', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#166534', marginBottom: '6px' }}>Message received</div>
            <div style={{ fontSize: '13px', color: '#15803D', marginBottom: '20px' }}>We'll get back to you at <strong>{email}</strong> within 1 business day.</div>
            <a href="/dashboard" style={{ display: 'inline-block', padding: '10px 24px', background: '#1C2B3A', color: 'white', borderRadius: '8px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>
              Back to my report
            </a>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '28px' }}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>What's this about?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {CATEGORIES.map(cat => (
                  <label key={cat.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid', borderColor: category === cat.value ? '#C9A96E' : '#E5E7EB', background: category === cat.value ? '#F7F4EF' : 'white', cursor: 'pointer', fontSize: '14px', color: '#2C2C2A' }}>
                    <input type="radio" name="category" value={cat.value} checked={category === cat.value} onChange={() => setCategory(cat.value)} style={{ accentColor: '#C9A96E' }} />
                    {cat.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Your name or business name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Happy Hands Massage"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#2C2C2A', fontFamily: 'system-ui' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Your email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#2C2C2A', fontFamily: 'system-ui' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Describe the issue or question as specifically as you can..."
                style={{ width: '100%', minHeight: '120px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'system-ui', color: '#2C2C2A' }}
              />
            </div>

            {submitError && (
              <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '13px', color: '#DC2626' }}>
                {submitError}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !message.trim() || !email.trim()}
              style={{ width: '100%', padding: '13px', background: '#1C2B3A', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: submitting || !message.trim() || !email.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !message.trim() || !email.trim() ? 0.5 : 1 }}
            >
              {submitting ? 'Sending...' : 'Send Message'}
            </button>

            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: '#9CA3AF' }}>
              Or email us directly at <a href="mailto:support@yourhonesthand.com" style={{ color: '#C9A96E' }}>support@yourhonesthand.com</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
