// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('userToken');
};

// Helper function to make API requests
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Add authorization header if token exists
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      // Create error with additional data from response
      const error = new Error(data.error || 'Something went wrong');
      error.statusCode = response.status;
      error.needsVerification = data.needsVerification;
      error.email = data.email;
      error.userId = data.userId;
      throw error;
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Authentication API
export const authAPI = {
  // Register new user
  register: async (userData) => {
    return await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // Login user
  login: async (credentials) => {
    return await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  // Get user profile
  getProfile: async () => {
    return await apiRequest('/auth/profile');
  },

  // Verify email with code
  verifyEmail: async (data) => {
    return await apiRequest('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Resend verification code
  resendVerificationCode: async (data) => {
    return await apiRequest('/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Forgot password - Send OTP
  forgotPassword: async (data) => {
    return await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Verify reset OTP
  verifyResetOTP: async (data) => {
    return await apiRequest('/auth/verify-reset-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Reset password
  resetPassword: async (data) => {
    return await apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Logout (client-side)
  logout: () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('user');
  },
};

// Courses API
export const coursesAPI = {
  // Get all courses
  getAll: async () => {
    return await apiRequest('/courses');
  },

  // Get course by ID
  getById: async (id) => {
    return await apiRequest(`/courses/${id}`);
  },
};

// Branches API
export const branchesAPI = {
  // Get all branches
  getAll: async () => {
    return await apiRequest('/branches');
  },

  // Get branch by ID
  getById: async (id) => {
    return await apiRequest(`/branches/${id}`);
  },
};

// Bookings API
export const bookingsAPI = {
  // Create new booking
  create: async (bookingData) => {
    return await apiRequest('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },

  // Get all user bookings
  getAll: async () => {
    return await apiRequest('/bookings');
  },

  // Get booking by ID
  getById: async (id) => {
    return await apiRequest(`/bookings/${id}`);
  },

  // Update booking status
  updateStatus: async (id, status) => {
    return await apiRequest(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Delete booking
  delete: async (id) => {
    return await apiRequest(`/bookings/${id}`, {
      method: 'DELETE',
    });
  },
};

// Export helper functions
export const setAuthToken = (token) => {
  localStorage.setItem('userToken', token);
};

export const removeAuthToken = () => {
  localStorage.removeItem('userToken');
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};
