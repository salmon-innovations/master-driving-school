import { useState, useEffect } from "react"
import { useNotification } from "../context/NotificationContext"
import { authAPI, bookingsAPI, schedulesAPI } from "../services/api"

function Payment({ cart, setCart, onNavigate, isLoggedIn, preSelectedBranch, scheduleSelection }) {
  const { showNotification } = useNotification()
  const [paymentType, setPaymentType] = useState(null) // "full" or "downpayment"
  const [paymentMethod, setPaymentMethod] = useState(null) // "starpay" or "gcash"
  const [step, setStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
  const downpaymentAmount = subtotal * 0.5
  const finalAmount = paymentType === "downpayment" ? downpaymentAmount : subtotal

  useEffect(() => {
    const isGuest = localStorage.getItem('isGuestCheckout') === 'true'
    if (!isLoggedIn && !isGuest) {
      showNotification("Please sign in to proceed with payment", "error")
      onNavigate("signin")
      return
    }
    if (cart.length === 0) {
      onNavigate("courses")
    }
  }, [cart, onNavigate, isLoggedIn])

  useEffect(() => {
    if (showTermsModal) {
      setTimeout(() => {
        const el = document.getElementById('terms-scroll-container');
        if (el && el.scrollHeight <= el.clientHeight + 20) {
          setHasScrolledToBottom(true);
        }
      }, 100);
    }
  }, [showTermsModal]);

  const handleOpenTermsModal = () => {
    if (!paymentType || !paymentMethod) {
      showNotification("Please select both payment type and method", "error")
      return
    }
    setAgreedToTerms(false)
    setHasScrolledToBottom(false)
    setShowTermsModal(true)
  }

  const handleProcessPayment = async () => {
    if (!agreedToTerms) {
      showNotification("Please check the agreement box to proceed", "error")
      return
    }

    setShowTermsModal(false)
    setIsProcessing(true)

    // Simulate payment processing
    showNotification(`Processing ${paymentMethod.toUpperCase()} payment for ₱${finalAmount.toLocaleString()}...`, "info")

    const handleSuccess = () => {
      showNotification("Payment successful! Redirecting to home...", "success")
      setCart([]) // Clear cart
      setIsProcessing(false)
      // Cleanup guest session flags
      localStorage.removeItem('isGuestCheckout')
      localStorage.removeItem('guestEnrollmentData')
      onNavigate("home")
    }

    const isGuest = localStorage.getItem('isGuestCheckout') === 'true'
    const guestDataStr = localStorage.getItem('guestEnrollmentData')

    try {
      const formatDate = (dateInput) => {
        if (!dateInput) return null;
        const d = new Date(dateInput);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      if (isGuest && guestDataStr && scheduleSelection && cart.length > 0) {
        // Prepare guest checkout payload
        const guestData = JSON.parse(guestDataStr)
        const checkoutPayload = {
          ...guestData,
          courseId: cart[0].id,
          courseCategory: cart[0].category,
          courseType: cart[0].type,
          branchId: preSelectedBranch?.id || guestData.branchId,
          scheduleSlotId: scheduleSelection.slot,
          scheduleDate: formatDate(scheduleSelection.date),
          scheduleSlotId2: scheduleSelection.slot2,
          scheduleDate2: formatDate(scheduleSelection.date2),
          paymentMethod: paymentMethod === 'starpay' ? 'Starpay' : 'GCash',
          amountPaid: finalAmount,
          paymentStatus: paymentType === 'full' ? 'Full Payment' : 'Downpayment'
        }

        // Hit our new backend endpoint
        await authAPI.guestCheckout(checkoutPayload)
      } else if (isLoggedIn && scheduleSelection && cart.length > 0) {
        // Standard logged-in user flow
        const authDataStr = localStorage.getItem('user');
        const user = authDataStr ? JSON.parse(authDataStr) : null;
        const studentId = user?.id;

        // 1. Create booking

        const checkoutPayload = {
          courseId: cart[0].id,
          courseCategory: cart[0].category,
          courseType: cart[0].type,
          branchId: preSelectedBranch?.id,
          bookingDate: formatDate(scheduleSelection.date),
          bookingTime: scheduleSelection.slotDetails?.time || 'N/A',
          notes: scheduleSelection.isMotorcyclePDC ? 'Motorcycle PDC - Schedule TBA' : 'Standard Enrollment',
          paymentMethod: paymentMethod === 'starpay' ? 'Starpay' : 'GCash',
          totalAmount: finalAmount,
          paymentType: paymentType === 'full' ? 'Full Payment' : 'Downpayment'
        };

        await bookingsAPI.create(checkoutPayload);

        // 2. Enroll in schedule slot (deducts available_slots automatically)
        if (scheduleSelection.slot) {
          await schedulesAPI.enrollStudent(scheduleSelection.slot, {
            student_id: studentId,
            enrollment_status: 'enrolled'
          });
        }

        // 3. Enroll in Day 2 schedule slot if applicable
        if (scheduleSelection.slot2) {
          await schedulesAPI.enrollStudent(scheduleSelection.slot2, {
            student_id: studentId,
            enrollment_status: 'enrolled'
          });
        }
      }

      handleSuccess();
    } catch (error) {
      console.error('Checkout error:', error)
      showNotification(error.message || 'Enrollment failed. Please try again.', 'error')
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-indigo-50/30">
      {/* Hero Section */}
      <section className="relative py-12 sm:py-16 bg-gradient-to-br from-[#2157da] via-[#1a3a8a] to-[#0f1f4d] overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-10">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
          </div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-6" data-aos="fade-down">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-sm font-bold">Secure Checkout</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 tracking-tight" data-aos="fade-up">
              Complete Your Payment
            </h1>
            <p className="text-blue-100 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed" data-aos="fade-up" data-aos-delay="100">
              Choose your payment preference and secure your enrollment with our trusted payment partners.
            </p>
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-12 lg:py-16">
        <div className="container mx-auto px-4">
          {/* Progress Indicator */}
          <div className="max-w-4xl mx-auto mb-8 sm:mb-12" data-aos="fade-down">
            <div className="flex items-center justify-between relative">
              <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full -z-10">
                <div className={`h-full bg-gradient-to-r from-[#2157da] to-blue-600 rounded-full transition-all duration-500 ${!paymentType ? 'w-0' : !paymentMethod ? 'w-1/2' : 'w-full'
                  }`}></div>
              </div>

              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${paymentType ? 'bg-[#2157da] text-white shadow-lg' : 'bg-white border-2 border-gray-300 text-gray-400'
                  }`}>
                  {paymentType ? '✓' : '1'}
                </div>
                <span className="text-xs font-bold text-gray-600 mt-2 hidden sm:block">Payment Type</span>
              </div>

              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${paymentMethod ? 'bg-[#2157da] text-white shadow-lg' : 'bg-white border-2 border-gray-300 text-gray-400'
                  }`}>
                  {paymentMethod ? '✓' : '2'}
                </div>
                <span className="text-xs font-bold text-gray-600 mt-2 hidden sm:block">Payment Method</span>
              </div>

              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${(paymentType && paymentMethod) ? 'bg-[#2157da] text-white shadow-lg' : 'bg-white border-2 border-gray-300 text-gray-400'
                  }`}>
                  3
                </div>
                <span className="text-xs font-bold text-gray-600 mt-2 hidden sm:block">Confirm</span>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-6 lg:gap-8">

            {/* Left Column: Selection */}
            <div className="lg:col-span-2 space-y-6">

              {/* Step 1: Payment Type */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border border-gray-100" data-aos="fade-right">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-md">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900">Payment Type</h2>
                    <p className="text-xs text-gray-500">Choose how you want to pay</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Full Payment */}
                  <button
                    onClick={() => setPaymentType("full")}
                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg ${paymentType === "full"
                      ? "border-[#2157da] bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md"
                      : "border-gray-200 hover:border-blue-300 bg-white"
                      }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${paymentType === "full" ? 'bg-[#2157da] shadow-lg' : 'bg-gray-100 group-hover:bg-blue-100'
                        }`}>
                        <svg className={`w-6 h-6 ${paymentType === "full" ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      {paymentType === "full" && (
                        <div className="px-2.5 py-1 bg-green-100 rounded-full">
                          <span className="text-[10px] font-black text-green-700 uppercase">Selected</span>
                        </div>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-gray-900 mb-2">Full Payment</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">Pay the complete amount now and secure your enrollment immediately.</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold text-gray-500">₱</span>
                      <span className="text-2xl font-black text-[#2157da]">{subtotal.toLocaleString()}</span>
                    </div>
                  </button>

                  {/* Downpayment */}
                  <button
                    onClick={() => setPaymentType("downpayment")}
                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg ${paymentType === "downpayment"
                      ? "border-[#2157da] bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md"
                      : "border-gray-200 hover:border-blue-300 bg-white"
                      }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${paymentType === "downpayment" ? 'bg-[#2157da] shadow-lg' : 'bg-gray-100 group-hover:bg-blue-100'
                        }`}>
                        <svg className={`w-6 h-6 ${paymentType === "downpayment" ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      {paymentType === "downpayment" && (
                        <div className="px-2.5 py-1 bg-green-100 rounded-full">
                          <span className="text-[10px] font-black text-green-700 uppercase">Selected</span>
                        </div>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-gray-900 mb-2">50% Downpayment</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">Pay half now, settle the balance before your course starts.</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold text-gray-500">₱</span>
                      <span className="text-2xl font-black text-[#2157da]">{downpaymentAmount.toLocaleString()}</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 2: Payment Method */}
              <div className={`bg-white p-6 sm:p-8 rounded-3xl shadow-lg border transition-all duration-500 ${!paymentType ? "opacity-40 pointer-events-none border-gray-200" : "opacity-100 border-gray-100"
                }`} data-aos="fade-right" data-aos-delay="100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-md">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900">Payment Method</h2>
                    <p className="text-xs text-gray-500">Select your preferred payment gateway</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* GCash */}
                  <button
                    onClick={() => setPaymentMethod("gcash")}
                    disabled={!paymentType}
                    className={`group relative flex flex-col p-6 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg ${paymentMethod === "gcash"
                      ? "border-[#007dfe] bg-gradient-to-br from-blue-50 to-cyan-50 shadow-md"
                      : "border-gray-200 hover:border-blue-300 bg-white"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${paymentMethod === "gcash" ? 'bg-[#007dfe] shadow-lg scale-110' : 'bg-[#007dfe]/10 group-hover:bg-[#007dfe]/20'
                        }`}>
                        <span className={`text-2xl font-black italic ${paymentMethod === "gcash" ? 'text-white' : 'text-[#007dfe]'
                          }`}>G</span>
                      </div>
                      {paymentMethod === "gcash" && (
                        <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-gray-900 mb-1">GCash</h3>
                      <p className="text-sm text-gray-600">Pay instantly via GCash app</p>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex -space-x-1">
                        <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          </svg>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-500">Fast & Secure</span>
                    </div>
                  </button>

                  {/* Star Pay */}
                  <button
                    onClick={() => setPaymentMethod("starpay")}
                    disabled={!paymentType}
                    className={`group relative flex flex-col p-6 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg ${paymentMethod === "starpay"
                      ? "border-[#ff4d00] bg-gradient-to-br from-orange-50 to-red-50 shadow-md"
                      : "border-gray-200 hover:border-orange-300 bg-white"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${paymentMethod === "starpay" ? 'bg-[#ff4d00] shadow-lg scale-110' : 'bg-[#ff4d00]/10 group-hover:bg-[#ff4d00]/20'
                        }`}>
                        <span className={`text-xl font-black tracking-tighter ${paymentMethod === "starpay" ? 'text-white' : 'text-[#ff4d00]'
                          }`}>★P</span>
                      </div>
                      {paymentMethod === "starpay" && (
                        <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-gray-900 mb-1">Star Pay</h3>
                      <p className="text-sm text-gray-600">Secure merchant gateway</p>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex -space-x-1">
                        <div className="w-6 h-6 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                          </svg>
                        </div>
                        <div className="w-6 h-6 bg-yellow-500 rounded-full border-2 border-white flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-500">Trusted Gateway</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Proceed to Payment CTA */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#2157da] via-[#1e4db7] to-[#0f1f4d] p-1 rounded-3xl shadow-2xl" data-aos="fade-up">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-blue-400/20 to-blue-400/0 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-[#2157da] via-[#1a3a8a] to-[#0f1f4d] p-6 sm:p-8 rounded-3xl">
                  <button
                    className={`w-full py-5 rounded-2xl text-white font-black text-base sm:text-lg transition-all duration-300 relative overflow-hidden group ${paymentType && paymentMethod && !isProcessing
                      ? "bg-white/20 hover:bg-white/30 border-2 border-white/40 hover:scale-[1.02] shadow-2xl hover:shadow-white/10"
                      : "bg-white/10 border border-white/20 cursor-not-allowed opacity-60"
                      }`}
                    disabled={!paymentType || !paymentMethod || isProcessing}
                    onClick={handleOpenTermsModal}
                  >
                    {/* Button shine effect */}
                    {paymentType && paymentMethod && !isProcessing && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    )}

                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-3">
                        <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-base sm:text-lg">Processing Payment...</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-3 relative z-10">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-base sm:text-lg">
                          {paymentType === "full"
                            ? `Complete Payment ₱${subtotal.toLocaleString()}`
                            : `Pay Downpayment ₱${downpaymentAmount.toLocaleString()}`}
                        </span>
                      </span>
                    )}
                  </button>

                  {/* Security badge */}
                  <div className="mt-4 flex items-center justify-center gap-2 text-white/80">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-semibold">256-bit SSL Encrypted • Secure Payment</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-32 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl overflow-hidden border border-gray-700/50" data-aos="fade-left">
                {/* Background decorations */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight">Order Summary</h2>
                  </div>

                  {/* Selected Branch */}
                  {preSelectedBranch && (
                    <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">📍</span>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Branch Selection</p>
                      </div>
                      <p className="text-sm font-bold text-white pl-6">{preSelectedBranch.name}</p>
                    </div>
                  )}

                  {/* Selected Schedule */}
                  {scheduleSelection && (
                    <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">📅</span>
                        <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">Schedule Selection</p>
                      </div>
                      <div className="space-y-2 pl-6">
                        <p className="text-sm font-semibold text-white/90">
                          {scheduleSelection.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-sm font-semibold text-white/90 flex items-center gap-2">
                          <span className="text-sm">🕒</span> {scheduleSelection.slotDetails.time}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 mb-6">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-3 pb-4 border-b border-white/10 last:border-0 last:pb-0">
                        <div className="flex-1">
                          <p className="font-bold text-sm text-white/95 mb-1.5">{item.name}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-white/50">
                              {item.duration} × {item.quantity}
                            </p>
                            {item.type && item.type !== 'standard' && (
                              <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 rounded-full text-[10px] font-black uppercase border border-blue-400/20">
                                {item.type === 'online' ? '💻 Online' : item.type === 'face-to-face' ? '👥 Face to Face' : item.type}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-black text-sm text-blue-400 whitespace-nowrap">₱{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-white/20">
                    <div className="flex justify-between text-white/70 text-sm">
                      <span className="font-semibold">Subtotal:</span>
                      <span className="font-bold">₱{subtotal.toLocaleString()}</span>
                    </div>
                    {paymentType === "downpayment" && (
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-orange-400">Downpayment (50%):</span>
                        <span className="font-bold text-orange-400">₱{downpaymentAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-4 border-t border-white/30">
                      <span className="text-lg font-black text-white">Total Now</span>
                      <div className="text-right">
                        <div className="text-3xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">₱{finalAmount.toLocaleString()}</div>
                        {paymentType === "downpayment" && (
                          <p className="text-[10px] text-white/50 mt-1">Balance: ₱{downpaymentAmount.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2 text-white/60 text-xs mb-3">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold">Secure Payment</span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      Your payment information is encrypted and secure. We never store your card details.
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-center gap-6 opacity-40 grayscale group-hover:grayscale-0 transition-all duration-500">
                  <div className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest text-white">SSL SECURE</div>
                  <div className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest text-white">PCI DSS</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowTermsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all animate-slide-up" onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50/80 rounded-t-2xl">
              <h2 className="text-2xl font-black text-[#2157da]">Terms and Conditions</h2>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-200 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div
              id="terms-scroll-container"
              className="flex-1 overflow-y-auto p-6 text-gray-700 relative"
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.target;
                if (scrollHeight - scrollTop <= clientHeight + 50) {
                  setHasScrolledToBottom(true);
                }
              }}
            >
              {!hasScrolledToBottom && (
                <div className="text-center p-3 mb-4 bg-orange-50 text-orange-800 text-xs font-bold rounded-lg sticky top-0 uppercase tracking-widest shadow-sm z-10 opacity-90 transition-opacity animate-pulse border border-orange-200">
                  ⚠️ Please scroll to the bottom to agree
                </div>
              )}
              <p className="mb-6 leading-relaxed">
                These terms and conditions govern the enrollment and participation in the Driving courses offered by MASTER DRIVING SCHOOL. By enrolling in our driving school, you agree to the following terms:
              </p>

              {/* 1. ELIGIBILITY */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">1. ELIGIBILITY</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Student(s) must be at least 16 years of age with Parents consent when applying for TDC.</li>
                <li>Student(s) must hold a valid Student Permit or valid Driver's license to enroll in any driving course.</li>
              </ul>

              {/* 2. ENROLLMENT AND PAYMENT */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">2. ENROLLMENT AND PAYMENT</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Enrollment is only confirmed upon receipt of a completed application form and payment of the course fee.</li>
                <li>50% Down payment is acceptable.</li>
                <li>Full payment must be made before the 2nd day of lesson.</li>
                <li>Payments are <strong className="text-red-600">NON-REFUNDABLE</strong> and <strong className="text-red-600">NON-TRANSFERABLE</strong> unless stated otherwise in the cancellation and refund policy.</li>
              </ul>

              {/* 3. CANCELLATION AND REFUND POLICY */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">3. CANCELLATION AND REFUND POLICY</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>A full refund will be issued if the student cancels the enrollment within (5) five days before the course start date.</li>
                <li>If a lesson is cancelled by the student, a (5) five days' notice is required to reschedule without incurring a fee.</li>
                <li>Failure to give proper notice or missed lessons may result in late payment fee amounting to:
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>1st re-schedule - Php 1,000.00</li>
                    <li>2nd re-schedule - Lesson Forfeiture</li>
                  </ul>
                </li>
                <li>Refunds for courses cancelled by the driving school will be issued in full.</li>
              </ul>

              {/* 4. LESSON SCHEDULE */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">4. LESSON SCHEDULE</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Lessons are scheduled according to the availability of both the instructor and the student. The school reserves the right to adjust the lesson schedule.</li>
                <li>Punctuality is required. Students who arrive late may lose the portion of the lesson missed, and no extra time will be provided.</li>
              </ul>

              {/* 5. STUDENT CONDUCT */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">5. STUDENT CONDUCT</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>Students must follow all instructions from the instructor during lessons.</li>
                <li>Students are expected to behave responsibly and comply with all traffic laws during lessons.</li>
                <li>Use of alcohol, drugs, or any illegal substances before or during lessons is strictly prohibited and will result in termination of enrollment, without refund.</li>
              </ul>

              {/* 6. LIABILITY */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">6. LIABILITY</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>The driving school is not liable for any damage, injury, or loss incurred during lessons unless caused by negligence on the part of the school or instructor.</li>
                <li>Students are responsible for any fines, penalties, or legal issues arising from their actions during a lesson. (PDC)</li>
              </ul>

              {/* 7. COMPLETION OF COURSE */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">7. COMPLETION OF COURSE</h3>
              <ul className="list-disc pl-6 mb-6 space-y-2">
                <li>The completion of the course and the issuance of certificates depend on the students' performance and test result.</li>
                <li>The driving school does not guarantee that students will pass their driving test or obtain a driver's license.</li>
              </ul>

              {/* 8. PRIVACY POLICY */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">8. PRIVACY POLICY</h3>
              <p className="mb-6">
                The driving school respects your privacy and is committed to protecting your personal information. Personal details collected will be kept confidential and used only for course administration and legal purposes.
              </p>

              {/* 9. AMENDMENTS */}
              <h3 className="text-lg font-bold text-[#2157da] mb-3">9. AMENDMENTS</h3>
              <p className="mb-6">
                The driving school reserves the right to amend these Terms and Conditions at any time. Any changes will be communicated via phone call or email.
              </p>

              <div
                className={`mt-8 p-5 rounded-2xl border transition-all duration-300 shadow-sm flex items-start gap-3 ${hasScrolledToBottom ? "bg-white border-blue-200 opacity-100" : "bg-gray-50 border-gray-200 opacity-50 grayscale"
                  }`}
              >
                <div className="flex items-center h-6 mt-0">
                  <input
                    type="checkbox"
                    id="modal-terms"
                    disabled={!hasScrolledToBottom}
                    className="w-6 h-6 rounded border-gray-300 text-[#2157da] focus:ring-[#2157da] cursor-pointer transition-all hover:border-[#2157da] disabled:cursor-not-allowed"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                  />
                </div>
                <label htmlFor="modal-terms" className={`text-base cursor-pointer select-none leading-relaxed font-bold ${hasScrolledToBottom ? 'text-gray-800' : 'text-gray-500 cursor-not-allowed'}`}>
                  I have completely read and agree to these Terms & Conditions. I understand the cancellation and refund policies.
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex gap-3">
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-1/3 bg-gray-200 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-300 transition-all text-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessPayment}
                disabled={!agreedToTerms}
                className={`w-2/3 text-white py-3.5 rounded-xl font-bold transition-all text-lg ${agreedToTerms ? "bg-[#2157da] hover:bg-[#1a3a8a] hover:shadow-lg active:scale-95" : "bg-blue-300 cursor-not-allowed"
                  }`}
              >
                Go to Payment
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default Payment
