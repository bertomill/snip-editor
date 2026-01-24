'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Project } from '@/types/project';
import { useUser } from '@/lib/supabase/hooks';

interface ProjectsContextValue {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
  createProject: (name: string) => Promise<Project | null>;
  updateProject: (id: string, data: Partial<Project>) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch projects from API
  const refreshProjects = useCallback(async () => {
    if (!user?.id) {
      setProjects([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/projects');
      const data = await response.json();

      if (response.ok) {
        setProjects(data.projects || []);
      } else {
        setError(data.error || 'Failed to fetch projects');
      }
    } catch (err) {
      setError('Failed to fetch projects');
      console.error('Error fetching projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Create a new project
  const createProject = useCallback(async (name: string): Promise<Project | null> => {
    if (!user?.id) {
      setError('You must be logged in to create projects');
      return null;
    }

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (response.ok && data.project) {
        setProjects(prev => [data.project, ...prev]);
        return data.project;
      } else {
        setError(data.error || 'Failed to create project');
        return null;
      }
    } catch (err) {
      setError('Failed to create project');
      console.error('Error creating project:', err);
      return null;
    }
  }, [user?.id]);

  // Update a project
  const updateProject = useCallback(async (id: string, data: Partial<Project>): Promise<boolean> => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...result.project } : p));
        return true;
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to update project');
        return false;
      }
    } catch (err) {
      setError('Failed to update project');
      console.error('Error updating project:', err);
      return false;
    }
  }, []);

  // Delete a project
  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setProjects(prev => prev.filter(p => p.id !== id));
        return true;
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete project');
        return false;
      }
    } catch (err) {
      setError('Failed to delete project');
      console.error('Error deleting project:', err);
      return false;
    }
  }, []);

  // Load projects on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      refreshProjects();
    }
  }, [user?.id, refreshProjects]);

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        isLoading,
        error,
        refreshProjects,
        createProject,
        updateProject,
        deleteProject,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
}
