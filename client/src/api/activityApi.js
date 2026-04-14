import api from './axiosInstance';

export const getRecentActivity = (params) =>
  api.get('/activity', { params }).then(r => r.data);
