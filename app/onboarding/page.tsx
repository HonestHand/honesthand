'use client'
import { useState } from 'react'
import { supabase } from '../supabase'

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    business_name: '',
    industry: '',
    city: '',
    county: '',
    revenue_range: '',
    entity_type: '',
    is_veteran: false
  })

  const industries = ['Restaurant / Food & Beverage','Ranch / Farm / Agriculture','Construction / Trades','Retail','Real Estate','Professional Services','Veteran-Owned Business','Other']
  const revenueRanges = ['Under $100k','$100k - $250k','$250k - $500k','$500k - $1M','Over $1M']
  const entityTypes = ['Sole Proprietor','LLC','S-Corp','C-Corp','Partnership','Other']

  const handleSubmit = async () => {
  if (!supabase) return
  setLoading(true)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No user found')
    const { error } = await supabase.from('profiles').upsert({ id: user.id, ...form }, { onConflict: 'id' })
    if (error) throw error
    window.location.href = '/dashboard'
  } catch (err: any) {
    alert(err.message)
  }
  setLoading(false)
}

  const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, marginBottom: '12px', background: 'white' }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px', paddingTop: '24px' }}>
          <div style={{ fontSize: '22px', fontWeight: '600', color: '#2C2C2A', marginBottom: '8px' }}>Honest<span style={{ color: '#1D9E75' }}>Hand</span></div>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#2C2C2A', marginBottom: '4px' }}>Tell us about your business</div>
          <div style={{ fontSize: '14px', color: '#6B7280' }}>Takes 2 minutes. We'll find what you're owed.</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {[1,2,3].map(s => (<div key={s} style={{ flex: 1, height: '4px', borderRadius: '2px', background: s <= step ? '#1D9E75' : '#E5E7EB' }} />))}
        </div>
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #E5E7EB' }}>
          {step === 1 && (
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#2C2C2A', marginBottom: '16px' }}>Basic information</div>
              <input style={inputStyle} placeholder="Business name" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} />
              <select style={selectStyle} value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}>
                <option value="">Select your industry</option>
                {industries.map(i => (<option key={i} value={i}>{i}</option>))}
              </select>
              <select style={selectStyle} value={form.entity_type} onChange={e => setForm({ ...form, entity_type: e.target.value })}>
                <option value="">Select entity type</option>
                {entityTypes.map(e => (<option key={e} value={e}>{e}</option>))}
              </select>
            </div>
          )}
          {step === 2 && (
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#2C2C2A', marginBottom: '16px' }}>Location & revenue</div>
              <input style={inputStyle} placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <input style={inputStyle} placeholder="County" value={form.county} onChange={e => setForm({ ...form, county: e.target.value })} />
              <select style={selectStyle} value={form.revenue_range} onChange={e => setForm({ ...form, revenue_range: e.target.value })}>
                <option value="">Select annual revenue range</option>
                {revenueRanges.map(r => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
          )}
          {step === 3 && (
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#2C2C2A', marginBottom: '16px' }}>One last thing</div>
              <div style={{ padding: '16px', background: '#F9FAFB', borderRadius: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setForm({ ...form, is_veteran: !form.is_veteran })}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#2C2C2A' }}>Veteran-owned business?</div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>Unlocks exclusive veteran programs</div>
                </div>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', border: '2px solid', borderColor: form.is_veteran ? '#1D9E75' : '#E5E7EB', background: form.is_veteran ? '#1D9E75' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '14px' }}>
                  {form.is_veteran ? '✓' : ''}
                </div>
              </div>
              <div style={{ padding: '16px', background: '#E1F5EE', borderRadius: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#085041', marginBottom: '4px' }}>Your report is almost ready</div>
                <div style={{ fontSize: '12px', color: '#1D9E75', lineHeight: '1.6' }}>We'll match your business against 50+ Texas programs and show you exactly what you qualify for.</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontWeight: '500', color: '#6B7280', cursor: 'pointer' }}>Back</button>
            )}
            <button onClick={() => step < 3 ? setStep(step + 1) : handleSubmit()} disabled={loading} style={{ flex: 1, padding: '12px', background: '#1D9E75', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
              {loading ? 'Setting up...' : step < 3 ? 'Continue' : 'Generate My Report →'}
            </button>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#9CA3AF' }}>Your information is secure and never shared</div>
      </div>
    </div>
  )
}