import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPost, updatePost } from '../api/postsApi';
import { listMedia, uploadMedia } from '../api/mediaApi';
import { listAccounts } from '../api/socialApi';
import { useAuth } from '../context/AuthContext';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Image, X, Upload, Film,
} from 'lucide-react';
import { FacebookIcon as Facebook, InstagramIcon as Instagram } from '../components/common/SocialIcons';
import clsx from 'clsx';

const IG_LIMIT = 2200;
const FB_LIMIT = 63206;

function MediaPickerModal({ onSelect, onClose }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const { data } = useQuery({
    queryKey: ['media', 1, ''],
    queryFn: () => listMedia({ page: 1, limit: 48 }),
  });
  const items = data?.data || [];
  const toggle = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Select Media</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {items.map(item => {
              const isVideo = item.mimeType.startsWith('video/');
              const selected = selectedIds.includes(item.id);
              return (
                <div key={item.id} onClick={() => toggle(item.id)}
                  className={clsx('relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2', selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300')}>
                  {isVideo ? <div className="w-full h-full bg-gray-200 flex items-center justify-center"><Film className="w-6 h-6 text-gray-400" /></div>
                    : <img src={item.thumbnailUrl || item.url} alt="" className="w-full h-full object-cover" />}
                  {selected && <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><span className="text-white text-xs font-bold">{selectedIds.indexOf(item.id) + 1}</span></div>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm text-gray-500">{selectedIds.length} selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={() => { onSelect(selectedIds, items.filter(i => selectedIds.includes(i.id))); onClose(); }}
              disabled={!selectedIds.length} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50">Attach</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PostEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: post, isLoading } = useQuery({ queryKey: ['post', id], queryFn: () => getPost(id) });
  const { data: socialAccounts = [] } = useQuery({ queryKey: ['socialAccounts'], queryFn: listAccounts });
  const activeAccounts = socialAccounts.filter(a => a.isActive);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachedMedia, setAttachedMedia] = useState([]);
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  useEffect(() => {
    if (post) {
      setTitle(post.title || '');
      setContent(post.content || '');
      setAttachedMedia(post.media || []);
      setSelectedTargets(post.targets?.map(t => t.socialAccountId) || []);
    }
  }, [post]);

  const updateMut = useMutation({
    mutationFn: (data) => updatePost(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post updated');
      navigate(`/posts/${id}`);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update'),
  });

  const uploadMut = useMutation({
    mutationFn: uploadMedia,
    onSuccess: (uploaded) => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setAttachedMedia(prev => [...prev, ...uploaded]);
      toast.success('Uploaded');
    },
  });

  const handleSave = () => {
    if (!content.trim()) { toast.error('Content is required'); return; }
    updateMut.mutate({
      title: title || undefined,
      content,
      mediaIds: attachedMedia.map(m => m.id),
    });
  };

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!post) return <div className="text-center py-12 text-red-500">Post not found</div>;

  const charCount = content.length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Post</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Internal reference title"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={8} placeholder="Post content..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-y" />
              <div className="flex justify-end gap-4 mt-1">
                <span className={clsx('text-xs', charCount > IG_LIMIT ? 'text-red-500' : 'text-gray-400')}>IG: {charCount}/{IG_LIMIT}</span>
                <span className={clsx('text-xs', charCount > FB_LIMIT ? 'text-red-500' : 'text-gray-400')}>FB: {charCount}/{FB_LIMIT}</span>
              </div>
            </div>
          </div>

          {/* Media */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Media</h3>
              <div className="flex gap-2">
                <button onClick={() => setShowMediaPicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                  <Image className="w-3.5 h-3.5" /> From Library
                </button>
                <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Upload
                  <input type="file" multiple accept="image/*,video/mp4" onChange={e => uploadMut.mutate([...e.target.files])} className="hidden" />
                </label>
              </div>
            </div>
            {attachedMedia.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-400">No media attached</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {attachedMedia.map((item, idx) => (
                  <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden group border border-gray-200">
                    {item.mimeType?.startsWith('video/') ? (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center"><Film className="w-6 h-6 text-gray-400" /></div>
                    ) : (
                      <img src={item.thumbnailUrl || item.url} alt="" className="w-full h-full object-cover" />
                    )}
                    <button onClick={() => setAttachedMedia(prev => prev.filter(m => m.id !== item.id))}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Actions</h3>
            <button onClick={handleSave} disabled={updateMut.isPending || !content.trim()}
              className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {updateMut.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {activeAccounts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Publish To</h3>
              <div className="space-y-2">
                {activeAccounts.map(account => {
                  const checked = selectedTargets.includes(account.id);
                  const isFB = account.platform === 'facebook_page';
                  return (
                    <label key={account.id} className={clsx('flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer', checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50')}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setSelectedTargets(prev => prev.includes(account.id) ? prev.filter(i => i !== account.id) : [...prev, account.id])}
                        className="w-4 h-4 text-blue-600 rounded" />
                      <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center', isFB ? 'bg-blue-100' : 'bg-pink-100')}>
                        {isFB ? <Facebook className="w-3.5 h-3.5 text-blue-600" /> : <Instagram className="w-3.5 h-3.5 text-pink-600" />}
                      </div>
                      <p className="text-xs font-medium text-gray-800 truncate">{account.accountName}</p>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showMediaPicker && (
        <MediaPickerModal
          onSelect={(ids, items) => {
            const existing = new Set(attachedMedia.map(m => m.id));
            setAttachedMedia(prev => [...prev, ...items.filter(i => !existing.has(i.id))]);
          }}
          onClose={() => setShowMediaPicker(false)}
        />
      )}
    </div>
  );
}
