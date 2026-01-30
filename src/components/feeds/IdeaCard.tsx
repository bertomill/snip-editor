'use client';

import { Idea, IDEA_STATUS_CONFIG } from '@/types/feeds';

interface IdeaCardProps {
  idea: Idea;
  onClick: () => void;
  onDelete?: () => void;
}

export function IdeaCard({ idea, onClick, onDelete }: IdeaCardProps) {
  const statusConfig = IDEA_STATUS_CONFIG[idea.status];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      onClick={onClick}
      className="group p-5 rounded-2xl cursor-pointer transition-all duration-300
        bg-white/[0.03] backdrop-blur-xl
        border border-white/[0.08]
        hover:bg-white/[0.06] hover:border-white/[0.12] hover:scale-[1.02]
        shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold text-white line-clamp-2 flex-1 leading-snug">{idea.title}</h3>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg transition-all"
          >
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Description */}
      {idea.description && (
        <p className="text-sm text-[#A1A1A6] line-clamp-3 mb-4 leading-relaxed">{idea.description}</p>
      )}

      {/* Media Preview */}
      {(idea.imageUrl || idea.videoUrl) && (
        <div className="mb-4 rounded-xl overflow-hidden bg-black/30 aspect-video flex items-center justify-center border border-white/5">
          {idea.imageUrl ? (
            <img
              src={idea.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : idea.videoUrl ? (
            <div className="text-[#636366] flex flex-col items-center gap-2">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-xs">Video</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Tags */}
      {idea.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {idea.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-[#10B981]/15 text-[#10B981] text-xs font-medium rounded-full border border-[#10B981]/20"
            >
              {tag}
            </span>
          ))}
          {idea.tags.length > 3 && (
            <span className="px-3 py-1 bg-white/5 text-[#8E8E93] text-xs font-medium rounded-full border border-white/10">
              +{idea.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
        <span
          className="px-3 py-1 text-xs font-medium rounded-full"
          style={{
            backgroundColor: `${statusConfig.color}15`,
            color: statusConfig.color,
            border: `1px solid ${statusConfig.color}30`,
          }}
        >
          {statusConfig.label}
        </span>
        <span className="text-xs text-[#636366]">{formatDate(idea.createdAt)}</span>
      </div>
    </div>
  );
}
