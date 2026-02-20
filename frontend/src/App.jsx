import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout.jsx';

import Login from './pages/auth/Login.jsx';
import SignUp from './pages/auth/SignUp.jsx';
import OTP from './pages/auth/Otp.jsx';

import SuperAdminDashboard from './pages/SuperAdmin/Dashboard.jsx';
import HoardingDashboard from './pages/hoardingOwner/HoardingDashboard.jsx';
import BannerDashboard from './pages/bannerUser/BannerDashboard.jsx';
import WorkerDashboard from './pages/worker/WorkerDashboard.jsx';

import HoardingIndex from './pages/hoarding/HoardingIndex.jsx';
import HoardingCreate from './pages/hoarding/HoardingCreate.jsx';
import HoardingView from './pages/hoarding/HoardingView.jsx';

import Master from './pages/master/Master.jsx';
import Country from './pages/master/Country.jsx';
import State from './pages/master/State.jsx';
import City from './pages/master/City.jsx';
import Area from './pages/master/Area.jsx';

function App() {
  const DashboardRouter = () => {
    const token = localStorage.getItem('token');
    const userTypeRaw = localStorage.getItem('userType') || '';
    const userType = String(userTypeRaw);

    if (!token) return <Navigate to="/login" />;

    switch (userType) {
      case 'SuperAdmin':
        return <SuperAdminDashboard />;
      case 'HoardingOwner':
        return <HoardingDashboard />;
      case 'BannerUser':
        return <BannerDashboard />;
      case 'Worker':
        return <WorkerDashboard />;
      default:
        return <SuperAdminDashboard />;
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/otp" element={<OTP />} />

        {/* App routes wrapped in MainLayout */}
        <Route path="/" element={<MainLayout />}> 
          <Route path="dashboard" element={<DashboardRouter />} />

          {/* Hoarding CRUD */}
          <Route path="hoarding" element={<HoardingIndex />} />
          <Route path="hoarding/create" element={<HoardingCreate />} />
          <Route path="hoarding/edit/:id" element={<HoardingCreate />} />
          <Route path="hoarding/:id" element={<HoardingView />} />

          {/* Master pages */}
          <Route path="master" element={<Master />} />
          <Route path="master/:type" element={<Master />} />
          <Route path="master/country" element={<Country />} />
          <Route path="master/state" element={<State />} />
          <Route path="master/city" element={<City />} />
          <Route path="master/area" element={<Area />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;