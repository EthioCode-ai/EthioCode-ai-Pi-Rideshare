import React, { useState } from 'react';
import { 
  User, 
  Car, 
  CreditCard, 
  Shield, 
  FileText,
  Upload,
  Calendar,
  Building,
  X,
  Check,
  AlertTriangle
} from 'lucide-react';

interface DriverEnrollmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (driverData: any) => void;
}

const DriverEnrollmentForm: React.FC<DriverEnrollmentFormProps> = ({ isOpen, onClose, onSubmit }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Personal Information
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    ssn: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',

    // Driver's License
    licenseNumber: '',
    licenseState: '',
    licenseValidUntil: '',
    licenseImage: null as File | null,

    // Vehicle Information
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    licensePlate: '',
    vehicleColor: '',
    vehicleVin: '',

    // Insurance Information
    insuranceCompany: '',
    policyNumber: '',
    insuranceExpiryDate: '',
    insuranceImage: null as File | null,

    // Registration Information
    registrationExpiryDate: '',
    registrationImage: null as File | null,

    // Banking Information
    bankName: '',
    routingNumber: '',
    accountNumber: '',
    accountHolderName: '',

    // Additional Documents
    backgroundCheckConsent: false,
    profilePhoto: null as File | null,
    emergencyContactName: '',
    emergencyContactPhone: '',

    // Agreement
    termsAccepted: false,
    dataProcessingConsent: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const steps = [
    { number: 1, title: 'Personal Info', icon: User },
    { number: 2, title: 'License & Vehicle', icon: Car },
    { number: 3, title: 'Insurance & Registration', icon: Shield },
    { number: 4, title: 'Banking', icon: CreditCard },
    { number: 5, title: 'Documents & Review', icon: FileText }
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileUpload = (field: string, file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.firstName) newErrors.firstName = 'First name is required';
        if (!formData.lastName) newErrors.lastName = 'Last name is required';
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
        if (!formData.ssn) newErrors.ssn = 'SSN is required';
        if (!formData.email) newErrors.email = 'Email is required';
        if (!formData.phone) newErrors.phone = 'Phone number is required';
        if (!formData.address) newErrors.address = 'Address is required';
        break;
      case 2:
        if (!formData.licenseNumber) newErrors.licenseNumber = 'License number is required';
        if (!formData.licenseValidUntil) newErrors.licenseValidUntil = 'License expiry date is required';
        if (!formData.vehicleMake) newErrors.vehicleMake = 'Vehicle make is required';
        if (!formData.vehicleModel) newErrors.vehicleModel = 'Vehicle model is required';
        if (!formData.vehicleYear) newErrors.vehicleYear = 'Vehicle year is required';
        if (!formData.licensePlate) newErrors.licensePlate = 'License plate is required';
        break;
      case 3:
        if (!formData.insuranceCompany) newErrors.insuranceCompany = 'Insurance company is required';
        if (!formData.policyNumber) newErrors.policyNumber = 'Policy number is required';
        if (!formData.insuranceExpiryDate) newErrors.insuranceExpiryDate = 'Insurance expiry date is required';
        if (!formData.registrationExpiryDate) newErrors.registrationExpiryDate = 'Registration expiry date is required';
        break;
      case 4:
        if (!formData.bankName) newErrors.bankName = 'Bank name is required';
        if (!formData.routingNumber) newErrors.routingNumber = 'Routing number is required';
        if (!formData.accountNumber) newErrors.accountNumber = 'Account number is required';
        if (!formData.accountHolderName) newErrors.accountHolderName = 'Account holder name is required';
        break;
      case 5:
        if (!formData.backgroundCheckConsent) newErrors.backgroundCheckConsent = 'Background check consent is required';
        if (!formData.termsAccepted) newErrors.termsAccepted = 'Terms and conditions must be accepted';
        if (!formData.dataProcessingConsent) newErrors.dataProcessingConsent = 'Data processing consent is required';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (validateStep(5)) {
      setIsLoading(true);

      try {
        // Get auth token
        const auth = JSON.parse(localStorage.getItem('rideflow_auth') || '{}');
        if (!auth.token) {
          throw new Error('Authentication required');
        }

        // Submit application
        const response = await fetch('/api/drivers/apply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.token}`
          },
          body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
          // Upload documents if any
          if (formData.licenseImage || formData.insuranceImage || formData.registrationImage || formData.profilePhoto) {
            const formDataUpload = new FormData();

            if (formData.licenseImage) formDataUpload.append('licenseImage', formData.licenseImage);
            if (formData.insuranceImage) formDataUpload.append('insuranceImage', formData.insuranceImage);
            if (formData.registrationImage) formDataUpload.append('registrationImage', formData.registrationImage);
            if (formData.profilePhoto) formDataUpload.append('profilePhoto', formData.profilePhoto);

            const uploadResponse = await fetch('/api/drivers/documents', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${auth.token}`
              },
              body: formDataUpload
            });

            if (!uploadResponse.ok) {
              console.warn('Document upload failed, but application was submitted');
            }
          }

          onSubmit({
            ...formData,
            applicationId: data.applicationId,
            status: data.status,
            backgroundCheckId: data.backgroundCheckId
          });
          onClose();

          // Show success notification
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
          `;
          notification.innerHTML = `
            <div style="margin-bottom: 8px;">🎉 Driver Application Submitted!</div>
            <div style="font-size: 12px; opacity: 0.9;">Background check initiated. You'll receive updates via email.</div>
          `;
          document.body.appendChild(notification);
          setTimeout(() => document.body.removeChild(notification), 5000);

        } else {
          throw new Error(data.error || 'Application submission failed');
        }
      } catch (error) {
        console.error('Application submission error:', error);
        setErrors({ general: error.message });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const formatSSN = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,2})(\d{0,4})$/);
    if (match) {
      return [match[1], match[2], match[3]].filter(Boolean).join('-');
    }
    return cleaned;
  };

  if (!isOpen) return null;

  return (
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
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
              New Driver Enrollment
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
              Step {currentStep} of 5
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Steps */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.number === currentStep;
              const isCompleted = step.number < currentStep;

              return (
                <div key={step.number} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isCompleted ? '#10b981' : isActive ? '#3b82f6' : '#e2e8f0',
                    color: isCompleted || isActive ? 'white' : '#64748b'
                  }}>
                    {isCompleted ? <Check size={20} /> : <Icon size={20} />}
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: isActive ? '600' : '400',
                    color: isActive ? '#3b82f6' : '#64748b'
                  }}>
                    {step.title}
                  </span>
                  {index < steps.length - 1 && (
                    <div style={{
                      width: '24px',
                      height: '2px',
                      backgroundColor: step.number < currentStep ? '#10b981' : '#e2e8f0',
                      margin: '0 8px'
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div style={{ padding: '24px', overflow: 'auto', flex: 1 }}>
          {/* Header section - modified to include Pi symbol and larger font size for the title */}
          <div style={{
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            <h1 style={{
              fontSize: '64px',
              fontWeight: '800',
              color: '#1e293b',
              margin: '0 0 8px 0'
            }}>
              π Driver
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: '16px',
              margin: 0
            }}>
              Complete your driver application
            </p>
          </div>

          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.firstName ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.firstName && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.firstName}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.lastName ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.lastName && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.lastName}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Date of Birth *
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.dateOfBirth ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.dateOfBirth && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.dateOfBirth}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Social Security Number *
                </label>
                <input
                  type="text"
                  value={formData.ssn}
                  onChange={(e) => handleInputChange('ssn', formatSSN(e.target.value))}
                  placeholder="XXX-XX-XXXX"
                  maxLength={11}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.ssn ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.ssn && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.ssn}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.email ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.email && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.email}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.phone ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.phone && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.phone}</div>}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Address *
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.address ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.address && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.address}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 2: License & Vehicle */}
          {currentStep === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: '0 0 16px 0' }}>
                  Driver's License Information
                </h3>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  License Number *
                </label>
                <input
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.licenseNumber ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.licenseNumber && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.licenseNumber}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Valid Until *
                </label>
                <input
                  type="date"
                  value={formData.licenseValidUntil}
                  onChange={(e) => handleInputChange('licenseValidUntil', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.licenseValidUntil ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.licenseValidUntil && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.licenseValidUntil}</div>}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: '24px 0 16px 0' }}>
                  Vehicle Information
                </h3>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Make *
                </label>
                <input
                  type="text"
                  value={formData.vehicleMake}
                  onChange={(e) => handleInputChange('vehicleMake', e.target.value)}
                  placeholder="e.g., Toyota, Honda, Ford"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.vehicleMake ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.vehicleMake && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.vehicleMake}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Model *
                </label>
                <input
                  type="text"
                  value={formData.vehicleModel}
                  onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
                  placeholder="e.g., Camry, Accord, Focus"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.vehicleModel ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.vehicleModel && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.vehicleModel}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Year *
                </label>
                <input
                  type="number"
                  value={formData.vehicleYear}
                  onChange={(e) => handleInputChange('vehicleYear', e.target.value)}
                  min="2010"
                  max={new Date().getFullYear()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.vehicleYear ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.vehicleYear && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.vehicleYear}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  License Plate *
                </label>
                <input
                  type="text"
                  value={formData.licensePlate}
                  onChange={(e) => handleInputChange('licensePlate', e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.licensePlate ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.licensePlate && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.licensePlate}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Color
                </label>
                <input
                  type="text"
                  value={formData.vehicleColor}
                  onChange={(e) => handleInputChange('vehicleColor', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  VIN Number
                </label>
                <input
                  type="text"
                  value={formData.vehicleVin}
                  onChange={(e) => handleInputChange('vehicleVin', e.target.value.toUpperCase())}
                  maxLength={17}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 3: Insurance & Registration */}
          {currentStep === 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: '0 0 16px 0' }}>
                  Proof of Insurance
                </h3>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Insurance Company *
                </label>
                <input
                  type="text"
                  value={formData.insuranceCompany}
                  onChange={(e) => handleInputChange('insuranceCompany', e.target.value)}
                  placeholder="e.g., Geico, State Farm, Allstate"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.insuranceCompany ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.insuranceCompany && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.insuranceCompany}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Policy Number *
                </label>
                <input
                  type="text"
                  value={formData.policyNumber}
                  onChange={(e) => handleInputChange('policyNumber', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.policyNumber ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.policyNumber && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.policyNumber}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Insurance Expiry Date *
                </label>
                <input
                  type="date"
                  value={formData.insuranceExpiryDate}
                  onChange={(e) => handleInputChange('insuranceExpiryDate', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.insuranceExpiryDate ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.insuranceExpiryDate && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.insuranceExpiryDate}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Insurance Document
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload('insuranceImage', e.target.files?.[0] || null)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: '24px 0 16px 0' }}>
                  Vehicle Registration
                </h3>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Registration Expiry Date *
                </label>
                <input
                  type="date"
                  value={formData.registrationExpiryDate}
                  onChange={(e) => handleInputChange('registrationExpiryDate', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.registrationExpiryDate ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.registrationExpiryDate && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.registrationExpiryDate}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Registration Document
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload('registrationImage', e.target.files?.[0] || null)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 4: Banking Information */}
          {currentStep === 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{
                  backgroundColor: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  marginBottom: '24px'
                }}>
                  <AlertTriangle size={20} color="#f59e0b" />
                  <div>
                    <div style={{ fontWeight: '600', color: '#92400e' }}>
                      Secure Banking Information
                    </div>
                    <div style={{ fontSize: '14px', color: '#92400e', marginTop: '4px' }}>
                      Your banking details are encrypted and secure. This information is only used for driver payouts.
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Bank Name *
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  placeholder="e.g., Wells Fargo, Chase, Bank of America"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.bankName ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.bankName && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.bankName}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  value={formData.accountHolderName}
                  onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                  placeholder="Full name as shown on bank account"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.accountHolderName ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.accountHolderName && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.accountHolderName}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Routing Number *
                </label>
                <input
                  type="text"
                  value={formData.routingNumber}
                  onChange={(e) => handleInputChange('routingNumber', e.target.value.replace(/\D/g, ''))}
                  placeholder="9-digit routing number"
                  maxLength={9}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.routingNumber ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.routingNumber && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.routingNumber}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Account Number *
                </label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errors.accountNumber ? '1px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                {errors.accountNumber && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.accountNumber}</div>}
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: '0 0 16px 0' }}>
                  Emergency Contact
                </h3>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  value={formData.emergencyContactName}
                  onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 5: Documents & Review */}
          {currentStep === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: '0 0 16px 0' }}>
                  Additional Documents
                </h3>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Profile Photo
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload('profilePhoto', e.target.files?.[0] || null)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: '0 0 16px 0' }}>
                  Required Consents
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.backgroundCheckConsent}
                      onChange={(e) => handleInputChange('backgroundCheckConsent', e.target.checked)}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>
                        Background Check Consent *
                      </div>
                      <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                        I authorize the company to conduct a background check, including criminal history and driving record verification.
                      </div>
                    </div>
                  </label>
                  {errors.backgroundCheckConsent && <div style={{ color: '#ef4444', fontSize: '12px' }}>{errors.backgroundCheckConsent}</div>}

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.dataProcessingConsent}
                      onChange={(e) => handleInputChange('dataProcessingConsent', e.target.checked)}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>
                        Data Processing Consent *
                      </div>
                      <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                        I consent to the processing of my personal data for driver verification and platform operations.
                      </div>
                    </div>
                  </label>
                  {errors.dataProcessingConsent && <div style={{ color: '#ef4444', fontSize: '12px' }}>{errors.dataProcessingConsent}</div>}

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.termsAccepted}
                      onChange={(e) => handleInputChange('termsAccepted', e.target.checked)}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>
                        Terms and Conditions *
                      </div>
                      <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                        I have read and agree to the Terms and Conditions, Privacy Policy, and Driver Agreement.
                      </div>
                    </div>
                  </label>
                  {errors.termsAccepted && <div style={{ color: '#ef4444', fontSize: '12px' }}>{errors.termsAccepted}</div>}
                </div>
              </div>

              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: '0 0 12px 0' }}>
                  Next Steps
                </h4>
                <ul style={{ fontSize: '14px', color: '#64748b', margin: 0, paddingLeft: '20px' }}>
                  <li>Your application will be reviewed within 2-3 business days</li>
                  <li>Background check will be initiated upon application submission</li>
                  <li>Vehicle inspection will be scheduled once documents are approved</li>
                  <li>You'll receive email updates throughout the process</li>
                  <li>Driver onboarding will begin upon successful completion</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            style={{
              padding: '12px 24px',
              backgroundColor: currentStep === 1 ? '#f1f5f9' : '#f8fafc',
              color: currentStep === 1 ? '#94a3b8' : '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Previous
          </button>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {currentStep < 5 && (
              <button
                onClick={nextStep}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Next Step
              </button>
            )}

            {currentStep === 5 && (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: isLoading ? '#a7f3d0' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {isLoading ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverEnrollmentForm;