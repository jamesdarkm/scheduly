import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTeams, getTeam, createTeam, deleteTeam, addTeamMember, removeTeamMember } from '../api/teamsApi';
import { listUsers } from '../api/usersApi';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Plus, Users, X, UserPlus, UserMinus, Trash2, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

function CreateTeamModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onCreate({ name, description });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create team');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Create Team</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddMemberModal({ teamId, existingMemberIds, onClose }) {
  const queryClient = useQueryClient();
  const { data: allUsers = [] } = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const availableUsers = allUsers.filter(u => u.isActive && !existingMemberIds.includes(u.id));

  const addMut = useMutation({
    mutationFn: (userId) => addTeamMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Member added');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add member'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Member</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {availableUsers.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">All users are already members.</p>
          ) : (
            <div className="space-y-1">
              {availableUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-700">{u.firstName[0]}{u.lastName[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => addMut.mutate(u.id)}
                    disabled={addMut.isPending}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const { data: teams = [], isLoading } = useQuery({ queryKey: ['teams'], queryFn: listTeams });

  const { data: selectedTeam } = useQuery({
    queryKey: ['team', selectedTeamId],
    queryFn: () => getTeam(selectedTeamId),
    enabled: !!selectedTeamId,
  });

  const createMut = useMutation({
    mutationFn: createTeam,
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setSelectedTeamId(team.id);
      toast.success('Team created');
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setSelectedTeamId(null);
      toast.success('Team deleted');
    },
  });

  const removeMemberMut = useMutation({
    mutationFn: ({ teamId, userId }) => removeTeamMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Member removed');
    },
  });

  const isAdmin = hasRole('admin');
  const canManageMembers = hasRole('admin', 'manager');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Team
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams list */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : teams.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No teams yet.</p>
            </div>
          ) : (
            teams.map(team => (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className={clsx(
                  'w-full text-left p-4 rounded-xl border transition flex items-center justify-between',
                  selectedTeamId === team.id
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{team.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))
          )}
        </div>

        {/* Team detail */}
        <div className="lg:col-span-2">
          {selectedTeam ? (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedTeam.name}</h2>
                  {selectedTeam.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{selectedTeam.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canManageMembers && (
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Add Member
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => { if (confirm(`Delete team "${selectedTeam.name}"?`)) deleteMut.mutate(selectedTeam.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Members ({selectedTeam.members?.length || 0})
                </h3>
                {selectedTeam.members?.length === 0 ? (
                  <p className="text-sm text-gray-400">No members yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedTeam.members?.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-700">
                              {member.firstName[0]}{member.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{member.firstName} {member.lastName}</p>
                            <p className="text-xs text-gray-400">{member.email} &middot; {member.role}</p>
                          </div>
                        </div>
                        {canManageMembers && (
                          <button
                            onClick={() => removeMemberMut.mutate({ teamId: selectedTeam.id, userId: member.id })}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition"
                          >
                            <UserMinus className="w-3 h-3" />
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">Select a team to view details</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(data) => createMut.mutateAsync(data)}
        />
      )}

      {showAddMember && selectedTeam && (
        <AddMemberModal
          teamId={selectedTeam.id}
          existingMemberIds={selectedTeam.members?.map(m => m.id) || []}
          onClose={() => setShowAddMember(false)}
        />
      )}
    </div>
  );
}
