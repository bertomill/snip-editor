'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

interface Feedback {
  id: string
  user_id: string | null
  email: string | null
  feedback: string
  type: 'general' | 'feature' | 'bug'
  created_at: string
  resolved: boolean
  resolved_at: string | null
  admin_notes: string | null
}

const ADMIN_EMAILS = ['bertmill19@gmail.com', 'hello@bertomill.ca']

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'general' | 'feature' | 'bug'>('all')
  const [showResolved, setShowResolved] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const router = useRouter()

  const fetchFeedback = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/feedback')
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        if (response.status === 403) {
          setError('Access denied. Admin privileges required.')
          return
        }
        throw new Error('Failed to fetch feedback')
      }
      const data = await response.json()
      setFeedback(data.feedback || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback')
    }
  }, [router])

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }
      if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
        setError('Access denied. Admin privileges required.')
        setLoading(false)
        return
      }
      setUser(user)
      setLoading(false)
      fetchFeedback()
    })
  }, [router, fetchFeedback])

  const toggleResolved = async (id: string, currentResolved: boolean) => {
    try {
      const response = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolved: !currentResolved }),
      })
      if (!response.ok) throw new Error('Failed to update')
      setFeedback(prev =>
        prev.map(f =>
          f.id === id
            ? { ...f, resolved: !currentResolved, resolved_at: !currentResolved ? new Date().toISOString() : null }
            : f
        )
      )
    } catch {
      alert('Failed to update feedback status')
    }
  }

  const saveNotes = async (id: string) => {
    try {
      const response = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, admin_notes: notesValue }),
      })
      if (!response.ok) throw new Error('Failed to save notes')
      setFeedback(prev =>
        prev.map(f => (f.id === id ? { ...f, admin_notes: notesValue } : f))
      )
      setEditingNotes(null)
      setNotesValue('')
    } catch {
      alert('Failed to save notes')
    }
  }

  const filteredFeedback = feedback.filter(f => {
    if (!showResolved && f.resolved) return false
    if (filter !== 'all' && f.type !== filter) return false
    return true
  })

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'bug':
        return 'bg-red-500/20 text-red-300 border-red-500/30'
      case 'feature':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#161b2e] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#161b2e] flex flex-col items-center justify-center p-4">
        <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-6 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-300 mb-2">Access Denied</h1>
          <p className="text-white/60">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#161b2e] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-white/50 text-sm">Feedback Management</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/50 text-sm hidden sm:block">{user?.email}</span>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm transition-all"
            >
              Back to App
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-white/50 text-sm">Total</p>
            <p className="text-2xl font-bold">{feedback.length}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-white/50 text-sm">Unresolved</p>
            <p className="text-2xl font-bold text-yellow-400">
              {feedback.filter(f => !f.resolved).length}
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-white/50 text-sm">Bugs</p>
            <p className="text-2xl font-bold text-red-400">
              {feedback.filter(f => f.type === 'bug').length}
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-white/50 text-sm">Features</p>
            <p className="text-2xl font-bold text-blue-400">
              {feedback.filter(f => f.type === 'feature').length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-6 pb-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {(['all', 'general', 'feature', 'bug'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-2 rounded-full text-sm transition-all ${
                  filter === type
                    ? 'bg-white text-gray-900'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={e => setShowResolved(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/10 accent-white"
            />
            Show resolved
          </label>
        </div>
      </div>

      {/* Feedback List */}
      <div className="px-4 sm:px-6 pb-8">
        <div className="max-w-6xl mx-auto space-y-3">
          {filteredFeedback.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              No feedback found matching your filters.
            </div>
          ) : (
            filteredFeedback.map(item => (
              <div
                key={item.id}
                className={`bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all ${
                  item.resolved ? 'opacity-60' : ''
                }`}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-white/5 transition-all"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full border ${getTypeColor(
                            item.type
                          )}`}
                        >
                          {item.type}
                        </span>
                        {item.resolved && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                            Resolved
                          </span>
                        )}
                        <span className="text-white/40 text-xs">
                          {new Date(item.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-white/90 line-clamp-2">{item.feedback}</p>
                      <p className="text-white/40 text-sm mt-1">
                        From: {item.email || 'Anonymous'}
                      </p>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        toggleResolved(item.id, item.resolved)
                      }}
                      className={`shrink-0 px-3 py-1.5 text-sm rounded-full transition-all ${
                        item.resolved
                          ? 'bg-white/10 hover:bg-white/20 text-white'
                          : 'bg-green-500/20 hover:bg-green-500/30 text-green-300'
                      }`}
                    >
                      {item.resolved ? 'Reopen' : 'Resolve'}
                    </button>
                  </div>
                </div>

                {/* Expanded View */}
                {expandedId === item.id && (
                  <div className="border-t border-white/10 p-4 bg-white/[0.02]">
                    <div className="mb-4">
                      <h4 className="text-white/50 text-sm mb-2">Full Feedback:</h4>
                      <p className="text-white/90 whitespace-pre-wrap">{item.feedback}</p>
                    </div>

                    <div className="mb-4">
                      <h4 className="text-white/50 text-sm mb-2">Admin Notes:</h4>
                      {editingNotes === item.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={notesValue}
                            onChange={e => setNotesValue(e.target.value)}
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40 resize-none"
                            rows={3}
                            placeholder="Add notes about this feedback..."
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveNotes(item.id)}
                              className="px-4 py-2 bg-white text-gray-900 rounded-full text-sm font-medium hover:bg-gray-100 transition-all"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingNotes(null)
                                setNotesValue('')
                              }}
                              className="px-4 py-2 bg-white/10 text-white rounded-full text-sm hover:bg-white/20 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {item.admin_notes ? (
                            <p className="text-white/70 whitespace-pre-wrap mb-2">
                              {item.admin_notes}
                            </p>
                          ) : (
                            <p className="text-white/40 italic mb-2">No notes yet</p>
                          )}
                          <button
                            onClick={() => {
                              setEditingNotes(item.id)
                              setNotesValue(item.admin_notes || '')
                            }}
                            className="text-sm text-white/50 hover:text-white transition-all"
                          >
                            {item.admin_notes ? 'Edit notes' : 'Add notes'}
                          </button>
                        </div>
                      )}
                    </div>

                    {item.resolved_at && (
                      <p className="text-white/40 text-sm">
                        Resolved on{' '}
                        {new Date(item.resolved_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
