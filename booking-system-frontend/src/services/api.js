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
      error.accountLocked = data.accountLocked;
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

  // Logout (update last activity and clear local storage)
  logout: async () => {
    try {
      // Call server to update last_login timestamp
      await apiRequest('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.warn('Failed to update last activity on server:', error);
      // Continue with logout even if server call fails
    } finally {
      // Clear local storage
      localStorage.removeItem('userToken');
      localStorage.removeItem('user');
    }
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

  // Create new course (Admin only)
  create: async (courseData) => {
    return await apiRequest('/courses', {
      method: 'POST',
      body: JSON.stringify(courseData),
    });
  },

  // Update course (Admin only)
  update: async (id, courseData) => {
    return await apiRequest(`/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(courseData),
    });
  },

  // Delete course (Admin only)
  delete: async (id) => {
    return await apiRequest(`/courses/${id}`, {
      method: 'DELETE',
    });
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

// Admin API
export const adminAPI = {
  // Get dashboard statistics
  getStats: async () => {
    return await apiRequest('/admin/stats');
  },

  // Get all bookings (admin view)
  getAllBookings: async (status = null, limit = 50) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit);
    return await apiRequest(`/admin/bookings?${params.toString()}`);
  },

  // Get all users
  getAllUsers: async (role = null, limit = 100) => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    params.append('limit', limit);
    return await apiRequest(`/admin/users?${params.toString()}`);
  },

  // Update booking status (admin)
  updateBookingStatus: async (id, status) => {
    return await apiRequest(`/admin/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Delete booking (admin)
  deleteBooking: async (id) => {
    return await apiRequest(`/admin/bookings/${id}`, {
      method: 'DELETE',
    });
  },

  // Get revenue data for charts
  getRevenueData: async () => {
    return await apiRequest('/admin/revenue');
  },

  // Get enrollment data for charts
  getEnrollmentData: async () => {
    return await apiRequest('/admin/enrollments');
  },

  // Get best selling courses
  getBestSellingCourses: async () => {
    return await apiRequest('/admin/best-selling-courses');
  },

  // Create new user (Admin/Staff only)
  createUser: async (userData) => {
    return await apiRequest('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // Update user
  updateUser: async (id, userData) => {
    return await apiRequest(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  // Toggle user status (activate/deactivate)
  toggleUserStatus: async (id) => {
    return await apiRequest(`/admin/users/${id}/status`, {
      method: 'PATCH',
    });
  },

  // Reset user password (admin)
  resetUserPassword: async (id, data) => {
    return await apiRequest(`/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(data),
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
