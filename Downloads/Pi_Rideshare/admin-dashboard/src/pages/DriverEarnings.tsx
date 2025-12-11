import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Download, 
  CreditCard, 
  FileText, 
  BarChart3,
  PieChart,
  Filter,
  Clock,
  Percent,
  Star,
  Target,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

interface EarningsData {
  period: string;
  totalEarnings: number;
  rideFare: number;
  tips: number;
  bonuses: number;
  fees: number;
  netEarnings: number;
  rides: number;
  hours: number;
  avgPerRide: number;
  avgPerHour: number;
}

interface PayoutMethod {
  id: string;
  type: 'bank' | 'debit' | 'paypal';
  name: string;
  details: string;
  isDefault: boolean;
  isVerified: boolean;
  addedDate: string;
}

interface PayoutHistory {
  id: string;
  amount: number;
  method: string;
  status: 'completed' | 'pending' | 'failed';
  date: string;
  fees: number;
  reference: string;
}

const DriverEarnings: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year'>('week');
  const [showPayoutMethods, setShowPayoutMethods] = useState(false);
  const [showTaxDocuments, setShowTaxDocuments] = useState(false);
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed' | 'payouts' | 'tax'>('overview');

  // Mock data - in real app, this would come from API
  const earningsData: Record<string, EarningsData> = {
    today: {
      period: 'Today',
      totalEarnings: 0, // Will be loaded from API
      rideFare: 210.00,
      tips: 32.50,
      bonuses: 15.00,
      fees: -10.00,
      netEarnings: 237.50,
      rides: 23,
      hours: 8.5,
      avgPerRide: 10.76,
      avgPerHour: 29.12
    },
    week: {
      period: 'This Week',
      totalEarnings: 1580.25,
      rideFare: 1320.00,
      tips: 180.25,
      bonuses: 145.00,
      fees: -65.00,
      netEarnings: 1515.25,
      rides: 156,
      hours: 42.5,
      avgPerRide: 10.13,
      avgPerHour: 37.18
    },
    month: {
      period: 'This Month',
      totalEarnings: 6420.80,
      rideFare: 5250.00,
      tips: 720.80,
      bonuses: 580.00,
      fees: -130.00,
      netEarnings: 6290.80,
      rides: 645,
      hours: 168,
      avgPerRide: 9.95,
      avgPerHour: 38.24
    },
    year: {
      period: 'This Year',
      totalEarnings: 48650.00,
      rideFare: 39800.00,
      tips: 5240.00,
      bonuses: 4250.00,
      fees: -640.00,
      netEarnings: 48010.00,
      rides: 4890,
      hours: 1250,
      avgPerRide: 9.95,
      avgPerHour: 38.92
    }
  };

  const payoutMethods: PayoutMethod[] = [
    {
      id: 'bank1',
      type: 'bank',
      name: 'Chase Bank',
      details: '****4567',
      isDefault: true,
      isVerified: true,
      addedDate: '2023-01-15'
    },
    {
      id: 'debit1',
      type: 'debit',
      name: 'GoBank Debit',
      details: '****8901',
      isDefault: false,
      isVerified: true,
      addedDate: '2023-03-20'
    }
  ];

  const payoutHistory: PayoutHistory[] = [
    {
      id: 'P001',
      amount: 1515.25,
      method: 'Chase Bank ****4567',
      status: 'completed',
      date: '2024-01-08',
      fees: 0,
      reference: 'TXN-7891234567'
    },
    {
      id: 'P002',
      amount: 1280.50,
      method: 'Chase Bank ****4567',
      status: 'completed',
      date: '2024-01-01',
      fees: 0,
      reference: 'TXN-7891234566'
    },
    {
      id: 'P003',
      amount: 850.75,
      method: 'GoBank Debit ****8901',
      status: 'pending',
      date: '2024-01-07',
      fees: 0.50,
      reference: 'TXN-7891234565'
    }
  ];

  const currentData = earningsData[selectedPeriod];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getPayoutMethodIcon = (type: string) => {
    switch (type) {
      case 'bank': return <CreditCard size={20} />;
      case 'debit': return <CreditCard size={20} />;
      case 'paypal': return <ExternalLink size={20} />;
      default: return <CreditCard size={20} />;
    }
  };

  return (
    <div style={{
      maxWidth: '450px',
      margin: '0 auto',
      height: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        color: 'white',
        padding: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <DollarSign size={24} />
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>
            Driver Earnings
          </h1>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '4px'
        }}>
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'detailed', label: 'Details', icon: PieChart },
            { key: 'payouts', label: 'Payouts', icon: CreditCard },
            { key: 'tax', label: 'Tax', icon: FileText }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedView(tab.key as any)}
              style={{
                flex: 1,
                background: selectedView === tab.key ? 'rgba(255,255,255,0.2)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 4px',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s ease'
              }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {selectedView === 'overview' && (
          <>
            {/* Period Selector */}
            <div style={{
              display: 'flex',
              background: 'white',
              borderRadius: '12px',
              padding: '4px',
              marginBottom: '20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {[
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'Week' },
                { key: 'month', label: 'Month' },
                { key: 'year', label: 'Year' }
              ].map((period) => (
                <button
                  key={period.key}
                  onClick={() => setSelectedPeriod(period.key as any)}
                  style={{
                    flex: 1,
                    background: selectedPeriod === period.key ? '#3b82f6' : 'transparent',
                    color: selectedPeriod === period.key ? 'white' : '#6b7280',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {period.label}
                </button>
              ))}
            </div>

            {/* Main Earnings Card */}
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '16px',
              padding: '24px',
              color: 'white',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>
                {currentData.period} Net Earnings
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px' }}>
                {formatCurrency(currentData.netEarnings)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{currentData.rides}</div>
                  <div style={{ opacity: 0.8 }}>Rides</div>
                </div>
                <div>
                  <div style={{ fontWeight: '600' }}>{currentData.hours}h</div>
                  <div style={{ opacity: 0.8 }}>Online</div>
                </div>
                <div>
                  <div style={{ fontWeight: '600' }}>{formatCurrency(currentData.avgPerHour)}</div>
                  <div style={{ opacity: 0.8 }}>Per Hour</div>
                </div>
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#1f2937' }}>
                Earnings Breakdown
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>Ride Fare</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                    {formatCurrency(currentData.rideFare)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>Tips</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                    {formatCurrency(currentData.tips)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>Bonuses</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                    {formatCurrency(currentData.bonuses)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>Platform Fees</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444' }}>
                    {formatCurrency(currentData.fees)}
                  </span>
                </div>

                <div style={{ height: '1px', background: '#e5e7eb', margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>Net Earnings</span>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>
                    {formatCurrency(currentData.netEarnings)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <button
                onClick={() => setSelectedView('payouts')}
                style={{
                  background: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <CreditCard size={20} color="#3b82f6" />
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                  Instant Payout
                </span>
              </button>

              <button
                onClick={() => setSelectedView('tax')}
                style={{
                  background: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <FileText size={20} color="#f59e0b" />
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                  Tax Documents
                </span>
              </button>
            </div>
          </>
        )}

        {selectedView === 'detailed' && (
          <>
            {/* Performance Metrics */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#1f2937' }}>
                Performance Metrics
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#3b82f6' }}>
                    {formatCurrency(currentData.avgPerRide)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Avg per Ride</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981' }}>
                    {formatCurrency(currentData.avgPerHour)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Avg per Hour</div>
                </div>
              </div>
            </div>

            {/* Commission Structure */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#1f2937' }}>
                Commission Structure
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: '8px'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>Platform Fee</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Standard commission</div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>25%</div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  background: '#f0f9ff',
                  borderRadius: '8px'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>You Keep</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Your earnings</div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>75%</div>
                </div>
              </div>
            </div>

            {/* Weekly Goals */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#1f2937' }}>
                Weekly Goals
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>Rides Goal</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>156/200</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: '78%',
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>Earnings Goal</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                      {formatCurrency(currentData.netEarnings)}/{formatCurrency(2000)}
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: '76%',
                      height: '100%',
                      background: 'linear-gradient(90deg, #10b981, #059669)',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedView === 'payouts' && (
          <>
            {/* Available Balance */}
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              borderRadius: '16px',
              padding: '20px',
              color: 'white',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>
                Available for Payout
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '12px' }}>
                {formatCurrency(currentData.netEarnings)}
              </div>
              <button style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                padding: '10px 20px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                Request Instant Payout
              </button>
            </div>

            {/* Payout Methods */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                  Payout Methods
                </h3>
                <button style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>
                  Add Method
                </button>
              </div>

              {payoutMethods.map((method) => (
                <div key={method.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  border: '2px solid',
                  borderColor: method.isDefault ? '#3b82f6' : '#e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ color: '#6b7280' }}>
                      {getPayoutMethodIcon(method.type)}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                        {method.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {method.details} {method.isDefault && '• Default'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {method.isVerified ? (
                      <CheckCircle size={16} color="#10b981" />
                    ) : (
                      <AlertCircle size={16} color="#f59e0b" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Payout History */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#1f2937' }}>
                Payout History
              </h3>

              {payoutHistory.map((payout) => (
                <div key={payout.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                      {formatCurrency(payout.amount)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {payout.method} • {payout.date}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      background: payout.status === 'completed' ? '#f0fdf4' : 
                                 payout.status === 'pending' ? '#fefce8' : '#fef2f2',
                      color: getStatusColor(payout.status)
                    }}>
                      {payout.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {selectedView === 'tax' && (
          <>
            {/* Tax Summary */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#1f2937' }}>
                2024 Tax Summary
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{
                  padding: '16px',
                  background: '#f0f9ff',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d4ed8' }}>
                    {formatCurrency(48010)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Earnings</div>
                </div>
                <div style={{
                  padding: '16px',
                  background: '#f0fdf4',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669' }}>
                    {formatCurrency(8640)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Estimated Tax</div>
                </div>
              </div>

              <div style={{
                background: '#fef3c7',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Info size={16} color="#d97706" />
                <div style={{ fontSize: '12px', color: '#92400e' }}>
                  Tax estimates are based on 18% effective rate. Consult a tax professional for accurate calculations.
                </div>
              </div>
            </div>

            {/* Tax Documents */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#1f2937' }}>
                Tax Documents
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={20} color="#3b82f6" />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                        2024 1099-NEC
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Available January 31, 2025
                      </div>
                    </div>
                  </div>
                  <button style={{
                    background: '#f3f4f6',
                    color: '#6b7280',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'not-allowed'
                  }}>
                    Pending
                  </button>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={20} color="#10b981" />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                        2023 1099-NEC
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Tax year 2023 summary
                      </div>
                    </div>
                  </div>
                  <button style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Download size={12} />
                    Download
                  </button>
                </div>
              </div>
            </div>

            {/* Tax Tips */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#1f2937' }}>
                Tax Tips for Drivers
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  borderLeft: '4px solid #3b82f6'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                    Track Your Mileage
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Business mileage is tax deductible at $0.655 per mile for 2023.
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  borderLeft: '4px solid #10b981'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                    Vehicle Expenses
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Gas, maintenance, insurance, and car payments may be deductible.
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  borderLeft: '4px solid #f59e0b'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                    Quarterly Payments
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Consider making quarterly estimated tax payments to avoid penalties.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DriverEarnings;