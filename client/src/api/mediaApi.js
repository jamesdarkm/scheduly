import api from './axiosInstance';

export const listMedia = (params) =>
  api.get('/media', { params }).then(r => r.data);

export const uploadMedia = (files) => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  return api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const deleteMedia = (id) =>
  api.delete(`/media/${id}`).then(r => r.data);
