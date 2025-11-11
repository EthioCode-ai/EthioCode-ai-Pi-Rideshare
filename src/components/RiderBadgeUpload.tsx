import React, { useState, useEffect, useRef } from 'react';
import { Upload, Camera, Check, AlertCircle, Building2, User, Mail, FileImage, ArrowLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const RiderBadgeUpload = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [corporations, setCorporations] = useState([]);
  const [formData, setFormData] = useState({
    corporationId: '',
    workEmail: '',
    employeeId: '',
    department: ''
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Fetch available corporations
    fetchCorporations();
  }, []);

  const fetchCorporations = async () => {
    try {
      const response = await fetch('/api/corporations/available', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || 'demo-rider-token'}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCorporations(data.corporations || []);
      }
    } catch (error) {
      console.error('Error fetching corporations:', error);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!selectedFile || !formData.corporationId || !formData.workEmail) {
      alert('Please fill in all required fields and select a work badge photo');
      return;
    }

    setUploading(true);
    
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('workBadge', selectedFile);
      uploadFormData.append('corporationId', formData.corporationId);
      uploadFormData.append('workEmail', formData.workEmail);
      uploadFormData.append('employeeId', formData.employeeId);
      uploadFormData.append('department', formData.department);

      const response = await fetch('/api/corporate/upload-badge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || 'demo-rider-token'}`
        },
        body: uploadFormData
      });

      if (response.ok) {
        setUploadSuccess(true);
        // Reset form
        setSelectedFile(null);
        setPreview(null);
        setFormData({
          corporationId: '',
          workEmail: '',
          employeeId: '',
          department: ''
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (uploadSuccess) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)'
      }}>
        {/* Navigation Header */}
        <div style={{
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <button
            onClick={() => navigate('/rider')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#4a5568',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#f7fafc'}
            onMouseOut={(e) => e.target.style.background = 'none'}
          >
            <ArrowLeft size={20} />
            Back to Rider App
          </button>
          <div style={{
            height: '24px',
            width: '1px',
            background: '#e2e8f0'
          }} />
          <h1 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#2d3748',
            margin: 0
          }}>
            Application Submitted
          </h1>
        </div>

        <div style={{
          maxWidth: '600px',
          margin: '40px auto',
          padding: '40px',
          background: 'linear-gradient(135deg, #D6F5D6 0%, #A8E6A8 100%)',
          borderRadius: '20px',
          textAlign: 'center',
          border: '2px solid #68D391'
        }}>
          <div style={{
            fontSize: '80px',
            marginBottom: '20px'
          }}>
            ✅
          </div>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#22543D',
            marginBottom: '15px'
          }}>
            Work Badge Uploaded Successfully!
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#2F855A',
            marginBottom: '30px',
            lineHeight: '1.5'
          }}>
            Your corporate discount application has been submitted for review. 
            An admin will verify your work badge and approve your application within 24-48 hours.
          </p>
          <button
            onClick={() => setUploadSuccess(false)}
            style={{
              padding: '12px 24px',
              background: '#48BB78',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Upload Another Badge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)'
    }}>
      {/* Navigation Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <button
          onClick={() => navigate('/rider')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#4a5568',
            fontSize: '16px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#f7fafc'}
          onMouseOut={(e) => e.target.style.background = 'none'}
        >
          <ArrowLeft size={20} />
          Back to Rider App
        </button>
        <div style={{
          height: '24px',
          width: '1px',
          background: '#e2e8f0'
        }} />
        <h1 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#2d3748',
          margin: 0
        }}>
          Corporate Discount Application
        </h1>
      </div>

      <div style={{
        maxWidth: '800px',
        margin: '20px auto',
        padding: '30px',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '60px',
          height: '60px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '50%',
          marginBottom: '15px'
        }}>
          <FileImage size={30} color="white" />
        </div>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#2D3748',
          marginBottom: '8px'
        }}>
          Apply for Corporate Discount
        </h1>
        <p style={{
          color: '#718096',
          fontSize: '14px'
        }}>
          Upload your work badge to get approved for corporate discounts
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Corporation Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#2D3748',
            fontSize: '14px'
          }}>
            Select Your Company *
          </label>
          <select
            value={formData.corporationId}
            onChange={(e) => setFormData({...formData, corporationId: e.target.value})}
            required
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '16px',
              background: 'white'
            }}
          >
            <option value="">Choose your company...</option>
            {corporations.map(corp => (
              <option key={corp.id} value={corp.id}>
                {corp.company_name} - {corp.discount_type === 'percentage' ? `${corp.discount_value}% off` : `$${corp.discount_value} off`}
              </option>
            ))}
          </select>
        </div>

        {/* Work Email */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#2D3748',
            fontSize: '14px'
          }}>
            <Mail size={16} style={{ display: 'inline', marginRight: '5px' }} />
            Work Email Address * (for Verification purposes only)
          </label>
          <input
            type="email"
            value={formData.workEmail}
            onChange={(e) => setFormData({...formData, workEmail: e.target.value})}
            placeholder="your.name@company.com"
            required
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '16px'
            }}
          />
        </div>

        {/* Employee ID and Department */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '15px',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#2D3748',
              fontSize: '14px'
            }}>
              Employee ID (Optional)
            </label>
            <input
              type="text"
              value={formData.employeeId}
              onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
              placeholder="e.g., EMP001"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #E2E8F0',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />
          </div>
          <div>
            <label style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#2D3748',
              fontSize: '14px'
            }}>
              Department
            </label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({...formData, department: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #E2E8F0',
                borderRadius: '8px',
                fontSize: '16px',
                background: 'white'
              }}
            >
              <option value="">Select Department...</option>
              <option value="Accounting & Finance">Accounting & Finance</option>
              <option value="Administration">Administration</option>
              <option value="Business Development">Business Development</option>
              <option value="Customer Service">Customer Service</option>
              <option value="Data Science & Analytics">Data Science & Analytics</option>
              <option value="Engineering">Engineering</option>
              <option value="Executive">Executive</option>
              <option value="Facilities & Operations">Facilities & Operations</option>
              <option value="Human Resources">Human Resources</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Legal">Legal</option>
              <option value="Marketing">Marketing</option>
              <option value="Product Management">Product Management</option>
              <option value="Purchasing & Procurement">Purchasing & Procurement</option>
              <option value="Quality Assurance">Quality Assurance</option>
              <option value="Research & Development">Research & Development</option>
              <option value="Sales">Sales</option>
              <option value="Security">Security</option>
              <option value="Supply Chain & Logistics">Supply Chain & Logistics</option>
              <option value="Training & Development">Training & Development</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* File Upload Area */}
        <div style={{ marginBottom: '30px' }}>
          <label style={{
            display: 'block',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#2D3748',
            fontSize: '14px'
          }}>
            <Camera size={16} style={{ display: 'inline', marginRight: '5px' }} />
            Upload Work Badge Photo *
          </label>
          
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            style={{
              border: '2px dashed #CBD5E0',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              background: preview ? '#F7FAFC' : '#FAFAFA',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <div>
                <img 
                  src={preview} 
                  alt="Work badge preview" 
                  style={{
                    maxWidth: '200px',
                    maxHeight: '200px',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    border: '2px solid #E2E8F0'
                  }}
                />
                <p style={{ color: '#4A5568', fontSize: '14px', margin: 0 }}>
                  Click to change photo
                </p>
              </div>
            ) : (
              <div>
                <Upload size={40} color="#A0AEC0" style={{ marginBottom: '15px' }} />
                <p style={{ 
                  color: '#4A5568', 
                  fontSize: '16px',
                  margin: '0 0 8px 0',
                  fontWeight: 'bold'
                }}>
                  Click to upload or drag and drop
                </p>
                <p style={{ 
                  color: '#718096', 
                  fontSize: '14px',
                  margin: 0
                }}>
                  PNG, JPG up to 10MB
                </p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* Info Box */}
        <div style={{
          background: '#EBF8FF',
          border: '1px solid #BEE3F8',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <AlertCircle size={20} color="#3182CE" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <p style={{ 
                margin: '0 0 8px 0', 
                fontWeight: 'bold', 
                color: '#2B6CB0',
                fontSize: '14px'
              }}>
                Important Requirements:
              </p>
              <ul style={{ 
                margin: 0, 
                paddingLeft: '20px', 
                color: '#2C5282',
                fontSize: '13px',
                lineHeight: '1.4'
              }}>
                <li>Photo must clearly show your name and company</li>
                <li>Badge must be current and valid</li>
                <li>Use your official work email address</li>
                <li>Admin review takes 24-48 hours</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploading || !selectedFile || !formData.corporationId || !formData.workEmail}
          style={{
            width: '100%',
            padding: '15px',
            background: uploading ? '#A0AEC0' : '#4299E1',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          {uploading ? (
            <>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #ffffff40',
                borderTop: '2px solid #ffffff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Submitting Application...
            </>
          ) : (
            <>
              <Check size={20} />
              Enroll in Corporate Discount Program
            </>
          )}
        </button>
      </form>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      </div>
    </div>
  );
};

export default RiderBadgeUpload;