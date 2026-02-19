export const normalizeProfilePic = (profilepic) => {
  if (!profilepic) return '';
  const s = String(profilepic).trim();
  if (s.startsWith('http') || s.startsWith('data:')) return s;
  const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_URL || '';
  return `${IMAGE_BASE_URL}${s.replace(/^\/+/, '')}`;
};

export const storeUserToLocal = (user, token = '', auth = 'true') => {
  try {
    localStorage.setItem('email', user.email || '');
    localStorage.setItem('firstName', user.firstName || '');
    localStorage.setItem('lastName', user.lastName || '');
    localStorage.setItem('profilepic', normalizeProfilePic(user.profilepic || ''));
    // keep legacy role fields if present
    localStorage.setItem('role', user.role?.name || '');
    localStorage.setItem('roleId', user.role?._id || '');
    localStorage.setItem('userId', user._id || user.id || '');
    localStorage.setItem('user', JSON.stringify(user));
    if (token) localStorage.setItem('token', token);
    localStorage.setItem('auth', auth);
    localStorage.setItem('userType', user.userType || '');

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
