import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
// route-based lazy imports to avoid loading all pages on initial load
const Login = lazy(() => import('./pages/auth/login/login'));
const SignUp = lazy(() => import('./pages/auth/signup/signup'));
const OTP = lazy(() => import('./pages/auth/otp/otp'));
const MainLayout = lazy(() => import('./components/layout/main/MainLayout'));
// admin flow is handled inside the Login component now; OTP has its own route
import PrivateRoutes from './routes/PrivateRoutes';

function App() {
return (
<Router>
	<Suspense fallback={<div style={{minHeight: '100vh'}} /> }>
		<Routes>
{/* Auth Routes */}
	<Route path="/login" element={<Login />} />
	<Route path="/signup" element={<SignUp />} />
	<Route path="/otp" element={<OTP />} />

<Route path="/" element={<Navigate to="/login" replace />} />

{/* Protected Dashboard Route */}
			<Route
				path="/dashboard"
				element={
					<PrivateRoutes>
						<Suspense fallback={<div className="dashboard-wrapper">Loading...</div>}>
							<MainLayout title="Dashboard">
								<div className="dashboard-wrapper">
									<h2>Welcome to Your Dashboard</h2>
									<p>Your content goes here...</p>
								</div>
							</MainLayout>
						</Suspense>
					</PrivateRoutes>
				}
			/>

{/* Redirect any unknown routes to login */}
<Route path="*" element={<Navigate to="/login" replace />} />
		</Routes>
	</Suspense>
</Router>
)
}

export default App
