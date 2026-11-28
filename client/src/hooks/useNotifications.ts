import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { createSocket } from './useSocket';
import { useSettings } from '../context/SettingsContext';
import { soundEffects } from '../lib/sound';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  reference_type?: string | null;
  reference_id?: string | null;
  is_read: boolean;
  created_at: string;
};

export function useNotifications(enabled = true) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { pushNotifs, msgAlerts } = useSettings();

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(Number(response.data.unread_count || 0));
    } catch {
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
    if (!enabled || !(localStorage.getItem('skillswap_token') || sessionStorage.getItem('skillswap_token'))) return undefined;
    const socket = createSocket();
    const onNotification = (item: NotificationItem) => {
      setNotifications((current) => [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 50));
      setUnreadCount((current) => current + (item.is_read ? 0 : 1));

      const isMessage = (item.type || '').toUpperCase().includes('MESSAGE');
      if (isMessage) {
        if (!msgAlerts) return;
        soundEffects.playMessageSound();
        toast(item.title || 'New Message', {
          id: `notif-${item.id}`,
          description: item.message,
          action: {
            label: 'Open Chat',
            onClick: () => {
              if (item.reference_id) {
                navigate(`/messages/${item.reference_id}`);
              } else {
                navigate('/messages');
              }
            },
          },
        });
      } else {
        if (!pushNotifs) return;
        soundEffects.playNotificationSound();
        const type = (item.type || '').toUpperCase();
        let actionLabel = 'View';
        let actionUrl = '/notifications';
        if (type.includes('SWAP')) {
          actionLabel = 'View Swap';
          actionUrl = '/swaps';
        } else if (type.includes('REVIEW')) {
          actionLabel = 'View Reviews';
          actionUrl = '/ratings';
        }
        toast(item.title || 'Notification', {
          id: `notif-${item.id}`,
          description: item.message,
          action: {
            label: actionLabel,
            onClick: () => {
              navigate(actionUrl);
            },
          },
        });
      }
    };
    socket.on('notification', onNotification);
    socket.connect();
    return () => {
      socket.off('notification', onNotification);
      socket.disconnect();
    };
  }, [enabled, load, pushNotifs, msgAlerts, navigate]);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      toast.error('Unable to mark notification as read.');
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch {
      toast.error('Unable to update notifications.');
    }
  };

  return { notifications, unreadCount, loading, reload: load, markRead, markAllRead };
}
