'use client'

import { useState } from 'react'
import { useUser, useSignOut } from '@/lib/supabase'
import Link from 'next/link'

export function UserMenu() {
  const { user, loading } = useUser()
  const signOut = useSignOut()
  const [isOpen, setIsOpen] = useState(false)

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-[#2A2A2A] animate-pulse" />
    )
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="px-4 py-2 bg-[#4A8FE7] hover:bg-[#3A7FD7] text-white text-sm font-medium rounded-lg transition-colors"
      >
        Sign In
      </Link>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full bg-[#4A8FE7] flex items-center justify-center text-white font-medium text-sm hover:bg-[#3A7FD7] transition-colors"
      >
        {user.email?.[0].toUpperCase()}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2A2A2A]">
              <p className="text-sm text-white truncate">{user.email}</p>
            </div>
            <button
              onClick={() => {
                setIsOpen(false)
                signOut()
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-400 hover:bg-[#2A2A2A] hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
