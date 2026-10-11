import React, { useState } from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/images/logo.svg';
import axiosInstance from '../../utils/axiosInstance';
import { toastSuccess, toastError } from '../../utils/alertHelper';
import { storeUserToLocal } from '../../utils/authHelper';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'admin'
  const [adminPassword, setAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userObj, setUserObj] = useState(null);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const otpLength = 4;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await axiosInstance.post('/user/login', { email });
      console.debug('Login email response:', res && res.data ? res.data : res);
      const data = res?.data || {};
      const user = data.user || (data.data && data.data.user) || null;
      const token = data?.token || (data.data && data.data.token) || data?.UserToken || (data.data && data.data.UserToken) || '';

      // Some backends may return a token during email-only request; require an explicit
      // flag that authentication is complete before auto-signing in. This prevents
      // unexpectedly landing on the dashboard when OTP/password step is expected.
      const authComplete = Boolean(
        data?.isAuthenticated || data?.authComplete || data?.authenticated || data?.loginComplete
      );

      console.debug('Parsed login:', { user, token, authComplete, data });

      if (authComplete && token && user) {
        try { storeUserToLocal(user, token, 'true'); } catch (err) { console.warn('storeUserToLocal failed', err); }
        toastSuccess(res?.data?.Message || 'Signed in');
        navigate('/dashboard');
      } else if (user) {
        // Partial info received — proceed to OTP or admin-password step
        try { storeUserToLocal(user, '', 'false'); } catch (err) { console.warn('storeUserToLocal failed', err); }
        const userType = (user.userType || '').toLowerCase();
        if (userType === 'admin' || userType === 'superadmin') {
          setStep('admin');
        } else {
          // ensure email saved so OTP can find it
          localStorage.setItem('email', email || user.email || '');
          navigate('/otp');
        }
      } else {
        toastError(data?.Message || 'Email not found');
      }
    } catch (err) {
      console.warn('handleSubmit error', err);
      toastError(err?.response?.data?.Message || err?.message || 'Failed to check user');
    }
    setIsSubmitting(false);
  };

  const submitAdmin = async (e) => {
    e.preventDefault();
    if (!adminPassword) return;
    setIsSubmitting(true);
    try {
      const res = await axiosInstance.post('/user/login', { email, password: adminPassword });
      const payload = res?.data?.data || res?.data || {};
      const user = payload.user || payload;
      const token = payload?.token || res?.data?.token || payload?.UserToken || '';
      if (user) {
        try { storeUserToLocal(user, token, 'true'); } catch (err) { console.warn('storeUserToLocal failed', err); }
        toastSuccess(res?.data?.Message || 'Signed in');
        navigate('/dashboard');
      } else {
        toastError(res?.data?.Message || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Admin login failed', err);
      toastError('Admin sign-in failed');
    }
    setIsSubmitting(false);
  };

  const backToEmail = () => {
    setStep('email');
    setAdminPassword('');
  };

  return (
    <div className="hoarding-scene">
      {/* Sky Background */}
      <div className="sky-background"></div>

      {/* Billboard Structure */}
      <div className="billboard-structure">
        {/* Support Poles */}
        <div className="support-pole pole-left"></div>
        <div className="support-pole pole-right"></div>
        <div className="cross-beam"></div>

        {/* Billboard Panel */}
        <div className="billboard-panel">
          {/* Panel Lights */}
          <div className="panel-lights">
            <div className="light"></div>
            <div className="light"></div>
            <div className="light"></div>
            <div className="light"></div>
          </div>

          {/* Billboard Content */}
          <div className="billboard-content">
            <div className="billboard-branding">
              <div className="brand-logo">
                <img src={logo} alt="MyBoard Logo" />
              </div>
              <h1 className="brand-name">MyBoard</h1>
            </div>

            {/* Login / OTP / Admin Form Card */}
            <div className="billboard-form-card card">
              {step === 'email' && (
                <>
                  <h2>Welcome Back</h2>
                  <p className="form-subtitle">Enter your email to continue</p>

                  <form onSubmit={handleSubmit} className="billboard-form">
                    <div className="form-group">
                      <label htmlFor="email">Email Address</label>
                      <div className="input-wrapper">
                        <Mail className="input-icon" size={20} />
                        <input
                          type="email"
                          id="email"
                          name="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="input"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    <button type="submit" className="submit-button">
                      <span>Continue</span>
                      <ArrowRight size={20} />
                    </button>
                  </form>

                  <div className="form-footer">
                    Don't have an account? <a href="/signup">Sign Up</a>
                  </div>
                </>
              )}


              {step === 'admin' && (
                <>
                  <h2>Admin Sign In</h2>
                  <p className="form-subtitle">Enter the admin password to continue</p>

                  <form onSubmit={submitAdmin} className="billboard-form">
                    <div className="form-group">
                      <label htmlFor="admin-password">Password</label>
                      <div className="input-wrapper">
                        <input
                          id="admin-password"
                          name="adminPassword"
                          type="password"
                          placeholder="Enter admin password"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          className="input"
                          autoComplete="current-password"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                      <button type="button" className="submit-button btn-primary" onClick={backToEmail} style={{ background: '#fff', color: '#333' }}>Back</button>
                      <button type="submit" className="submit-button btn-primary">Sign In</button>
                    </div>

                    <div className="form-footer" style={{ marginTop: 18 }}>
                      Not an admin? <button type="button" onClick={backToEmail} style={{ border: 'none', background: 'transparent', color: '#ff6b35', fontWeight: 600, cursor: 'pointer' }}>Use OTP login</button>
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* Bottom Text */}
            {/* <div className="billboard-tag">Secure • Reliable • Professional</div> */}
          </div>

          {/* Metal Frame */}
          <div className="metal-frame">
            <div className="frame-corner corner-tl"></div>
            <div className="frame-corner corner-tr"></div>
            <div className="frame-corner corner-bl"></div>
            <div className="frame-corner corner-br"></div>
            <div className="frame-edge edge-top"></div>
            <div className="frame-edge edge-bottom"></div>
            <div className="frame-edge edge-left"></div>
            <div className="frame-edge edge-right"></div>
          </div>
        </div>

        {/* Worker Hanging on Right Side */}
        <div className="hanging-worker">
          <div className="safety-rope"></div>
          <div className="worker-character">
            <div className="worker-harness"></div>
            <div className="hard-hat">
              <div className="hat-dome"></div>
              <div className="hat-brim"></div>
            </div>
            <div className="worker-head"></div>
            <div className="safety-vest">
              <div className="vest-stripe stripe-1"></div>
              <div className="vest-stripe stripe-2"></div>
            </div>
            <div className="worker-arms">
              <div className="worker-arm arm-left">
                <div className="hand"></div>
              </div>
              <div className="worker-arm arm-right">
                <div className="tool"></div>
              </div>
            </div>
            <div className="worker-torso"></div>
            <div className="worker-legs">
              <div className="worker-leg leg-left">
                <div className="boot"></div>
              </div>
              <div className="worker-leg leg-right">
                <div className="boot"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
