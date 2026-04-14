import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listComments, addComment, deleteComment } from '../../api/commentsApi';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export default function CommentThread({ postId }) {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => listComments(postId),
  });

  const addMut = useMutation({
    mutationFn: (text) => addComment(postId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      setBody('');
    },
    onError: () => toast.error('Failed to post comment'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      toast.success('Comment deleted');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    addMut.mutate(body.trim());
  };

  const canComment = hasRole('admin', 'manager', 'editor');

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center gap-2 p-4 border-b border-gray-100">
        <MessageSquare className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-700">Comments ({comments.length})</h3>
      </div>

      {/* Comment list */}
      <div className="divide-y divide-gray-50">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-400">Loading...</div>
        ) : comments.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No comments yet.</div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="p-4 hover:bg-gray-50/50">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-blue-700">
                    {comment.userName.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{comment.userName}</span>
                    <span className={clsx(
                      'px-1.5 py-0 rounded text-[10px] font-medium',
                      comment.userRole === 'admin' ? 'bg-red-50 text-red-600' :
                      comment.userRole === 'manager' ? 'bg-blue-50 text-blue-600' :
                      'bg-gray-50 text-gray-500'
                    )}>
                      {comment.userRole}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{comment.body}</p>
                </div>
                {(comment.userId === user?.id || hasRole('admin', 'manager')) && (
                  <button
                    onClick={() => deleteMut.mutate(comment.id)}
                    className="p-1 rounded text-gray-300 hover:text-red-500 transition flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add comment */}
      {canComment && (
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              type="submit"
              disabled={!body.trim() || addMut.isPending}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
