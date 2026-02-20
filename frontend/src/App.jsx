import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import SignUp from "./pages/auth/SignUp";
import OTP from "./pages/auth/OTP";
import Dashboard from "./pages/SuperAdmin/Dashboard"; 
import HoardingDashboard from "./pages/HoardingOwner/HoardingDashboard";
import BannerDashboard from "./pages/BannerUser/BannerDashboard";
import WorkerDashboard from "./pages/Worker/WorkerDashboard";
import Master from "./pages/master/Master.jsx";
import Country from "./pages/master/Country.jsx";
import State from "./pages/master/State.jsx";
import City from "./pages/master/City.jsx";
import Area from "./pages/master/Area.jsx";

function App() {
  const DashboardRouter = () => {
    const token = localStorage.getItem('token');
    const userTypeRaw = localStorage.getItem('userType') || '';
    const userType = String(userTypeRaw);

    if (!token) return <Navigate to="/login" />;

    switch (userType) {
      case 'SuperAdmin':
        return <Dashboard />;

      case 'HoardingOwner':
        return <HoardingDashboard />;

      case 'BannerUser':
        return <BannerDashboard />;

      case 'Worker':
        return <WorkerDashboard />;

      default:
        return <Dashboard />;
    }
  };

  return (
    <BrowserRouter>
      <Routes>

        
        <Route path="/" element={<Navigate to="/login" />} />

  
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/otp" element={<OTP />} />

        {/* Master pages */}
        <Route path="/master" element={<Master />} />
        <Route path="/master/:type" element={<Master />} />
        <Route path="/master/country" element={<Country />} />
        <Route path="/master/state" element={<State />} />
        <Route path="/master/city" element={<City />} />
        <Route path="/master/area" element={<Area />} />

      
        <Route path="/dashboard" element={<DashboardRouter />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
