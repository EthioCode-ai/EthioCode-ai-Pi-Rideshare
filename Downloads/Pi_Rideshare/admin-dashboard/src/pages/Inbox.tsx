import React, { useState, useEffect } from 'react';
import {
  Bell,
  MessageCircle,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  DollarSign,
  Car,
  Mail,
  MessageSquare,
  Trash2
} from 'lucide-react';

interface InboxItem {
  id: string;
  type: 'notification' | 'message' | 'alert' | 'receipt' | 'promotion';
  title: string;
  content: string;
  timestamp: Date;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
  actionRequired?: boolean;
  metadata?: {
    driverId?: string;
    rideId?: string;
    amount?: number;
    location?: string;
  };
}

const Inbox: React.FC = () => {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([
    {
      id: '1',
      type: 'message',
      title: 'Message from Alex R.',
      content: 'I\'m running 2 minutes late due to traffic. Thanks for your patience!',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      read: false,
      priority: 'high',
      metadata: { driverId: 'alex_r', rideId: 'ride_123' }
    },
    {
      id: '2',
      type: 'receipt',
      title: 'Trip Receipt',
      content: 'Your ride to Downtown has been completed. Total: $24.50',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      read: false,
      priority: 'medium',
      metadata: { amount: 24.50, rideId: 'ride_122' }
    },
    {
      id: '3',
      type: 'notification',
      title: 'Driver Arrived',
      content: 'Sarah M. has arrived at your pickup location',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      read: true,
      priority: 'high',
      metadata: { driverId: 'sarah_m', location: 'Main St & 5th Ave' }
    },
    {
      id: '4',
      type: 'promotion',
      title: '20% Off Your Next Ride',
      content: 'Use code SAVE20 on your next trip. Valid until midnight!',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      read: true,
      priority: 'low'
    },
    {
      id: '5',
      type: 'alert',
      title: 'Payment Method Updated',
      content: 'Your default payment method has been successfully updated',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      read: true,
      priority: 'medium'
    }
  ]);

  const [filter, setFilter] = useState<'all' | 'unread' | 'messages' | 'receipts'>('all');

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageCircle size={20} color="#3b82f6" />;
      case 'notification': return <Bell size={20} color="#10b981" />;
      case 'alert': return <AlertCircle size={20} color="#f59e0b" />;
      case 'receipt': return <DollarSign size={20} color="#8b5cf6" />;
      case 'promotion': return <CheckCircle size={20} color="#ef4444" />;
      default: return <Bell size={20} color="#6b7280" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const filteredItems = inboxItems.filter(item => {
    switch (filter) {
      case 'unread': return !item.read;
      case 'messages': return item.type === 'message';
      case 'receipts': return item.type === 'receipt';
      default: return true;
    }
  });

  const unreadCount = inboxItems.filter(item => !item.read).length;

  const markAsRead = (id: string) => {
    setInboxItems(items =>
      items.map(item =>
        item.id === id ? { ...item, read: true } : item
      )
    );
  };

  const markAsUnread = (id: string) => {
    setInboxItems(items =>
      items.map(item =>
        item.id === id ? { ...item, read: false } : item
      )
    );
  };

  const deleteItem = (id: string) => {
    setInboxItems(items => items.filter(item => item.id !== id));
  };

  const markAllAsRead = () => {
    setInboxItems(items => items.map(item => ({ ...item, read: true })));
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        padding: '20px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#1e293b' }}>
            Inbox
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>
            {unreadCount} unread messages
          </p>
        </div>
        <button
          onClick={markAllAsRead}
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          Mark All Read
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        padding: '0 4px'
      }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: `Unread (${unreadCount})` },
          { key: 'messages', label: 'Messages' },
          { key: 'receipts', label: 'Receipts' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            style={{
              background: filter === key ? '#3b82f6' : 'white',
              color: filter === key ? 'white' : '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Inbox Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredItems.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '60px 20px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <MessageSquare size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <div style={{ fontSize: '18px', marginBottom: '8px' }}>No messages</div>
            <div style={{ fontSize: '14px' }}>Your inbox is empty</div>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                border: `1px solid ${!item.read ? '#3b82f6' : '#e2e8f0'}`,
                borderLeft: `4px solid ${getPriorityColor(item.priority)}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => !item.read && markAsRead(item.id)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ marginTop: '2px' }}>
                  {getTypeIcon(item.type)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: !item.read ? 600 : 500,
                      color: '#1e293b'
                    }}>
                      {item.title}
                    </h3>
                    {!item.read && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#3b82f6'
                      }} />
                    )}
                  </div>

                  <p style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    color: '#64748b',
                    lineHeight: '1.4'
                  }}>
                    {item.content}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: '#9ca3af'
                    }}>
                      <Clock size={12} />
                      {formatTimestamp(item.timestamp)}
                    </div>

                    {item.metadata?.location && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        color: '#9ca3af'
                      }}>
                        <MapPin size={12} />
                        {item.metadata.location}
                      </div>
                    )}

                    {item.metadata?.amount && (
                      <div style={{
                        background: '#10b981',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        ${item.metadata.amount}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      item.read ? markAsUnread(item.id) : markAsRead(item.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    title={item.read ? 'Mark as unread' : 'Mark as read'}
                  >
                    <Mail size={16} color="#64748b" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(item.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Inbox;