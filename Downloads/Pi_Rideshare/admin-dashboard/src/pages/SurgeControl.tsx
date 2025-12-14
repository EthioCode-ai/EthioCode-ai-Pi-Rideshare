
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  MapPin, 
  Settings, 
  AlertCircle, 
  Clock, 
  Users, 
  DollarSign,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Save,
  CheckCircle
} from 'lucide-react';
import { marketService, Market } from '../utils/marketService';
import { apiUrl } from '../config/api.config';

interface SurgeZone {
  id: string;
  name: string;
  marketId?: string;
  coordinates: { lat: number; lng: number };
  radius: number;
  surgeMultiplier: number;
  isManualOverride: boolean;
  demandLevel: 'low' | 'medium' | 'high' | 'extreme';
  activeDrivers: number;
  waitingRiders: number;
  lastUpdated: Date;
  isAirport?: boolean;
  airportCode?: string;
  queueLength?: number;
  avgWaitTime?: string;
}

const SurgeControl: React.FC = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [surgeZones, setSurgeZones] = useState<SurgeZone[]>([]);
  const [globalSurgeEnabled, setGlobalSurgeEnabled] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<string>('all');
  const [maxSurgeMultiplier, setMaxSurgeMultiplier] = useState(3.0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showAirportZones, setShowAirportZones] = useState(true);
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    loadMarkets();
    loadSurgeZones();
    loadExistingOverrides();
  }, []);

  const loadMarkets = () => {
    const allMarkets = marketService.getAllMarkets();
    setMarkets(allMarkets);
  };

  const loadSurgeZones = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(apiUrl('api/admin/surge/zones'), {
      headers: {
      'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const transformedZones: SurgeZone[] = data.zones.map((zone: any) => ({
          id: zone.id,
          name: zone.zone_name,
          marketId: zone.zone_code?.toLowerCase() || 'unknown',
          coordinates: { lat: parseFloat(zone.latitude), lng: parseFloat(zone.longitude) },
          radius: parseFloat(zone.radius),
          surgeMultiplier: parseFloat(zone.base_multiplier) + 1.0, // Convert 0.5 base to 1.5 display
          isManualOverride: false,
          demandLevel: zone.zone_type === 'airport' ? 'high' : 'medium',
          activeDrivers: zone.active_drivers || 0,
          waitingRiders: zone.waiting_riders || 0,
          lastUpdated: new Date(),
          isAirport: zone.zone_type === 'airport',
          airportCode: zone.zone_code,
          queueLength: zone.queue_length || 0,
          avgWaitTime: zone.avg_wait_time || '0 min'
        }));
        
        setSurgeZones(transformedZones);
        console.log(`📊 Loaded ${transformedZones.length} real surge zones from database`);
      } else {
        console.error('Failed to load surge zones');
        // Fallback to empty array
        setSurgeZones([]);
      }
    } catch (error) {
      console.error('Error loading surge zones:', error);
      setSurgeZones([]);
    }
  };

  const loadExistingOverrides = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(apiUrl('api/admin/surge/overrides'), {
      headers: {
      'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const overrides = data.overrides;
        
        // Apply existing overrides to surge zones
        setSurgeZones(zones => zones.map(zone => {
          const override = overrides.find((o: any) => o.zone_code === zone.id || o.zone_name === zone.name);
          if (override) {
            return {
              ...zone,
              surgeMultiplier: parseFloat(override.manual_multiplier) + 1.0,
              isManualOverride: true
            };
          }
          return zone;
        }));
        
        console.log(`📊 Loaded ${overrides.length} existing manual overrides`);
      } else {
        console.warn('Failed to load existing overrides, continuing without them');
      }
    } catch (error) {
      console.warn('Error loading existing overrides:', error);
      // Continue without overrides rather than throwing
    }
  };

  const saveAllChanges = async () => {
    try {
      setIsSaving(true);
      
      // Get all zones that have manual overrides or unsaved changes
      const overridesToSave = surgeZones
        .filter(zone => zone.isManualOverride || unsavedChanges.has(zone.id))
        .map(zone => ({
          zoneId: zone.id,
          surgeMultiplier: zone.surgeMultiplier - 1.0, // Convert display (1.5x) to database (0.5)
          isManualOverride: zone.isManualOverride,
          overrideReason: 'Admin panel manual adjustment'
        }));

      console.log(`💾 Saving ${overridesToSave.length} zone overrides:`, overridesToSave);

      const token = localStorage.getItem('authToken');
      const response = await fetch(apiUrl('api/admin/surge/bulk-save'), {
      method: 'POST',
      headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
     },
     body: JSON.stringify({ overrides: overridesToSave })
  });

      if (response.ok) {
        const data = await response.json();
        console.log(`💾 ${data.message}`);
        
        // Clear unsaved changes
        setUnsavedChanges(new Set());
        setLastSavedAt(new Date());
      } else {
        throw new Error('Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSurgeMultiplier = async (zoneId: string, newMultiplier: number) => {
    try {
      // Update local state
      setSurgeZones(zones => zones.map(zone => 
        zone.id === zoneId 
          ? { ...zone, surgeMultiplier: newMultiplier, isManualOverride: true, lastUpdated: new Date() }
          : zone
      ));

      // Track as unsaved change
      setUnsavedChanges(prev => new Set([...prev, zoneId]));

      console.log(`⚡ Surge updated locally for zone ${zoneId}: ${newMultiplier}x (unsaved)`);
    } catch (error) {
      console.error('Error updating surge:', error);
    }
  };

  const resetToAutomatic = async (zoneId: string) => {
    try {
      setSurgeZones(zones => zones.map(zone => 
        zone.id === zoneId 
          ? { ...zone, isManualOverride: false, lastUpdated: new Date() }
          : zone
      ));

      // Track as unsaved change
      setUnsavedChanges(prev => new Set([...prev, zoneId]));

      console.log(`🔄 Surge reset to automatic locally for zone ${zoneId} (unsaved)`);
    } catch (error) {
      console.error('Error resetting surge:', error);
    }
  };

  const toggleGlobalSurge = async () => {
    try {
      const newState = !globalSurgeEnabled;
      setGlobalSurgeEnabled(newState);

      const token = localStorage.getItem('authToken');
      const response = await fetch(apiUrl('api/admin/surge/global-toggle'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ enabled: newState })
      });

      if (response.ok) {
        console.log(`✅ Global surge ${newState ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error('Error toggling global surge:', error);
    }
  };

  const updateMaxSurge = async (newMax: number) => {
    try {
      setMaxSurgeMultiplier(newMax);

      const token = localStorage.getItem('authToken');
      const response = await fetch(apiUrl('api/admin/surge/max-multiplier'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer demo-rider-token'
        },
        body: JSON.stringify({ maxMultiplier: newMax })
      });

      if (response.ok) {
        console.log(`✅ Max surge multiplier updated to ${newMax}x`);
      }
    } catch (error) {
      console.error('Error updating max surge:', error);
    }
  };

  const getDemandColor = (level: string) => {
    switch (level) {
      case 'extreme': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#16a34a';
      default: return '#6b7280';
    }
  };

  const getSurgeColor = (multiplier: number) => {
    if (multiplier >= 2.5) return '#dc2626';
    if (multiplier >= 2.0) return '#ea580c';
    if (multiplier >= 1.5) return '#d97706';
    return '#16a34a';
  };

  const filteredZones = selectedMarket === 'all' 
    ? surgeZones.filter(zone => showAirportZones || !zone.isAirport)
    : surgeZones.filter(zone => zone.marketId === selectedMarket && (showAirportZones || !zone.isAirport));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' }}>
            Surge Control Center
          </h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
            Monitor and control surge pricing across all markets
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: autoRefresh ? '#10b981' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {autoRefresh ? <Play size={16} /> : <Pause size={16} />}
            Auto Refresh
          </button>
          
          <button
            onClick={toggleGlobalSurge}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 24px',
              backgroundColor: globalSurgeEnabled ? '#dc2626' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <Zap size={16} />
            {globalSurgeEnabled ? 'Disable' : 'Enable'} Global Surge
          </button>
        </div>
      </div>

      {/* Global Controls */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#1e293b' }}>
          Global Surge Settings
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Market Filter
            </label>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: 'white'
              }}
            >
              <option value="all">All Markets</option>
              {markets.map(market => (
                <option key={market.id} value={market.id}>
                  {market.city}, {market.state}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Zone Types
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', height: '44px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showAirportZones}
                  onChange={(e) => setShowAirportZones(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Show Airports
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Maximum Surge Multiplier: {maxSurgeMultiplier}x
            </label>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              value={maxSurgeMultiplier}
              onChange={(e) => updateMaxSurge(Number(e.target.value))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '5px',
                background: '#e5e7eb',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              <span>1.0x</span>
              <span>5.0x</span>
            </div>
          </div>

          <div style={{
            backgroundColor: globalSurgeEnabled ? '#dcfce7' : '#fef2f2',
            padding: '16px',
            borderRadius: '12px',
            border: `2px solid ${globalSurgeEnabled ? '#16a34a' : '#dc2626'}`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: globalSurgeEnabled ? '#15803d' : '#dc2626', marginBottom: '4px' }}>
              Global Surge Status
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: globalSurgeEnabled ? '#15803d' : '#dc2626' }}>
              {globalSurgeEnabled ? 'ACTIVE' : 'DISABLED'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={saveAllChanges}
              disabled={unsavedChanges.size === 0 || isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 16px',
                backgroundColor: unsavedChanges.size > 0 ? '#059669' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: unsavedChanges.size > 0 && !isSaving ? 'pointer' : 'not-allowed',
                opacity: isSaving ? 0.7 : 1
              }}
            >
              {isSaving ? (
                <>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid white', 
                    borderTop: '2px solid transparent', 
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
            
            {unsavedChanges.size > 0 && (
              <div style={{ 
                fontSize: '12px', 
                color: '#dc2626', 
                textAlign: 'center',
                fontWeight: '600'
              }}>
                {unsavedChanges.size} unsaved change{unsavedChanges.size !== 1 ? 's' : ''}
              </div>
            )}
            
            {lastSavedAt && (
              <div style={{ 
                fontSize: '12px', 
                color: '#10b981', 
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}>
                <CheckCircle size={12} />
                Saved {lastSavedAt.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Surge Zones Grid */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {filteredZones.map((zone) => (
          <div key={zone.id} style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 150px 150px', gap: '24px', alignItems: 'center' }}>
              {/* Zone Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                    {zone.isAirport ? `${zone.airportCode} - ${zone.name}` : zone.name}
                  </h4>
                  {zone.isManualOverride && (
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      MANUAL
                    </span>
                  )}
                  {zone.isAirport && (
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: '#dbeafe',
                      color: '#1d4ed8',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      AIRPORT
                    </span>
                  )}
                  {unsavedChanges.has(zone.id) && (
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      ● UNSAVED
                    </span>
                  )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={14} />
                    {zone.isAirport ? `${(zone.radius / 1000).toFixed(1)}km radius` : markets.find(m => m.id === zone.marketId)?.city}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} />
                    Updated {zone.lastUpdated.toLocaleTimeString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
                    🚗 {zone.isAirport ? zone.queueLength : zone.activeDrivers} {zone.isAirport ? 'in queue' : 'drivers'}
                  </div>
                  {zone.isAirport && zone.avgWaitTime && (
                    <div style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
                      ⏱️ {zone.avgWaitTime} avg wait
                    </div>
                  )}
                  {!zone.isAirport && (
                    <div style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
                      👤 {zone.waitingRiders} waiting
                    </div>
                  )}
                  <div style={{ 
                    fontSize: '12px', 
                    padding: '4px 8px', 
                    backgroundColor: `${getDemandColor(zone.demandLevel)}20`,
                    color: getDemandColor(zone.demandLevel),
                    borderRadius: '6px',
                    fontWeight: '600'
                  }}>
                    {zone.demandLevel.toUpperCase()} DEMAND
                  </div>
                </div>
              </div>

              {/* Surge Multiplier Display */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
                  Current Surge
                </div>
                <div style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  color: getSurgeColor(zone.surgeMultiplier),
                  marginBottom: '4px'
                }}>
                  {zone.surgeMultiplier.toFixed(1)}x
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  +${((zone.surgeMultiplier - 1) * 15).toFixed(0)} avg
                </div>
              </div>

              {/* Manual Override Controls */}
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
                  Manual Override
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="range"
                    min="1.0"
                    max={maxSurgeMultiplier}
                    step="0.1"
                    value={zone.surgeMultiplier}
                    onChange={(e) => updateSurgeMultiplier(zone.id, Number(e.target.value))}
                    style={{
                      width: '100%',
                      height: '4px',
                      borderRadius: '5px',
                      background: '#e5e7eb',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#6b7280' }}>
                    <span>1.0x</span>
                    <span>{maxSurgeMultiplier}x</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => resetToAutomatic(zone.id)}
                  disabled={!zone.isManualOverride}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    backgroundColor: zone.isManualOverride ? '#10b981' : '#f1f5f9',
                    color: zone.isManualOverride ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: zone.isManualOverride ? 'pointer' : 'not-allowed'
                  }}
                >
                  <RotateCcw size={12} />
                  Auto
                </button>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => updateSurgeMultiplier(zone.id, Math.min(maxSurgeMultiplier, zone.surgeMultiplier + 0.5))}
                    style={{
                      flex: 1,
                      padding: '6px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    +0.5x
                  </button>
                  <button
                    onClick={() => updateSurgeMultiplier(zone.id, Math.max(1.0, zone.surgeMultiplier - 0.5))}
                    style={{
                      flex: 1,
                      padding: '6px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    -0.5x
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginTop: '24px',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#1e293b' }}>
          Surge Summary
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
              {filteredZones.filter(z => z.isManualOverride).length}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Manual Overrides</div>
          </div>
          
          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
              {filteredZones.filter(z => z.surgeMultiplier > 1.5).length}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>High Surge Zones</div>
          </div>
          
          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
              {(filteredZones.reduce((sum, z) => sum + z.surgeMultiplier, 0) / filteredZones.length).toFixed(1)}x
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Average Surge</div>
          </div>
          
          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
              ${((filteredZones.reduce((sum, z) => sum + z.surgeMultiplier, 0) / filteredZones.length - 1) * 15 * 100).toFixed(0)}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Est. Extra Revenue/Day</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurgeControl;
