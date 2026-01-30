'use client';

import { Idea, IdeaStatus, IDEA_STATUS_CONFIG } from '@/types/feeds';
import { IdeaCard } from './IdeaCard';

interface IdeaListProps {
  ideas: Idea[];
  isLoading: boolean;
  statusFilter: IdeaStatus | null;
  onStatusFilterChange: (status: IdeaStatus | null) => void;
  onSelectIdea: (idea: Idea) => void;
  onDeleteIdea: (id: string) => void;
  onCreateIdea: () => void;
}

const STATUS_OPTIONS: (IdeaStatus | null)[] = [null, 'draft', 'in_progress', 'published', 'archived'];

export function IdeaList({
  ideas,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  onSelectIdea,
  onDeleteIdea,
  onCreateIdea,
}: IdeaListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Status Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status || 'all'}
            onClick={() => onStatusFilterChange(status)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
              statusFilter === status
                ? 'bg-[#4A8FE7] text-white'
                : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
            }`}
          >
            {status ? IDEA_STATUS_CONFIG[status].label : 'All'}
          </button>
        ))}
      </div>

      {/* Ideas Grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-[#8E8E93]">Loading ideas...</p>
          </div>
        ) : ideas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[#2C2C2E] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white mb-1">No ideas yet</p>
            <p className="text-xs text-[#8E8E93] mb-4">Start capturing your content ideas</p>
            <button
              onClick={onCreateIdea}
              className="px-4 py-2 bg-[#4A8FE7] text-white text-sm font-medium rounded-lg hover:bg-[#3A7FD7] transition-colors"
            >
              Create First Idea
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onClick={() => onSelectIdea(idea)}
                onDelete={() => onDeleteIdea(idea.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Button (sticky at bottom when there are ideas) */}
      {ideas.length > 0 && (
        <div className="pt-3 border-t border-[#2C2C2E] mt-3">
          <button
            onClick={onCreateIdea}
            className="w-full py-3 bg-[#4A8FE7] text-white text-sm font-medium rounded-xl hover:bg-[#3A7FD7] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Idea
          </button>
        </div>
      )}
    </div>
  );
}
