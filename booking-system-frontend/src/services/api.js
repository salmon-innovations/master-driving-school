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

  // Create new branch
  create: async (branchData) => {
    return await apiRequest('/branches', {
      method: 'POST',
      body: JSON.stringify(branchData),
    });
  },

  // Update branch
  update: async (id, branchData) => {
    return await apiRequest(`/branches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(branchData),
    });
  },

  // Delete branch
  delete: async (id) => {
    return await apiRequest(`/branches/${id}`, {
      method: 'DELETE',
    });
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

  // Get funnel data
  getFunnelData: async () => {
    return await apiRequest('/admin/analytics/funnel');
  },

  // Get course distribution
  getCourseDistribution: async () => {
    return await apiRequest('/admin/analytics/course-distribution');
  },

  // Get branch performance
  getBranchPerformance: async () => {
    return await apiRequest('/admin/analytics/branch-performance');
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

  // Walk-in enrollment
  walkInEnrollment: async (enrollmentData) => {
    return await apiRequest('/admin/walk-in-enrollment', {
      method: 'POST',
      body: JSON.stringify(enrollmentData),
    });
  },

  // Get all financial transactions
  getAllTransactions: async (limit = 100) => {
    return await apiRequest(`/admin/transactions?limit=${limit}`);
  },

  // Get all unpaid bookings (No Pay Users)
  getUnpaidBookings: async (limit = 100) => {
    return await apiRequest(`/admin/unpaid-bookings?limit=${limit}`);
  },
};

// Schedules API
export const schedulesAPI = {
  // Get all schedules
  getAll: async (date = null, branchId = null) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (branchId) params.append('branch_id', branchId);
    const queryString = params.toString();
    return await apiRequest(`/schedules${queryString ? `?${queryString}` : ''}`);
  },

  // Get schedule by ID
  getById: async (id) => {
    return await apiRequest(`/schedules/${id}`);
  },

  // Create new schedule
  create: async (scheduleData) => {
    return await apiRequest('/schedules', {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    });
  },

  // Update schedule
  update: async (id, scheduleData) => {
    return await apiRequest(`/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(scheduleData),
    });
  },

  // Delete schedule
  delete: async (id) => {
    return await apiRequest(`/schedules/${id}`, {
      method: 'DELETE',
    });
  },

  // Get slots for a specific date
  getSlotsByDate: async (date, branchId = null) => {
    const params = new URLSearchParams();
    params.append('date', date);
    if (branchId) params.append('branch_id', branchId);
    return await apiRequest(`/schedules/slots?${params.toString()}`);
  },

  // Create new slot
  createSlot: async (slotData) => {
    return await apiRequest('/schedules/slots', {
      method: 'POST',
      body: JSON.stringify(slotData),
    });
  },

  // Update slot
  updateSlot: async (id, slotData) => {
    return await apiRequest(`/schedules/slots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(slotData),
    });
  },

  // Delete slot
  deleteSlot: async (id) => {
    return await apiRequest(`/schedules/slots/${id}`, {
      method: 'DELETE',
    });
  },

  // Get enrollments for a slot
  getSlotEnrollments: async (slotId) => {
    return await apiRequest(`/schedules/slots/${slotId}/enrollments`);
  },

  // Enroll student in slot
  enrollStudent: async (slotId, studentData) => {
    return await apiRequest(`/schedules/slots/${slotId}/enroll`, {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  },

  // Update enrollment status
  updateEnrollmentStatus: async (enrollmentId, status) => {
    return await apiRequest(`/schedules/enrollments/${enrollmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Cancel enrollment
  cancelEnrollment: async (enrollmentId) => {
    return await apiRequest(`/schedules/enrollments/${enrollmentId}`, {
      method: 'DELETE',
    });
  },
};

// CRM API
export const crmAPI = {
  // Stats
  getStats: async () => await apiRequest('/crm/stats'),

  // Leads
  getAllLeads: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val) params.append(key, val);
    });
    const query = params.toString();
    return await apiRequest(`/crm/leads${query ? `?${query}` : ''}`);
  },
  getLeadById: async (id) => await apiRequest(`/crm/leads/${id}`),
  createLead: async (data) => await apiRequest('/crm/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: async (id, data) => await apiRequest(`/crm/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLead: async (id) => await apiRequest(`/crm/leads/${id}`, { method: 'DELETE' }),

  // Actions
  convertLead: async (id, userId) => await apiRequest(`/crm/leads/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId })
  }),
  addInteraction: async (leadId, data) => await apiRequest(`/crm/leads/${leadId}/interactions`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getAllInteractions: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return await apiRequest(`/crm/interactions${query ? `?${query}` : ''}`);
  },

  // Config: Sources
  getLeadSources: async () => await apiRequest('/crm/sources'),
  createLeadSource: async (data) => await apiRequest('/crm/sources', { method: 'POST', body: JSON.stringify(data) }),
  updateLeadSource: async (id, data) => await apiRequest(`/crm/sources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLeadSource: async (id) => await apiRequest(`/crm/sources/${id}`, { method: 'DELETE' }),

  // Config: Statuses
  getLeadStatuses: async () => await apiRequest('/crm/statuses'),
  createLeadStatus: async (data) => await apiRequest('/crm/statuses', { method: 'POST', body: JSON.stringify(data) }),
  updateLeadStatus: async (id, data) => await apiRequest(`/crm/statuses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLeadStatus: async (id) => await apiRequest(`/crm/statuses/${id}`, { method: 'DELETE' }),

  // Public
  createLeadFromContact: async (data) => await apiRequest('/crm/public/contact', { method: 'POST', body: JSON.stringify(data) }),
  createLeadFromCourseInterest: async (data) => await apiRequest('/crm/public/course-interest', { method: 'POST', body: JSON.stringify(data) })
};

// Roles API
export const rolesAPI = {
  getAll: async () => await apiRequest('/roles'),
  create: async (data) => await apiRequest('/roles', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id, data) => await apiRequest(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id) => await apiRequest(`/roles/${id}`, { method: 'DELETE' })
};

// News & Announcements API
export const newsAPI = {
  getAll: async () => await apiRequest('/news'),
  create: async (data) => await apiRequest('/news', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: async (id, data) => await apiRequest(`/news/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: async (id) => await apiRequest(`/news/${id}`, {
    method: 'DELETE'
  }),
  getVideos: async () => await apiRequest('/news/videos')
};

// Export helper functions
export const setAuthToken = (token) => localStorage.setItem('userToken', token);
export const removeAuthToken = () => localStorage.removeItem('userToken');
export const isAuthenticated = () => !!localStorage.getItem('userToken');
