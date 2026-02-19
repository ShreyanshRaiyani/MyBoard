export const normalizeProfilePic = (profilepic) => {
  if (!profilepic) return '';
  const s = String(profilepic).trim();
  if (s.startsWith('http') || s.startsWith('data:')) return s;
  const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_URL || '';
  return `${IMAGE_BASE_URL}${s.replace(/^\/+/, '')}`;
};

export const normalizeUserType = (raw) => {
  if (!raw) return '';
  const s = String(raw).trim().toLowerCase();
  if (!s) return '';
  if (s.includes('super') || s.includes('admin')) return 'SuperAdmin';
  if (s.includes('hoarding')) return 'HoardingOwner';
  if (s.includes('banner') || s.includes('client') || s.includes('user')) return 'BannerUser';
  if (s.includes('worker')) return 'Worker';
  return '';
};

export const storeUserToLocal = (user, token = '', auth = 'true') => {
  try {
    localStorage.setItem('email', user.email || '');
    localStorage.setItem('firstName', user.firstName || '');
    localStorage.setItem('lastName', user.lastName || '');
    localStorage.setItem('profilepic', normalizeProfilePic(user.profilepic || ''));
    localStorage.setItem('userId', user._id || user.id || '');
    localStorage.setItem('user', JSON.stringify(user));
    if (token) localStorage.setItem('token', token);
    localStorage.setItem('auth', auth);
    localStorage.setItem('userType', normalizeUserType(user.userType || ''));

    if (user.role?.permissionGroups) {
      localStorage.setItem('permissionGroups', JSON.stringify(user.role.permissionGroups));
    }

    if (user.business) {
      localStorage.setItem('businessId', user.business._id || '');
      localStorage.setItem('businessName', user.business.name || '');
    }

    if (user.location && Array.isArray(user.location.coordinates)) {
      localStorage.setItem('locationType', user.location.type || '');
      localStorage.setItem('locationCoordinates', JSON.stringify(user.location.coordinates));
    }

    if (user.addedBy) {
      localStorage.setItem('addedById', user.addedBy._id || '');
      localStorage.setItem('addedByFirstName', user.addedBy.firstName || '');
      localStorage.setItem('addedByLastName', user.addedBy.lastName || '');
      localStorage.setItem('addedByEmail', user.addedBy.email || '');
      localStorage.setItem('addedByRole', user.addedBy.role?.name || '');
    }

    try { window.dispatchEvent(new Event('userChanged')); } catch (e) {}
  } catch (err) {
    console.error('storeUserToLocal error:', err);
  }
};

export const clearLocalUser = () => {
  const keys = ['token','userType','user','email','firstName','lastName','profilepic','auth','role','roleId','userId','permissionGroups','businessId','businessName','locationType','locationCoordinates','addedById','addedByFirstName','addedByLastName','addedByEmail','addedByRole','deviceId','devicetoken'];
  try {
    keys.forEach(k => localStorage.removeItem(k));
    try { window.dispatchEvent(new Event('userChanged')); } catch (e) {}
  } catch (e) {
    console.warn('clearLocalUser failed', e);
  }
};

import axiosInstance from './axiosInstance';

export const logoutUser = async () => {
  try {
    // attempt server-side logout (non-blocking)
    await axiosInstance.delete('/user/logout');
  } catch (e) {
    // ignore — still clear client state
    console.warn('logout API failed', e?.message || e);
  }
  clearLocalUser();
};
