'use client';

import { useMemo } from 'react';
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

  const handleDelete = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(projectId);
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 bg-[#1A1A1A] rounded-xl">
              <div className="w-14 h-14 bg-[#2A2A2A] rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#2A2A2A] rounded w-1/3" />
                <div className="h-3 bg-[#2A2A2A] rounded w-1/4" />
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
        <div className="w-20 h-20 rounded-full bg-[#1A1A1A] flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-[#636366]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">No projects yet</h2>
        <p className="text-[#8E8E93] mb-8">
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
        <h3 className="text-[#636366] text-xs font-semibold uppercase tracking-wider mb-3 px-1">
          {title}
        </h3>
        <div className="space-y-2">
          {sectionProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onSelectProject(project.id)}
              onDelete={() => handleDelete(project.id)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Projects</h1>
          <p className="text-[#8E8E93] text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onCreateProject}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
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
    </div>
  );
}
