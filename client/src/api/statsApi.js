import api from './axiosInstance';

export const getPostStats = () =>
  api.get('/posts/stats').then(r => r.data);
