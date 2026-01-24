'use client';

import { useMemo, useState } from 'react';
import { Project } from '@/types/project';
import { ProjectCard } from './ProjectCard';
import { useProjects } from '@/contexts/ProjectsContext';

interface ProjectFeedProps {
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
}

interface GroupedProjects {
  today: Project[];
  yesterday: Project[];
  lastWeek: Project[];
  lastMonth: Project[];
  older: Project[];
}

export function ProjectFeed({ onSelectProject, onCreateProject }: ProjectFeedProps) {
  const { projects, isLoading, deleteProject } = useProjects();
  const [deleteConfirm, setDeleteConfirm] = useState<{ projectId: string; projectName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Group projects by date
  const groupedProjects = useMemo((): GroupedProjects => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekAgoStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgoStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    const groups: GroupedProjects = {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    };

    projects.forEach(project => {
      const updatedAt = new Date(project.updatedAt);

      if (updatedAt >= todayStart) {
        groups.today.push(project);
      } else if (updatedAt >= yesterdayStart) {
        groups.yesterday.push(project);
      } else if (updatedAt >= weekAgoStart) {
        groups.lastWeek.push(project);
      } else if (updatedAt >= monthAgoStart) {
        groups.lastMonth.push(project);
      } else {
        groups.older.push(project);
      }
    });

    return groups;
  }, [projects]);

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
      <div className="w-full max-w-2xl mx-auto px-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 bg-[var(--background-card)] border border-[var(--border-subtle)] rounded-2xl">
              <div className="w-14 h-14 bg-[var(--background-elevated)] rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[var(--background-elevated)] rounded w-1/3" />
                <div className="h-3 bg-[var(--background-elevated)] rounded w-1/4" />
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

  // Render a section if it has projects
  const renderSection = (title: string, sectionProjects: Project[]) => {
    if (sectionProjects.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="category-label px-1">
          {title}
        </h3>
        <div className="space-y-2">
          {sectionProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onSelectProject(project.id)}
              onDelete={() => handleDeleteClick(project.id, project.name)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Projects</h1>
          <p className="text-[#8E8E93] text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        {/* Desktop only button */}
        <button
          onClick={onCreateProject}
          className="hidden sm:flex btn-primary px-4 py-2 text-sm items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>

      {/* Grouped project list */}
      {renderSection('Today', groupedProjects.today)}
      {renderSection('Yesterday', groupedProjects.yesterday)}
      {renderSection('Previous 7 Days', groupedProjects.lastWeek)}
      {renderSection('Previous 30 Days', groupedProjects.lastMonth)}
      {renderSection('Older', groupedProjects.older)}

      {/* Floating Action Button - desktop only (mobile uses bottom nav) */}
      <button
        onClick={onCreateProject}
        className="hidden md:flex fixed bottom-8 right-8 w-14 h-14 bg-[#4A8FE7] hover:bg-[#5A9FF7] rounded-full shadow-lg shadow-[#4A8FE7]/30 items-center justify-center transition-all hover:scale-105 active:scale-95 z-40"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

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
    </div>
  );
}
