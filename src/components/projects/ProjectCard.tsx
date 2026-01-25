'use client';

import { useState } from 'react';
import { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
  onShowActions?: (project: Project) => void;
  variant?: 'list' | 'grid';
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function ProjectCard({
  project,
  onClick,
  onDelete,
  onShowActions,
  variant = 'list',
  isSelectMode = false,
  isSelected = false,
  onToggleSelect
}: ProjectCardProps) {
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
          <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-[var(--background-card)] relative">
            {project.thumbnailUrl ? (
              <img
                src={project.thumbnailUrl}
                alt={project.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#3b82f6] to-[#1e3a8a] flex items-center justify-center">
                <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
            )}

            {/* Selection checkbox overlay - only visible in select mode */}
            {isSelectMode && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.();
                }}
                className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#4A8FE7] border-[#4A8FE7]'
                    : 'border-white/50 bg-black/30 hover:border-white'
                }`}
              >
                {isSelected && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <h3 className="text-white font-medium text-sm truncate">{project.name}</h3>
          <p className="text-[10px] text-[#636366] mt-0.5">
            {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Draft'}
          </p>
        </button>

        {/* Menu button - hidden in select mode */}
        {!isSelectMode && (
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
        )}

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
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1C1C1E] rounded-xl transition-all text-left group"
      >
        {/* Selection checkbox - only visible in select mode */}
        {isSelectMode && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
              isSelected
                ? 'bg-[#4A8FE7] border-[#4A8FE7]'
                : 'border-[#48484A] hover:border-[#8E8E93]'
            }`}
          >
            {isSelected && (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}

        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden">
          {project.thumbnailUrl ? (
            <img
              src={project.thumbnailUrl}
              alt={project.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#3b82f6] to-[#1e3a8a] flex items-center justify-center">
              <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
          )}
        </div>

        {/* Project info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{project.name}</h3>
          <p className="text-xs text-[#636366] mt-0.5">
            {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Draft'}
          </p>
        </div>

        {/* Horizontal menu button - always visible on mobile, hidden in select mode */}
        {!isSelectMode && (
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
        )}
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
