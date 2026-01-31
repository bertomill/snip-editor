'use client';

import { useState, useEffect, useMemo } from 'react';
import { Idea, SOCIAL_PLATFORMS } from '@/types/feeds';

interface StatsProps {
  ideas?: Idea[];
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

export function Stats({ ideas = [] }: StatsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [isLoading, setIsLoading] = useState(false);

  // Filter ideas based on time range
  const filteredIdeas = useMemo(() => {
    if (timeRange === 'all') return ideas;

    const now = new Date();
    const daysMap: Record<TimeRange, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      'all': 0,
    };
    const days = daysMap[timeRange];
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return ideas.filter(idea => new Date(idea.createdAt) >= cutoff);
  }, [ideas, timeRange]);

  // Calculate stats
  const stats = useMemo(() => {
    const published = filteredIdeas.filter(i => i.status === 'published');
    const drafts = filteredIdeas.filter(i => i.status === 'draft');
    const inProgress = filteredIdeas.filter(i => i.status === 'in_progress');

    // Posts per day calculation
    const publishedWithDates = published.filter(p => p.publishedAt);
    const postsPerDay: Record<string, number> = {};

    publishedWithDates.forEach(post => {
      const date = new Date(post.publishedAt!).toISOString().split('T')[0];
      postsPerDay[date] = (postsPerDay[date] || 0) + 1;
    });

    // Get date range for chart
    const daysToShow = timeRange === 'all' ? 30 : parseInt(timeRange);
    const chartDates: string[] = [];
    const now = new Date();
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      chartDates.push(date.toISOString().split('T')[0]);
    }

    const chartData = chartDates.map(date => ({
      date,
      count: postsPerDay[date] || 0,
    }));

    // Platform breakdown
    const platformCounts: Record<string, number> = {};
    published.forEach(post => {
      (post.publishedPlatforms || []).forEach(platform => {
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      });
    });

    // Average posts per day (only counting days with posts)
    const daysWithPosts = Object.keys(postsPerDay).length;
    const avgPerDay = daysWithPosts > 0 ? published.length / daysWithPosts : 0;

    // Calculate streak
    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date();

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (postsPerDay[dateStr]) {
        currentStreak++;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      } else if (dateStr === today) {
        // Today hasn't ended yet, check yesterday
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      } else {
        break;
      }
    }

    return {
      total: filteredIdeas.length,
      published: published.length,
      drafts: drafts.length,
      inProgress: inProgress.length,
      avgPerDay,
      currentStreak,
      chartData,
      platformCounts,
      maxDailyCount: Math.max(...chartData.map(d => d.count), 1),
    };
  }, [filteredIdeas, timeRange]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Posting Stats</h3>
        <div className="flex items-center bg-[#2C2C2E] rounded-lg p-1">
          {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                timeRange === range
                  ? 'bg-[#10B981] text-white'
                  : 'text-[#8E8E93] hover:text-white'
              }`}
            >
              {range === 'all' ? 'All' : range}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#2C2C2E] rounded-xl p-4">
          <p className="text-xs text-[#8E8E93] mb-1">Total Ideas</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-[#10B981]/20 to-[#10B981]/5 border border-[#10B981]/30 rounded-xl p-4">
          <p className="text-xs text-[#10B981] mb-1">Published</p>
          <p className="text-2xl font-bold text-[#10B981]">{stats.published}</p>
        </div>
        <div className="bg-[#2C2C2E] rounded-xl p-4">
          <p className="text-xs text-[#8E8E93] mb-1">Avg/Day</p>
          <p className="text-2xl font-bold text-white">{stats.avgPerDay.toFixed(1)}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/30 rounded-xl p-4">
          <p className="text-xs text-orange-400 mb-1">Current Streak</p>
          <p className="text-2xl font-bold text-orange-400">{stats.currentStreak} days</p>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-[#2C2C2E] rounded-xl p-4">
        <p className="text-xs text-[#8E8E93] mb-3">Status Breakdown</p>
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#8E8E93]">Drafts</span>
              <span className="text-xs text-white">{stats.drafts}</span>
            </div>
            <div className="h-2 bg-[#1C1C1E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8E8E93] rounded-full transition-all"
                style={{ width: `${stats.total ? (stats.drafts / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#8E8E93]">In Progress</span>
              <span className="text-xs text-white">{stats.inProgress}</span>
            </div>
            <div className="h-2 bg-[#1C1C1E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F59E0B] rounded-full transition-all"
                style={{ width: `${stats.total ? (stats.inProgress / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#8E8E93]">Published</span>
              <span className="text-xs text-white">{stats.published}</span>
            </div>
            <div className="h-2 bg-[#1C1C1E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#10B981] rounded-full transition-all"
                style={{ width: `${stats.total ? (stats.published / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Posts Per Day Chart */}
      <div className="bg-[#2C2C2E] rounded-xl p-4">
        <p className="text-xs text-[#8E8E93] mb-4">Posts Per Day</p>
        <div className="h-40 flex items-end gap-1">
          {stats.chartData.map((day, idx) => (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full bg-[#10B981] rounded-t transition-all hover:bg-[#059669] cursor-pointer relative group"
                style={{
                  height: `${(day.count / stats.maxDailyCount) * 100}%`,
                  minHeight: day.count > 0 ? '4px' : '0',
                }}
              >
                {day.count > 0 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1C1C1E] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {day.count} post{day.count !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {(idx === 0 || idx === stats.chartData.length - 1 || idx === Math.floor(stats.chartData.length / 2)) && (
                <span className="text-[9px] text-[#636366] mt-1">{formatDate(day.date)}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Platform Breakdown */}
      {Object.keys(stats.platformCounts).length > 0 && (
        <div className="bg-[#2C2C2E] rounded-xl p-4">
          <p className="text-xs text-[#8E8E93] mb-3">Posts by Platform</p>
          <div className="space-y-2">
            {Object.entries(stats.platformCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([platform, count]) => {
                const platformConfig = SOCIAL_PLATFORMS.find(p => p.id === platform || p.name === platform);
                const total = Object.values(stats.platformCounts).reduce((a, b) => a + b, 0);
                return (
                  <div key={platform} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: platformConfig?.color || '#8E8E93' }}
                    >
                      {(platformConfig?.name || platform).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white">{platformConfig?.name || platform}</span>
                        <span className="text-xs text-[#8E8E93]">{count}</span>
                      </div>
                      <div className="h-1.5 bg-[#1C1C1E] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(count / total) * 100}%`,
                            backgroundColor: platformConfig?.color || '#8E8E93',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats.total === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No data yet</h3>
          <p className="text-[#8E8E93] max-w-sm">
            Start creating and publishing posts to see your stats here.
          </p>
        </div>
      )}
    </div>
  );
}
