'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'

const FEATURES = [
  { icon: '📋', title: 'Full Opportunity Report', desc: 'Every federal, state, and local program you qualify for — not just the top 3' },
  { icon: '⏰', title: 'Deadline Reminders', desc: 'Never miss a grant window. We alert you before applications close' },
  { icon: '🔄', title: 'Monthly Updates', desc: 'Programs change. Your report refreshes every month with new opportunities' },
  { icon: '🎖️', title: 'Veteran & Minority Programs', desc: 'Exclusive set-aside contracts and grants most owners never find' },
  { icon: '💰', title: 'Tax Credit Finder', desc: 'WOTC, R&D credits, Section 179, energy credits — we find what your accountant missed' },
  { icon: '📍', title: 'Local Intelligence', desc: 'City and county programs specific to your area that national tools never surface' },
  { icon: '📞', title: '30-Day Action Plan', desc: 'Step-by-step with real phone numbers, URLs, and contacts — not just program names' },
  { icon: '📈', title: 'Priority Ranking', desc: 'Opportunities sorted by easiest win first so you know exactly where to start' },
]

export default function Welcome() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const check = async () => {
      if (!supabase) { window.location.href = '/'; return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/'; return }
      setLoading(false)
    }
    check()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'system-ui', padding: '24px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '48px' }}>

        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#2C2C2A' }}>
            Honest<span style={{ color: '#C9A96E' }}>Hand</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '40px', paddingTop: '32px' }}>
          <div style={{ fontSize: '52px', marginBottom: '20px' }}>🎉</div>
          <div style={{ fontSize: '30px', fontWeight: '700', color: '#2C2C2A', marginBottom: '10px', lineHeight: '1.2' }}>
            Welcome to HonestHand Pro
          </div>
          <div style={{ fontSize: '16px', color: '#6B7280', lineHeight: '1.7', maxWidth: '440px', margin: '0 auto' }}>
            You now have full access to every opportunity we find for your business — federal, state, local, and more.
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '28px', marginBottom: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: '600', color: '#2C2C2A', marginBottom: '20px' }}>
            What's included in your Pro membership
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '22px', flexShrink: 0, marginTop: '2px' }}>{icon}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#2C2C2A', marginBottom: '3px' }}>{title}</div>
                  <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.5' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #1C2B3A 0%, #2a3f52 100%)', borderRadius: '16px', padding: '32px', textAlign: 'center', color: 'white', marginBottom: '20px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Your full report is ready</div>
          <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '24px', lineHeight: '1.6' }}>
            We've already analyzed your business. Click below to see every opportunity you qualify for.
          </div>
          <button
            onClick={() => { window.location.href = '/dashboard' }}
            style={{ background: 'white', color: '#C9A96E', border: 'none', borderRadius: '10px', padding: '15px 40px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: '100%', maxWidth: '320px' }}
          >
            View My Full Report
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: '12px', color: '#9CA3AF' }}>
          Questions? Email us at hello@yourhonesthand.com
        </div>
      </div>
    </div>
  )
}
