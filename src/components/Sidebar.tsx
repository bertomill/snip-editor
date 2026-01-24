'use client'

import { useState } from 'react'
import { useUser, useSignOut } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'

interface SidebarProps {
  onOpenUploads?: () => void;
  onNavigateHome?: () => void;
  onCreateProject?: () => void;
}

export function Sidebar({ onOpenUploads, onNavigateHome, onCreateProject }: SidebarProps) {
  const { user, loading } = useUser()
  const signOut = useSignOut()
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  return (
    <>
      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[72px] bg-[var(--background)] border-r border-[var(--border-subtle)] flex-col items-center py-4 z-50">
        {/* Logo */}
        <Link href="/" className="mb-8">
          <Image
            src="/branding/icon-transparent.png"
            alt="Snip"
            width={40}
            height={40}
            className="rounded-xl hover:scale-105 transition-transform"
          />
        </Link>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col items-center gap-2">
          {/* Home */}
          <NavButton
            icon={<HomeIcon />}
            label="Home"
            onClick={() => onNavigateHome?.()}
            active
          />

          {/* Uploads */}
          <NavButton
            icon={<UploadsIcon />}
            label="Uploads"
            onClick={() => onOpenUploads?.()}
          />

          {/* Discover/Explore */}
          <NavItem href="/" icon={<ExploreIcon />} label="Explore" />

          {/* Create */}
          <NavButton
            icon={<CreateIcon />}
            label="Create"
            onClick={() => onCreateProject?.()}
          />
        </nav>

        {/* Bottom section - Profile */}
        <div className="relative">
          {loading ? (
            <div className="w-10 h-10 rounded-full bg-[#1C1C1E] animate-pulse" />
          ) : user ? (
            <>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4A8FE7] to-[#6366F1] flex items-center justify-center text-white font-semibold text-sm hover:scale-105 transition-transform ring-2 ring-transparent hover:ring-[#4A8FE7]/50"
              >
                {user.email?.[0].toUpperCase()}
              </button>

              {/* Profile Menu */}
              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute bottom-0 left-full ml-2 w-64 bg-[var(--background-card)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden">
                    {/* Profile Header */}
                    <div className="p-4 border-b border-[var(--border)]">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4A8FE7] to-[#6366F1] flex items-center justify-center text-white font-semibold text-lg">
                          {user.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {user.user_metadata?.full_name || 'User'}
                          </p>
                          <p className="text-gray-400 text-sm truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="p-2">
                      <MenuItem icon={<ProfileIcon />} label="View profile" />
                      <MenuItem icon={<ProjectsIcon />} label="My projects" onClick={() => {
                        setShowProfileMenu(false);
                        onNavigateHome?.();
                      }} />
                      <MenuItem icon={<SettingsIcon />} label="Settings" />
                      <div className="border-t border-[var(--border)] my-2" />
                      <button
                        onClick={() => {
                          setShowProfileMenu(false)
                          signOut()
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <LogoutIcon />
                        <span className="text-sm">Log out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <Link
              href="/login"
              className="w-10 h-10 rounded-full bg-[var(--background-elevated)] flex items-center justify-center text-gray-400 hover:text-white hover:bg-[var(--background-card)] transition-colors"
            >
              <ProfileIcon />
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Nav Bar - Liquid glass style */}
      <MobileBottomNav
        onNavigateHome={onNavigateHome}
        onCreateProject={onCreateProject}
      />
    </>
  )
}

function MobileBottomNav({
  onNavigateHome,
  onCreateProject,
}: {
  onNavigateHome?: () => void
  onCreateProject?: () => void
}) {
  return (
    <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-1 bg-white/10 backdrop-blur-xl rounded-full px-2 py-2 shadow-lg shadow-black/20 border border-white/20">
        <MobileNavButton
          icon={<HomeIconFilled />}
          onClick={onNavigateHome}
          active
        />
        <MobileNavButton
          icon={<SearchIcon />}
          onClick={() => {}}
        />
        <MobileNavButton
          icon={<PlusIcon />}
          onClick={onCreateProject}
          accent
        />
      </div>
    </nav>
  )
}

function MobileNavButton({
  icon,
  onClick,
  active = false,
  accent = false,
}: {
  icon: React.ReactNode
  onClick?: () => void
  active?: boolean
  accent?: boolean
}) {
  if (accent) {
    return (
      <button
        onClick={onClick}
        className="p-3 rounded-full bg-[#4A8FE7] text-white transition-all hover:bg-[#5A9FF7] active:scale-95"
      >
        {icon}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-full transition-colors ${
        active
          ? 'text-white'
          : 'text-white/60 hover:text-white'
      }`}
    >
      {icon}
    </button>
  )
}

function NavItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
        active ? 'text-white' : 'text-gray-400 hover:text-white'
      }`}
    >
      <div
        className={`p-2 rounded-xl transition-colors ${
          active ? 'bg-[#1C1C1E]' : 'group-hover:bg-[#1C1C1E]'
        }`}
      >
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  )
}

function NavButton({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
        active ? 'text-white' : 'text-gray-400 hover:text-white'
      }`}
    >
      <div
        className={`p-2 rounded-xl transition-colors ${
          active ? 'bg-[#1C1C1E]' : 'group-hover:bg-[#1C1C1E]'
        }`}
      >
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-300 hover:bg-[var(--background-card-hover)] rounded-lg transition-colors"
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  )
}

// Desktop Icons
function HomeIcon() {
  return (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3L4 9v12h5v-7h6v7h5V9l-8-6z" />
    </svg>
  )
}

function UploadsIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function ExploreIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" />
    </svg>
  )
}

function CreateIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

// Mobile Icons (Shop app style)
function HomeIconFilled() {
  return (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3L4 9v12h16V9l-8-6z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function CreateIconMobile() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 12h6m-3-3v6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
    </svg>
  )
}

function ProjectsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4m0 14v4m-9-9h4m14 0h-4m-2.5-6.5l2.8-2.8m-11.3 11.3l2.8-2.8m0-5.7l-2.8-2.8m11.3 11.3l-2.8-2.8" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9" />
    </svg>
  )
}
