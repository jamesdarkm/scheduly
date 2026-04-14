import api from './axiosInstance';

export const listAccounts = () =>
  api.get('/social/accounts').then(r => r.data);

export const startFacebookAuth = (teamId) =>
  api.get('/social/auth/facebook', { params: { teamId } }).then(r => r.data);

export const disconnectAccount = (id) =>
  api.delete(`/social/accounts/${id}`).then(r => r.data);

export const reconnectAccount = (id) =>
  api.post(`/social/accounts/${id}/reconnect`).then(r => r.data);
