import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 1000,
  timerProgressBar: true,
});

export const toastSuccess = (message = 'Success!') => {
  Toast.fire({
    icon: 'success',
    title: message,
    iconColor: '#27ae60',
  });
};

export const toastError = (message = 'Something went wrong!') => {
  Toast.fire({
    icon: 'error',
    title: message,
  });
};

export const toastInfo = (message = '') => {
  Toast.fire({
    icon: 'info',
    title: message,
  });
};

export const toastWarning = (message = '') => {
  Toast.fire({
    icon: 'warning',
    title: message,
  });
};

export const confirmDelete = async (message = 'Do you want to delete this item?') => {
  return await Swal.fire({
    title: 'Are you sure?',
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel',
  });
};