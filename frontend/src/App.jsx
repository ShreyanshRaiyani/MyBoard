import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/main/MainLayout';
import Login from './pages/auth/login/login';
import SignUp from './pages/auth/signup/signup';
import OTP from './pages/auth/otp/otp';
// admin flow is handled inside the Login component now; OTP has its own route
import PrivateRoutes from './routes/PrivateRoutes';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/otp" element={<OTP />} />
        
        {/* Protected Dashboard Route */}
        <Route
          path="/"
          element={
            <PrivateRoutes>
              <MainLayout title="Dashboard">
                <div className="dashboard-wrapper">
                  <h2>Welcome to Your Dashboard</h2>
                  <p>Your content goes here...</p>
                </div>
              </MainLayout>
            </PrivateRoutes>
          }
        />
        
        {/* Redirect any unknown routes to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}

export default App
