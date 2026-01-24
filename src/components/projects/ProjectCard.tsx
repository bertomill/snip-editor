'use client';

import { useState } from 'react';
import { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project, onClick, onDelete }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  // Format relative date
  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete();
  };

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className="w-full flex items-center gap-4 p-4 bg-[var(--background-card)] hover:bg-[var(--background-card-hover)] border border-[var(--border-subtle)] hover:border-[var(--border)] rounded-2xl transition-all text-left group"
      >
        {/* Thumbnail or gradient placeholder */}
        <div className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden">
          {project.thumbnailUrl ? (
            <img
              src={project.thumbnailUrl}
              alt={project.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#4A8FE7] to-[#6366F1] flex items-center justify-center">
              <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
          )}
        </div>

        {/* Project info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{project.name}</h3>
          <p className="text-[#8E8E93] text-sm">
            {formatRelativeDate(project.updatedAt)}
            {project.clipCount > 0 && (
              <span className="text-[#636366]"> · {project.clipCount} clip{project.clipCount !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>

        {/* Menu button */}
        <div
          onClick={handleMenuClick}
          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--background-elevated)] transition-all"
        >
          <svg className="w-5 h-5 text-[#8E8E93]" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="6" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="18" r="2" />
          </svg>
        </div>
      </button>

      {/* Context menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-4 top-14 w-40 bg-[var(--background-card)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden">
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
