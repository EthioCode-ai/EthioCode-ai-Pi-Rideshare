import React, { useState, useEffect } from 'react';
import { Bell, Send, Users, User, Search, Filter, Trash2, Eye } from 'lucide-react';
import { apiUrl } from '../config/api.config';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  data: any;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

const PushNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    target: 'all' as 'all' | 'drivers' | 'riders' | 'single',
    userId: '',
    title: '',
    message: '',
    type: 'general'
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(apiUrl('api/admin/notifications'), {
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('authToken')
        }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async () => {
    if (!sendForm.title.trim() || !sendForm.message.trim()) {
      alert('Title and message are required');
      return;
    }
    if (sendForm.target === 'single' && !sendForm.userId.trim()) {
      alert('User ID is required for single user notification');
      return;
    }

    setSending(true);
    try {
      const response = await fetch(apiUrl('api/admin/notifications/send'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('authToken')
        },
        body: JSON.stringify(sendForm)
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'Notification sent successfully');
        setShowSendModal(false);
        setSendForm({ target: 'all', userId: '', title: '', message: '', type: 'general' });
        fetchNotifications();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Error sending notification');
    } finally {
      setSending(false);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!confirm('Delete this notification?')) return;
    try {
      const response = await fetch(apiUrl('api/admin/notifications/' + id), {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('authToken')
        }
      });
      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    const typeMatch = typeFilter === 'all' || n.type === typeFilter;
    const readMatch = readFilter === 'all' || 
                      (readFilter === 'read' && n.is_read) || 
                      (readFilter === 'unread' && !n.is_read);
    return typeMatch && readMatch;
  });

  const notificationTypes = [...new Set(notifications.map(n => n.type).filter(Boolean))];

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ride': return { bg: '#DBEAFE', text: '#1D4ED8' };
      case 'payment': return { bg: '#D1FAE5', text: '#047857' };
      case 'promo': return { bg: '#FEF3C7', text: '#D97706' };
      case 'alert': return { bg: '#FEE2E2', text: '#DC2626' };
      default: return { bg: '#F3F4F6', text: '#374151' };
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading notifications...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bell size={28} color="#4F46E5" />
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
            Push Notifications
          </h1>
        </div>
        <button
          onClick={() => setShowSendModal(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4F46E5',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          <Send size={16} /> Send Notification
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', backgroundColor: '#EEF2FF', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4F46E5' }}>{notifications.length}</div>
          <div style={{ fontSize: '14px', color: '#6366F1' }}>Total Sent</div>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#FEF3C7', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#D97706' }}>
            {notifications.filter(n => !n.is_read).length}
          </div>
          <div style={{ fontSize: '14px', color: '#D97706' }}>Unread</div>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#D1FAE5', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#047857' }}>
            {notifications.filter(n => n.is_read).length}
          </div>
          <div style={{ fontSize: '14px', color: '#047857' }}>Read</div>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#374151' }}>
            {new Date().toLocaleDateString()}
          </div>
          <div style={{ fontSize: '14px', color: '#374151' }}>Today</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
        >
          <option value="all">All Types</option>
          {notificationTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select
          value={readFilter}
          onChange={(e) => setReadFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
        >
          <option value="all">All Status</option>
          <option value="read">Read</option>
          <option value="unread">Unread</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Title</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Message</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Type</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>User</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Sent</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredNotifications.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                  No notifications found
                </td>
              </tr>
            ) : (
              filteredNotifications.map(n => {
                const typeColor = getTypeColor(n.type);
                return (
                  <tr key={n.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '500' }}>{n.title}</td>
                    <td style={{ padding: '12px 16px', color: '#6B7280', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.message}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: typeColor.bg,
                        color: typeColor.text,
                        textTransform: 'capitalize'
                      }}>
                        {n.type || 'general'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6B7280' }}>
                      {n.user_name || n.user_email || 'Broadcast'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: n.is_read ? '#D1FAE5' : '#FEF3C7',
                        color: n.is_read ? '#047857' : '#D97706'
                      }}>
                        {n.is_read ? 'Read' : 'Unread'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6B7280' }}>
                      {new Date(n.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => deleteNotification(n.id)}
                        style={{
                          padding: '6px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#DC2626'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: '600' }}>
              Send Push Notification
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Target Audience *</label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { value: 'all', label: 'All Users', icon: Users },
                  { value: 'drivers', label: 'Drivers', icon: User },
                  { value: 'riders', label: 'Riders', icon: User },
                  { value: 'single', label: 'Single User', icon: User }
                ].map(opt => (
                  <label key={opt.value} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: sendForm.target === opt.value ? '2px solid #4F46E5' : '1px solid #D1D5DB',
                    backgroundColor: sendForm.target === opt.value ? '#EEF2FF' : 'white'
                  }}>
                    <input
                      type="radio"
                      name="target"
                      value={opt.value}
                      checked={sendForm.target === opt.value}
                      onChange={(e) => setSendForm({ ...sendForm, target: e.target.value as any })}
                      style={{ display: 'none' }}
                    />
                    <opt.icon size={16} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {sendForm.target === 'single' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>User ID *</label>
                <input
                  type="text"
                  value={sendForm.userId}
                  onChange={(e) => setSendForm({ ...sendForm, userId: e.target.value })}
                  placeholder="Enter user UUID"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Notification Type</label>
              <select
                value={sendForm.type}
                onChange={(e) => setSendForm({ ...sendForm, type: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
              >
                <option value="general">General</option>
                <option value="promo">Promotion</option>
                <option value="alert">Alert</option>
                <option value="update">Update</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Title *</label>
              <input
                type="text"
                value={sendForm.title}
                onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                placeholder="Notification title"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Message *</label>
              <textarea
                value={sendForm.message}
                onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                placeholder="Notification message"
                rows={4}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => {
                  setShowSendModal(false);
                  setSendForm({ target: 'all', userId: '', title: '', message: '', type: 'general' });
                }}
                style={{
                  padding: '10px 16px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={sendNotification}
                disabled={sending}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#4F46E5',
                  color: 'white',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  opacity: sending ? 0.6 : 1
                }}
              >
                {sending ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PushNotifications;