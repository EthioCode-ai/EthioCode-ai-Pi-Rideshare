import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, Calendar, Users, DollarSign, Clock, Eye } from 'lucide-react';
import { apiUrl } from '../config/api.config';

interface Corporation {
  id: string;
  company_name: string;
  company_email: string;
  contact_person: string;
  contact_phone: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  valid_days: string[];
  start_date: string;
  end_date: string;
  is_active: boolean;
  max_discount_amount?: number;
  min_ride_amount?: number;
  total_applications: number;
  approved_applications: number;
  total_usage: number;
  total_savings: number;
  created_at: string;
}

const CorporateManagement: React.FC = () => {
  const [corporations, setCorporations] = useState<Corporation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCorp, setEditingCorp] = useState<Corporation | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    company_email: '',
    contact_person: '',
    contact_phone: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount',
    discount_value: 0,
    valid_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    start_date: '',
    end_date: '',
    is_active: true,
    max_discount_amount: 0,
    min_ride_amount: 0
  });

  useEffect(() => {
    fetchCorporations();
  }, []);

  const fetchCorporations = async () => {
    try {
      const response = await fetch(apiUrl('api/admin/corporations'), {
      headers: {
     'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCorporations(data.corporations);
      } else {
        console.error('Failed to fetch corporations');
      }
    } catch (error) {
      console.error('Error fetching corporations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingCorp 
        ? `/api/admin/corporations/${editingCorp.id}`
        : '/api/admin/corporations';
      
      const method = editingCorp ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchCorporations();
        resetForm();
        setShowForm(false);
        setEditingCorp(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save corporation');
      }
    } catch (error) {
      console.error('Error saving corporation:', error);
      alert('Error saving corporation');
    }
  };

  const handleEdit = (corp: Corporation) => {
    setEditingCorp(corp);
    setFormData({
      company_name: corp.company_name,
      company_email: corp.company_email || '',
      contact_person: corp.contact_person || '',
      contact_phone: corp.contact_phone || '',
      discount_type: corp.discount_type,
      discount_value: corp.discount_value,
      valid_days: Array.isArray(corp.valid_days) ? corp.valid_days : JSON.parse(corp.valid_days as string),
      start_date: corp.start_date,
      end_date: corp.end_date || '',
      is_active: corp.is_active,
      max_discount_amount: corp.max_discount_amount || 0,
      min_ride_amount: corp.min_ride_amount || 0
    });
    setShowForm(true);
  };

  const handleDelete = async (corpId: string) => {
    if (!confirm('Are you sure you want to delete this corporation? This will affect all associated applications.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/corporations/${corpId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await fetchCorporations();
      } else {
        alert('Failed to delete corporation');
      }
    } catch (error) {
      console.error('Error deleting corporation:', error);
      alert('Error deleting corporation');
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      company_email: '',
      contact_person: '',
      contact_phone: '',
      discount_type: 'percentage',
      discount_value: 0,
      valid_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      start_date: '',
      end_date: '',
      is_active: true,
      max_discount_amount: 0,
      min_ride_amount: 0
    });
  };

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      valid_days: prev.valid_days.includes(day)
        ? prev.valid_days.filter(d => d !== day)
        : [...prev.valid_days, day]
    }));
  };

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading corporations...</div>
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
          <Building2 size={28} color="#4F46E5" />
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: '#1F2937',
            margin: 0
          }}>
            Corporate Discount Management
          </h1>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingCorp(null);
            setShowForm(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#4F46E5',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} />
          Add Corporation
        </button>
      </div>

      {showForm && (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
            {editingCorp ? 'Edit Corporation' : 'Add New Corporation'}
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  Company Email
                </label>
                <input
                  type="email"
                  value={formData.company_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, company_email: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  Contact Person
                </label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  Discount Type *
                </label>
                <select
                  value={formData.discount_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value as 'percentage' | 'fixed_amount' }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed_amount">Fixed Amount</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '($)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.discount_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  Max Discount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.max_discount_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_discount_amount: parseFloat(e.target.value) || 0 }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                Valid Days *
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {dayNames.map(day => (
                  <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.valid_days.includes(day)}
                      onChange={() => handleDayToggle(day)}
                      style={{ margin: 0 }}
                    />
                    <span style={{ fontSize: '14px', textTransform: 'capitalize' }}>{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                style={{ margin: 0 }}
              />
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Active</label>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                style={{
                  backgroundColor: '#4F46E5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {editingCorp ? 'Update Corporation' : 'Create Corporation'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingCorp(null);
                  resetForm();
                }}
                style={{
                  backgroundColor: '#6B7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{
        backgroundColor: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 120px',
          gap: '16px',
          padding: '16px 20px',
          backgroundColor: '#F9FAFB',
          borderBottom: '1px solid #E5E7EB',
          fontSize: '12px',
          fontWeight: '600',
          color: '#6B7280',
          textTransform: 'uppercase'
        }}>
          <div>Company</div>
          <div>Discount</div>
          <div>Applications</div>
          <div>Usage</div>
          <div>Status</div>
          <div>Date Range</div>
          <div>Actions</div>
        </div>

        {corporations.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: '#6B7280',
            fontSize: '16px'
          }}>
            No corporations configured. Add your first corporate discount program.
          </div>
        ) : (
          corporations.map((corp) => (
            <div
              key={corp.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 120px',
                gap: '16px',
                padding: '16px 20px',
                borderBottom: '1px solid #F3F4F6',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>
                  {corp.company_name}
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>
                  {corp.contact_person && `${corp.contact_person} • `}
                  {corp.company_email}
                </div>
              </div>
              
              <div style={{ fontSize: '14px' }}>
                {corp.discount_type === 'percentage' 
                  ? `${corp.discount_value}%` 
                  : `$${corp.discount_value}`}
                {corp.max_discount_amount && corp.discount_type === 'percentage' && (
                  <div style={{ fontSize: '11px', color: '#6B7280' }}>
                    Max: ${corp.max_discount_amount}
                  </div>
                )}
              </div>
              
              <div style={{ fontSize: '14px' }}>
                <div>{corp.approved_applications}/{corp.total_applications}</div>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>approved</div>
              </div>
              
              <div style={{ fontSize: '14px' }}>
                <div>{corp.total_usage} rides</div>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>
                  ${corp.total_savings.toFixed(2)} saved
                </div>
              </div>
              
              <div>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  backgroundColor: corp.is_active ? '#D1FAE5' : '#FEE2E2',
                  color: corp.is_active ? '#047857' : '#DC2626'
                }}>
                  {corp.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div style={{ fontSize: '12px', color: '#6B7280' }}>
                <div>{new Date(corp.start_date).toLocaleDateString()}</div>
                {corp.end_date && (
                  <div>to {new Date(corp.end_date).toLocaleDateString()}</div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => handleEdit(corp)}
                  style={{
                    padding: '6px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: '#F3F4F6',
                    cursor: 'pointer',
                    color: '#6B7280'
                  }}
                  title="Edit"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDelete(corp.id)}
                  style={{
                    padding: '6px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: '#FEE2E2',
                    cursor: 'pointer',
                    color: '#DC2626'
                  }}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CorporateManagement;