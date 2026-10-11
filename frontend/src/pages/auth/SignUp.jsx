import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/images/logo.svg';
import axiosInstance from '../../utils/axiosInstance';
import { toastSuccess, toastError } from '../../utils/alertHelper';
import { storeUserToLocal } from '../../utils/authHelper';

const SignUp = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    userType: 'hoarding', // 'hoarding' | 'banner' | 'worker'
    // hoarding owner
    licenceNumber: '',
    // banner user
    gstNumber: '',
    businessName: '',
    businessEmail: '',
    // worker
    area: '',
    skill: '',
    otherSkill: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowPassword(false);
    try {
      const payload = { ...formData };
      // map local userType values to more descriptive backend values if needed
      if (payload.userType === 'hoarding') payload.userType = 'HoardingOwner';
      if (payload.userType === 'banner') payload.userType = 'BannerUser';
      if (payload.userType === 'worker') payload.userType = 'Worker';

      const res = await axiosInstance.post('/user/signup', payload);
      const data = res?.data || {};
      const user = data.user || data.data?.user || data || null;
      const token = data?.token || data.data?.token || data?.UserToken || '';

      const authComplete = Boolean(
        data?.isAuthenticated || data?.authComplete || data?.authenticated || data?.registrationComplete
      );

      if (authComplete && user && token) {
        try { storeUserToLocal(user, token, 'true'); } catch (err) { console.warn('storeUserToLocal failed', err); }
        toastSuccess(data?.Message || 'Registered and signed in');
        navigate('/dashboard');
        return;
      }

      if (user) {
        try { storeUserToLocal(user, '', 'false'); } catch (err) { console.warn('storeUserToLocal failed', err); }
        localStorage.setItem('email', formData.email || user.email || '');
        toastSuccess(data?.Message || 'Registration successful — verify your email');
        navigate('/otp');
        return;
      }

      toastError(data?.Message || 'Registration failed');
    } catch (err) {
      console.error('Sign up failed', err);
      toastError(err?.response?.data?.Message || err?.message || 'Sign up failed');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
            
            {/* Signup Form Card */}
            <div className="billboard-form-card">
              <h2>Create Account</h2>
              <p className="form-subtitle">Sign up to get started</p>

              <form onSubmit={handleSubmit} className="billboard-form">
                <div className="form-group">
                  <div style={{display: 'flex', gap: 12}}>
                    <div style={{flex: 1}}>
                      <label htmlFor="firstName">First Name</label>
                      <div className="input-wrapper">
                        <User className="input-icon" size={20} />
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          placeholder="First name"
                          value={formData.firstName}
                          onChange={handleChange}
                          autoComplete="given-name"
                          required
                        />
                      </div>
                    </div>

                    <div style={{flex: 1}}>
                      <label htmlFor="lastName">Last Name</label>
                      <div className="input-wrapper">
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          placeholder="Last name"
                          value={formData.lastName}
                          onChange={handleChange}
                          autoComplete="family-name"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <div className="input-wrapper">
                    <Mail className="input-icon" size={20} />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleChange}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <div className="input-wrapper">
                    <Phone className="input-icon" size={20} />
                    <input
                      type="tel"
                      id="phone"
                      name="mobileNumber"
                      placeholder="Enter your phone number"
                      value={formData.mobileNumber}
                      onChange={handleChange}
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>User Type</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="radio"
                        name="userType"
                        value="hoarding"
                        checked={formData.userType === 'hoarding'}
                        onChange={handleChange}
                      />
                      Hoarding Owner
                    </label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="radio"
                        name="userType"
                        value="banner"
                        checked={formData.userType === 'banner'}
                        onChange={handleChange}
                      />
                      Banner User
                    </label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="radio"
                        name="userType"
                        value="worker"
                        checked={formData.userType === 'worker'}
                        onChange={handleChange}
                      />
                      Worker
                    </label>
                  </div>
                </div>

                {/* Conditional fields */}
                {formData.userType === 'hoarding' && (
                  <div className="form-group">
                    <label htmlFor="licenceNumber">Hoarding Licence Number</label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        id="licenceNumber"
                        name="licenceNumber"
                        placeholder="Enter licence number"
                        value={formData.licenceNumber}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                )}

                {formData.userType === 'banner' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="businessName">Business Name</label>
                      <div className="input-wrapper">
                        <input
                          type="text"
                          id="businessName"
                          name="businessName"
                          placeholder="Enter business name"
                          value={formData.businessName}
                          onChange={handleChange}
                          autoComplete="organization"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="businessEmail">Business Email</label>
                      <div className="input-wrapper">
                        <input
                          type="email"
                          id="businessEmail"
                          name="businessEmail"
                          placeholder="Business email id"
                          value={formData.businessEmail}
                          onChange={handleChange}
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="gstNumber">GST Number</label>
                      <div className="input-wrapper">
                        <input
                          type="text"
                          id="gstNumber"
                          name="gstNumber"
                          placeholder="Enter GST / Tax number"
                          value={formData.gstNumber}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </>
                )}

                {formData.userType === 'worker' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="area">Area</label>
                      <div className="input-wrapper">
                        <select
                          id="area"
                          name="area"
                          value={formData.area}
                          onChange={handleChange}
                        >
                          <option value="">Select area</option>
                          <option value="north">North</option>
                          <option value="south">South</option>
                          <option value="east">East</option>
                          <option value="west">West</option>
                          <option value="central">Central</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="skill">Skill</label>
                      <div className="input-wrapper">
                        <select
                          id="skill"
                          name="skill"
                          value={formData.skill}
                          onChange={handleChange}
                        >
                          <option value="">Select skill</option>
                          <option value="installation">Installation</option>
                          <option value="painting">Painting</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    {formData.skill === 'other' && (
                      <div className="form-group">
                        <label htmlFor="otherSkill">Please specify</label>
                        <div className="input-wrapper">
                          <input
                            type="text"
                            id="otherSkill"
                            name="otherSkill"
                            placeholder="Describe your skill"
                            value={formData.otherSkill}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                <button type="submit" className="submit-button">
                  <span>Create Account</span>
                  <ArrowRight size={20} />
                </button>
              </form>

              <div className="form-footer">
                Already have an account? <a href="/login">Log In</a>
              </div>
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

export default SignUp;