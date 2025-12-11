import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, XCircle, AlertTriangle, User, Calendar, Building2, ArrowLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DriverBadgeVerification = () => {
  const navigate = useNavigate();
  const [riderInfo, setRiderInfo] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('idle'); // 'idle', 'verifying', 'verified', 'failed'
  const [notes, setNotes] = useState('');
  const [riderId, setRiderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // For demo purposes, simulate a rider lookup
  const handleLookupRider = async () => {
    if (!riderId.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/driver/rider-corporate-info/${riderId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRiderInfo(data);
      } else {
        alert('No corporate discount found for this rider');
        setRiderInfo(null);
      }
    } catch (error) {
      console.error('Error looking up rider:', error);
      alert('Error looking up rider information');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBadge = async (status) => {
    if (!riderInfo) return;
    
    setVerificationStatus('verifying');
    try {
      const response = await fetch('/api/driver/verify-badge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          riderId: riderInfo.rider_id,
          corporateApplicationId: riderInfo.id,
          verificationStatus: status,
          notes: notes
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setVerificationResult(result);
        setVerificationStatus(status);
      } else {
        setVerificationStatus('failed');
        alert('Failed to verify badge');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationStatus('failed');
    }
  };

  const resetVerification = () => {
    setRiderInfo(null);
    setVerificationStatus('idle');
    setNotes('');
    setRiderId('');
    setVerificationResult(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      {/* Navigation Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <button
          onClick={() => navigate('/driver')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '8px 16px',
            borderRadius: '12px',
            cursor: 'pointer',
            color: '#4a5568',
            fontSize: '16px',
            fontWeight: '500',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'white';
            e.target.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.9)';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          <ArrowLeft size={20} />
          Back to Driver App
        </button>
        <div style={{
          height: '24px',
          width: '1px',
          background: 'rgba(255, 255, 255, 0.3)'
        }} />
        <h1 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#2d3748',
          margin: 0
        }}>
          Badge Verification
        </h1>
      </div>

      <div style={{
        maxWidth: '800px',
        margin: '20px auto',
        background: 'white',
        borderRadius: '20px',
        padding: '30px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
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
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '50%',
            marginBottom: '20px'
          }}>
            <Camera size={40} color="white" />
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#2D3748',
            marginBottom: '10px'
          }}>
            Badge Verification
          </h1>
          <p style={{
            color: '#718096',
            fontSize: '16px'
          }}>
            Verify employee work badge to extend corporate discount eligibility
          </p>
        </div>

        {verificationStatus === 'idle' && (
          <div>
            {/* Rider Lookup */}
            <div style={{
              background: '#F7FAFC',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#2D3748',
                marginBottom: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <User size={20} />
                Step 1: Look Up Rider
              </h3>
              <div style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  placeholder="Enter Rider ID or email"
                  value={riderId}
                  onChange={(e) => setRiderId(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
                <button
                  onClick={handleLookupRider}
                  disabled={loading}
                  style={{
                    padding: '12px 24px',
                    background: '#4299E1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    cursor: 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading ? 'Looking up...' : 'Lookup'}
                </button>
              </div>
            </div>

            {/* Demo rider for testing */}
            <div style={{
              background: '#EDF2F7',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '2px dashed #CBD5E0'
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#4A5568' }}>
                <strong>Demo:</strong> Use rider ID "550e8400-e29b-41d4-a716-446655440002" to test the verification workflow
              </p>
            </div>

            {riderInfo && (
              <div>
                {/* Rider Information Display */}
                <div style={{
                  background: '#F0FFF4',
                  border: '2px solid #68D391',
                  padding: '20px',
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#22543D',
                    marginBottom: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <Building2 size={20} />
                    Corporate Information Found
                  </h3>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '15px'
                  }}>
                    <div>
                      <strong>Company:</strong><br />
                      {riderInfo.company_name}
                    </div>
                    <div>
                      <strong>Employee Email:</strong><br />
                      {riderInfo.work_email}
                    </div>
                    <div>
                      <strong>Department:</strong><br />
                      {riderInfo.department || 'Not specified'}
                    </div>
                    <div>
                      <strong>Current Expiry:</strong><br />
                      <span style={{
                        color: new Date(riderInfo.discount_end_date) > new Date() ? '#22543D' : '#C53030',
                        fontWeight: 'bold'
                      }}>
                        {new Date(riderInfo.discount_end_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <strong>Discount:</strong><br />
                      {riderInfo.discount_percentage ? 
                        `${riderInfo.discount_percentage}% off` : 
                        `$${riderInfo.discount_fixed_amount} off`
                      }
                    </div>
                  </div>

                  {/* Work Badge Image */}
                  {riderInfo.work_id_image_url && (
                    <div style={{ marginTop: '20px' }}>
                      <strong>Registered Work Badge:</strong><br />
                      <img 
                        src={`/${riderInfo.work_id_image_url}`} 
                        alt="Work Badge" 
                        style={{
                          maxWidth: '200px',
                          maxHeight: '200px',
                          border: '2px solid #E2E8F0',
                          borderRadius: '8px',
                          marginTop: '10px'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Badge Verification Action */}
                <div style={{
                  background: '#FFFAF0',
                  border: '2px solid #F6AD55',
                  padding: '20px',
                  borderRadius: '12px'
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#C05621',
                    marginBottom: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <AlertTriangle size={20} />
                    Step 2: Verify Physical Badge
                  </h3>
                  
                  <p style={{
                    color: '#744210',
                    marginBottom: '15px',
                    lineHeight: '1.5'
                  }}>
                    Ask the passenger to show their physical work badge. Compare it with the registered image above.
                    Check that the name, company, and photo match.
                  </p>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{
                      display: 'block',
                      fontWeight: 'bold',
                      marginBottom: '5px',
                      color: '#744210'
                    }}>
                      Verification Notes (optional):
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about the verification..."
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid #E2E8F0',
                        borderRadius: '8px',
                        resize: 'vertical',
                        minHeight: '80px'
                      }}
                    />
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '15px',
                    justifyContent: 'center'
                  }}>
                    <button
                      onClick={() => handleVerifyBadge('verified')}
                      style={{
                        padding: '15px 30px',
                        background: '#48BB78',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <CheckCircle size={20} />
                      Badge Verified
                    </button>
                    <button
                      onClick={() => handleVerifyBadge('failed')}
                      style={{
                        padding: '15px 30px',
                        background: '#F56565',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <XCircle size={20} />
                      Badge Invalid
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {verificationStatus === 'verifying' && (
          <div style={{
            textAlign: 'center',
            padding: '40px'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid #E2E8F0',
              borderTop: '4px solid #4299E1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <h3 style={{
              fontSize: '20px',
              color: '#2D3748',
              marginBottom: '10px'
            }}>
              Processing Verification...
            </h3>
            <p style={{ color: '#718096' }}>
              Recording badge verification and updating expiry date
            </p>
          </div>
        )}

        {(verificationStatus === 'verified' || verificationStatus === 'failed') && verificationResult && (
          <div>
            <div style={{
              background: verificationStatus === 'verified' ? '#F0FFF4' : '#FED7D7',
              border: `2px solid ${verificationStatus === 'verified' ? '#68D391' : '#FC8181'}`,
              padding: '30px',
              borderRadius: '12px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                fontSize: '60px',
                marginBottom: '20px'
              }}>
                {verificationStatus === 'verified' ? '✅' : '❌'}
              </div>
              
              <h3 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: verificationStatus === 'verified' ? '#22543D' : '#C53030',
                marginBottom: '15px'
              }}>
                {verificationStatus === 'verified' ? 'Badge Verified Successfully!' : 'Badge Verification Failed'}
              </h3>

              {verificationStatus === 'verified' && (
                <div style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  marginTop: '20px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    marginBottom: '10px'
                  }}>
                    <Calendar size={20} color="#22543D" />
                    <strong>Discount Extended</strong>
                  </div>
                  <p style={{ margin: 0, color: '#4A5568' }}>
                    New expiry date: <strong>{new Date(verificationResult.newExpiryDate).toLocaleDateString()}</strong><br />
                    Extended by: <strong>{verificationResult.verification.days_extended} days</strong>
                  </p>
                </div>
              )}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '15px'
            }}>
              <button
                onClick={resetVerification}
                style={{
                  padding: '12px 24px',
                  background: '#4299E1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                Verify Another Badge
              </button>
            </div>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default DriverBadgeVerification;