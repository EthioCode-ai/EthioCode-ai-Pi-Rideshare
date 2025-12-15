
import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  User, 
  Car, 
  Phone, 
  Mail,
  Camera,
  FileText,
  DollarSign,
  Calendar,
  Filter,
  Search,
  MoreVertical,
  Upload,
  Send,
  Star
} from 'lucide-react';
import { apiUrl } from '../config/api.config';

interface Dispute {
  id: string;
  caseNumber: string;
  type: 'fare_dispute' | 'driver_behavior' | 'rider_behavior' | 'vehicle_issue' | 'route_dispute' | 'cancellation_dispute' | 'safety_incident' | 'lost_item';
  status: 'open' | 'investigating' | 'pending_rider' | 'pending_driver' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  rideId: string;
  riderId: string;
  riderName: string;
  driverId: string;
  driverName: string;
  reportedBy: 'rider' | 'driver' | 'admin';
  reportedAt: string;
  resolvedAt?: string;
  assignedTo?: string;
  subject: string;
  description: string;
  requestedRefund?: number;
  actualRefund?: number;
  evidence: DisputeEvidence[];
  messages: DisputeMessage[];
  resolution?: string;
  resolutionType?: 'refund' | 'credit' | 'warning' | 'suspension' | 'no_action';
}

interface DisputeEvidence {
  id: string;
  type: 'photo' | 'screenshot' | 'document' | 'audio';
  url: string;
  filename: string;
  uploadedBy: string;
  uploadedAt: string;
  description?: string;
}

interface DisputeMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'rider' | 'driver' | 'admin';
  message: string;
  sentAt: string;
  isInternal: boolean;
}

const DisputeResolution: React.FC = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showDisputeDetails, setShowDisputeDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDisputes();
  }, []);

const loadDisputes = async () => {
  try {
    setLoading(true);
    const token = localStorage.getItem('authToken');
    const response = await fetch(apiUrl('api/admin/disputes'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('⚖️ Disputes loaded:', data.disputes?.length);
      
      const transformed = (data.disputes || []).map((d: any) => ({
        id: d.id,
        caseNumber: d.case_number,
        type: d.type,
        status: d.status,
        priority: d.priority,
        rideId: d.ride_id || '',
        riderId: d.rider_id || '',
        riderName: d.rider_name || 'Unknown Rider',
        driverId: d.driver_id || '',
        driverName: d.driver_name || 'Unknown Driver',
        reportedBy: d.reported_by,
        reportedAt: d.reported_at,
        resolvedAt: d.resolved_at,
        assignedTo: d.assigned_to,
        subject: d.subject,
        description: d.description,
        requestedRefund: d.requested_refund ? parseFloat(d.requested_refund) : undefined,
        actualRefund: d.actual_refund ? parseFloat(d.actual_refund) : undefined,
        evidence: [],
        messages: [],
        resolution: d.resolution,
        resolutionType: d.resolution_type
      }));
      
      setDisputes(transformed);
    }
  } catch (error) {
    console.error('Failed to load disputes:', error);
  } finally {
    setLoading(false);
  }
};

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'fare_dispute': '#f59e0b',
      'driver_behavior': '#ef4444',
      'rider_behavior': '#f59e0b',
      'vehicle_issue': '#8b5cf6',
      'route_dispute': '#06b6d4',
      'cancellation_dispute': '#6b7280',
      'safety_incident': '#dc2626',
      'lost_item': '#10b981'
    };
    return colors[type] || '#6b7280';
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'open': '#f59e0b',
      'investigating': '#3b82f6',
      'pending_rider': '#8b5cf6',
      'pending_driver': '#06b6d4',
      'resolved': '#10b981',
      'closed': '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const getPriorityColor = (priority: string) => {
    const colors: { [key: string]: string } = {
      'low': '#10b981',
      'medium': '#f59e0b',
      'high': '#ef4444',
      'urgent': '#dc2626'
    };
    return colors[priority] || '#6b7280';
  };

  const formatDisputeType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const filteredDisputes = disputes.filter(dispute => {
    const matchesSearch = 
      dispute.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispute.riderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispute.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispute.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || dispute.status === statusFilter;
    const matchesType = typeFilter === 'all' || dispute.type === typeFilter;
    const matchesPriority = priorityFilter === 'all' || dispute.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });

  const handleDisputeAction = (action: string, dispute: Dispute) => {
    setSelectedDispute(dispute);
    setActiveDropdown(null);
    
    switch (action) {
      case 'view':
        setShowDisputeDetails(true);
        break;
      case 'assign':
        // Show assign modal
        break;
      case 'resolve':
        // Show resolution modal
        break;
      case 'escalate':
        // Escalate dispute
        break;
      default:
        break;
    }
  };

  const statsData = {
    total: disputes.length,
    open: disputes.filter(d => d.status === 'open').length,
    investigating: disputes.filter(d => d.status === 'investigating').length,
    resolved: disputes.filter(d => d.status === 'resolved').length,
    avgResolutionTime: '2.3 days'
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' }}>
            Dispute Resolution Center
          </h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
            Manage and resolve rider and driver disputes
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            Export Report
          </button>
          <button style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            Bulk Actions
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#3b82f6', fontSize: '24px', fontWeight: '700' }}>{statsData.total}</div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Total Disputes</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: '700' }}>{statsData.open}</div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Open Cases</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#8b5cf6', fontSize: '24px', fontWeight: '700' }}>{statsData.investigating}</div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Investigating</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#10b981', fontSize: '24px', fontWeight: '700' }}>{statsData.resolved}</div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Resolved</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#6b7280', fontSize: '24px', fontWeight: '700' }}>{statsData.avgResolutionTime}</div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Avg Resolution</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
          <div style={{ position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search by case number, names, or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 44px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="pending_rider">Pending Rider</option>
            <option value="pending_driver">Pending Driver</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            <option value="all">All Types</option>
            <option value="fare_dispute">Fare Dispute</option>
            <option value="driver_behavior">Driver Behavior</option>
            <option value="rider_behavior">Rider Behavior</option>
            <option value="vehicle_issue">Vehicle Issue</option>
            <option value="route_dispute">Route Dispute</option>
            <option value="cancellation_dispute">Cancellation</option>
            <option value="safety_incident">Safety Incident</option>
            <option value="lost_item">Lost Item</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              padding: '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Disputes Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Case Details
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Type
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Priority
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Status
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Parties
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Reported
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDisputes.map((dispute) => (
                <tr key={dispute.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                        {dispute.caseNumber}
                      </div>
                      <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '2px' }}>
                        {dispute.subject}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Ride: {dispute.rideId}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: `${getTypeColor(dispute.type)}20`,
                      color: getTypeColor(dispute.type)
                    }}>
                      {formatDisputeType(dispute.type)}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: `${getPriorityColor(dispute.priority)}20`,
                      color: getPriorityColor(dispute.priority)
                    }}>
                      {dispute.priority.charAt(0).toUpperCase() + dispute.priority.slice(1)}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: `${getStatusColor(dispute.status)}20`,
                      color: getStatusColor(dispute.status)
                    }}>
                      {dispute.status === 'open' && <AlertTriangle size={12} />}
                      {dispute.status === 'investigating' && <Clock size={12} />}
                      {dispute.status === 'resolved' && <CheckCircle size={12} />}
                      {dispute.status === 'closed' && <XCircle size={12} />}
                      {dispute.status.replace('_', ' ').split(' ').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '14px' }}>
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: '#64748b' }}>Rider:</span> {dispute.riderName}
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Driver:</span> {dispute.driverName}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      {new Date(dispute.reportedAt).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      by {dispute.reportedBy}
                    </div>
                  </td>
                  <td style={{ padding: '16px', position: 'relative' }}>
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === dispute.id ? null : dispute.id)}
                      style={{
                        padding: '8px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <MoreVertical size={16} color="#64748b" />
                    </button>
                    
                    {activeDropdown === dispute.id && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: '16px',
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        zIndex: 1000,
                        minWidth: '160px'
                      }}>
                        <button
                          onClick={() => handleDisputeAction('view', dispute)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '14px'
                          }}
                        >
                          <Eye size={16} color="#6b7280" />
                          View Details
                        </button>
                        <button
                          onClick={() => handleDisputeAction('assign', dispute)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '14px'
                          }}
                        >
                          <User size={16} color="#6b7280" />
                          Assign Agent
                        </button>
                        <button
                          onClick={() => handleDisputeAction('resolve', dispute)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '14px',
                            color: '#10b981'
                          }}
                        >
                          <CheckCircle size={16} />
                          Mark Resolved
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispute Details Modal */}
      {showDisputeDetails && selectedDispute && (
        <DisputeDetailsModal
          dispute={selectedDispute}
          onClose={() => {
            setShowDisputeDetails(false);
            setSelectedDispute(null);
          }}
          onUpdate={(updatedDispute) => {
            setDisputes(disputes.map(d => d.id === updatedDispute.id ? updatedDispute : d));
          }}
        />
      )}

      {/* Click outside to close dropdown */}
      {activeDropdown && (
        <div
          onClick={() => setActiveDropdown(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
        />
      )}
    </div>
  );
};

