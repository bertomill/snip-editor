'use client';

import { useState, useEffect } from 'react';
import { Idea, SOCIAL_PLATFORMS } from '@/types/feeds';

interface LibraryProps {
  onSelectPost?: (post: Idea) => void;
}

export function Library({ onSelectPost }: LibraryProps) {
  const [posts, setPosts] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Idea | null>(null);

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/library');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch library');
      }

      setPosts(data.posts || []);
    } catch (err) {
      console.error('Library fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getPlatformColor = (platformId: string) => {
    const platform = SOCIAL_PLATFORMS.find(p => p.id === platformId || p.name === platformId);
    return platform?.color || '#8E8E93';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchLibrary}
          className="px-4 py-2 bg-[#2C2C2E] text-white rounded-lg hover:bg-[#3C3C3E] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No published posts yet</h3>
        <p className="text-[#8E8E93] max-w-sm">
          When you publish posts, they&apos;ll appear here. The AI will use them to learn your style.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 mb-6">
        <div className="px-4 py-2 bg-[#2C2C2E] rounded-lg">
          <p className="text-xs text-[#8E8E93]">Total Posts</p>
          <p className="text-xl font-semibold text-white">{posts.length}</p>
        </div>
        <div className="flex-1">
          <p className="text-xs text-[#8E8E93] mb-1">
            AI uses your library to match your voice and style
          </p>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span className="text-xs text-purple-300">Context enabled for AI drafting</span>
          </div>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="grid gap-4">
        {posts.map((post) => (
          <div
            key={post.id}
            onClick={() => {
              setSelectedPost(selectedPost?.id === post.id ? null : post);
              onSelectPost?.(post);
            }}
            className={`p-4 rounded-xl cursor-pointer transition-all duration-200
              bg-white/[0.03] border
              ${selectedPost?.id === post.id
                ? 'border-[#10B981] bg-[#10B981]/5'
                : 'border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12]'
              }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-sm font-medium text-white flex-1">{post.title}</h3>
              <span className="text-xs text-[#636366]">
                {formatDate(post.publishedAt || post.updatedAt)}
              </span>
            </div>

            {/* Content Preview */}
            <p className="text-xs text-[#8E8E93] mb-3 line-clamp-2">
              {post.publishedContent || post.draftContent || post.description || 'No content'}
            </p>

            {/* Platforms */}
            {post.publishedPlatforms && post.publishedPlatforms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {post.publishedPlatforms.map((platform, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      backgroundColor: `${getPlatformColor(platform)}20`,
                      color: getPlatformColor(platform),
                    }}
                  >
                    {SOCIAL_PLATFORMS.find(p => p.id === platform || p.name === platform)?.name || platform}
                  </span>
                ))}
              </div>
            )}

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {post.tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-[#10B981]/15 text-[#10B981] text-[10px] font-medium rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                {post.tags.length > 3 && (
                  <span className="px-2 py-0.5 bg-white/5 text-[#636366] text-[10px] font-medium rounded-full">
                    +{post.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Expanded Content */}
            {selectedPost?.id === post.id && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-[#8E8E93] mb-2">Full content:</p>
                <div className="bg-[#1C1C1E] rounded-lg p-3 text-sm text-white whitespace-pre-wrap">
                  {post.publishedContent || post.draftContent || post.description || 'No content'}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
