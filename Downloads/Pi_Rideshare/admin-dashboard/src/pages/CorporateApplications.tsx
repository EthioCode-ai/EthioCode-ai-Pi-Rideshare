import React, { useState, useEffect } from 'react';
import { FileText, Eye, Check, X, Building2, User, Calendar, Clock } from 'lucide-react';
import { apiUrl } from '../config/api.config';

interface CorporateApplication {
  id: string;
  rider_id: string;
  corporation_id: string;
  work_email: string;
  employee_id: string;
  department: string;
  work_id_image_url: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  rejection_reason?: string;
  approved_at?: string;
  created_at: string;
  
  // Joined data
  first_name: string;
  last_name: string;
  rider_email: string;
  company_name: string;
  discount_type: string;
  discount_value: number;
}

const CorporateApplications: React.FC = () => {
  const [applications, setApplications] = useState<CorporateApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<CorporateApplication | null>(null);
  const [reviewForm, setReviewForm] = useState({
    status: '' as 'approved' | 'rejected' | '',
    review_notes: '',
    rejection_reason: ''
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await fetch(apiUrl('api/admin/corporate-applications'), {
      headers: {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications);
      } else {
        console.error('Failed to fetch applications');
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (applicationId: string) => {
    if (!reviewForm.status) {
      alert('Please select approve or reject');
      return;
    }

    if (reviewForm.status === 'rejected' && !reviewForm.rejection_reason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      const response = await fetch(apiUrl(`api/admin/corporate-applications/${applicationId}/review`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(reviewForm)
      });

      if (response.ok) {
        await fetchApplications();
        setSelectedApplication(null);
        setReviewForm({ status: '', review_notes: '', rejection_reason: '' });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to review application');
      }
    } catch (error) {
      console.error('Error reviewing application:', error);
      alert('Error reviewing application');
    }
  };

  const openApplicationDetails = (application: CorporateApplication) => {
    setSelectedApplication(application);
    setReviewForm({
      status: '',
      review_notes: '',
      rejection_reason: ''
    });
  };

  const filteredApplications = applications.filter(app => 
    statusFilter === 'all' || app.status === statusFilter
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return { bg: '#D1FAE5', text: '#047857' };
      case 'rejected': return { bg: '#FEE2E2', text: '#DC2626' };
      default: return { bg: '#FEF3C7', text: '#D97706' };
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading applications...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={28} color="#4F46E5" />
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: '#1F2937',
            margin: 0
          }}>
            Corporate Discount Applications
          </h1>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white'
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div style={{
        backgroundColor: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 100px',
          gap: '16px',
          padding: '16px 20px',
          backgroundColor: '#F9FAFB',
          borderBottom: '1px solid #E5E7EB',
          fontSize: '12px',
          fontWeight: '600',
          color: '#6B7280',
          textTransform: 'uppercase'
        }}>
          <div>Employee</div>
          <div>Company</div>
          <div>Submitted</div>
          <div>Status</div>
          <div>Discount</div>
          <div>Actions</div>
        </div>

        {filteredApplications.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: '#6B7280',
            fontSize: '16px'
          }}>
            {statusFilter === 'all' 
              ? 'No corporate discount applications submitted yet.'
              : `No ${statusFilter} applications found.`}
          </div>
        ) : (
          filteredApplications.map((app) => {
            const statusColor = getStatusColor(app.status);
            return (
              <div
                key={app.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 100px',
                  gap: '16px',
                  padding: '16px 20px',
                  borderBottom: '1px solid #F3F4F6',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>
                    {app.first_name} {app.last_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {app.work_email}
                  </div>
                  {app.employee_id && (
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>
                      ID: {app.employee_id}
                    </div>
                  )}
                </div>
                
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>
                    {app.company_name}
                  </div>
                  {app.department && (
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      {app.department}
                    </div>
                  )}
                </div>
                
                <div style={{ fontSize: '12px', color: '#6B7280' }}>
                  {new Date(app.created_at).toLocaleDateString()}
                </div>
                
                <div>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: statusColor.bg,
                    color: statusColor.text,
                    textTransform: 'capitalize'
                  }}>
                    {app.status}
                  </span>
                </div>
                
                <div style={{ fontSize: '14px', fontWeight: '600' }}>
                  {app.discount_type === 'percentage' 
                    ? `${app.discount_value}%` 
                    : `$${app.discount_value}`}
                </div>
                
                <div>
                  <button
                    onClick={() => openApplicationDetails(app)}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: '#4F46E5',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Review Application"
                  >
                    <Eye size={12} />
                    Review
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Application Details Modal */}
      {selectedApplication && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: 'bold', 
                color: '#1F2937',
                margin: 0
              }}>
                Corporate Discount Application
              </h2>
              <button
                onClick={() => setSelectedApplication(null)}
                style={{
                  padding: '6px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#F3F4F6',
                  cursor: 'pointer',
                  color: '#6B7280'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <User size={16} />
                Employee Information
              </h3>
              <div style={{ 
                backgroundColor: '#F9FAFB', 
                padding: '16px', 
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <strong>Name:</strong> {selectedApplication.first_name} {selectedApplication.last_name}
                  </div>
                  <div>
                    <strong>Personal Email:</strong> {selectedApplication.rider_email}
                  </div>
                  <div>
                    <strong>Work Email:</strong> {selectedApplication.work_email}
                  </div>
                  {selectedApplication.employee_id && (
                    <div>
                      <strong>Employee ID:</strong> {selectedApplication.employee_id}
                    </div>
                  )}
                  {selectedApplication.department && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>Department:</strong> {selectedApplication.department}
                    </div>
                  )}
                </div>
              </div>

              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Building2 size={16} />
                Company & Discount Information
              </h3>
              <div style={{ 
                backgroundColor: '#F9FAFB', 
                padding: '16px', 
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <strong>Company:</strong> {selectedApplication.company_name}
                  </div>
                  <div>
                    <strong>Discount:</strong> {selectedApplication.discount_type === 'percentage' 
                      ? `${selectedApplication.discount_value}%` 
                      : `$${selectedApplication.discount_value}`}
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Submitted:</strong> {new Date(selectedApplication.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                marginBottom: '12px'
              }}>
                Work ID Verification
              </h3>
              <div style={{ 
                backgroundColor: '#F9FAFB', 
                padding: '16px', 
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                {selectedApplication.work_id_image_url ? (
                  <div>
                    <p style={{ marginBottom: '8px', color: '#6B7280' }}>
                      Work ID Image uploaded. Click to view:
                    </p>
                    <a 
                      href={selectedApplication.work_id_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '8px 16px',
                        backgroundColor: '#4F46E5',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      View Work ID Image
                    </a>
                  </div>
                ) : (
                  <p style={{ color: '#6B7280' }}>No work ID image uploaded</p>
                )}
              </div>

              {selectedApplication.status !== 'pending' && (
                <div>
                  <h3 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    marginBottom: '12px'
                  }}>
                    Review Information
                  </h3>
                  <div style={{ 
                    backgroundColor: '#F9FAFB', 
                    padding: '16px', 
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Status:</strong> 
                      <span style={{
                        marginLeft: '8px',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: getStatusColor(selectedApplication.status).bg,
                        color: getStatusColor(selectedApplication.status).text,
                        textTransform: 'capitalize'
                      }}>
                        {selectedApplication.status}
                      </span>
                    </div>
                    {selectedApplication.reviewed_at && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Reviewed:</strong> {new Date(selectedApplication.reviewed_at).toLocaleString()}
                      </div>
                    )}
                    {selectedApplication.review_notes && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Review Notes:</strong> {selectedApplication.review_notes}
                      </div>
                    )}
                    {selectedApplication.rejection_reason && (
                      <div>
                        <strong>Rejection Reason:</strong> {selectedApplication.rejection_reason}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedApplication.status === 'pending' && (
              <div>
                <h3 style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  marginBottom: '16px'
                }}>
                  Review Application
                </h3>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                    Decision *
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="decision"
                        value="approved"
                        checked={reviewForm.status === 'approved'}
                        onChange={(e) => setReviewForm(prev => ({ ...prev, status: e.target.value as 'approved' }))}
                      />
                      <span style={{ fontSize: '14px', color: '#047857', fontWeight: '600' }}>
                        <Check size={16} style={{ display: 'inline', marginRight: '4px' }} />
                        Approve
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="decision"
                        value="rejected"
                        checked={reviewForm.status === 'rejected'}
                        onChange={(e) => setReviewForm(prev => ({ ...prev, status: e.target.value as 'rejected' }))}
                      />
                      <span style={{ fontSize: '14px', color: '#DC2626', fontWeight: '600' }}>
                        <X size={16} style={{ display: 'inline', marginRight: '4px' }} />
                        Reject
                      </span>
                    </label>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Review Notes
                  </label>
                  <textarea
                    value={reviewForm.review_notes}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, review_notes: e.target.value }))}
                    placeholder="Optional notes about this decision..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '14px',
                      minHeight: '80px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {reviewForm.status === 'rejected' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                      Rejection Reason *
                    </label>
                    <textarea
                      value={reviewForm.rejection_reason}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, rejection_reason: e.target.value }))}
                      placeholder="Please explain why this application is being rejected..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        minHeight: '80px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setSelectedApplication(null)}
                    style={{
                      padding: '10px 16px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      backgroundColor: 'white',
                      color: '#6B7280',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReview(selectedApplication.id)}
                    style={{
                      padding: '10px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: reviewForm.status === 'approved' ? '#047857' : '#DC2626',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    {reviewForm.status === 'approved' ? 'Approve Application' : 'Reject Application'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CorporateApplications;