// Dispute Details Modal Component
const DisputeDetailsModal: React.FC<{
  dispute: Dispute;
  onClose: () => void;
  onUpdate: (dispute: Dispute) => void;
}> = ({ dispute, onClose, onUpdate }) => {
  const [newMessage, setNewMessage] = useState('');
  const [selectedTab, setSelectedTab] = useState<'details' | 'messages' | 'evidence' | 'resolution'>('details');
  const [resolutionType, setResolutionType] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message: DisputeMessage = {
      id: `MSG_${Date.now()}`,
      senderId: 'admin_current',
      senderName: 'Support Agent',
      senderType: 'admin',
      message: newMessage,
      sentAt: new Date().toISOString(),
      isInternal: false
    };

    const updatedDispute = {
      ...dispute,
      messages: [...dispute.messages, message]
    };

    onUpdate(updatedDispute);
    setNewMessage('');
    alert('Message sent successfully!');
  };

  const resolveDispute = () => {
    if (!resolutionType || !resolutionNotes) {
      alert('Please fill in all resolution fields');
      return;
    }

    const updatedDispute = {
      ...dispute,
      status: 'resolved' as const,
      resolvedAt: new Date().toISOString(),
      resolution: resolutionNotes,
      resolutionType: resolutionType as any,
      actualRefund: resolutionType === 'refund' ? parseFloat(refundAmount) || 0 : undefined
    };

    onUpdate(updatedDispute);
    alert('Dispute resolved successfully!');
  };

  return (
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
        padding: '0',
        maxWidth: '900px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '24px 24px 0 24px',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>
              Case {dispute.caseNumber}
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
              {dispute.subject}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px'
        }}>
          {[
            { id: 'details', label: 'Details', icon: <FileText size={16} /> },
            { id: 'messages', label: 'Messages', icon: <MessageSquare size={16} /> },
            { id: 'evidence', label: 'Evidence', icon: <Camera size={16} /> },
            { id: 'resolution', label: 'Resolution', icon: <CheckCircle size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              style={{
                padding: '12px 16px',
                border: 'none',
                backgroundColor: 'transparent',
                borderBottom: selectedTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                color: selectedTab === tab.id ? '#3b82f6' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {selectedTab === 'details' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <h4 style={{ margin: '0 0 16px 0', color: '#374151' }}>Case Information</h4>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div>
                    <span style={{ fontWeight: '600', color: '#64748b' }}>Type: </span>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px',
                      backgroundColor: `${dispute.type === 'safety_incident' ? '#dc2626' : '#f59e0b'}20`,
                      color: dispute.type === 'safety_incident' ? '#dc2626' : '#f59e0b'
                    }}>
                      {dispute.type.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontWeight: '600', color: '#64748b' }}>Priority: </span>
                    <span style={{ color: dispute.priority === 'urgent' ? '#dc2626' : '#f59e0b' }}>
                      {dispute.priority.charAt(0).toUpperCase() + dispute.priority.slice(1)}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontWeight: '600', color: '#64748b' }}>Reported by: </span>
                    {dispute.reportedBy}
                  </div>
                  <div>
                    <span style={{ fontWeight: '600', color: '#64748b' }}>Date: </span>
                    {new Date(dispute.reportedAt).toLocaleString()}
                  </div>
                  {dispute.requestedRefund && (
                    <div>
                      <span style={{ fontWeight: '600', color: '#64748b' }}>Requested refund: </span>
                      <span style={{ color: '#10b981' }}>${dispute.requestedRefund}</span>
                    </div>
                  )}
                </div>

                <h4 style={{ margin: '24px 0 16px 0', color: '#374151' }}>Description</h4>
                <p style={{ 
                  backgroundColor: '#f8fafc', 
                  padding: '16px', 
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  {dispute.description}
                </p>
              </div>

              <div>
                <h4 style={{ margin: '0 0 16px 0', color: '#374151' }}>Party Information</h4>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ 
                    padding: '16px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <User size={16} color="#3b82f6" />
                      <span style={{ fontWeight: '600' }}>Rider</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      <div>{dispute.riderName}</div>
                      <div>ID: {dispute.riderId}</div>
                    </div>
                  </div>

                  <div style={{ 
                    padding: '16px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Car size={16} color="#10b981" />
                      <span style={{ fontWeight: '600' }}>Driver</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      <div>{dispute.driverName}</div>
                      <div>ID: {dispute.driverId}</div>
                    </div>
                  </div>

                  <div style={{ 
                    padding: '16px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Calendar size={16} color="#f59e0b" />
                      <span style={{ fontWeight: '600' }}>Ride Details</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      <div>ID: {dispute.rideId}</div>
                      <div>Date: {new Date(dispute.reportedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'messages' && (
            <div>
              <div style={{ marginBottom: '24px', maxHeight: '400px', overflow: 'auto' }}>
                {dispute.messages.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    color: '#64748b', 
                    padding: '40px' 
                  }}>
                    No messages yet. Send the first message to start the conversation.
                  </div>
                ) : (
                  dispute.messages.map(message => (
                    <div 
                      key={message.id} 
                      style={{ 
                        marginBottom: '16px',
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: message.senderType === 'admin' ? '#eff6ff' : '#f8fafc',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600', color: '#1e293b' }}>
                            {message.senderName}
                          </span>
                          <span style={{ 
                            fontSize: '12px', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            backgroundColor: message.senderType === 'admin' ? '#3b82f620' : '#64748b20',
                            color: message.senderType === 'admin' ? '#3b82f6' : '#64748b'
                          }}>
                            {message.senderType}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(message.sentAt).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ margin: 0, lineHeight: '1.5' }}>
                        {message.message}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Send Message */}
              <div style={{ 
                borderTop: '1px solid #e2e8f0', 
                paddingTop: '16px' 
              }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={3}
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'vertical'
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: newMessage.trim() ? '#3b82f6' : '#e2e8f0',
                      color: newMessage.trim() ? 'white' : '#64748b',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Send size={16} />
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'evidence' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4 style={{ margin: 0 }}>Evidence Files</h4>
                <button style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Upload size={16} />
                  Upload Evidence
                </button>
              </div>

              {dispute.evidence.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#64748b', 
                  padding: '40px',
                  border: '2px dashed #e2e8f0',
                  borderRadius: '8px'
                }}>
                  <Camera size={48} color="#e2e8f0" style={{ marginBottom: '16px' }} />
                  <div>No evidence files uploaded yet.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {dispute.evidence.map(evidence => (
                    <div 
                      key={evidence.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc'
                      }}
                    >
                      <div style={{
                        width: '48px',
                        height: '48px',
                        backgroundColor: '#3b82f6',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {evidence.type === 'photo' && <Camera size={20} color="white" />}
                        {evidence.type === 'screenshot' && <FileText size={20} color="white" />}
                        {evidence.type === 'document' && <FileText size={20} color="white" />}
                        {evidence.type === 'audio' && <FileText size={20} color="white" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                          {evidence.filename}
                        </div>
                        <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '2px' }}>
                          Uploaded by {evidence.uploadedBy} on {new Date(evidence.uploadedAt).toLocaleDateString()}
                        </div>
                        {evidence.description && (
                          <div style={{ fontSize: '14px', color: '#64748b' }}>
                            {evidence.description}
                          </div>
                        )}
                      </div>
                      <button style={{
                        padding: '8px 12px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}>
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedTab === 'resolution' && (
            <div>
              {dispute.status === 'resolved' ? (
                <div style={{ 
                  padding: '20px', 
                  backgroundColor: '#ecfdf5', 
                  border: '1px solid #10b981', 
                  borderRadius: '8px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <CheckCircle size={20} color="#10b981" />
                    <span style={{ fontWeight: '600', color: '#10b981' }}>Case Resolved</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Resolution Type:</strong> {dispute.resolutionType}
                  </div>
                  {dispute.actualRefund && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Refund Amount:</strong> ${dispute.actualRefund}
                    </div>
                  )}
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Resolved on:</strong> {dispute.resolvedAt ? new Date(dispute.resolvedAt).toLocaleString() : 'N/A'}
                  </div>
                  <div>
                    <strong>Resolution Notes:</strong>
                    <p style={{ 
                      marginTop: '8px', 
                      padding: '12px', 
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0'
                    }}>
                      {dispute.resolution}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <h4 style={{ margin: '0 0 16px 0' }}>Resolve Dispute</h4>
                  
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                        Resolution Type
                      </label>
                      <select
                        value={resolutionType}
                        onChange={(e) => setResolutionType(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      >
                        <option value="">Select resolution type</option>
                        <option value="refund">Issue Refund</option>
                        <option value="credit">Provide Credit</option>
                        <option value="warning">Issue Warning</option>
                        <option value="suspension">Account Suspension</option>
                        <option value="no_action">No Action Required</option>
                      </select>
                    </div>

                    {resolutionType === 'refund' && (
                      <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                          Refund Amount ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(e.target.value)}
                          placeholder="0.00"
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px'
                          }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                        Resolution Notes
                      </label>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Explain the resolution and any actions taken..."
                        rows={4}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <button
                      onClick={resolveDispute}
                      disabled={!resolutionType || !resolutionNotes}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: resolutionType && resolutionNotes ? '#10b981' : '#e2e8f0',
                        color: resolutionType && resolutionNotes ? 'white' : '#64748b',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '600',
                        cursor: resolutionType && resolutionNotes ? 'pointer' : 'not-allowed'
                      }}
                    >
                      Resolve Dispute
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisputeResolution;
