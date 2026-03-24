# 🛠️ Insert Logic Guide: Guest Enrollment

This guide explains how to connect the **Guest Enrollment** form to the backend to successfully "insert" (save) the student, booking, and schedule data into the database.

---

## 1. Frontend: Updating `handleSubmit`

In `GuestEnrollment.jsx`, current logic only saves to `localStorage`. You should update it to call the `authAPI.guestCheckout` method.

### 📍 File: `update/GuestEnrollment.jsx`

```javascript
import { authAPI } from '../services/api'

// ... inside GuestEnrollment component ...

const handleSubmit = async () => {
    const newErrors = validateStep2()

    if (Object.keys(newErrors).length === 0) {
      setLoading(true)
      try {
        // 1. Prepare the data (Include data from previous steps/storage)
        const checkoutData = {
          ...formData, // All personal and contact details
          courseId: localStorage.getItem('selectedCourseId'),
          branchId: localStorage.getItem('selectedBranchId'),
          scheduleSlotId: localStorage.getItem('selectedSlotId'),
          scheduleDate: localStorage.getItem('selectedScheduleDate'),
          paymentMethod: 'Cash', // Or get from your payment step
          amountPaid: localStorage.getItem('totalAmount'),
          paymentStatus: 'Pending',
        }

        // 2. Call the API
        const response = await authAPI.guestCheckout(checkoutData)

        if (response.success) {
          showNotification('Enrollment Successful!', 'success')
          
          // Clear temporary storage
          localStorage.removeItem('guestEnrollmentData')
          localStorage.removeItem('isGuestCheckout')
          
          // Navigate to success or dashboard
          onNavigate('success')
        }
      } catch (error) {
        showNotification(error.message || 'Failed to finish enrollment', 'error')
        setErrors({ general: error.message })
      } finally {
        setLoading(false)
      }
    } else {
      setErrors(newErrors)
    }
}
```

---

## 2. The API Layer

The frontend uses the `api.js` service to communicate. The `guestCheckout` method handles the `POST` request.

### 📍 File: `src/services/api.js`

```javascript
export const authAPI = {
  // Process Guest Checkout (User creation, booking, schedule, and email)
  guestCheckout: async (checkoutData) => {
    return await apiRequest('/auth/guest-checkout', {
      method: 'POST',
      body: JSON.stringify(checkoutData),
    });
  },
  // ...
}
```

---

## 3. Backend: Database Insertion

The backend performs multiple "inserts" in a single **Transaction** to ensure data integrity.

### 📍 Controller: `authController.js` (`guestCheckout` function)

1.  **User Insert**: Inserts the guest into the `users` table with a generated random password.
    ```sql
    INSERT INTO users (first_name, last_name, email, role, status, ...) 
    VALUES ($1, $2, $3, 'student', 'active', ...)
    ```
2.  **Booking Insert**: Creates a record in the `bookings` table linked to the new user.
    ```sql
    INSERT INTO bookings (user_id, course_id, branch_id, total_amount, status, ...) 
    VALUES ($1, $2, $3, $4, 'paid/collectable', ...)
    ```
3.  **Schedule Enrollment**: Links the user to the specific schedule slot.
    ```sql
    INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status) 
    VALUES ($1, $2, 'enrolled')
    ```
4.  **Capacity Update**: Decrements the `available_slots` in the `schedule_slots` table.
5.  **Confirmation**: Sends a "Guest Enrollment" email via `sendGuestEnrollmentEmail`.

---

## 💡 Key Tips for "Insert" Operations

- **Validation**: Always validate data on both the frontend (User experience) and backend (Security).
- **Transactions**: Use `BEGIN` and `COMMIT` in SQL to make sure if one insert fails (e.g., Booking), the whole process stops.
- **Loading States**: Always use a `loading` state in React to disable the "Submit" button and prevent duplicate entries.
- **Error Handling**: Use `try-catch` blocks to capture database errors and show friendly messages to the user.

---

## 4. Frontend: Input Handling & Auto-fill Logic

To prevent browser interference and ensure clean data entry, the forms (`GuestEnrollment.jsx`, `SignUp.jsx`, `WalkInEnrollment.jsx`) rely on a dedicated `handleChange` logic.

### 📍 Auto-Clear & Zip Code Mapping

The logic checks the Address field to automatically match a branch and map it to its Zip Code.
- If the Address is manually **cleared** (backspaced), the Zip Code state is explicitly set to an empty string (`''`).
- This explicit reset forces the UI to naturally display its initial placeholder (e.g., "1234").
- **Place of Birth** does *not* utilize auto-fill, ensuring users explicitly select their correct birth place.
- `autoComplete="off"` is recommended on address inputs to avoid Chromium/Edge aggressive autofill overriding custom React states.
