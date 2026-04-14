import api from './axiosInstance';

export const getCalendarEvents = (start, end) =>
  api.get('/calendar', { params: { start, end } }).then(r => r.data);
