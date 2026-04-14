import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAccounts, startFacebookAuth, disconnectAccount, reconnectAccount } from '../api/socialApi';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Link2, Unlink, RefreshCw,
  CheckCircle, AlertTriangle, XCircle, Plus,
} from 'lucide-react';
import { FacebookIcon as Facebook, InstagramIcon as Instagram } from '../components/common/SocialIcons';
import clsx from 'clsx';
import { format } from 'date-fns';

const platformConfig = {
  facebook_page: {
    label: 'Facebook Page',
    icon: Facebook,
    color: 'text-blue-600 bg-blue-50',
    iconColor: 'text-blue-600',
  },
  instagram_business: {
    label: 'Instagram',
    icon: Instagram,
    color: 'text-pink-600 bg-pink-50',
    iconColor: 'text-pink-600',
  },
};

const tokenStatusConfig = {
  valid: { label: 'Connected', icon: CheckCircle, color: 'text-green-600' },
  expiring: { label: 'Expiring Soon', icon: AlertTriangle, color: 'text-yellow-600' },
  expired: { label: 'Expired', icon: XCircle, color: 'text-red-600' },
};

export default function AccountsPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['socialAccounts'],
    queryFn: listAccounts,
  });

  // Handle OAuth callback params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected) {
      toast.success(`Successfully connected ${connected} account(s)!`);
      queryClient.invalidateQueries({ queryKey: ['socialAccounts'] });
      setSearchParams({});
    } else if (error) {
      const messages = {
        oauth_denied: 'Facebook authorization was denied',
        invalid_state: 'Invalid session. Please try again.',
        connection_failed: 'Failed to connect accounts. Please try again.',
      };
      toast.error(messages[error] || 'Connection failed');
      setSearchParams({});
    }
  }, [searchParams]);

  const connectMutation = useMutation({
    mutationFn: () => startFacebookAuth(),
    onSuccess: (data) => {
      // Redirect to Facebook OAuth
      window.location.href = data.authUrl;
    },
    onError: (err) => {
      if (!err.response?.data?.error?.includes('FB_APP_ID')) {
        toast.error('Failed to start connection. Check Facebook App settings.');
      } else {
        toast.error(err.response?.data?.error || 'Failed to start connection');
      }
    },
  });

  const disconnectMut = useMutation({
    mutationFn: disconnectAccount,
    onSuccess: () => {
      toast.success('Account disconnected');
      queryClient.invalidateQueries({ queryKey: ['socialAccounts'] });
    },
  });

  const reconnectMut = useMutation({
    mutationFn: reconnectAccount,
    onSuccess: () => {
      toast.success('Account reconnected');
      queryClient.invalidateQueries({ queryKey: ['socialAccounts'] });
    },
  });

  const isAdmin = hasRole('admin');
  const activeAccounts = accounts.filter(a => a.isActive);
  const inactiveAccounts = accounts.filter(a => !a.isActive);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Accounts</h1>
          <p className="text-gray-500 text-sm mt-1">Connect your Facebook Pages and Instagram accounts</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Facebook className="w-4 h-4" />
            {connectMutation.isPending ? 'Connecting...' : 'Connect Facebook'}
          </button>
        )}
      </div>

      {/* Setup instructions */}
      {accounts.length === 0 && !isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-6">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Facebook className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Connect Your Social Accounts</h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
            Connect your Facebook Page to start scheduling posts. Instagram Business accounts linked to your Facebook Pages will be automatically discovered.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left max-w-lg mx-auto">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Prerequisites:</h3>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Create a Facebook App at developers.facebook.com</li>
              <li>Add your App ID and Secret to the server .env file</li>
              <li>Set the OAuth redirect URI in your Facebook App settings</li>
              <li>Click "Connect Facebook" above to authorize</li>
            </ol>
          </div>
        </div>
      )}

      {/* Active accounts */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading accounts...</div>
      ) : activeAccounts.length > 0 && (
        <div className="space-y-3 mb-6">
          {activeAccounts.map(account => {
            const platform = platformConfig[account.platform] || platformConfig.facebook_page;
            const tokenStatus = tokenStatusConfig[account.tokenStatus] || tokenStatusConfig.valid;
            const PlatformIcon = platform.icon;
            const StatusIcon = tokenStatus.icon;

            return (
              <div
                key={account.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar/Icon */}
                  <div className="relative">
                    {account.profilePictureUrl ? (
                      <img
                        src={account.profilePictureUrl}
                        alt={account.accountName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className={clsx('w-12 h-12 rounded-full flex items-center justify-center', platform.color)}>
                        <PlatformIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className={clsx('absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center', platform.color)}>
                      <PlatformIcon className="w-3 h-3" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{account.accountName}</h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{platform.label}</span>
                      <span className="text-xs text-gray-300">|</span>
                      <div className="flex items-center gap-1">
                        <StatusIcon className={clsx('w-3 h-3', tokenStatus.color)} />
                        <span className={clsx('text-xs', tokenStatus.color)}>{tokenStatus.label}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Connected by {account.connectedByName} &middot; {format(new Date(account.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { if (confirm(`Disconnect ${account.accountName}?`)) disconnectMut.mutate(account.id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Inactive accounts */}
      {inactiveAccounts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Disconnected Accounts</h2>
          <div className="space-y-2">
            {inactiveAccounts.map(account => {
              const platform = platformConfig[account.platform] || platformConfig.facebook_page;
              const PlatformIcon = platform.icon;

              return (
                <div
                  key={account.id}
                  className="bg-gray-50 rounded-lg border border-gray-200 p-3 flex items-center justify-between opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center', platform.color)}>
                      <PlatformIcon className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-gray-600">{account.accountName}</span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => reconnectMut.mutate(account.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reconnect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
