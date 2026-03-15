import { useState, useEffect, useRef } from "react"
import { useNotification } from "../context/NotificationContext"
import { authAPI, bookingsAPI, schedulesAPI, starpayAPI } from "../services/api"

function Payment({ cart, setCart, onNavigate, isLoggedIn, preSelectedBranch, scheduleSelection }) {
  const { showNotification } = useNotification()
  const [paymentType, setPaymentType] = useState(null) // "full" or "downpayment"
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  // StarPay QR state
  const [starpayQR, setStarpayQR] = useState(null) // { codeUrl, msgId, bookingId }
  const [qrStatus, setQrStatus] = useState('pending') // pending|success|failed
  const pollRef = useRef(null)

  const isGuestCheckout = localStorage.getItem('isGuestCheckout') === 'true' && !isLoggedIn

  const calculateItemTotals = (item) => {
    let calcBasePrice = parseFloat(item.price) || 0;
    let calcDiscountRate = 0;

    if (item.hasTypeOption && item.typeOptions) {
      const activeType = item.typeOptions.find(opt => opt.value === item.type);
      if (activeType) {
        calcBasePrice = parseFloat(activeType.price) || calcBasePrice;
        calcDiscountRate = activeType.discount || parseFloat(item.discount) || 0;
      }
    } else {
      calcDiscountRate = parseFloat(item.discount) || 0;
    }

    let calcDiscountValue = 0;
    let hasDiscount = false;
    if (calcDiscountRate > 0) {
      hasDiscount = true;
      calcDiscountValue = calcBasePrice * (calcDiscountRate / 100);
    }

    const reviewerPrice = item.selectedAddons?.reviewer ? parseFloat(item.addonsConfig?.reviewer || 30) : 0;
    const vehicleTipsPrice = item.selectedAddons?.vehicleTips ? parseFloat(item.addonsConfig?.vehicleTips || 20) : 0;
    const advFee = parseFloat(item.addonsConfig?.convenienceFee || 25);

    const finalItemPrice = calcBasePrice - calcDiscountValue + reviewerPrice + vehicleTipsPrice + advFee;
    
    return {
      calcBasePrice,
      hasDiscount,
      calcDiscountRate,
      calcDiscountValue,
      reviewerPrice,
      vehicleTipsPrice,
      advFee,
      finalItemPrice
    };
  };

  const getPaymentTotals = () => {
    let baseCoursePriceTotal = 0;
    let reviewerTotal = 0;
    let vehicleTipsTotal = 0;
    let convenienceTotal = 0;
    let discountTotal = 0;
    let subtotal = 0;

    cart.forEach(item => {
      const totals = calculateItemTotals(item);
      const qty = item.quantity;
      baseCoursePriceTotal += totals.calcBasePrice * qty;
      reviewerTotal += totals.reviewerPrice * qty;
      vehicleTipsTotal += totals.vehicleTipsPrice * qty;
      convenienceTotal += totals.advFee * qty;
      discountTotal += totals.calcDiscountValue * qty;
      subtotal += totals.finalItemPrice * qty;
    });
    
    const hasTDC = cart.some(item => (item.category === 'TDC' || (item.name || '').toLowerCase().includes('tdc') || (item.shortName || '').toLowerCase().includes('tdc')));
    const hasPDC = cart.some(item => (item.category === 'PDC' || (item.name || '').toLowerCase().includes('pdc') || (item.shortName || '').toLowerCase().includes('pdc')));
    
    const hasBundleDiscount = hasTDC && hasPDC;
    const bundleDiscountValue = hasBundleDiscount ? subtotal * 0.03 : 0;
    const finalTotal = subtotal - bundleDiscountValue;

    return { 
      baseCoursePriceTotal, 
      reviewerTotal, 
      vehicleTipsTotal, 
      convenienceTotal, 
      discountTotal, 
      subtotal, 
      hasBundleDiscount, 
      bundleDiscountValue, 
      finalTotal 
    };
  };

  const totalsData = getPaymentTotals();
  const baseSubtotal = totalsData.subtotal;
  const hasBundleDiscount = totalsData.hasBundleDiscount;
  const bundleDiscountValue = totalsData.bundleDiscountValue;

  const subtotal = totalsData.finalTotal;
  const downpaymentAmount = subtotal * 0.5;
  const finalAmount = paymentType === "downpayment" ? downpaymentAmount : subtotal;

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

  // Auto-select StarPay — it's the only payment method
  useEffect(() => {
    setPaymentMethod('starpay')
  }, [])

  // Always allow the checkbox to be ticked — don't gate on scroll
  useEffect(() => {
    if (showTermsModal) {
      setHasScrolledToBottom(true);
    }
  }, [showTermsModal]);

  const handleOpenTermsModal = () => {
    if (!paymentType || !paymentMethod) {
      showNotification("Please select both payment type and method", "error")
      return
    }
    setAgreedToTerms(false)
    setShowTermsModal(true)
  }

  const handleProcessPayment = async () => {
    if (!agreedToTerms) {
      showNotification("Please check the agreement box to proceed", "error")
      return
    }

    setShowTermsModal(false)
    setIsProcessing(true)

    // ── StarPay: create QR order, show QR modal, poll for status ──────────────────
    if (paymentMethod === 'starpay') {
      try {
        if (!scheduleSelection?.slot) {
          showNotification('Please select a schedule slot before paying.', 'error')
          setIsProcessing(false)
          return
        }

        const isGuest = localStorage.getItem('isGuestCheckout') === 'true'
        const guestDataStr = localStorage.getItem('guestEnrollmentData')

        let result
        if (isGuest && guestDataStr) {
          // Guest StarPay: send personal info + booking details to the no-auth endpoint
          const guestData = JSON.parse(guestDataStr)
          const formatDate = (d) => {
            if (!d) return null
            const dt = new Date(d)
            return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
          }
          result = await starpayAPI.createGuestPayment({
            ...guestData,
            courseId:        cart[0]?.id,
            branchId:        preSelectedBranch?.id || guestData.branchId,
            courseCategory:  cart[0]?.category,
            courseType:      cart[0]?.type,
            scheduleSlotId:  scheduleSelection.slot,
            scheduleSlotId2: scheduleSelection.slot2 || null,
            scheduleDate:    formatDate(scheduleSelection.date),
            amount:          finalAmount,
            paymentType:     paymentType === 'full' ? 'Full Payment' : 'Downpayment',
            attach:          `MDS ${cart[0]?.name || 'Course'}`.slice(0, 92),
          })
        } else {
          // Logged-in StarPay: use authenticated endpoint
          result = await starpayAPI.createPayment({
            courseId:        cart[0]?.id,
            branchId:        preSelectedBranch?.id,
            courseCategory:  cart[0]?.category,
            courseType:      cart[0]?.type,
            amount:          finalAmount,
            paymentType:     paymentType === 'full' ? 'Full Payment' : 'Downpayment',
            attach:          `MDS ${cart[0]?.name || 'Course'}`.slice(0, 92),
            scheduleSlotId:  scheduleSelection.slot,
            scheduleSlotId2: scheduleSelection.slot2 || null,
          })
        }
        if (!result.success || !result.codeUrl) {
          showNotification(result.message || 'Failed to create StarPay order', 'error')
          setIsProcessing(false)
          return
        }
        setIsProcessing(false)
        setQrStatus('pending')
        setStarpayQR({ codeUrl: result.codeUrl, msgId: result.msgId, bookingId: result.bookingId })
        // Poll every 3 seconds for payment confirmation
        pollRef.current = setInterval(async () => {
          try {
            const status = await starpayAPI.checkStatus(result.msgId)
            const state = status.starpayState || status.localStatus
            if (state === 'SUCCESS' || status.localStatus === 'paid') {
              clearInterval(pollRef.current)
              setQrStatus('success')
              setTimeout(() => {
                setStarpayQR(null)
                setCart([])
                localStorage.removeItem('isGuestCheckout')
                localStorage.removeItem('guestEnrollmentData')
                showNotification('Payment successful! 🎉 Check your email for confirmation.', 'success')
                onNavigate('home')
              }, 2000)
            } else if (['FAIL', 'REVERSED', 'CLOSE'].includes(state)) {
              clearInterval(pollRef.current)
              setQrStatus('failed')
            }
          } catch { /* ignore poll errors */ }
        }, 3000)
      } catch (err) {
        showNotification(err.message || 'StarPay error', 'error')
        setIsProcessing(false)
      }
      return
    }

    showNotification(`Processing ${paymentMethod} payment for ₱${finalAmount.toLocaleString()}...`, "info")

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
          paymentMethod: paymentMethod,
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
          notes: 'Standard Enrollment',
          paymentMethod: paymentMethod,
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
      } else {
        // Safety net: neither branch matched — session data may be missing
        showNotification('Session expired. Please restart the enrollment process.', 'error')
        setIsProcessing(false)
        return
      }

      handleSuccess();
    } catch (error) {
      console.error('Checkout error:', error)
      showNotification(error.message || 'Enrollment failed. Please try again.', 'error')
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero ── */}
      <section className="relative py-10 sm:py-14 bg-gradient-to-br from-[#2157da] via-[#1a3a8a] to-[#0f1f4d] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 sm:w-96 sm:h-96 bg-blue-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-60 h-60 sm:w-80 sm:h-80 bg-indigo-400/20 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '36px 36px' }} />
        </div>
        <div className="relative z-10 container mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center text-white">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-5">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs sm:text-sm font-bold tracking-wide">Secure Checkout</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black mb-3 tracking-tight leading-tight">
              Complete Your Payment
            </h1>
            <p className="text-blue-100 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Choose your payment preference and secure your enrollment today.
            </p>
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <section className="py-6 sm:py-10 lg:py-14">
        <div className="container mx-auto px-4 sm:px-6">

          {/* Progress Steps */}
          <div className="max-w-lg mx-auto mb-8 sm:mb-10">
            <div className="flex items-center gap-0">
              {/* Step 1 */}
              <div className="flex flex-col items-center flex-1">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm border-2 transition-all duration-300 ${paymentType ? 'bg-[#2157da] border-[#2157da] text-white shadow-md shadow-blue-200' : 'bg-white border-gray-300 text-gray-400'}`}>
                  {paymentType ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  ) : '1'}
                </div>
                <span className="mt-1.5 text-[10px] sm:text-xs font-bold text-gray-500 text-center">Type</span>
              </div>
              {/* Connector */}
              <div className="flex-1 h-0.5 mb-5 mx-1 rounded-full bg-gray-200 overflow-hidden">
                <div className={`h-full bg-[#2157da] rounded-full transition-all duration-500 ${paymentType ? 'w-full' : 'w-0'}`} />
              </div>
              {/* Step 2 */}
              <div className="flex flex-col items-center flex-1">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm border-2 transition-all duration-300 ${paymentMethod ? 'bg-[#2157da] border-[#2157da] text-white shadow-md shadow-blue-200' : 'bg-white border-gray-300 text-gray-400'}`}>
                  {paymentMethod ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  ) : '2'}
                </div>
                <span className="mt-1.5 text-[10px] sm:text-xs font-bold text-gray-500 text-center">Method</span>
              </div>
              {/* Connector */}
              <div className="flex-1 h-0.5 mb-5 mx-1 rounded-full bg-gray-200 overflow-hidden">
                <div className={`h-full bg-[#2157da] rounded-full transition-all duration-500 ${paymentType && paymentMethod ? 'w-full' : 'w-0'}`} />
              </div>
              {/* Step 3 */}
              <div className="flex flex-col items-center flex-1">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm border-2 transition-all duration-300 ${paymentType && paymentMethod ? 'bg-[#2157da] border-[#2157da] text-white shadow-md shadow-blue-200' : 'bg-white border-gray-300 text-gray-400'}`}>
                  3
                </div>
                <span className="mt-1.5 text-[10px] sm:text-xs font-bold text-gray-500 text-center">Confirm</span>
              </div>
            </div>
          </div>

          {/* Main grid – form left, summary right */}
          <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-5 lg:gap-8 items-start">

            {/* ── Left: form ── */}
            <div className="lg:col-span-3 space-y-5">

              {/* Step 1 – Payment Type */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
                  <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-sm sm:text-base">Step 1 — Payment Type</p>
                    <p className="text-[11px] text-gray-400">Choose how much you'd like to pay now</p>
                  </div>
                </div>

                <div className="p-4 sm:p-5 grid sm:grid-cols-2 gap-3">
                  {/* Full Payment */}
                  <button
                    onClick={() => setPaymentType("full")}
                    className={`group relative text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 ${paymentType === "full" ? "border-[#2157da] bg-blue-50 shadow-md" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${paymentType === "full" ? 'bg-[#2157da]' : 'bg-gray-100 group-hover:bg-blue-100'}`}>
                        <svg className={`w-5 h-5 ${paymentType === "full" ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      {paymentType === "full" && <span className="text-[10px] font-black text-green-700 bg-green-100 px-2.5 py-1 rounded-full uppercase">Selected</span>}
                    </div>
                    <p className="font-black text-gray-900 mb-1 text-sm sm:text-base">Full Payment</p>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">Pay the complete amount now and secure your spot immediately.</p>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-xs text-gray-400 font-semibold">₱</span>
                      <span className="text-xl sm:text-2xl font-black text-[#2157da]">{subtotal.toLocaleString()}</span>
                    </div>
                  </button>

                  {/* Downpayment */}
                  <button
                    onClick={() => setPaymentType("downpayment")}
                    className={`group relative text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 ${paymentType === "downpayment" ? "border-[#2157da] bg-blue-50 shadow-md" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${paymentType === "downpayment" ? 'bg-[#2157da]' : 'bg-gray-100 group-hover:bg-blue-100'}`}>
                        <svg className={`w-5 h-5 ${paymentType === "downpayment" ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      {paymentType === "downpayment" && <span className="text-[10px] font-black text-green-700 bg-green-100 px-2.5 py-1 rounded-full uppercase">Selected</span>}
                    </div>
                    <p className="font-black text-gray-900 mb-1 text-sm sm:text-base">50% Downpayment</p>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">Pay half now, settle the balance before your course starts.</p>
                    <div className="flex items-baseline gap-1">
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-xs text-gray-400 font-semibold">₱</span>
                        <span className="text-xl sm:text-2xl font-black text-[#2157da]">{downpaymentAmount.toLocaleString()}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-semibold">(of ₱{subtotal.toLocaleString()})</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 2 – Payment Method */}
              <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${!paymentType ? 'opacity-40 pointer-events-none border-gray-100' : 'opacity-100 border-gray-100'}`}>
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
                  <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-sm sm:text-base">Step 2 — Payment Method</p>
                    <p className="text-[11px] text-gray-400">Pay via QR Ph — GCash, Maya, GrabPay & more</p>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-3">
                  {/* StarPay QR card — available to everyone */}
                  <button
                    onClick={() => setPaymentMethod('starpay')}
                    disabled={!paymentType}
                    className={`group w-full text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 ${paymentMethod === 'starpay'
                      ? 'border-[#2b4db8] bg-[#f0f4ff] shadow-md'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all duration-200 ${paymentMethod === 'starpay' ? 'border-[#2b4db8] shadow-md scale-105' : 'border-gray-200 group-hover:border-blue-300 group-hover:scale-105'}`}>
                        <img src="/images/starpay.png" alt="Star Pay" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="font-black text-gray-900 text-base sm:text-lg">Star Pay</p>
                          {paymentMethod === 'starpay' ? (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-black text-green-700 bg-green-100 px-2.5 py-1 rounded-full uppercase">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                              Selected
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full uppercase">Tap to select</span>
                          )}
                          </div>
                          <p className="text-xs text-gray-500 mb-3">Scan the QR Ph code with any supported e-wallet or banking app</p>
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Accepted wallets &amp; apps</p>
                            <div className="flex flex-wrap gap-1.5">
                              {["GCash", "Maya", "GrabPay", "ShopeePay", "BDO", "BPI", "RCBC", "TayoCash", "USSC"].map((w) => (
                                <span key={w} className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${paymentMethod === 'starpay' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                                  {w}
                                </span>
                              ))}
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-gray-50 border-dashed border-gray-300 text-gray-400">+ more</span>
                            </div>
                          </div>
                        </div>
                      </div>
                  </button>

                </div>
              </div>

              {/* CTA */}
              <div className={`rounded-2xl overflow-hidden transition-all duration-300 ${paymentType && paymentMethod ? 'shadow-lg shadow-blue-100' : ''}`}>
                <button
                  onClick={handleOpenTermsModal}
                  disabled={!paymentType || !paymentMethod || isProcessing}
                  className={`relative w-full py-4 sm:py-5 font-black text-base sm:text-lg text-white rounded-2xl overflow-hidden transition-all duration-300 ${paymentType && paymentMethod && !isProcessing
                    ? "bg-gradient-to-r from-[#2157da] to-[#1a3a8a] hover:from-[#1a3a8a] hover:to-[#0f1f4d] hover:shadow-xl active:scale-[0.99]"
                    : "bg-gray-300 cursor-not-allowed"}`}
                >
                  {paymentType && paymentMethod && !isProcessing && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                  )}
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing Payment...
                    </span>
                  ) : (
                    <span className="relative z-10 flex items-center justify-center gap-2.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {!paymentType ? 'Select a Payment Type' : !paymentMethod ? 'Select a Payment Method' : paymentType === "full" ? `Complete Payment — ₱${subtotal.toLocaleString()}` : `Pay Downpayment — ₱${downpaymentAmount.toLocaleString()}`}
                    </span>
                  )}
                </button>
                {paymentType && paymentMethod && (
                  <div className="flex items-center justify-center gap-1.5 mt-2.5 text-gray-400 text-xs">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">256-bit SSL Encrypted · Secure Payment</span>
                  </div>
                )}
              </div>

            </div>

            {/* ── Right: Order Summary ── */}
            <div className="lg:col-span-2 order-first lg:order-last">
              <div className="sticky top-24 bg-gradient-to-br from-[#0d1b3e] via-gray-900 to-[#0d1b3e] rounded-2xl text-white shadow-2xl border border-white/5 overflow-hidden">

                {/* Decorations */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-36 h-36 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight">Order Summary</h2>
                  </div>

                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Branch */}
                    {preSelectedBranch && (
                      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                        <span className="text-lg shrink-0">📍</span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Branch</p>
                          <p className="text-xs font-bold text-white truncate">{preSelectedBranch.name}</p>
                        </div>
                      </div>
                    )}

                    {/* Schedule */}
                    {scheduleSelection && (
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">📅</span>
                            <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">Schedule</p>
                          </div>
                          <button onClick={() => onNavigate('schedule')} className="text-[10px] font-black text-blue-300 hover:text-white bg-blue-500/20 hover:bg-blue-500/40 px-2 py-1 rounded-lg transition-all uppercase tracking-wide">
                            Change
                          </button>
                        </div>

                        {scheduleSelection.isMotorcyclePDC ? (
                          <p className="text-xs font-bold text-white/80 text-center mt-2">Assigned by Admin after payment</p>
                        ) : (
                          <div className="mt-2 space-y-1.5">
                            {scheduleSelection.slotDetails?.type?.toLowerCase() === 'tdc' && scheduleSelection.slotDetails?.end_date && scheduleSelection.slotDetails.end_date !== scheduleSelection.slotDetails.date ? (
                              <>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Day 1 & Day 2</p>
                                <p className="text-xs font-semibold text-white/90">
                                  {scheduleSelection.date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &amp; {new Date(scheduleSelection.slotDetails.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </>
                            ) : (
                              <>
                                {scheduleSelection.date2 && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Day 1</p>}
                                <p className="text-xs font-semibold text-white/90">
                                  {scheduleSelection.date?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </>
                            )}
                            <p className="text-xs text-white/70 flex items-center gap-1.5">
                              <span>🕒</span>{scheduleSelection.slotDetails?.time_range || scheduleSelection.slotDetails?.time}
                            </p>
                            {scheduleSelection.date2 && (
                              <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Day 2</p>
                                <p className="text-xs font-semibold text-white/90">
                                  {scheduleSelection.date2?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-white/70 flex items-center gap-1.5">
                                  <span>🕒</span>{scheduleSelection.slotDetails2?.time_range || scheduleSelection.slotDetails2?.time}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cart Items */}
                    <div className="space-y-4">
                      {cart.map((item, idx) => {
                        const totals = calculateItemTotals(item);
                        return (
                          <div key={idx} className="pb-4 border-b border-white/10 last:border-0 last:pb-0">
                            <div className="flex justify-between items-start gap-3 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-white/95 mb-1 leading-snug">{item.name}</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11px] text-white/40">{item.duration} × {item.quantity}</span>
                                  {item.type && item.type !== 'standard' && (
                                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-[10px] font-black uppercase border border-blue-400/20">
                                      {item.type === 'online' ? '💻 Online' : item.type === 'face-to-face' ? '👥 Face to Face' : item.type}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Detailed Breakdown inside Totals */}
                    <div className="pt-3 border-t border-white/15 space-y-2">
                      <div className="space-y-1.5 text-xs text-white/60 font-medium mb-3">
                        <div className="flex justify-between items-center">
                          <span>Course Price</span>
                          <span className="font-bold text-white/90">₱{totalsData.baseCoursePriceTotal.toLocaleString()}</span>
                        </div>

                        {(totalsData.reviewerTotal > 0 || totalsData.vehicleTipsTotal > 0) && (
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span>Add-ons</span>
                              {totalsData.reviewerTotal > 0 && <span className="text-[10px] text-white/40 ml-2">• Reviewer</span>}
                              {totalsData.vehicleTipsTotal > 0 && <span className="text-[10px] text-white/40 ml-2">• Vehicle Tips</span>}
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-white/90">₱{(totalsData.reviewerTotal + totalsData.vehicleTipsTotal).toLocaleString()}</span>
                              {totalsData.reviewerTotal > 0 && <span className="text-[10px] text-white/40">₱{totalsData.reviewerTotal.toLocaleString()}</span>}
                              {totalsData.vehicleTipsTotal > 0 && <span className="text-[10px] text-white/40">₱{totalsData.vehicleTipsTotal.toLocaleString()}</span>}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center">
                          <span>Convenience Fee</span>
                          <span className="font-bold text-white/90">₱{totalsData.convenienceTotal.toLocaleString()}</span>
                        </div>

                        {totalsData.discountTotal > 0 && (
                          <div className="flex justify-between items-center text-green-400">
                            <span>Discount</span>
                            <span className="font-bold">- ₱{totalsData.discountTotal.toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between text-xs text-white/60 border-t border-white/10 pt-2">
                        <span className="font-semibold">Subtotal</span>
                        <span className="font-bold">₱{baseSubtotal.toLocaleString()}</span>
                      </div>
                      {hasBundleDiscount && (
                        <div className="flex justify-between text-xs text-green-400 bg-green-500/10 px-2 py-1.5 -mx-2 rounded">
                          <span className="font-bold">Bundle Discount (3% OFF)</span>
                          <span className="font-bold">- ₱{bundleDiscountValue.toLocaleString()}</span>
                        </div>
                      )}
                      {subtotal !== baseSubtotal && (
                         <div className="flex justify-between text-xs text-white/80 pt-1">
                           <span className="font-semibold">Total after discount</span>
                           <span className="font-bold">₱{subtotal.toLocaleString()}</span>
                         </div>
                      )}
                      {paymentType === "downpayment" && (
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-amber-400">Downpayment (50%)</span>
                          <span className="font-bold text-amber-400">₱{downpaymentAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-3 border-t border-white/20">
                        <span className="text-sm font-black text-white">Due Now</span>
                        <div className="text-right">
                          <p className="text-2xl sm:text-3xl font-black text-white">₱{finalAmount.toLocaleString()}</p>
                          {paymentType === "downpayment" && (
                            <p className="text-[10px] text-white/40 mt-0.5">Balance later: ₱{downpaymentAmount.toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Trust badges */}
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-bold">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        SSL SECURE
                      </div>
                      <div className="w-px h-3 bg-white/10" />
                      <span className="text-white/30 text-[10px] font-bold">PCI DSS</span>
                      <div className="w-px h-3 bg-white/10" />
                      <span className="text-white/30 text-[10px] font-bold">ENCRYPTED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Terms & Conditions Modal ── */}
      {showTermsModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowTermsModal(false)}
        >
          <div
            className="bg-white w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#2157da]">Terms and Conditions</h2>
                <p className="text-xs text-gray-400 mt-0.5">Read to the bottom before agreeing</p>
              </div>
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div
              id="terms-scroll-container"
              className="flex-1 overflow-y-auto px-5 py-4 text-gray-700 text-sm leading-relaxed"
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.target;
                if (scrollHeight - scrollTop <= clientHeight + 50) setHasScrolledToBottom(true);
              }}
            >
              {!hasScrolledToBottom && (
                <div className="sticky top-0 z-10 mb-4 flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
                  <span>⚠️</span>
                  <span>Scroll to the bottom to enable the agreement checkbox</span>
                </div>
              )}

              <p className="mb-5 text-gray-600">
                These terms and conditions govern the enrollment and participation in the Driving courses offered by <strong>MASTER DRIVING SCHOOL</strong>. By enrolling, you agree to the following:
              </p>

              {[
                { title: "1. ELIGIBILITY", items: ["Student(s) must be at least 16 years of age with Parents consent when applying for TDC.", "Student(s) must hold a valid Student Permit or valid Driver's license to enroll in any driving course."] },
                { title: "2. ENROLLMENT AND PAYMENT", items: ["Enrollment is only confirmed upon receipt of a completed application form and payment of the course fee.", "50% Down payment is acceptable.", "Full payment must be made before the 2nd day of lesson.", null] },
                { title: "4. LESSON SCHEDULE", items: ["Lessons are scheduled according to the availability of both the instructor and the student. The school reserves the right to adjust the lesson schedule.", "Punctuality is required. Students who arrive late may lose the portion of the lesson missed, and no extra time will be provided."] },
                { title: "5. STUDENT CONDUCT", items: ["Students must follow all instructions from the instructor during lessons.", "Students are expected to behave responsibly and comply with all traffic laws during lessons.", "Use of alcohol, drugs, or any illegal substances before or during lessons is strictly prohibited and will result in termination of enrollment, without refund."] },
                { title: "6. LIABILITY", items: ["The driving school is not liable for any damage, injury, or loss incurred during lessons unless caused by negligence on the part of the school or instructor.", "Students are responsible for any fines, penalties, or legal issues arising from their actions during a lesson. (PDC)"] },
                { title: "7. COMPLETION OF COURSE", items: ["The completion of the course and the issuance of certificates depend on the students' performance and test result.", "The driving school does not guarantee that students will pass their driving test or obtain a driver's license."] },
              ].map(({ title, items }) => (
                <div key={title} className="mb-5">
                  <h3 className="font-black text-[#2157da] mb-2 text-sm">{title}</h3>
                  <ul className="list-disc pl-5 space-y-1.5 text-gray-600 text-xs">
                    {items.map((item, i) => item ? (
                      <li key={i} dangerouslySetInnerHTML={{ __html: item.replace('NON-REFUNDABLE', '<strong class="text-red-600">NON-REFUNDABLE</strong>').replace('NON-TRANSFERABLE', '<strong class="text-red-600">NON-TRANSFERABLE</strong>') }} />
                    ) : (
                      <li key={i}>Payments are <strong className="text-red-600">NON-REFUNDABLE</strong> and <strong className="text-red-600">NON-TRANSFERABLE</strong> unless stated otherwise in the cancellation and refund policy.</li>
                    ))}
                  </ul>
                </div>
              ))}

              {/* Cancellation */}
              <div className="mb-5">
                <h3 className="font-black text-[#2157da] mb-2 text-sm">3. CANCELLATION AND REFUND POLICY</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-gray-600 text-xs">
                  <li>A full refund will be issued if the student cancels the enrollment within (5) five days before the course start date.</li>
                  <li>If a lesson is cancelled by the student, a (5) five days' notice is required to reschedule without incurring a fee.</li>
                  <li>Failure to give proper notice or missed lessons may result in a late fee:
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>1st re-schedule — Php 1,000.00</li>
                      <li>2nd re-schedule — Lesson Forfeiture</li>
                    </ul>
                  </li>
                  <li>Refunds for courses cancelled by the driving school will be issued in full.</li>
                </ul>
              </div>

              {/* Privacy & Amendments */}
              <div className="mb-5">
                <h3 className="font-black text-[#2157da] mb-2 text-sm">8. PRIVACY POLICY</h3>
                <p className="text-xs text-gray-600">The driving school respects your privacy and is committed to protecting your personal information. Personal details collected will be kept confidential and used only for course administration and legal purposes.</p>
              </div>
              <div className="mb-5">
                <h3 className="font-black text-[#2157da] mb-2 text-sm">9. AMENDMENTS</h3>
                <p className="text-xs text-gray-600">The driving school reserves the right to amend these Terms and Conditions at any time. Changes will be communicated via phone or email.</p>
              </div>

              {/* Agreement checkbox */}
              <div className={`mt-6 p-4 rounded-2xl border-2 flex items-start gap-3 transition-all duration-300 ${hasScrolledToBottom ? 'bg-blue-50 border-[#2157da]' : 'bg-gray-50 border-gray-200 opacity-50'}`}>
                <input
                  type="checkbox"
                  id="modal-terms"
                  disabled={!hasScrolledToBottom}
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[#2157da] focus:ring-[#2157da] cursor-pointer disabled:cursor-not-allowed shrink-0"
                />
                <label htmlFor="modal-terms" className={`text-xs sm:text-sm font-bold cursor-pointer leading-relaxed ${hasScrolledToBottom ? 'text-gray-800' : 'text-gray-400 cursor-not-allowed'}`}>
                  I have completely read and agree to these Terms & Conditions, including the cancellation and refund policies.
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0 bg-gray-50 rounded-b-2xl sm:rounded-b-2xl">
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-2/5 sm:w-1/3 py-3 rounded-xl font-bold text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessPayment}
                disabled={!agreedToTerms}
                className={`flex-1 py-3 rounded-xl font-black text-sm text-white transition-all ${agreedToTerms ? 'bg-[#2157da] hover:bg-[#1a3a8a] shadow-md active:scale-[0.98]' : 'bg-blue-200 cursor-not-allowed'}`}
              >
                {agreedToTerms ? '✓ Proceed to Payment' : 'Agree to Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── StarPay QR Modal ──────────────────────────────────── */}
      {starpayQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#2157da] to-[#3b82f6] p-5 text-white text-center">
              <img src="/images/starpay.png" alt="StarPay" className="w-10 h-10 rounded-xl mx-auto mb-2 object-cover" />
              <h2 className="text-lg font-black">Scan to Pay via StarPay</h2>
              <p className="text-blue-100 text-xs mt-1">Open GCash, Maya, or any QRPh-enabled app</p>
            </div>

            <div className="p-6 flex flex-col items-center">
              {qrStatus === 'pending' && (
                <>
                  <div className="p-2 border-4 border-[#2157da] rounded-xl mb-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(starpayQR.codeUrl)}&size=220x220&format=png`}
                      alt="StarPay QR"
                      className="w-[220px] h-[220px]"
                    />
                  </div>
                  <p className="text-sm font-bold text-gray-700 mb-1">Amount Due</p>
                  <p className="text-3xl font-black text-[#2157da] mb-4">₱{finalAmount.toLocaleString()}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                    Waiting for payment...
                  </div>
                </>
              )}
              {qrStatus === 'success' && (
                <div className="py-6 text-center">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="text-xl font-black text-green-600">Payment Confirmed!</p>
                  <p className="text-sm text-gray-500 mt-1">Redirecting you now...</p>
                </div>
              )}
              {qrStatus === 'failed' && (
                <div className="py-6 text-center">
                  <div className="text-5xl mb-3">❌</div>
                  <p className="text-xl font-black text-red-600">Payment Failed</p>
                  <p className="text-sm text-gray-500 mt-2">Please try again or use a different payment method.</p>
                  <button
                    onClick={() => { clearInterval(pollRef.current); setStarpayQR(null) }}
                    className="mt-4 px-6 py-2 bg-gray-100 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>

            {qrStatus === 'pending' && (
              <div className="px-6 pb-5">
                <button
                  onClick={() => { clearInterval(pollRef.current); setStarpayQR(null) }}
                  className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50"
                >
                  Cancel Payment
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Payment
