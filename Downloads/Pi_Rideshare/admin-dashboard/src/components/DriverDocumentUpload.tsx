import React, { useState, useRef } from 'react';
import { Upload, FileText, Shield, Car, Check, AlertCircle, Camera } from 'lucide-react';

const DriverDocumentUpload = () => {
  const [documents, setDocuments] = useState({
    insurance: { file: null, preview: null, uploaded: false },
    registration: { file: null, preview: null, uploaded: false }
  });
  const [uploading, setUploading] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRefs = {
    insurance: useRef(null),
    registration: useRef(null)
  };

  const handleFileSelect = (documentType, event) => {
    const file = event.target.files[0];
    if (file) {
      setDocuments(prev => ({
        ...prev,
        [documentType]: {
          ...prev[documentType],
          file: file,
          preview: URL.createObjectURL(file)
        }
      }));
    }
  };

  const handleDrop = (documentType, event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setDocuments(prev => ({
        ...prev,
        [documentType]: {
          ...prev[documentType],
          file: file,
          preview: URL.createObjectURL(file)
        }
      }));
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const uploadDocument = async (documentType) => {
    const docData = documents[documentType];
    if (!docData.file) return;

    setUploading(documentType);
    
    try {
      const formData = new FormData();
      formData.append('document', docData.file);
      formData.append('documentType', documentType);

      const response = await fetch('/api/driver/upload-document', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        setDocuments(prev => ({
          ...prev,
          [documentType]: {
            ...prev[documentType],
            uploaded: true
          }
        }));
        
        // Check if both documents are uploaded
        const otherType = documentType === 'insurance' ? 'registration' : 'insurance';
        const otherUploaded = documents[otherType].uploaded;
        
        if (otherUploaded) {
          setUploadSuccess(true);
        }
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const resetUpload = (documentType) => {
    setDocuments(prev => ({
      ...prev,
      [documentType]: {
        file: null,
        preview: null,
        uploaded: false
      }
    }));
    if (fileInputRefs[documentType].current) {
      fileInputRefs[documentType].current.value = '';
    }
  };

  const resetAll = () => {
    setDocuments({
      insurance: { file: null, preview: null, uploaded: false },
      registration: { file: null, preview: null, uploaded: false }
    });
    setUploadSuccess(false);
    Object.values(fileInputRefs).forEach(ref => {
      if (ref.current) ref.current.value = '';
    });
  };

  if (uploadSuccess) {
    return (
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
          Documents Uploaded Successfully!
        </h2>
        <p style={{
          fontSize: '16px',
          color: '#2F855A',
          marginBottom: '30px',
          lineHeight: '1.5'
        }}>
          Your insurance and registration documents have been uploaded and are being verified. 
          You'll be notified once the verification is complete.
        </p>
        <button
          onClick={resetAll}
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
          Upload New Documents
        </button>
      </div>
    );
  }

  const DocumentUploadCard = ({ type, icon: Icon, title, description }) => {
    const doc = documents[type];
    const isUploading = uploading === type;
    
    return (
      <div style={{
        background: doc.uploaded ? '#F0FFF4' : 'white',
        border: doc.uploaded ? '2px solid #68D391' : '2px solid #E2E8F0',
        borderRadius: '16px',
        padding: '25px',
        transition: 'all 0.2s'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            background: doc.uploaded ? '#48BB78' : '#4299E1',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {doc.uploaded ? <Check size={24} color="white" /> : <Icon size={24} color="white" />}
          </div>
          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#2D3748',
              margin: 0
            }}>
              {title}
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#718096',
              margin: 0
            }}>
              {description}
            </p>
          </div>
        </div>

        {doc.uploaded ? (
          <div style={{
            textAlign: 'center',
            padding: '20px'
          }}>
            <Check size={40} color="#48BB78" style={{ marginBottom: '10px' }} />
            <p style={{
              color: '#22543D',
              fontWeight: 'bold',
              marginBottom: '15px'
            }}>
              Document Uploaded Successfully
            </p>
            <button
              onClick={() => resetUpload(type)}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: '#4299E1',
                border: '2px solid #4299E1',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Upload Different Document
            </button>
          </div>
        ) : (
          <>
            {/* Upload Area */}
            <div
              onDrop={(e) => handleDrop(type, e)}
              onDragOver={handleDragOver}
              style={{
                border: '2px dashed #CBD5E0',
                borderRadius: '12px',
                padding: '30px',
                textAlign: 'center',
                background: doc.preview ? '#F7FAFC' : '#FAFAFA',
                cursor: 'pointer',
                marginBottom: '20px'
              }}
              onClick={() => fileInputRefs[type].current?.click()}
            >
              {doc.preview ? (
                <div>
                  <img 
                    src={doc.preview} 
                    alt={`${title} preview`} 
                    style={{
                      maxWidth: '200px',
                      maxHeight: '150px',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      border: '2px solid #E2E8F0'
                    }}
                  />
                  <p style={{ color: '#4A5568', fontSize: '14px', margin: 0 }}>
                    Click to change document
                  </p>
                </div>
              ) : (
                <div>
                  <Camera size={32} color="#A0AEC0" style={{ marginBottom: '12px' }} />
                  <p style={{ 
                    color: '#4A5568', 
                    fontSize: '16px',
                    margin: '0 0 5px 0',
                    fontWeight: 'bold'
                  }}>
                    Upload {title}
                  </p>
                  <p style={{ 
                    color: '#718096', 
                    fontSize: '14px',
                    margin: 0
                  }}>
                    Click or drag and drop
                  </p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRefs[type]}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect(type, e)}
              style={{ display: 'none' }}
            />

            {/* Upload Button */}
            <button
              onClick={() => uploadDocument(type)}
              disabled={!doc.file || isUploading}
              style={{
                width: '100%',
                padding: '12px',
                background: isUploading ? '#A0AEC0' : (!doc.file ? '#E2E8F0' : '#4299E1'),
                color: !doc.file ? '#A0AEC0' : 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: !doc.file || isUploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isUploading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #ffffff40',
                    borderTop: '2px solid #ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload {title}
                </>
              )}
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{
      maxWidth: '900px',
      margin: '20px auto',
      padding: '30px'
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '40px'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '70px',
          height: '70px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '50%',
          marginBottom: '20px'
        }}>
          <FileText size={35} color="white" />
        </div>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#2D3748',
          marginBottom: '10px'
        }}>
          Upload Driver Documents
        </h1>
        <p style={{
          color: '#718096',
          fontSize: '16px',
          maxWidth: '500px',
          margin: '0 auto'
        }}>
          Upload clear photos of your insurance and registration documents to complete your driver verification
        </p>
      </div>

      {/* Info Alert */}
      <div style={{
        background: '#EBF8FF',
        border: '1px solid #BEE3F8',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '30px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <AlertCircle size={24} color="#3182CE" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <p style={{ 
              margin: '0 0 10px 0', 
              fontWeight: 'bold', 
              color: '#2B6CB0',
              fontSize: '16px'
            }}>
              Document Requirements:
            </p>
            <ul style={{ 
              margin: 0, 
              paddingLeft: '20px', 
              color: '#2C5282',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              <li>Documents must be current and valid</li>
              <li>Photos should be clear and all text readable</li>
              <li>Insurance policy must show your name and coverage dates</li>
              <li>Registration must match your vehicle information</li>
              <li>Accepted formats: JPG, PNG (max 10MB each)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Document Upload Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '25px',
        marginBottom: '30px'
      }}>
        <DocumentUploadCard 
          type="insurance"
          icon={Shield}
          title="Insurance Document"
          description="Current auto insurance policy"
        />
        <DocumentUploadCard 
          type="registration"
          icon={Car}
          title="Vehicle Registration"
          description="Current vehicle registration"
        />
      </div>

      {/* Progress Indicator */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        border: '2px solid #E2E8F0',
        textAlign: 'center'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#2D3748',
          marginBottom: '15px'
        }}>
          Upload Progress
        </h3>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          alignItems: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: documents.insurance.uploaded ? '#22543D' : '#718096'
          }}>
            {documents.insurance.uploaded ? <Check size={20} /> : <Shield size={20} />}
            <span>Insurance</span>
          </div>
          <div style={{
            width: '40px',
            height: '2px',
            background: (documents.insurance.uploaded && documents.registration.uploaded) ? '#48BB78' : '#E2E8F0'
          }} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: documents.registration.uploaded ? '#22543D' : '#718096'
          }}>
            {documents.registration.uploaded ? <Check size={20} /> : <Car size={20} />}
            <span>Registration</span>
          </div>
        </div>
        
        <p style={{
          margin: '15px 0 0 0',
          fontSize: '14px',
          color: '#718096'
        }}>
          {documents.insurance.uploaded && documents.registration.uploaded ? 
            'All documents uploaded! Verification in progress.' :
            `${Object.values(documents).filter(doc => doc.uploaded).length}/2 documents uploaded`
          }
        </p>
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

export default DriverDocumentUpload;