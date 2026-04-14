import api from './axiosInstance';

export const listTeams = () =>
  api.get('/teams').then(r => r.data);

export const getTeam = (id) =>
  api.get(`/teams/${id}`).then(r => r.data);

export const createTeam = (data) =>
  api.post('/teams', data).then(r => r.data);

export const updateTeam = (id, data) =>
  api.put(`/teams/${id}`, data).then(r => r.data);

export const deleteTeam = (id) =>
  api.delete(`/teams/${id}`).then(r => r.data);

export const addTeamMember = (teamId, userId) =>
  api.post(`/teams/${teamId}/members`, { userId }).then(r => r.data);

export const removeTeamMember = (teamId, userId) =>
  api.delete(`/teams/${teamId}/members/${userId}`).then(r => r.data);
