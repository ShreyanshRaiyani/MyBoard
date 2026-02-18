import React, { useState } from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import logo from '../../../assets/logo.svg';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'admin'
  const [adminPassword, setAdminPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Login attempt:', email);

    // Simulated userType lookup. Replace with real API call.
    const getUserType = async (email) => {
      if (!email) return 'user';
      const e = email.trim().toLowerCase();
      if (e === 'super@myboard.com' || e.endsWith('@admin.com')) return 'superAdmin';
      return 'user';
    };

    (async () => {
      const userType = await getUserType(email);
      console.log('Detected userType:', userType);
      if (userType === 'superAdmin') {
        setStep('admin');
      } else {
        navigate('/otp');
      }
    })();
  };

  const submitAdmin = (e) => {
    e.preventDefault();
    if (!adminPassword) return;
    // TODO: validate admin password via backend
    localStorage.setItem('auth', 'true');
    navigate('/');
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
            <div className="billboard-form-card">
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

              {/* OTP is handled in a separate page */}

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
                        />
                      </div>
                    </div>

                    <div style={{display: 'flex', gap: 12, marginTop: 12}}>
                      <button type="button" className="submit-button" onClick={backToEmail} style={{background: '#ddd', color: '#333'}}>Back</button>
                      <button type="submit" className="submit-button">Sign In</button>
                    </div>

                    <div className="form-footer" style={{marginTop: 18}}>
                      Not an admin? <button type="button" onClick={backToEmail} style={{border: 'none', background: 'transparent', color: '#ff6b35', fontWeight: 600, cursor: 'pointer'}}>Use OTP login</button>
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