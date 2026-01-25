'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const router = useRouter()

  useEffect(() => {
    const client = createClient()
    setSupabase(client)

    // Warm up Supabase connection - reduces delay on first auth call
    client.auth.getSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        setMessage('Check your email for the confirmation link!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (!supabase) return
    setGoogleLoading(true)
    setError(null)

    // Use skipBrowserRedirect to get URL immediately, then redirect ourselves
    // This is faster than waiting for Supabase to redirect
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      setError(error.message)
      setGoogleLoading(false)
      return
    }

    if (data?.url) {
      window.location.href = data.url
    }
  }

  const handleAppleSignIn = async () => {
    if (!supabase) return
    setAppleLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setAppleLoading(false)
    }
  }

  return (
    <>
      {/* Mobile View - Calm Style */}
      <div className="lg:hidden min-h-screen bg-[#161b2e] flex flex-col">
        {/* Header area with headline */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8">
          <Image
            src="/snip.jpg"
            alt="Snip"
            width={200}
            height={200}
            className="w-48 h-48 mb-6 rounded-2xl"
            priority
          />
          <h2 className="relative text-4xl font-black mb-4">
            <span className="absolute text-[#00f2ea] glitch-text-cyan">snip</span>
            <span className="absolute text-[#ff0050] glitch-text-pink">snip</span>
            <span className="relative text-white">snip</span>
          </h2>
          <h1 className="text-2xl sm:text-3xl font-bold text-white text-center leading-tight mb-3">
            {showEmailForm
              ? (isSignUp ? 'Create your account' : 'Welcome back')
              : 'Create viral content in seconds'
            }
          </h1>
          {!showEmailForm && (
            <p className="text-white/60 text-center text-lg">
              AI-powered editing for the next generation of creators
            </p>
          )}
        </div>

        {/* Buttons area */}
        <div className="px-6 pb-8 space-y-3">
          {showEmailForm ? (
            // Email form
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-white/50 focus:outline-none focus:border-white/40 transition-all text-center"
                placeholder="Email address"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-white/50 focus:outline-none focus:border-white/40 transition-all text-center"
                placeholder="Password"
                required
                minLength={6}
              />

              {error && (
                <div className="text-red-300 text-sm text-center bg-red-500/20 p-3 rounded-2xl">
                  {error}
                </div>
              )}

              {message && (
                <div className="text-green-300 text-sm text-center bg-green-500/20 p-3 rounded-2xl">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-white text-gray-900 font-semibold rounded-full transition-all disabled:opacity-70 active:scale-[0.98] shadow-lg"
              >
                {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>

              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="w-full py-4 bg-white/10 backdrop-blur-sm text-white font-medium rounded-full transition-all active:scale-[0.98] border border-white/20"
              >
                Back
              </button>

              <p className="text-center text-white/60 text-sm pt-2">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError(null)
                    setMessage(null)
                  }}
                  className="text-white font-medium"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </form>
          ) : (
            // Social buttons - Calm style
            <>
              <button
                onClick={() => setShowEmailForm(true)}
                className="w-full py-4 bg-white/95 backdrop-blur-sm text-gray-900 font-semibold rounded-full transition-all flex items-center justify-start px-6 gap-4 active:scale-[0.98] shadow-lg"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="M22 6L12 13L2 6"/>
                </svg>
                Continue with Email
              </button>

              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full py-4 bg-white/95 backdrop-blur-sm text-gray-900 font-semibold rounded-full transition-all flex items-center justify-start px-6 gap-4 active:scale-[0.98] disabled:opacity-70 shadow-lg"
              >
                {googleLoading ? (
                  <>
                    <span className="w-6 h-6 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <button
                onClick={handleAppleSignIn}
                disabled={appleLoading}
                className="w-full py-4 bg-black text-white font-semibold rounded-full transition-all flex items-center justify-start px-6 gap-4 active:scale-[0.98] disabled:opacity-70 shadow-lg"
              >
                {appleLoading ? (
                  <>
                    <span className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    Continue with Apple
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Legal text at bottom */}
        <div className="px-8 pb-8 pt-4">
          <p className="text-white/40 text-xs text-center leading-relaxed">
            By signing in, you agree to our{' '}
            <span className="text-white/60">Terms of Service</span> and{' '}
            <span className="text-white/60">Privacy Policy</span>
          </p>
        </div>
      </div>

      {/* Desktop View - Clean Centered Layout */}
      <div className="hidden lg:flex min-h-screen bg-[#161b2e] flex-col">
        {/* Header area with headline */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8">
          <Image
            src="/snip.jpg"
            alt="Snip"
            width={280}
            height={280}
            className="w-64 h-64 mb-8 rounded-3xl"
            priority
          />
          <h2 className="relative text-5xl font-black mb-6">
            <span className="absolute text-[#00f2ea] glitch-text-cyan">snip</span>
            <span className="absolute text-[#ff0050] glitch-text-pink">snip</span>
            <span className="relative text-white">snip</span>
          </h2>
          <h1 className="text-3xl md:text-4xl font-bold text-white text-center leading-tight mb-4">
            Create viral content in seconds
          </h1>
          <p className="text-white/60 text-center text-xl">
            AI-powered editing for the next generation of creators
          </p>
        </div>

        {/* Buttons area */}
        <div className="px-8 pb-8 max-w-xl mx-auto w-full space-y-4">
          {showEmailForm ? (
            // Email form
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-white/50 focus:outline-none focus:border-white/40 transition-all text-center text-lg"
                placeholder="Email address"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-white/50 focus:outline-none focus:border-white/40 transition-all text-center text-lg"
                placeholder="Password"
                required
                minLength={6}
              />

              {error && (
                <div className="text-red-300 text-sm text-center bg-red-500/20 p-3 rounded-2xl">
                  {error}
                </div>
              )}

              {message && (
                <div className="text-green-300 text-sm text-center bg-green-500/20 p-3 rounded-2xl">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-white text-gray-900 font-semibold rounded-full transition-all disabled:opacity-70 hover:bg-gray-100 shadow-lg text-lg"
              >
                {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>

              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="w-full py-4 bg-white/10 backdrop-blur-sm text-white font-medium rounded-full transition-all hover:bg-white/20 border border-white/20 text-lg"
              >
                Back
              </button>

              <p className="text-center text-white/60 text-sm pt-2">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError(null)
                    setMessage(null)
                  }}
                  className="text-white font-medium hover:underline"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </form>
          ) : (
            // Social buttons
            <>
              <button
                onClick={() => setShowEmailForm(true)}
                className="w-full py-4 bg-white/95 backdrop-blur-sm text-gray-900 font-semibold rounded-full transition-all flex items-center justify-start px-6 gap-4 hover:bg-white shadow-lg text-lg"
              >
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="M22 6L12 13L2 6"/>
                </svg>
                Continue with Email
              </button>

              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full py-4 bg-white/95 backdrop-blur-sm text-gray-900 font-semibold rounded-full transition-all flex items-center justify-start px-6 gap-4 hover:bg-white disabled:opacity-70 shadow-lg text-lg"
              >
                {googleLoading ? (
                  <>
                    <span className="w-7 h-7 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-7 h-7" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <button
                onClick={handleAppleSignIn}
                disabled={appleLoading}
                className="w-full py-4 bg-black text-white font-semibold rounded-full transition-all flex items-center justify-start px-6 gap-4 hover:bg-gray-900 disabled:opacity-70 shadow-lg text-lg"
              >
                {appleLoading ? (
                  <>
                    <span className="w-7 h-7 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    Continue with Apple
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Legal text at bottom */}
        <div className="px-8 pb-8 pt-4">
          <p className="text-white/40 text-sm text-center leading-relaxed">
            By signing in, you agree to our{' '}
            <span className="text-white/60">Terms of Service</span> and{' '}
            <span className="text-white/60">Privacy Policy</span>
          </p>
        </div>
      </div>
    </>
  )
}
