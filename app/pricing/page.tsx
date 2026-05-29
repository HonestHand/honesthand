'use client'
import { useState } from 'react'

// ─── Elite waitlist modal ─────────────────────────────────────────────────────

function EliteWaitlistModal({ onClose }: { onClose: () => void }) {
  const [name,         setName]         = useState('')
  const [email,        setEmail]        = useState('')
  const [businessName, setBusinessName] = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitted,    setSubmitted]    = useState(false)
  const [error,        setError]        = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required'); return }
    setSubmitting(true)
    setError('')
    try {
      const res  = await fetch('/api/elite-waitlist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, businessName }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md relative"
        style={{ padding: '36px 32px', boxShadow: '0 24px 48px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-gray-400 hover:text-gray-600 text-2xl leading-none font-light"
          aria-label="Close"
        >
          ×
        </button>

        {submitted ? (
          <div className="text-center py-2">
            <div className="text-5xl mb-4">✅</div>
            <div className="text-[22px] font-bold mb-2" style={{ color: '#2C2C2A' }}>You're on the list.</div>
            <p className="text-[14px] leading-relaxed" style={{ color: '#6B7280' }}>
              We'll reach out when Elite launches. Thanks for your interest in Honest Hand.
            </p>
            <button
              onClick={onClose}
              className="mt-7 px-8 py-3 rounded-xl font-bold text-[15px] text-white"
              style={{ background: '#1D9E75' }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#1D9E75' }}>
              Honest Hand Elite
            </div>
            <h2 className="text-[22px] font-bold mb-1.5" style={{ color: '#2C2C2A' }}>
              Join the waitlist
            </h2>
            <p className="text-[14px] leading-relaxed mb-7" style={{ color: '#6B7280' }}>
              Elite is in development. Leave your details and we'll notify you when it's ready — no spam, ever.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border text-[14px] outline-none transition-colors"
                style={{
                  padding: '13px 16px',
                  borderColor: '#E5E7EB',
                  color: '#111827',
                }}
                onFocus={e  => (e.target.style.borderColor = '#1D9E75')}
                onBlur={e   => (e.target.style.borderColor = '#E5E7EB')}
              />
              <input
                type="email"
                placeholder="Email address *"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border text-[14px] outline-none transition-colors"
                style={{
                  padding: '13px 16px',
                  borderColor: '#E5E7EB',
                  color: '#111827',
                }}
                onFocus={e  => (e.target.style.borderColor = '#1D9E75')}
                onBlur={e   => (e.target.style.borderColor = '#E5E7EB')}
              />
              <input
                type="text"
                placeholder="Business name (optional)"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                className="w-full rounded-xl border text-[14px] outline-none transition-colors"
                style={{
                  padding: '13px 16px',
                  borderColor: '#E5E7EB',
                  color: '#111827',
                }}
                onFocus={e  => (e.target.style.borderColor = '#1D9E75')}
                onBlur={e   => (e.target.style.borderColor = '#E5E7EB')}
              />
              {error && (
                <p className="text-[13px]" style={{ color: '#DC2626' }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl font-bold text-[15px] text-white transition-opacity"
                style={{
                  padding: '14px',
                  background: '#2C2C2A',
                  opacity: submitting ? 0.7 : 1,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Submitting…' : 'Notify Me When Elite Launches'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Feature row ──────────────────────────────────────────────────────────────

function Feature({
  text,
  muted = false,
}: {
  text: string
  muted?: boolean
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="flex-shrink-0 mt-0.5 font-bold text-[13px]"
        style={{ color: muted ? '#D1D5DB' : '#1D9E75' }}
      >
        {muted ? '○' : '✓'}
      </span>
      <span
        className="text-[13px] leading-snug"
        style={{ color: muted ? '#9CA3AF' : '#4B5563' }}
      >
        {text}
      </span>
    </li>
  )
}

// ─── Main pricing page ────────────────────────────────────────────────────────

export default function PricingPage() {
  const [showWaitlist, setShowWaitlist] = useState(false)

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Nav ── */}
      <nav
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid #F3F4F6' }}
      >
        <a href="/" className="no-underline" style={{ fontSize: '20px', fontWeight: 600, color: '#2C2C2A' }}>
          Honest<span style={{ color: '#1D9E75' }}>Hand</span>
        </a>
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="no-underline hidden sm:block"
            style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}
          >
            Home
          </a>
          <a
            href="/contact"
            className="no-underline hidden sm:block"
            style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}
          >
            Contact
          </a>
          <a
            href="/"
            className="no-underline"
            style={{
              fontSize: '13px',
              padding: '7px 16px',
              border: '1px solid #1D9E75',
              borderRadius: '20px',
              color: '#1D9E75',
              fontWeight: 500,
            }}
          >
            Sign In
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="text-center px-6 pt-14 pb-10 max-w-lg mx-auto">
        <div
          className="text-[11px] font-bold uppercase tracking-widest mb-3"
          style={{ color: '#1D9E75' }}
        >
          Simple, Transparent Pricing
        </div>
        <h1
          className="text-[28px] sm:text-[32px] font-bold leading-tight mb-4"
          style={{ color: '#2C2C2A', letterSpacing: '-0.4px' }}
        >
          <span className="block">Start free.</span>
          <span className="block whitespace-nowrap">Go deeper with Pro.</span>
        </h1>
        <p className="text-[16px] leading-relaxed" style={{ color: '#6B7280' }}>
          Honest Hand helps Texas business owners find grants, loans, tax credits, and incentives they're already entitled to.
        </p>
      </div>

      {/* ── Pricing cards ── */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">

          {/* ─ Free Preview ─ */}
          <div
            className="bg-white rounded-2xl"
            style={{ border: '1.5px solid #E5E7EB', padding: '28px 24px' }}
          >
            <div className="mb-5">
              <div
                className="text-[11px] font-bold uppercase tracking-widest mb-2"
                style={{ color: '#9CA3AF' }}
              >
                Free Preview
              </div>
              <div className="text-[32px] font-bold" style={{ color: '#2C2C2A' }}>
                $0
              </div>
              <div className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>
                No credit card required
              </div>
            </div>

            <p
              className="text-[14px] leading-relaxed mb-6"
              style={{ color: '#6B7280' }}
            >
              See how Honest Hand organizes funding opportunities before creating a full business profile.
            </p>

            <ul className="space-y-2.5 mb-8">
              {[
                'Sample funding report preview',
                'Example grants & loans for Texas',
                'See how your eligibility is assessed',
                'Explore what programs exist for your industry',
              ].map(f => <Feature key={f} text={f} />)}
            </ul>

            <a
              href="/?signup=true"
              className="block w-full text-center rounded-xl font-semibold text-[15px] no-underline transition-colors"
              style={{
                padding: '13px',
                border: '2px solid #1D9E75',
                color: '#1D9E75',
                background: 'white',
              }}
              onMouseOver={e  => (e.currentTarget.style.background = '#E1F5EE')}
              onMouseOut={e   => (e.currentTarget.style.background = 'white')}
            >
              Preview Honest Hand
            </a>
          </div>

          {/* ─ Pro — recommended ─ */}
          <div
            className="bg-white rounded-2xl relative"
            style={{
              border: '2px solid #1D9E75',
              padding: '28px 24px',
              boxShadow: '0 8px 32px rgba(29,158,117,0.13)',
            }}
          >
            {/* Most Popular pill */}
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '-14px' }}>
              <span
                className="text-white text-[11px] font-bold uppercase tracking-wide rounded-full whitespace-nowrap"
                style={{ background: '#1D9E75', padding: '4px 16px' }}
              >
                Most Popular
              </span>
            </div>

            <div className="mb-5">
              <div
                className="text-[11px] font-bold uppercase tracking-widest mb-2"
                style={{ color: '#1D9E75' }}
              >
                Honest Hand Pro
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[32px] font-bold" style={{ color: '#2C2C2A' }}>$49</span>
                <span className="text-[14px]" style={{ color: '#9CA3AF' }}>/month</span>
              </div>
              <div className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>
                Cancel anytime
              </div>
            </div>

            <p
              className="text-[14px] leading-relaxed mb-6"
              style={{ color: '#4B5563' }}
            >
              Personalized funding intelligence for Texas business owners who want to stop missing grants, loans, credits, and incentives.
            </p>

            <ul className="space-y-2.5 mb-8">
              {[
                'Personalized monthly funding report',
                'Full opportunity dashboard',
                'Grants, loans, tax credits & incentives',
                'Deadline tracking',
                'Saved opportunities',
                'Official .gov source links',
                'Monthly report refresh',
                'Email updates & digests',
              ].map(f => <Feature key={f} text={f} />)}
            </ul>

            <a
              href="/?signup=true"
              className="block w-full text-center rounded-xl font-bold text-[15px] text-white no-underline transition-opacity"
              style={{ padding: '14px', background: '#1D9E75' }}
              onMouseOver={e  => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={e   => (e.currentTarget.style.opacity = '1')}
            >
              Start Pro
            </a>
            <p className="text-center text-[12px] mt-2.5" style={{ color: '#9CA3AF' }}>
              Create a free account, then upgrade from your dashboard.
            </p>
          </div>

          {/* ─ Elite — Coming Soon ─ */}
          <div
            className="rounded-2xl relative"
            style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', padding: '28px 24px' }}
          >
            {/* Coming Soon pill */}
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '-14px' }}>
              <span
                className="text-white text-[11px] font-bold uppercase tracking-wide rounded-full whitespace-nowrap"
                style={{ background: '#374151', padding: '4px 16px' }}
              >
                Coming Soon
              </span>
            </div>

            <div className="mb-5">
              <div
                className="text-[11px] font-bold uppercase tracking-widest mb-2"
                style={{ color: '#9CA3AF' }}
              >
                Honest Hand Elite
              </div>
              <div className="text-[32px] font-bold" style={{ color: '#D1D5DB' }}>
                —
              </div>
              <div className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>
                Pricing announced at launch
              </div>
            </div>

            <p
              className="text-[14px] leading-relaxed mb-6"
              style={{ color: '#9CA3AF' }}
            >
              For business owners who want deeper strategy, application support, and advanced funding readiness tools.
            </p>

            <ul className="space-y-2.5 mb-8">
              {[
                'Funding readiness score',
                'Priority opportunity ranking',
                'AI-assisted application drafting',
                'Custom funding searches',
                'Quarterly funding strategy roadmap',
                'Advanced deadline alerts',
                'Early access to advisor-style tools',
              ].map(f => <Feature key={f} text={f} muted />)}
            </ul>

            <button
              onClick={() => setShowWaitlist(true)}
              className="w-full rounded-xl font-semibold text-[15px] transition-colors"
              style={{
                padding: '13px',
                border: '2px solid #D1D5DB',
                background: 'white',
                color: '#6B7280',
                cursor: 'pointer',
              }}
              onMouseOver={e  => {
                e.currentTarget.style.borderColor = '#9CA3AF'
                e.currentTarget.style.color       = '#374151'
              }}
              onMouseOut={e   => {
                e.currentTarget.style.borderColor = '#D1D5DB'
                e.currentTarget.style.color       = '#6B7280'
              }}
            >
              Join Elite Waitlist
            </button>
          </div>
        </div>

        {/* ── Trust bar ── */}
        <div
          className="mt-12 pt-8"
          style={{ borderTop: '1px solid #F3F4F6' }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {[
              { icon: '🔒', label: 'Secure payments',      sub: 'Powered by Stripe'              },
              { icon: '✕',  label: 'Cancel anytime',       sub: 'No long-term contracts'         },
              { icon: '🏛️', label: 'Official sources',     sub: '.gov links, no guesswork'       },
              { icon: '⚠️', label: 'Verify requirements',  sub: 'Eligibility is not guaranteed'  },
            ].map(t => (
              <div key={t.label} className="text-center px-2">
                <div className="text-2xl mb-1.5">{t.icon}</div>
                <div className="text-[12px] font-semibold" style={{ color: '#2C2C2A' }}>{t.label}</div>
                <div className="text-[11px] mt-0.5 leading-snug" style={{ color: '#9CA3AF' }}>{t.sub}</div>
              </div>
            ))}
          </div>

          <p
            className="text-center text-[12px] leading-relaxed max-w-xl mx-auto"
            style={{ color: '#9CA3AF' }}
          >
            HonestHand helps identify opportunities, but users should verify requirements with official sources before applying. Eligibility is not guaranteed. Not legal, financial, or tax advice.
          </p>
        </div>

        {/* ── FAQ teaser ── */}
        <div
          className="mt-12 rounded-2xl px-8 py-7"
          style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}
        >
          <h2 className="text-[18px] font-bold mb-5 text-center" style={{ color: '#2C2C2A' }}>
            Common questions
          </h2>
          <div className="space-y-5 max-w-2xl mx-auto">
            {[
              {
                q: "What's included in the free preview?",
                a: "The free account lets you complete your business profile and view a partial report with a sample of the opportunities Honest Hand identifies. Full access to all sections requires Pro.",
              },
              {
                q: "Does my subscription guarantee I receive funding?",
                a: "No. HonestHand identifies programs you may qualify for based on the information you provide. Eligibility determinations are estimates — always verify requirements directly with the administering agency.",
              },
              {
                q: "Can I cancel my Pro subscription anytime?",
                a: "Yes. Cancel anytime from your billing settings. You keep access through the end of your current billing period.",
              },
              {
                q: "What is Honest Hand Elite?",
                a: "Elite is a deeper tier we're building — including application drafting assistance, funding readiness scoring, and strategy roadmaps. It's not available yet. Join the waitlist to be notified first.",
              },
            ].map(({ q, a }) => (
              <div key={q} style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '20px' }}>
                <div className="text-[14px] font-semibold mb-1.5" style={{ color: '#2C2C2A' }}>{q}</div>
                <div className="text-[13px] leading-relaxed" style={{ color: '#6B7280' }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className="text-center px-6 py-8"
        style={{ borderTop: '1px solid #F3F4F6' }}
      >
        <div className="text-[14px] font-semibold mb-1.5" style={{ color: '#2C2C2A' }}>
          Honest<span style={{ color: '#1D9E75' }}>Hand</span>
        </div>
        <div className="text-[12px] mb-4" style={{ color: '#9CA3AF' }}>
          yourhonesthand.com · Texas · Est. 2026
        </div>
        <div className="flex items-center justify-center gap-5">
          {[
            { label: 'Home',    href: '/'        },
            { label: 'Pricing', href: '/pricing' },
            { label: 'Contact', href: '/contact' },
          ].map(l => (
            <a
              key={l.label}
              href={l.href}
              className="no-underline text-[12px]"
              style={{ color: '#9CA3AF' }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* Waitlist modal */}
      {showWaitlist && <EliteWaitlistModal onClose={() => setShowWaitlist(false)} />}
    </div>
  )
}
