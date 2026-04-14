import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOverviewAnalytics } from '../api/analyticsApi';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { Eye, Users, Heart, MessageSquare, Share2, MousePointer, TrendingUp, BarChart3 } from 'lucide-react';
import clsx from 'clsx';

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatNum(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export default function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState(30);

  const end = format(new Date(), 'yyyy-MM-dd');
  const start = format(subDays(startOfDay(new Date()), rangeDays), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'overview', start, end],
    queryFn: () => getOverviewAnalytics(start, end),
  });

  const summary = data?.summary || {};
  const posts = data?.posts || [];
  const daily = data?.daily || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Performance metrics for your published posts</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-md transition',
                rangeDays === r.days ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading analytics...</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard icon={Eye} label="Impressions" value={summary.totalImpressions} color="bg-blue-500" />
            <StatCard icon={Users} label="Reach" value={summary.totalReach} color="bg-blue-500" />
            <StatCard icon={Heart} label="Likes" value={summary.totalLikes} color="bg-pink-500" />
            <StatCard icon={TrendingUp} label="Avg Engagement" value={`${summary.avgEngagementRate?.toFixed(1) || 0}%`} color="bg-emerald-500" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard icon={MessageSquare} label="Comments" value={summary.totalComments} color="bg-amber-500" />
            <StatCard icon={Share2} label="Shares" value={summary.totalShares} color="bg-purple-500" />
            <StatCard icon={MousePointer} label="Clicks" value={summary.totalClicks} color="bg-cyan-500" />
            <StatCard icon={BarChart3} label="Posts" value={summary.totalPosts} color="bg-gray-500" />
          </div>

          {/* Charts */}
          {daily.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Impressions & Reach chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Impressions & Reach</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => format(new Date(v), 'MMM d')}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatNum} />
                    <Tooltip
                      labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')}
                      formatter={(value) => [value.toLocaleString(), undefined]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="reach" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Engagement chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Likes & Posts Published</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => format(new Date(v), 'MMM d')}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip
                      labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')}
                      formatter={(value) => [value.toLocaleString(), undefined]}
                    />
                    <Legend />
                    <Bar dataKey="likes" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="postsCount" fill="#8b5cf6" name="Posts" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Posts table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">Post Performance</h3>
            </div>

            {posts.length === 0 ? (
              <div className="p-12 text-center">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No published posts in this period</p>
                <p className="text-gray-400 text-sm mt-1">Publish posts to see performance data here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Post</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">Impressions</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">Reach</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">Likes</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">Comments</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-3">Shares</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-5 py-3">Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map(post => (
                      <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              {post.thumbnail ? (
                                <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                                  {post.postType?.[0]?.toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{post.title}</p>
                              {post.publishedAt && (
                                <p className="text-xs text-gray-400">{format(new Date(post.publishedAt), 'MMM d')}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700 text-right">{post.impressions.toLocaleString()}</td>
                        <td className="px-3 py-3 text-sm text-gray-700 text-right">{post.reach.toLocaleString()}</td>
                        <td className="px-3 py-3 text-sm text-gray-700 text-right">{post.likes.toLocaleString()}</td>
                        <td className="px-3 py-3 text-sm text-gray-700 text-right">{post.commentsCount.toLocaleString()}</td>
                        <td className="px-3 py-3 text-sm text-gray-700 text-right">{post.shares.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            post.engagementRate >= 5 ? 'bg-green-100 text-green-700' :
                            post.engagementRate >= 2 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          )}>
                            {post.engagementRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
