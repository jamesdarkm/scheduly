import api from './axiosInstance';

export const listComments = (postId) =>
  api.get('/comments', { params: { postId } }).then(r => r.data);

export const addComment = (postId, body) =>
  api.post('/comments', { postId, body }).then(r => r.data);

export const updateComment = (id, body) =>
  api.put(`/comments/${id}`, { body }).then(r => r.data);

export const deleteComment = (id) =>
  api.delete(`/comments/${id}`).then(r => r.data);
