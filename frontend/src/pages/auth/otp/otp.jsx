import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// import '../login/Login.css';
import './otp.css';
import logo from '../../../assets/logo.svg';

const OTP = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState(['', '', '', '']);

  const handleChange = (e, idx) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 1);
    const next = [...code];
    next[idx] = val;
    setCode(next);
    if (val && idx < 3) {
      const nextInput = document.getElementById(`otp-${idx + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const otpValue = code.join('');
    console.log('Entered OTP:', otpValue);
    // TODO: verify OTP via API
    localStorage.setItem('auth', 'true');
    navigate('/');
  };

  return (
    <div className="hoarding-scene">
      <div className="sky-background"></div>
      <div className="billboard-structure">
        <div className="billboard-panel">
          <div className="billboard-content">
            <div className="billboard-branding">
              <div className="brand-logo"><img src={logo} alt="MyBoard"/></div>
              <h1 className="brand-name">MyBoard</h1>
            </div>

            <div className="billboard-form-card">
              <h2>Verify OTP</h2>
              <p className="form-subtitle">Enter the 4-digit code sent to your email</p>

              <form onSubmit={handleSubmit} className="billboard-form" style={{alignItems: 'center'}}>
                <div style={{display: 'flex', gap: 12}}>
                  {code.map((c, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      value={c}
                      onChange={(e) => handleChange(e, i)}
                      className="otp-input"
                    />
                  ))}
                </div>

                <div style={{display: 'flex', gap: 12, marginTop: 18}}>
                  <button type="submit" className="submit-button">Verify</button>
                </div>

                <div className="form-footer" style={{marginTop: 14}}>
                  Didn’t receive the code? <button type="button" onClick={() => console.log('Resend OTP')} style={{border: 'none', background: 'transparent', color: '#ff6b35', fontWeight: 600, cursor: 'pointer'}}>Resend</button>
                </div>
              </form>
            </div>

            <div className="billboard-tag">Secure • Reliable • Professional</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OTP;
