import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPost } from '../api/postsApi';
import { listMedia, uploadMedia } from '../api/mediaApi';
import { listAccounts } from '../api/socialApi';
import { useAuth } from '../context/AuthContext';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Image, X, Upload, Film, GripVertical, Plus,
} from 'lucide-react';
import { FacebookIcon as Facebook, InstagramIcon as Instagram } from '../components/common/SocialIcons';
import clsx from 'clsx';

const IG_LIMIT = 2200;
const FB_LIMIT = 63206;

function MediaPickerModal({ onSelect, onClose }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const { data, isLoading } = useQuery({
    queryKey: ['media', 1, ''],
    queryFn: () => listMedia({ page: 1, limit: 48 }),
  });

  const toggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const items = data?.data || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Select Media</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-center text-gray-400 py-8">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No media files. Upload some first!</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {items.map(item => {
                const isVideo = item.mimeType.startsWith('video/');
                const selected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={clsx(
                      'relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition',
                      selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'
                    )}
                  >
                    {isVideo ? (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <Film className="w-6 h-6 text-gray-400" />
                      </div>
                    ) : (
                      <img
                        src={item.thumbnailUrl || item.url}
                        alt={item.originalName}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {selected && (
                      <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{selectedIds.indexOf(item.id) + 1}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-gray-200">
          <span className="text-sm text-gray-500">{selectedIds.length} selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
            <button
              onClick={() => { onSelect(selectedIds, items.filter(i => selectedIds.includes(i.id))); onClose(); }}
              disabled={selectedIds.length === 0}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Attach Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PostCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachedMedia, setAttachedMedia] = useState([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState([]);

  const { data: socialAccounts = [] } = useQuery({
    queryKey: ['socialAccounts'],
    queryFn: listAccounts,
  });
  const activeAccounts = socialAccounts.filter(a => a.isActive);

  const createMutation = useMutation({
    mutationFn: createPost,
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post created!');
      navigate(`/posts/${post.id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to create post');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: uploadMedia,
    onSuccess: (uploaded) => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setAttachedMedia(prev => [...prev, ...uploaded]);
      toast.success('Files uploaded & attached');
    },
    onError: () => toast.error('Upload failed'),
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => uploadMutation.mutate(files),
    accept: {
      'image/jpeg': [], 'image/png': [], 'image/gif': [], 'image/webp': [],
      'video/mp4': [], 'video/quicktime': [],
    },
    noClick: true,
    noKeyboard: true,
  });

  const handleMediaSelect = (ids, items) => {
    const existing = new Set(attachedMedia.map(m => m.id));
    const newItems = items.filter(i => !existing.has(i.id));
    setAttachedMedia(prev => [...prev, ...newItems]);
  };

  const removeAttachment = (id) => {
    setAttachedMedia(prev => prev.filter(m => m.id !== id));
  };

  const handleSubmit = (asDraft = true) => {
    if (!content.trim()) {
      toast.error('Content is required');
      return;
    }
    createMutation.mutate({
      title: title || undefined,
      content,
      mediaIds: attachedMedia.map(m => m.id),
      targetAccountIds: selectedTargets,
    });
  };

  const charCount = content.length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create Post</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Internal reference title"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={8}
                placeholder="Write your post content here..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-y"
              />
              <div className="flex justify-end gap-4 mt-1">
                <span className={clsx('text-xs', charCount > IG_LIMIT ? 'text-red-500' : 'text-gray-400')}>
                  IG: {charCount}/{IG_LIMIT}
                </span>
                <span className={clsx('text-xs', charCount > FB_LIMIT ? 'text-red-500' : 'text-gray-400')}>
                  FB: {charCount}/{FB_LIMIT}
                </span>
              </div>
            </div>
          </div>

          {/* Media attachments */}
          <div className="bg-white rounded-xl border border-gray-200 p-5" {...getRootProps()}>
            <input {...getInputProps()} />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Media</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowMediaPicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                >
                  <Image className="w-3.5 h-3.5" />
                  From Library
                </button>
                <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  Upload New
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/gif,image/webp,video/mp4"
                    onChange={e => uploadMutation.mutate([...e.target.files])}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {uploadMutation.isPending && (
              <div className="text-center py-3 text-sm text-blue-600">Uploading...</div>
            )}

            {attachedMedia.length === 0 ? (
              <div className={clsx(
                'border-2 border-dashed rounded-lg p-8 text-center transition',
                isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              )}>
                <Image className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Drag & drop files here or use the buttons above</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {attachedMedia.map((item, idx) => {
                  const isVideo = item.mimeType.startsWith('video/');
                  return (
                    <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden group border border-gray-200">
                      {isVideo ? (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Film className="w-6 h-6 text-gray-400" />
                        </div>
                      ) : (
                        <img src={item.thumbnailUrl || item.url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeAttachment(item.id); }}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                        <span className="text-white text-xs">{idx + 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleSubmit(true)}
                disabled={createMutation.isPending || !content.trim()}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {createMutation.isPending ? 'Saving...' : 'Save as Draft'}
              </button>
            </div>
          </div>

          {/* Publish Targets */}
          {activeAccounts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Publish To</h3>
              <div className="space-y-2">
                {activeAccounts.map(account => {
                  const checked = selectedTargets.includes(account.id);
                  const isFB = account.platform === 'facebook_page';
                  return (
                    <label
                      key={account.id}
                      className={clsx(
                        'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition',
                        checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedTargets(prev =>
                            prev.includes(account.id) ? prev.filter(id => id !== account.id) : [...prev, account.id]
                          );
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className={clsx(
                        'w-7 h-7 rounded-full flex items-center justify-center',
                        isFB ? 'bg-blue-100' : 'bg-pink-100'
                      )}>
                        {isFB ? <Facebook className="w-3.5 h-3.5 text-blue-600" /> : <Instagram className="w-3.5 h-3.5 text-pink-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{account.accountName}</p>
                        <p className="text-[10px] text-gray-400">{isFB ? 'Facebook Page' : 'Instagram'}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Preview</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {attachedMedia.length > 0 && (
                <div className="aspect-square bg-gray-100">
                  {attachedMedia[0].mimeType.startsWith('video/') ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-12 h-12 text-gray-400" />
                    </div>
                  ) : (
                    <img
                      src={attachedMedia[0].url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}
              <div className="p-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-6">
                  {content || 'Your post content will appear here...'}
                </p>
              </div>
            </div>
            {attachedMedia.length > 1 && (
              <p className="text-xs text-gray-400 mt-2">+{attachedMedia.length - 1} more media file{attachedMedia.length > 2 ? 's' : ''}</p>
            )}
          </div>
        </div>
      </div>

      {showMediaPicker && (
        <MediaPickerModal
          onSelect={handleMediaSelect}
          onClose={() => setShowMediaPicker(false)}
        />
      )}
    </div>
  );
}
