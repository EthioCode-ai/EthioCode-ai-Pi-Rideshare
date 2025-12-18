import React, { useState, useEffect } from 'react';
import { Shield, Search, CheckCircle, XCircle, User, Calendar, FileText, Eye } from 'lucide-react';
import { apiUrl } from '../config/api.config';

interface BadgeVerification {
  id: string;
  rider_id: string;
  badge_type: string;
  verification_status: string;
  documents: any;
  verification_notes: string;
  new_expiry_date: string;
  verified_at: string;
  created_at: string;
  rider_name: string;
  rider_email: string;
  rider_phone: string;
}

const RiderBadgeVerification: React.FC = () => {
  const [verifications, setVerifications] = useState<BadgeVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'student' | 'military' | 'senior' | 'corporate'>('all');
  const [selectedVerification, setSelectedVerification] = useState<BadgeVerification | null>(null);
  const [reviewForm, setReviewForm] = useState({
    status: '' as 'verified' | 'rejected' | '',
    notes: '',
    expiry_date: ''
  });

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    try {
      const response = await fetch(apiUrl('api/admin/badge-verifications'), {
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('authToken')
        }
      });
      if (response.ok) {
        const data = await response.json();
        setVerifications(data.verifications || []);
      }
    } catch (error) {
      console.error('Error fetching verifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (verificationId: string) => {
    if (!reviewForm.status) {
      alert('Please select verify or reject');
      return;
    }
    try {
      const response = await fetch(apiUrl('api/admin/badge-verifications/' + verificationId + '/review'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('authToken')
        },
        body: JSON.stringify({
          verification_status: reviewForm.status,
          verification_notes: reviewForm.notes,
          new_expiry_date: reviewForm.expiry_date || null
        })
      });
      if (response.ok) {
        await fetchVerifications();
        setSelectedVerification(null);
        setReviewForm({ status: '', notes: '', expiry_date: '' });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to review');
      }
    } catch (error) {
      console.error('Error reviewing:', error);
      alert('Error reviewing verification');
    }
  };

  const filteredVerifications = verifications.filter(v => {
    const statusMatch = statusFilter === 'all' || v.verification_status === statusFilter;
    const typeMatch = typeFilter === 'all' || v.badge_type === typeFilter;
    return statusMatch && typeMatch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return { bg: '#D1FAE5', text: '#047857' };
      case 'rejected': return { bg: '#FEE2E2', text: '#DC2626' };
      default: return { bg: '#FEF3C7', text: '#D97706' };
    }
  };

  const getBadgeTypeColor = (type: string) => {
    switch (type) {
      case 'student': return { bg: '#DBEAFE', text: '#1D4ED8' };
      case 'military': return { bg: '#E0E7FF', text: '#4338CA' };
      case 'senior': return { bg: '#FCE7F3', text: '#BE185D' };
      default: return { bg: '#F3E8FF', text: '#7C3AED' };
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading verifications...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={28} color="#4F46E5" />
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
            Rider Badge Verification
          </h1>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
        >
          <option value="all">All Types</option>
          <option value="student">Student</option>
          <option value="military">Military/Veteran</option>
          <option value="senior">Senior</option>
          <option value="corporate">Corporate</option>
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {['pending', 'verified', 'rejected'].map(status => {
          const count = verifications.filter(v => v.verification_status === status).length;
          const colors = getStatusColor(status);
          return (
            <div key={status} style={{ padding: '16px', backgroundColor: colors.bg, borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.text }}>{count}</div>
              <div style={{ fontSize: '14px', color: colors.text, textTransform: 'capitalize' }}>{status}</div>
            </div>
          );
        })}
        <div style={{ padding: '16px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#374151' }}>{verifications.length}</div>
          <div style={{ fontSize: '14px', color: '#374151' }}>Total</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Rider</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Badge Type</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Submitted</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Expires</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVerifications.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                  No verifications found
                </td>
              </tr>
            ) : (
              filteredVerifications.map(v => {
                const statusColor = getStatusColor(v.verification_status);
                const typeColor = getBadgeTypeColor(v.badge_type);
                return (
                  <tr key={v.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '500' }}>{v.rider_name || 'Unknown'}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>{v.rider_email}</div>
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
                        {v.badge_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: statusColor.bg,
                        color: statusColor.text,
                        textTransform: 'capitalize'
                      }}>
                        {v.verification_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6B7280' }}>
                      {new Date(v.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6B7280' }}>
                      {v.new_expiry_date ? new Date(v.new_expiry_date).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => setSelectedVerification(v)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#4F46E5',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Review Modal */}
      {selectedVerification && (
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
              Review Badge Verification
            </h2>
            
            <div style={{ marginBottom: '16px' }}>
              <strong>Rider:</strong> {selectedVerification.rider_name || 'Unknown'}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>Email:</strong> {selectedVerification.rider_email}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>Badge Type:</strong> <span style={{ textTransform: 'capitalize' }}>{selectedVerification.badge_type}</span>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>Submitted:</strong> {new Date(selectedVerification.created_at).toLocaleString()}
            </div>

            {selectedVerification.documents && (
              <div style={{ marginBottom: '16px' }}>
                <strong>Documents:</strong>
                <button
                  onClick={() => window.open(selectedVerification.documents?.url, '_blank')}
                  style={{
                    marginLeft: '10px',
                    padding: '4px 8px',
                    backgroundColor: '#4F46E5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  View Document
                </button>
              </div>
            )}

            {selectedVerification.verification_status === 'pending' && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Decision *</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="status"
                        value="verified"
                        checked={reviewForm.status === 'verified'}
                        onChange={(e) => setReviewForm({ ...reviewForm, status: 'verified' })}
                      />
                      <CheckCircle size={16} color="#047857" /> Verify
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="status"
                        value="rejected"
                        checked={reviewForm.status === 'rejected'}
                        onChange={(e) => setReviewForm({ ...reviewForm, status: 'rejected' })}
                      />
                      <XCircle size={16} color="#DC2626" /> Reject
                    </label>
                  </div>
                </div>

                {reviewForm.status === 'verified' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Expiry Date</label>
                    <input
                      type="date"
                      value={reviewForm.expiry_date}
                      onChange={(e) => setReviewForm({ ...reviewForm, expiry_date: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                    />
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Notes</label>
                  <textarea
                    value={reviewForm.notes}
                    onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                    placeholder="Optional notes..."
                    rows={3}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB', resize: 'vertical' }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => {
                  setSelectedVerification(null);
                  setReviewForm({ status: '', notes: '', expiry_date: '' });
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
              {selectedVerification.verification_status === 'pending' && (
                <button
                  onClick={() => handleReview(selectedVerification.id)}
                  disabled={!reviewForm.status}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: reviewForm.status === 'verified' ? '#047857' : reviewForm.status === 'rejected' ? '#DC2626' : '#9CA3AF',
                    color: 'white',
                    cursor: reviewForm.status ? 'pointer' : 'not-allowed'
                  }}
                >
                  {reviewForm.status === 'verified' ? 'Verify Badge' : reviewForm.status === 'rejected' ? 'Reject Badge' : 'Select Decision'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderBadgeVerification;