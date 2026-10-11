import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/images/logo.svg';
import axiosInstance from '../../utils/axiosInstance';
import { toastSuccess, toastError } from '../../utils/alertHelper';
import { storeUserToLocal } from '../../utils/authHelper';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpValue = code.join('');
    const email = localStorage.getItem('email') || '';
    if (!email) {
      toastError('No email found — please start from login');
      return;
    }
    try {
      const res = await axiosInstance.post('/user/verifyOtp', { email, otp: otpValue });
      const { Status, Message, user, UserToken, defaultCountry, defaultState, defaultCity, device } = res.data || {};
      if (Status === 1 && user) {
        try { storeUserToLocal(user, UserToken || '', 'true'); } catch (err) { console.warn('storeUserToLocal failed', err); }
        if (defaultCountry) {
          localStorage.setItem('defaultCountry', defaultCountry._id || '');
          localStorage.setItem('defaultCountryName', defaultCountry.name || '');
        }
        if (defaultState) {
          localStorage.setItem('defaultState', defaultState._id || '');
          localStorage.setItem('defaultStateName', defaultState.name || '');
        }
        if (defaultCity) {
          localStorage.setItem('defaultCity', defaultCity._id || '');
          localStorage.setItem('defaultCityName', defaultCity.name || '');
        }
        if (device?.status && device.response) {
          localStorage.setItem('deviceId', device.response.deviceId || '');
          localStorage.setItem('devicetoken', device.response.devicetoken || '');
        }
        toastSuccess(Message || 'OTP verified');
        // store normalized userType already handled in storeUserToLocal
        try { window.dispatchEvent(new Event('userChanged')); } catch (e) {}
        // redirect to unified dashboard route — App will route to the correct dashboard by role
        navigate('/dashboard');
      } else {
        toastError(Message || 'Invalid OTP');
      }
    } catch (err) {
      console.error('OTP verify failed', err);
      toastError('Failed to verify OTP');
    }
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
                      name={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      value={c}
                      onChange={(e) => handleChange(e, i)}
                      className="otp-input"
                      autoComplete="one-time-code"
                    />
                  ))}
                </div>

                <div style={{display: 'flex', gap: 12, marginTop: 18}}>
                  <button type="submit" className="submit-button">Verify</button>
                </div>

                <div className="form-footer" style={{marginTop: 14}}>
                  Didn’t receive the code? <button type="button" onClick={() => console.log('Resend OTP')} style={{border: 'none', background: 'transparent', color: '#187fb0', fontWeight: 600, cursor: 'pointer'}}>Resend</button>
                </div>
              </form>
            </div>

            {/* <div className="billboard-tag">Secure • Reliable • Professional</div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OTP;
