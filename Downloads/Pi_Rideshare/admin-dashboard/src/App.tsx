import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import RiderApp from './pages/RiderApp';
import RiderAuthFixed from './pages/RiderAuthFixed';
import DriverApp from './pages/DriverApp';
import DriverManagement from './pages/DriverManagement';
import RiderManagement from './pages/RiderManagement';
import RideManagement from './pages/RideManagement';
import Analytics from './pages/Analytics';
import Dispatch from './pages/Dispatch';
import RideHistory from './pages/RideHistory';
import Settings from './pages/Settings';
import Payment from './pages/Payment';
import Profile from './pages/Profile';
import Inbox from './pages/Inbox';
import DriverEarnings from './pages/DriverEarnings';
import AirportQueue from './pages/AirportQueue';
import SurgeMap from './pages/SurgeMap';
import SurgeControl from './pages/SurgeControl';
import MarketManagement from './pages/MarketManagement';
import DisputeResolution from './pages/DisputeResolution';
import CorporateManagement from './pages/CorporateManagement';
import CorporateApplications from './pages/CorporateApplications';
import DriverBadgeVerification from './pages/DriverBadgeVerification';
import RiderBadgeUpload from './components/RiderBadgeUpload';
import DriverDocumentUpload from './components/DriverDocumentUpload';
import CarDemo from './pages/CarDemo';
import AppSelector from './pages/AppSelector';
import DownloadRider from './pages/DownloadRider';
import DownloadDriver from './pages/DownloadDriver';
import RiderBadgeVerification from './pages/RiderBadgeVerification';
import PushNotifications from './pages/PushNotifications';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* App Selection */}
        <Route path="/" element={<AppSelector />} />
        
        {/* Download/Install Pages */}
        <Route path="/download-rider" element={<DownloadRider />} />
        <Route path="/download-driver" element={<DownloadDriver />} />
        
        {/* Public routes */}
        <Route path="/rider" element={<RiderApp />} />
        <Route path="/rider/auth" element={<RiderAuthFixed />} />
        <Route path="/rider/badge-upload" element={<RiderBadgeUpload />} />
        <Route path="/driver" element={<DriverApp />} />
        <Route path="/driver/earnings" element={<DriverEarnings />} />
        <Route path="/driver/documents" element={<DriverDocumentUpload />} />
        <Route path="/airport-queue" element={<AirportQueue />} />
        <Route path="/car-demo" element={<CarDemo />} />

        {/* Admin Dashboard routes with Layout */}
        <Route path="/dashboard" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="drivers" element={<DriverManagement />} />
          <Route path="riders" element={<RiderManagement />} />
          <Route path="rides" element={<RideManagement />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="dispatch" element={<Dispatch />} />
          <Route path="history" element={<RideHistory />} />
          <Route path="settings" element={<Settings />} />
          <Route path="payment" element={<Payment />} />
          <Route path="profile" element={<Profile />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="markets" element={<MarketManagement />} />
          <Route path="surge-map" element={<SurgeMap />} />
          <Route path="surge-control" element={<SurgeControl />} />
          <Route path="disputes" element={<DisputeResolution />} />
          <Route path="corporations" element={<CorporateManagement />} />
          <Route path="corporate-applications" element={<CorporateApplications />} />
          <Route path="rider-badge-verification" element={<RiderBadgeVerification />} />
          <Route path="driver-badge-verification" element={<DriverBadgeVerification />} />
          <Route path="push-notifications" element={<PushNotifications />} />
        </Route>
      </Routes>
    </Router>
  );
}