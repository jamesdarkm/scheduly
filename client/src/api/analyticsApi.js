import api from './axiosInstance';

export const getOverviewAnalytics = (start, end) =>
  api.get('/analytics/overview', { params: { start, end } }).then(r => r.data);

export const getPostAnalytics = (postId) =>
  api.get(`/analytics/posts/${postId}`).then(r => r.data);

export const fetchInsights = (postTargetId) =>
  api.post(`/analytics/fetch/${postTargetId}`).then(r => r.data);
