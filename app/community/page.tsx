'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

type PostType = 'win' | 'question' | 'update'

type Post = {
  id: string
  user_id: string
  business_name: string
  industry: string
  city: string
  content: string
  post_type: PostType
  created_at: string
  likes: number
}

const TYPE_META: Record<PostType, { label: string; bg: string; color: string }> = {
  win:      { label: '🏆 Win',      bg: '#D1FAE5', color: '#065F46' },
  question: { label: '❓ Question', bg: '#DBEAFE', color: '#1E40AF' },
  update:   { label: '📢 Update',   bg: '#F3F4F6', color: '#374151' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Community() {
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<Post[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [formContent, setFormContent] = useState('')
  const [formType, setFormType] = useState<PostType>('win')
  const [error, setError] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/'; return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (!profileData?.is_pro) {
      window.location.href = '/dashboard'
      return
    }
    setProfile(profileData)

    const { data: postsData, error: fetchError } = await supabase
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (fetchError) {
      setError('Community feed unavailable. The table may not be set up yet.')
    } else {
      setPosts(postsData || [])
    }
    setLoading(false)
  }

  const handleLike = async (postId: string) => {
    if (!supabase || likedPosts.has(postId)) return
    const post = posts.find(p => p.id === postId)
    if (!post) return
    const newLikes = (post.likes || 0) + 1
    setLikedPosts(prev => new Set([...prev, postId]))
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p))
    await supabase.from('community_posts').update({ likes: newLikes }).eq('id', postId)
  }

  const handleSubmit = async () => {
    if (!supabase || !profile || !formContent.trim()) return
    setSubmitting(true)
    const { data, error: insertError } = await supabase
      .from('community_posts')
      .insert({
        user_id: profile.id,
        business_name: profile.business_name,
        industry: profile.industry,
        city: profile.city,
        content: formContent.trim(),
        post_type: formType,
        likes: 0,
      })
      .select()
      .single()
    if (insertError) {
      setError('Failed to post. Please try again.')
    } else if (data) {
      setPosts(prev => [data, ...prev])
      setFormContent('')
      setFormType('win')
      setShowForm(false)
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'system-ui' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#2C2C2A' }}>
            Honest<span style={{ color: '#1D9E75' }}>Hand</span>
          </div>
          <a href="/dashboard" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none', fontWeight: '500' }}>My Report</a>
          <span style={{ fontSize: '13px', color: '#1D9E75', fontWeight: '600' }}>Community</span>
        </div>
        <button
          onClick={async () => { if (supabase) { await supabase.auth.signOut(); window.location.href = '/' } }}
          style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: '20px', background: 'none', cursor: 'pointer', color: '#6B7280' }}
        >
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#2C2C2A' }}>Community</div>
            <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Texas business owners sharing wins, questions, and updates</div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + Share a Win
          </button>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#DC2626' }}>
            {error}
          </div>
        )}

        {showForm && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#2C2C2A', marginBottom: '14px' }}>Share with the community</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {(['win', 'question', 'update'] as PostType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setFormType(type)}
                  style={{ padding: '6px 14px', borderRadius: '20px', border: '1.5px solid', borderColor: formType === type ? '#1D9E75' : '#E5E7EB', background: formType === type ? '#E1F5EE' : 'white', color: formType === type ? '#1D9E75' : '#6B7280', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
                >
                  {TYPE_META[type].label}
                </button>
              ))}
            </div>
            <textarea
              value={formContent}
              onChange={e => setFormContent(e.target.value)}
              placeholder={
                formType === 'win' ? 'Share a grant you won, a program you found, or a tip that helped...' :
                formType === 'question' ? 'Ask the community about grants, programs, or running a Texas business...' :
                'Share a business update, milestone, or announcement...'
              }
              style={{ width: '100%', minHeight: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'system-ui', color: '#2C2C2A' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setFormContent('') }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formContent.trim()}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#1D9E75', color: 'white', fontSize: '13px', fontWeight: '600', cursor: submitting || !formContent.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !formContent.trim() ? 0.6 : 1 }}
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        )}

        {posts.length === 0 && !error ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#9CA3AF' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🤝</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#2C2C2A', marginBottom: '6px' }}>Be the first to share</div>
            <div style={{ fontSize: '13px', lineHeight: '1.6' }}>Post a win, ask a question, or share an update to get the community started.</div>
          </div>
        ) : (
          posts.map(post => {
            const meta = TYPE_META[post.post_type] || TYPE_META.update
            return (
              <div key={post.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#2C2C2A' }}>{post.business_name}</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                      {post.industry} · {post.city}, TX · {timeAgo(post.created_at)}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px', background: meta.bg, color: meta.color, whiteSpace: 'nowrap', marginLeft: '12px' }}>
                    {meta.label}
                  </span>
                </div>
                <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.7', marginBottom: '14px' }}>
                  {post.content}
                </div>
                <button
                  onClick={() => handleLike(post.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid', borderColor: likedPosts.has(post.id) ? '#1D9E75' : '#E5E7EB', borderRadius: '20px', padding: '5px 12px', fontSize: '13px', color: likedPosts.has(post.id) ? '#1D9E75' : '#6B7280', cursor: likedPosts.has(post.id) ? 'default' : 'pointer', fontWeight: likedPosts.has(post.id) ? '600' : '400' }}
                >
                  👍 {post.likes || 0}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
