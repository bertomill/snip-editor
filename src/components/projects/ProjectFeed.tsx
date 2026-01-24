'use client';

import { useMemo, useState } from 'react';
import { Project } from '@/types/project';
import { ProjectCard } from './ProjectCard';
import { useProjects } from '@/contexts/ProjectsContext';

interface ProjectFeedProps {
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
}

type ProjectFilter = 'all' | 'yours' | 'shared';

const filterLabels: Record<ProjectFilter, string> = {
  all: 'All projects',
  yours: 'Your projects',
  shared: 'Shared with you',
};

export function ProjectFeed({ onSelectProject, onCreateProject }: ProjectFeedProps) {
  const { projects, isLoading, deleteProject } = useProjects();
  const [deleteConfirm, setDeleteConfirm] = useState<{ projectId: string; projectName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [actionProject, setActionProject] = useState<Project | null>(null);

  // Filter projects by search query and ownership filter
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply ownership filter (for now, all projects are "yours" - shared will come later)
    if (projectFilter === 'shared') {
      filtered = []; // No shared projects yet
    }
    // 'yours' and 'all' show all projects for now

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [projects, searchQuery, projectFilter]);

  const handleDeleteClick = (projectId: string, projectName: string) => {
    setDeleteConfirm({ projectId, projectName });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await deleteProject(deleteConfirm.projectId);
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 pt-4">
        <div className="animate-pulse space-y-4">
          {/* Search skeleton */}
          <div className="h-12 bg-[var(--background-card)] rounded-xl" />
          {/* Filter pills skeleton */}
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-9 w-24 bg-[var(--background-card)] rounded-full" />
            ))}
          </div>
          {/* Cards skeleton */}
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 p-3">
              <div className="w-16 h-16 bg-[var(--background-card)] rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[var(--background-card)] rounded w-1/3" />
                <div className="h-3 bg-[var(--background-card)] rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (projects.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto text-center px-4 py-20">
        <div className="w-20 h-20 rounded-full bg-[var(--background-card)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">No projects yet</h2>
        <p className="text-[var(--text-secondary)] mb-8">
          Create your first video project to get started
        </p>
        <button
          onClick={onCreateProject}
          className="btn-primary px-6 py-3"
        >
          Create project
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-2 pb-24">
      {/* Header - Project Filter Dropdown */}
      <div className="relative mb-4">
        <button
          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          className="flex items-center gap-2 group"
        >
          <h1 className="text-2xl font-bold text-white">{filterLabels[projectFilter]}</h1>
          <svg
            className={`w-5 h-5 text-white/70 group-hover:text-white transition-all ${showFilterDropdown ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Filter Dropdown Menu */}
        {showFilterDropdown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowFilterDropdown(false)}
            />
            <div className="absolute left-0 top-full mt-2 w-56 bg-[#2C2C2E] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in">
              {(['all', 'yours', 'shared'] as ProjectFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => {
                    setProjectFilter(filter);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    projectFilter === filter
                      ? 'bg-[#4A8FE7]/10 text-[#4A8FE7]'
                      : 'text-white hover:bg-white/5'
                  }`}
                >
                  <span className="font-medium">{filterLabels[filter]}</span>
                  {projectFilter === filter && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Search Bar with gradient border */}
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600 p-[1px]">
          <div className="w-full h-full rounded-xl bg-[#1a1a2e]" />
        </div>
        <div className="relative flex items-center">
          <svg
            className="absolute left-4 w-5 h-5 text-[#8E8E93]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search across all content"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-white placeholder-[#8E8E93] pl-12 pr-4 py-3 rounded-xl focus:outline-none text-[15px]"
          />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {['Type', 'Category', 'Owner', 'Date'].map((filter) => (
          <button
            key={filter}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--background-card)] border border-[var(--border)] rounded-full text-white text-sm font-medium hover:bg-[var(--background-card-hover)] transition-colors whitespace-nowrap"
          >
            {filter}
            <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ))}
      </div>

      {/* Recents Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Recents</h2>
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          className="p-2 hover:bg-[var(--background-card)] rounded-lg transition-colors"
        >
          {viewMode === 'list' ? (
            <svg className="w-5 h-5 text-white/70" fill="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="8" height="8" rx="1" />
              <rect x="13" y="3" width="8" height="8" rx="1" />
              <rect x="3" y="13" width="8" height="8" rx="1" />
              <rect x="13" y="13" width="8" height="8" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white/70" fill="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <rect x="3" y="10" width="18" height="4" rx="1" />
              <rect x="3" y="16" width="18" height="4" rx="1" />
            </svg>
          )}
        </button>
      </div>

      {/* Project List */}
      {viewMode === 'list' ? (
        <div className="space-y-1">
          {filteredProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onSelectProject(project.id)}
              onDelete={() => handleDeleteClick(project.id, project.name)}
              onShowActions={setActionProject}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onSelectProject(project.id)}
              onDelete={() => handleDeleteClick(project.id, project.name)}
              onShowActions={setActionProject}
              variant="grid"
            />
          ))}
        </div>
      )}

      {/* No results */}
      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          {projectFilter === 'shared' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[var(--background-card)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <p className="text-white font-medium mb-1">No shared projects yet</p>
              <p className="text-[#8E8E93] text-sm">Projects shared with you will appear here</p>
            </>
          ) : searchQuery ? (
            <p className="text-[#8E8E93]">No projects found for "{searchQuery}"</p>
          ) : null}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleDeleteCancel}
          />

          {/* Modal */}
          <div className="relative bg-[#1C1C1E] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            {/* Icon */}
            <div className="flex justify-center pt-6">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pt-4 pb-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">Delete Project?</h3>
              <p className="text-[#8E8E93] text-sm">
                Are you sure you want to delete <span className="text-white font-medium">"{deleteConfirm.projectName}"</span>? This action cannot be undone.
              </p>
            </div>

            {/* Actions */}
            <div className="flex border-t border-[var(--border)]">
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="flex-1 py-3.5 text-[#4A8FE7] font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <div className="w-px bg-[var(--border)]" />
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 py-3.5 text-red-500 font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Actions Bottom Drawer */}
      {actionProject && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setActionProject(null)}
          />

          {/* Drawer */}
          <div className="absolute bottom-0 left-0 right-0 bg-[#1C1C1E] rounded-t-2xl animate-slide-up safe-area-bottom">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Project Info */}
            <div className="flex items-center gap-3 px-4 pb-4 border-b border-[var(--border)]">
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                {actionProject.thumbnailUrl ? (
                  <img
                    src={actionProject.thumbnailUrl}
                    alt={actionProject.name}
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
              <div className="min-w-0 flex-1">
                <h3 className="text-white font-medium truncate">{actionProject.name}</h3>
                <p className="text-[#8E8E93] text-sm">Video</p>
              </div>
            </div>

            {/* Action Options */}
            <div className="py-2">
              {/* Open */}
              <button
                onClick={() => {
                  onSelectProject(actionProject.id);
                  setActionProject(null);
                }}
                className="w-full flex items-center gap-4 px-4 py-3.5 text-white hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                <span className="text-[15px]">Open</span>
              </button>

              {/* Share */}
              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 text-white hover:bg-white/5 active:bg-white/10 transition-colors opacity-50"
                disabled
              >
                <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                <span className="text-[15px]">Share</span>
                <span className="text-xs text-[#8E8E93] ml-auto">Coming soon</span>
              </button>

              {/* Copy link */}
              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 text-white hover:bg-white/5 active:bg-white/10 transition-colors opacity-50"
                disabled
              >
                <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                <span className="text-[15px]">Copy link</span>
                <span className="text-xs text-[#8E8E93] ml-auto">Coming soon</span>
              </button>

              {/* Make a copy */}
              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 text-white hover:bg-white/5 active:bg-white/10 transition-colors opacity-50"
                disabled
              >
                <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
                <span className="text-[15px]">Make a copy</span>
                <span className="text-xs text-[#8E8E93] ml-auto">Coming soon</span>
              </button>

              {/* Download */}
              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 text-white hover:bg-white/5 active:bg-white/10 transition-colors opacity-50"
                disabled
              >
                <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span className="text-[15px]">Download</span>
                <span className="text-xs text-[#8E8E93] ml-auto">Coming soon</span>
              </button>

              {/* Divider */}
              <div className="my-2 border-t border-[var(--border)]" />

              {/* Delete */}
              <button
                onClick={() => {
                  handleDeleteClick(actionProject.id, actionProject.name);
                  setActionProject(null);
                }}
                className="w-full flex items-center gap-4 px-4 py-3.5 text-red-400 hover:bg-red-400/5 active:bg-red-400/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-[15px]">Delete</span>
              </button>
            </div>

            {/* Cancel button */}
            <div className="px-4 pb-4 pt-2">
              <button
                onClick={() => setActionProject(null)}
                className="w-full py-3.5 bg-[#2C2C2E] text-white font-medium rounded-xl hover:bg-[#3C3C3E] active:bg-[#4C4C4E] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
