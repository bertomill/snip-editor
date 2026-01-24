'use client';

import { useState } from 'react';
import { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
  onShowActions?: (project: Project) => void;
  variant?: 'list' | 'grid';
}

export function ProjectCard({ project, onClick, onDelete, onShowActions, variant = 'list' }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // On mobile, show bottom drawer; on desktop, show dropdown
    if (window.innerWidth < 768 && onShowActions) {
      onShowActions(project);
    } else {
      setShowMenu(!showMenu);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete();
  };

  // Grid variant
  if (variant === 'grid') {
    return (
      <div className="relative group">
        <button
          onClick={onClick}
          className="w-full text-left"
        >
          {/* Thumbnail */}
          <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-[var(--background-card)]">
            {project.thumbnailUrl ? (
              <img
                src={project.thumbnailUrl}
                alt={project.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#4A8FE7] to-[#6366F1] flex items-center justify-center">
                <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <h3 className="text-white font-medium text-sm truncate">{project.name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] bg-[#2a2a3a] text-[#8E8E93] px-1.5 py-0.5 rounded flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.4 0 2.8 1.1 2.8 2.5V11c.6 0 1.2.6 1.2 1.3v3.5c0 .6-.6 1.2-1.3 1.2H9.2c-.6 0-1.2-.6-1.2-1.3v-3.5c0-.6.6-1.2 1.3-1.2V9.5C9.2 8.1 10.6 7 12 7z"/>
              </svg>
              Private
            </span>
            <span className="text-[10px] text-[#8E8E93]">Video</span>
          </div>
        </button>

        {/* Menu button */}
        <button
          onClick={handleMenuClick}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 hover:bg-black/70 transition-all md:opacity-0"
        >
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="6" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="18" cy="12" r="2" />
          </svg>
        </button>

        {/* Desktop Context menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-2 top-10 w-40 bg-[var(--background-card)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden">
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-sm">Delete</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // List variant (default)
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 p-3 hover:bg-[var(--background-card)] rounded-xl transition-all text-left group"
      >
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg flex-shrink-0 overflow-hidden">
          {project.thumbnailUrl ? (
            <img
              src={project.thumbnailUrl}
              alt={project.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#4A8FE7] to-[#6366F1] flex items-center justify-center">
              <svg className="w-7 h-7 text-white/80" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
          )}
        </div>

        {/* Project info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate mb-1">{project.name}</h3>
          <div className="flex items-center gap-2">
            {/* Private badge */}
            <span className="text-xs bg-[#2a2a3a] text-[#8E8E93] px-2 py-0.5 rounded flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.4 0 2.8 1.1 2.8 2.5V11c.6 0 1.2.6 1.2 1.3v3.5c0 .6-.6 1.2-1.3 1.2H9.2c-.6 0-1.2-.6-1.2-1.3v-3.5c0-.6.6-1.2 1.3-1.2V9.5C9.2 8.1 10.6 7 12 7z"/>
              </svg>
              Private
            </span>
            {/* Separator */}
            <span className="text-[#636366]">·</span>
            {/* Type badge */}
            <span className="flex items-center gap-1 text-xs text-[#8E8E93]">
              <svg className="w-3.5 h-3.5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v12h16V6H4zm10.5 3l3.5 3-3.5 3v-2H8v-2h6.5V9z"/>
              </svg>
              Video
            </span>
          </div>
        </div>

        {/* Horizontal menu button - always visible on mobile */}
        <div
          onClick={handleMenuClick}
          className="p-2 rounded-lg md:opacity-0 md:group-hover:opacity-100 hover:bg-[var(--background-elevated)] transition-all"
        >
          <svg className="w-5 h-5 text-[#8E8E93]" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="6" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="18" cy="12" r="2" />
          </svg>
        </div>
      </button>

      {/* Desktop Context menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="hidden md:block absolute right-4 top-14 w-40 bg-[var(--background-card)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden">
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-sm">Delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
