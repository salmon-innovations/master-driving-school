// API Configuration
const normalizeApiUrl = (url) => String(url || '').trim().replace(/\/$/, '');
const isLoopbackApiUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(url);

const resolveApiBaseUrl = () => {
  const envApiUrl = normalizeApiUrl(import.meta.env.VITE_API_URL);

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';

    if (envApiUrl) {
      // Guard against accidental production builds that embed localhost URLs.
      if (!isLocalHost && isLoopbackApiUrl(envApiUrl)) {
        return `${window.location.origin}/api`;
      }

      return envApiUrl;
    }

    // In production, default to same-origin API route instead of localhost.
    if (!isLocalHost) {
      return `${window.location.origin}/api`;
    }

    return 'http://localhost:5000/api';
  }

  if (envApiUrl) return envApiUrl;

  return 'http://localhost:5000/api';
};

const API_BASE_URL = resolveApiBaseUrl();
export const MEDIA_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

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
      ...options.headers,
    },
  };

  // Only set JSON content type when a body exists and it's not FormData.
  if (options.body !== undefined && options.body !== null && !(options.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }

  // Add authorization header if token exists
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, config);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const rawBody = response.status === 204 ? '' : await response.text();
    const looksLikeJson = /^\s*[\[{]/.test(rawBody);

    let data = {};
    if (rawBody) {
      if (contentType.includes('application/json') || looksLikeJson) {
        try {
          data = JSON.parse(rawBody);
        } catch (parseError) {
          const error = new Error(`Invalid JSON response from ${url}`);
          error.statusCode = response.status;
          error.responseSnippet = rawBody.slice(0, 180);
          throw error;
        }
      } else {
        const error = new Error(`Expected JSON from ${url}, but received ${contentType || 'non-JSON response'}`);
        error.statusCode = response.status;
        error.responseSnippet = rawBody.slice(0, 180);
        error.isHtmlResponse = /^\s*</.test(rawBody);
        throw error;
      }
    }

    if (!response.ok) {
      // Create error with additional data from response
      const error = new Error(data.message || data.error || 'Something went wrong');
      error.statusCode = response.status;
      error.waitMinutes = data.waitMinutes;
      error.needsVerification = data.needsVerification;
      error.accountLocked = data.accountLocked;
      error.email = data.email;
      error.userId = data.userId;
      throw error;
    }

    if (!rawBody && response.status !== 204) {
      return {};
    }

    return data;
  } catch (error) {
    const isExpectedAuthFlow =
      error?.statusCode === 403 && (error?.needsVerification === true || error?.accountLocked === true);

    if (error.isHtmlResponse) {
      console.error('API Error: HTML response received. Check production API routing/proxy for /api endpoints.', {
        url,
        apiBaseUrl: API_BASE_URL,
        statusCode: error.statusCode,
        responseSnippet: error.responseSnippet,
      });
    } else if (!isExpectedAuthFlow) {
      console.error('API Error:', error);
    }
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

  // Process Guest Checkout (User creation, booking, schedule, and email)
  guestCheckout: async (checkoutData) => {
    return await apiRequest('/auth/guest-checkout', {
      method: 'POST',
      body: JSON.stringify(checkoutData),
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

  // Update profile
  updateProfile: async (data) => {
    return await apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Change password
  changePassword: async (data) => {
    return await apiRequest('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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

  // Get course type config (categories, tdcTypes, pdcTypes, bundleTypes)
  getConfig: async () => {
    return await apiRequest('/courses/config');
  },

  getAddonsConfig: async () => {
    return await apiRequest('/courses/addons-config');
  },

  // Update course type config (Admin only)
  updateConfig: async (config) => {
    return await apiRequest('/courses/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  // Update branch prices for a course (only stores branches that differ from the default)
  updateBranchPrices: async (id, branch_prices) => {
    return await apiRequest(`/courses/${id}/branch-prices`, {
      method: 'PUT',
      body: JSON.stringify({ branch_prices }),
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

// StarPay API
export const starpayAPI = {
  createPayment: async (data) => await apiRequest('/starpay/create-payment', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  createGuestPayment: async (data) => await apiRequest('/starpay/guest-create-payment', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  checkStatus: async (msgId) => await apiRequest(`/starpay/status/${msgId}`),
  payRescheduleFee: async (enrollmentId) => await apiRequest(`/starpay/reschedule-fee/${enrollmentId}`, {
    method: 'POST',
  }),
  testMarkFeePaid: async (enrollmentId) => await apiRequest(`/starpay/test-mark-fee-paid/${enrollmentId}`, {
    method: 'PATCH',
  }),
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
  getAddonsConfig: async () => await apiRequest('/admin/addons-config'),
  updateAddonsConfig: async (config) => await apiRequest('/admin/addons-config', { method: 'PUT', body: JSON.stringify({ config }) }),
  // Get dashboard statistics
  getStats: async () => {
    return await apiRequest('/admin/stats');
  },

  // Get all bookings (admin view)
  getAllBookings: async (status = null, limit = 50, branchId = null) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit);
    if (branchId) params.append('branchId', branchId);
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

  // Get students with active schedule for a given date/branch
  getTodayStudents: async ({ date, branchId } = {}) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (branchId) params.append('branch_id', branchId);
    const qs = params.toString();
    return await apiRequest(`/admin/today-students${qs ? '?' + qs : ''}`);
  },

  // Get full student detail (personal info + bookings/payment)
  getStudentDetail: async (studentId) => {
    return await apiRequest(`/admin/student-detail/${studentId}`);
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

  // Mark a downpayment booking as fully paid (collects remaining balance)
  markAsPaid: async (id, paymentMethod) => {
    return await apiRequest(`/admin/bookings/${id}/mark-paid`, {
      method: 'PATCH',
      body: JSON.stringify({ payment_method: paymentMethod }),
    });
  },

  // Send payment receipt email to student for a booking
  sendReceipt: async (id) => {
    return await apiRequest(`/admin/bookings/${id}/send-receipt`, {
      method: 'POST',
    });
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

  // Get slots for a specific date or upcoming slots
  getSlotsByDate: async (date = null, branchId = null, type = null) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (branchId) params.append('branch_id', branchId);
    if (type) params.append('type', type);
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

  // Mark student as No-Show & Trigger Reschedule Fee Email
  markNoShow: async (enrollmentId) => {
    return await apiRequest(`/schedules/enrollments/${enrollmentId}/no-show`, {
      method: 'POST',
    });
  },

  // Reschedule student to a different slot
  rescheduleEnrollment: async (enrollmentId, newSlotId) => {
    return await apiRequest(`/schedules/enrollments/${enrollmentId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ new_slot_id: newSlotId }),
    });
  },

  // Mark no-show rescheduling fee (walk-in) as paid
  markFeePaid: async (enrollmentId, amount, paymentMethod, transactionNumber) => {
    return await apiRequest(`/schedules/enrollments/${enrollmentId}/mark-fee-paid`, {
      method: 'PATCH',
      body: JSON.stringify({ amount, paymentMethod, transactionNumber }),
    });
  },

  // Get all no-show students (admin/staff)
  getNoShowStudents: async ({ branchId } = {}) => {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);
    return await apiRequest(`/schedules/no-show-students${params.toString() ? '?' + params.toString() : ''}`);
  },

  // Cancel enrollment
  cancelEnrollment: async (enrollmentId) => {
    return await apiRequest(`/schedules/enrollments/${enrollmentId}`, {
      method: 'DELETE',
    });
  },

  // Get enrollments for the currently logged-in student (Course History)
  getMyEnrollments: async () => {
    return await apiRequest('/schedules/my-enrollments');
  },

  // Student pays their remaining balance online
  payRemainingBalance: async (bookingId, paymentMethod) => {
    return await apiRequest(`/schedules/pay-balance/${bookingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ payment_method: paymentMethod }),
    });
  },

  // Get unassigned PDC students (optional ?course_type=... query string)
  getUnassignedPdcStudents: async (queryString = '') => {
    return await apiRequest(`/schedules/unassigned-pdc${queryString}`);
  }
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

// Email Content Configuration API
export const emailContentAPI = {
  get: async () => await apiRequest('/admin/email-content'),
  update: async (content) => await apiRequest('/admin/email-content', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  }),
  testEmail: async (data) => await apiRequest('/admin/email-content/test', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  testAllTemplates: async (email) => await apiRequest('/admin/email-content/test-all', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
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
  getVideos: async () => await apiRequest('/news/videos'),
  broadcast: async (id) => await apiRequest(`/news/${id}/broadcast`, {
    method: 'POST'
  }),
  incrementInteraction: async (id) => await apiRequest(`/news/${id}/increment`, {
    method: 'PATCH'
  })
};

// Testimonials API
export const testimonialsAPI = {
  getAll: async () => await apiRequest('/testimonials'),
  create: async (data) => await apiRequest('/testimonials', {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data)
  })
};

export const notificationsAPI = {
  getAll: async () => await apiRequest('/admin/notifications'),
};

// Export helper functions
export const setAuthToken = (token) => localStorage.setItem('userToken', token);
export const removeAuthToken = () => localStorage.removeItem('userToken');
export const isAuthenticated = () => !!localStorage.getItem('userToken');
