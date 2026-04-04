import React, { useState, useEffect, useRef } from "react"
import { useNotification } from "../context/NotificationContext"
import { authAPI, bookingsAPI, schedulesAPI, starpayAPI } from "../services/api"

function Payment({ cart, setCart, onNavigate, isLoggedIn, preSelectedBranch, scheduleSelection }) {
  const { showNotification } = useNotification()

  const getPdcSelectionKey = (item) => `${item?.id || 'na'}::${(item?.name || '').toLowerCase()}::${(item?.type || '').toLowerCase()}`
  const fmtDate = (value, opts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) => {
    if (!value) return 'N/A'
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return 'N/A'
    return d.toLocaleDateString('en-US', opts)
  }

  const getPdcScheduleEntries = () => {
    if (!scheduleSelection?.pdcSelections) {
      if (scheduleSelection?.pdcDate) {
        return [{
          label: 'PDC Schedule',
          date1: scheduleSelection.pdcDate,
          date2: scheduleSelection.pdcDate2 || null,
          time1: scheduleSelection.pdcSlotDetails?.time_range || scheduleSelection.pdcSlotDetails?.time || 'N/A',
          time2: scheduleSelection.pdcSlotDetails2?.time_range || scheduleSelection.pdcSlotDetails2?.time || null,
        }]
      }
      return []
    }

    const pdcCartItems = activeCart.filter(item => (item?.category || '').toLowerCase() === 'pdc' || (item?.name || '').toLowerCase().includes('pdc'))
    const entries = pdcCartItems.map(item => {
      const key = getPdcSelectionKey(item)
      const sel = scheduleSelection.pdcSelections?.[key] || scheduleSelection.pdcSelections?.[item.id]
      if (!sel) return null
      return {
        label: item.name || 'PDC Schedule',
        date1: sel.pdcDate || sel.date || null,
        date2: sel.pdcDate2 || sel.date2 || null,
        time1: sel.pdcSlotDetails?.time || sel.pdcSlotDetails?.time_range || sel.slot?.time_range || 'N/A',
        time2: sel.pdcSlotDetails2?.time || sel.pdcSlotDetails2?.time_range || sel.slot2?.time_range || null,
      }
    }).filter(Boolean)

    return entries
  }

  const handleReleaseLocks = async () => {
    // Release atomic slot locks before navigating away
    const pendingLocks = [];
    if (scheduleSelection?.slotDetails?.id) pendingLocks.push(scheduleSelection.slotDetails.id);
    if (scheduleSelection?.slotDetails2?.id) pendingLocks.push(scheduleSelection.slotDetails2.id);
    if (scheduleSelection?.pdcSlotDetails?.id) pendingLocks.push(scheduleSelection.pdcSlotDetails.id);
    if (scheduleSelection?.pdcSlotDetails2?.id) pendingLocks.push(scheduleSelection.pdcSlotDetails2.id);
    if (scheduleSelection?.pdcSelections) {
      Object.values(scheduleSelection.pdcSelections).forEach((sel) => {
        if (sel?.pdcSlotDetails?.id) pendingLocks.push(sel.pdcSlotDetails.id);
        if (sel?.pdcSlotDetails2?.id) pendingLocks.push(sel.pdcSlotDetails2.id);
        if (sel?.slot?.id) pendingLocks.push(sel.slot.id);
        if (sel?.slot2?.id) pendingLocks.push(sel.slot2.id);
      });
    }

    const uniqueLocks = [...new Set(pendingLocks.filter(Boolean))];

    if (uniqueLocks.length > 0) {
      try {
        await schedulesAPI.releaseLocks(uniqueLocks);
      } catch (err) {
        console.error('Failed to release pending slot locks:', err);
      }
    }
  }

  const handleEditSchedule = async (target) => {
    await handleReleaseLocks();
    sessionStorage.setItem('editScheduleTarget', target)
    onNavigate('schedule')
  }

  const [paymentType, setPaymentType] = useState(null) // "full" or "downpayment"
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  // StarPay QR state
  const [starpayQR, setStarpayQR] = useState(null) // { codeUrl, msgId, bookingId, amount }
  const [qrStatus, setQrStatus] = useState('pending') // pending|success|failed
  const [qrExpiresAt, setQrExpiresAt] = useState(null)
  const [qrNow, setQrNow] = useState(Date.now())
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)
  const [showPaymentFailed, setShowPaymentFailed] = useState(false)
  const [paymentFailReason, setPaymentFailReason] = useState('cancelled')
  const [receiptCart, setReceiptCart] = useState([])
  const pollRef = useRef(null)

  const activeCart = showPaymentSuccess ? receiptCart : cart;

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
    
    let customAddonsPriceTotal = 0;
    if (item.addonsConfig?.customAddons) {
      item.addonsConfig.customAddons.forEach(addon => {
        if (item.selectedAddons && item.selectedAddons[addon.id]) {
          customAddonsPriceTotal += parseFloat(addon.price || 0);
        }
      });
    }

    const advFee = parseFloat(item.addonsConfig?.convenienceFee || 25);

    const finalItemPrice = calcBasePrice - calcDiscountValue + reviewerPrice + vehicleTipsPrice + customAddonsPriceTotal + advFee;
    
    return {
      calcBasePrice,
      hasDiscount,
      calcDiscountRate,
      calcDiscountValue,
      reviewerPrice,
      vehicleTipsPrice,
      customAddonsPriceTotal,
      advFee,
      finalItemPrice
    };
  };

  const getPaymentTotals = () => {
    let baseCoursePriceTotal = 0;
    let reviewerTotal = 0;
    let vehicleTipsTotal = 0;
    let customAddonsTotal = 0;
    let convenienceTotal = 0;
    let discountTotal = 0;
    let subtotal = 0;

    activeCart.forEach(item => {
      const totals = calculateItemTotals(item);
      const qty = item.quantity;
      baseCoursePriceTotal += totals.calcBasePrice * qty;
      reviewerTotal += totals.reviewerPrice * qty;
      vehicleTipsTotal += totals.vehicleTipsPrice * qty;
      customAddonsTotal += totals.customAddonsPriceTotal * qty;
      convenienceTotal += totals.advFee * qty;
      discountTotal += totals.calcDiscountValue * qty;
      subtotal += totals.finalItemPrice * qty;
    });
    
    const hasTDC = activeCart.some(item => (item.category === 'TDC' || (item.name || '').toLowerCase().includes('tdc') || (item.shortName || '').toLowerCase().includes('tdc')));
    const hasPDC = activeCart.some(item => (item.category === 'PDC' || (item.name || '').toLowerCase().includes('pdc') || (item.shortName || '').toLowerCase().includes('pdc')));
    
    const hasBundleDiscount = hasTDC && hasPDC;
    const promoBundleDiscountPercent = Math.max(0, parseFloat(activeCart.find(item => item?.addonsConfig?.promoBundleDiscountPercent != null)?.addonsConfig?.promoBundleDiscountPercent ?? 3) || 0);
    const bundleDiscountValue = hasBundleDiscount ? subtotal * (promoBundleDiscountPercent / 100) : 0;
    const finalTotal = subtotal - bundleDiscountValue;

    return { 
      baseCoursePriceTotal, 
      reviewerTotal, 
      vehicleTipsTotal, 
      customAddonsTotal,
      convenienceTotal, 
      discountTotal, 
      subtotal, 
      hasBundleDiscount, 
      promoBundleDiscountPercent,
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
    // Do not enforce auth/cart guards while showing final result screens.
    if (showPaymentSuccess || showPaymentFailed) return

    const isGuest = localStorage.getItem('isGuestCheckout') === 'true'
    if (!isLoggedIn && !isGuest) {
      showNotification("Please sign in to proceed with payment", "error")
      handleReleaseLocks()
      onNavigate("signin")
      return
    }
    if (activeCart.length === 0 && !showPaymentSuccess) {
      handleReleaseLocks()
      onNavigate("courses")
    }
  }, [activeCart, cart, onNavigate, isLoggedIn, showPaymentSuccess, showPaymentFailed])

  // Auto-select StarPay — it's the only payment method
  /* useEffect(() => {
    setPaymentMethod('starpay')
  }, []) */

  // Always allow the checkbox to be ticked — don't gate on scroll
  useEffect(() => {
    if (showTermsModal) {
      setHasScrolledToBottom(true);
    }
  }, [showTermsModal]);

  // Ensure polling is always cleaned up when leaving the page
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (starpayQR && qrStatus === 'pending') {
      if (!qrExpiresAt) setQrExpiresAt(Date.now() + (20 * 60 * 1000))
      const tick = setInterval(() => setQrNow(Date.now()), 1000)
      return () => clearInterval(tick)
    }

    if (!starpayQR && qrExpiresAt) setQrExpiresAt(null)
  }, [starpayQR, qrStatus, qrExpiresAt])

  const qrSecondsLeft = qrExpiresAt ? Math.max(0, Math.floor((qrExpiresAt - qrNow) / 1000)) : null
  const qrMinutesLeft = qrSecondsLeft != null ? Math.floor(qrSecondsLeft / 60) : null
  const qrSecondsRem = qrSecondsLeft != null ? qrSecondsLeft % 60 : null

  const handlePaymentSuccess = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setStarpayQR(null)
    setQrStatus('pending')
    setQrExpiresAt(null)
    setIsProcessing(false)
    setReceiptCart([...cart])
    setCart([])
    setShowPaymentFailed(false)
    setShowPaymentSuccess(true)
    showNotification('Payment successful! Enrollment confirmed.', 'success')
  }

  const handlePaymentFailure = (reason = 'failed') => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setQrStatus('failed')
    setStarpayQR(null)
    setQrExpiresAt(null)
    setIsProcessing(false)
    setPaymentFailReason(reason)
    setShowPaymentSuccess(false)
    setShowPaymentFailed(true)
    if (reason === 'expired') {
      showNotification('Payment session expired. Please try again.', 'error')
    } else if (reason === 'cancelled') {
      showNotification('Payment cancelled.', 'error')
    } else {
      showNotification('Payment unsuccessful. Please try again.', 'error')
    }
  }

  useEffect(() => {
    if (starpayQR && qrStatus === 'pending' && qrSecondsLeft === 0) {
      handlePaymentFailure('expired')
    }
  }, [starpayQR, qrStatus, qrSecondsLeft])

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

    const formatDate = (dateInput) => {
      if (!dateInput) return null;
      const d = new Date(dateInput);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const isGuest = localStorage.getItem('isGuestCheckout') === 'true'
    const guestDataStr = localStorage.getItem('guestEnrollmentData')

    try {
      if (paymentMethod !== 'starpay') {
        showNotification('Only StarPay is supported right now.', 'error')
        setIsProcessing(false)
        return
      }

      if (!scheduleSelection || activeCart.length === 0) {
        showNotification('Session expired. Please restart the enrollment process.', 'error')
        setIsProcessing(false)
        return
      }

      let paymentResponse
      if (isLoggedIn) {
        const courseList = activeCart.map((item) => ({
          name: item?.name || 'N/A',
          type: item?.type || 'standard',
          category: item?.category || null,
        }))
        paymentResponse = await starpayAPI.createPayment({
          courseId: activeCart[0]?.id,
          courseName: activeCart[0]?.name,
          branchId: preSelectedBranch?.id,
          branchName: preSelectedBranch?.name,
          branchAddress: preSelectedBranch?.address,
          courseCategory: activeCart[0]?.category,
          courseType: activeCart[0]?.type,
          amount: finalAmount,
          paymentType: paymentType === 'full' ? 'Full Payment' : 'Downpayment',
          scheduleSlotId: scheduleSelection.slot || scheduleSelection.slotDetails?.id,
          scheduleDate: formatDate(scheduleSelection.date || scheduleSelection.slotDetails?.date),
          scheduleSession: scheduleSelection.slotDetails?.session || null,
          scheduleTime: scheduleSelection.slotDetails?.time_range || scheduleSelection.slotDetails?.time || 'N/A',
          scheduleSlotId2: scheduleSelection.slot2 || scheduleSelection.slotDetails2?.id,
          scheduleDate2: formatDate(scheduleSelection.date2 || scheduleSelection.slotDetails2?.date),
          scheduleSession2: scheduleSelection.slotDetails2?.session || null,
          scheduleTime2: scheduleSelection.slotDetails2?.time_range || scheduleSelection.slotDetails2?.time || null,
          pdcSelections: scheduleSelection.pdcSelections || {},
          courseList,
          hasReviewer: totalsData.reviewerTotal > 0,
          hasVehicleTips: totalsData.vehicleTipsTotal > 0,
        })
      } else if (isGuest && guestDataStr) {
        const guestData = JSON.parse(guestDataStr)
        const courseList = activeCart.map((item) => ({
          name: item?.name || 'N/A',
          type: item?.type || 'standard',
          category: item?.category || null,
        }))
        paymentResponse = await starpayAPI.createGuestPayment({
          ...guestData,
          courseId: activeCart[0].id,
          courseName: activeCart[0].name,
          branchId: preSelectedBranch?.id || guestData.branchId,
          branchName: preSelectedBranch?.name || guestData.branchName,
          courseCategory: activeCart[0].category,
          courseType: activeCart[0].type,
          scheduleSlotId: scheduleSelection.slot || scheduleSelection.slotDetails?.id,
          scheduleDate: formatDate(scheduleSelection.date || scheduleSelection.slotDetails?.date),
          scheduleSession: scheduleSelection.slotDetails?.session || null,
          scheduleSlotId2: scheduleSelection.slot2 || scheduleSelection.slotDetails2?.id,
          scheduleDate2: formatDate(scheduleSelection.date2 || scheduleSelection.slotDetails2?.date),
          scheduleSession2: scheduleSelection.slotDetails2?.session || null,
          scheduleTime: scheduleSelection.slotDetails?.time_range || scheduleSelection.slotDetails?.time || 'N/A',
          scheduleTime2: scheduleSelection.slotDetails2?.time_range || scheduleSelection.slotDetails2?.time || null,
          pdcSelections: scheduleSelection.pdcSelections || {},
          courseList,
          amount: finalAmount,
          paymentType: paymentType === 'full' ? 'Full Payment' : 'Downpayment',
          hasReviewer: totalsData.reviewerTotal > 0,
          hasVehicleTips: totalsData.vehicleTipsTotal > 0,
        })
      } else {
        showNotification('Guest profile is missing. Please complete guest enrollment first.', 'error')
        setIsProcessing(false)
        return
      }

      const msgId = paymentResponse?.msgId
      const codeUrl = paymentResponse?.codeUrl
      const bookingId = paymentResponse?.bookingId

      if (!msgId || !codeUrl) {
        throw new Error('Failed to initialize StarPay QR payment.')
      }

      setStarpayQR({ codeUrl, msgId, bookingId, amount: finalAmount })
      setQrStatus('pending')
      setIsProcessing(false)

      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await starpayAPI.checkStatus(msgId)
          const localStatus = (statusRes?.localStatus || '').toLowerCase()
          const trxState = (statusRes?.starpayState || '').toUpperCase()

          if (localStatus === 'paid' || trxState === 'SUCCESS') {
            clearInterval(pollRef.current)
            pollRef.current = null
            setQrStatus('success')
            setTimeout(() => {
              handlePaymentSuccess()
            }, 1200)
            return
          }

          if (localStatus === 'cancelled') {
            clearInterval(pollRef.current)
            pollRef.current = null
            handlePaymentFailure('cancelled')
            return
          }

          if (['CLOSE'].includes(trxState)) {
            clearInterval(pollRef.current)
            pollRef.current = null
            handlePaymentFailure('expired')
            return
          }

          if (['FAIL', 'REVERSED', 'CANCEL'].includes(trxState)) {
            clearInterval(pollRef.current)
            pollRef.current = null
            handlePaymentFailure('gateway')
          }
        } catch (pollErr) {
          // Keep polling unless we get explicit paid/failed state.
        }
      }, 4000)
    } catch (error) {
      console.error('Checkout error:', error)
      showNotification(error.message || 'Enrollment failed. Please try again.', 'error')
      setIsProcessing(false)
    }
  }

  if (showPaymentSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 pt-[100px] pb-12 font-poppins text-gray-800 flex flex-col items-center justify-center">
        <div className="bg-white rounded-3xl w-full max-w-2xl shadow-xl border border-slate-100 p-8 md:p-12 relative overflow-hidden" style={{ animation: 'bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)' }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute top-0 left-0 w-64 h-64 bg-teal-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 -translate-x-1/2 -translate-y-1/2"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            {/* Success Icon */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-30"></div>
              <div className="w-24 h-24 bg-gradient-to-tr from-[#10b981] to-[#34d399] rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/20 relative z-10 ring-4 ring-emerald-50 text-white">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" style={{ strokeDasharray: 50, animation: 'checkmark 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards' }} />
                </svg>
              </div>
            </div>

            <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight mb-3 text-center">Payment Successful!</h1>
            <p className="text-slate-500 mb-8 text-center text-lg max-w-md">
              Thank you for your enrollment. Your payment has been processed successfully. Here are your order details:
            </p>

            <div className="w-full mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 text-sm font-medium">
              <div className="flex items-start gap-2">
                <span className="text-base">✅</span>
                <div>
                  <p className="font-bold">Payment Alert</p>
                  <p>Your training schedule details were sent to your email. Please check your inbox (and Spam or Promotions folder).</p>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="w-full bg-slate-50 rounded-2xl border border-slate-200 p-6 mb-8 text-left relative overflow-hidden">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Enrollment Summary
              </h3>
              
              <div className="space-y-4">
                {activeCart.map((item, index) => {
                  const totals = calculateItemTotals(item)
                  return (
                    <div key={index} className="flex flex-col pb-4 border-b border-slate-200 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-slate-800 text-[15px]">{item.name}</div>
                          <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            {item.type && item.type !== 'standard' && <span className="bg-slate-200/60 px-2 py-0.5 rounded-md text-slate-700 capitalize">{item.type.replace('-', ' ')}</span>}
                            {item.selectedBranch && <span><span className="text-slate-400">Branch:</span> {item.selectedBranch}</span>}
                          </div>
                        </div>
                        <div className="font-bold text-slate-800 ml-4 whitespace-nowrap">
                          ₱{(totals.calcBasePrice * (item.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      {/* Addons Breakdown (Per Item) */}
                      {(totals.reviewerPrice > 0 || totals.vehicleTipsPrice > 0 || totals.customAddonsPriceTotal > 0 || totals.calcDiscountValue > 0) && (
                        <div className="mt-2 ml-2 pl-3 border-l-2 border-slate-200 space-y-1">
                          {totals.hasDiscount && totals.calcDiscountValue > 0 && (
                            <div className="flex justify-between text-[11px] text-red-500">
                              <span>Discount</span>
                              <span>-₱{(totals.calcDiscountValue * (item.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          {totals.reviewerPrice > 0 && (
                            <div className="flex justify-between text-[11px] text-slate-600">
                              <span>+ LTO Exam Reviewer</span>
                              <span>₱{(totals.reviewerPrice * (item.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          {totals.vehicleTipsPrice > 0 && (
                            <div className="flex justify-between text-[11px] text-slate-600">
                              <span>+ Vehicle Maintenance Tips</span>
                              <span>₱{(totals.vehicleTipsPrice * (item.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          {item.addonsConfig?.customAddons?.map(addon => {
                            if (item.selectedAddons && item.selectedAddons[addon.id]) {
                              return (
                                <div key={addon.id} className="flex justify-between text-[11px] text-slate-600">
                                  <span>+ {addon.name}</span>
                                  <span>₱{(parseFloat(addon.price) * (item.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              )
                            }
                            return null;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Convenience Fees & Bundle Discount */}
              {(totalsData.hasBundleDiscount || totalsData.convenienceTotal > 0) && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                  {totalsData.convenienceTotal > 0 && (
                    <div className="flex justify-between items-center text-sm text-slate-600">
                      <span>Convenience Fee</span>
                      <span className="font-semibold">₱{totalsData.convenienceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {totalsData.hasBundleDiscount && totalsData.bundleDiscountValue > 0 && (
                    <div className="flex justify-between items-center text-sm text-red-500 font-semibold bg-red-50 p-2 rounded-lg -mx-2 px-2">
                      <span>Promo Bundle (-{totalsData.promoBundleDiscountPercent}%)</span>
                      <span>-₱{totalsData.bundleDiscountValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-slate-300 border-dashed space-y-3 bg-emerald-50/50 p-4 rounded-xl -mx-2">
                <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
                  <span>Payment Method:</span>
                  <span className="capitalize">{paymentMethod || 'Online'}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
                  <span>Payment Type:</span>
                  <span className="capitalize">{paymentType === 'downpayment' ? 'Downpayment (50%)' : 'Full Payment'}</span>
                </div>
                {paymentType === 'downpayment' && (
                  <div className="pt-2 mt-2 border-t border-emerald-200/60 space-y-2">
                    <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
                      <span>Total Assessment Price:</span>
                      <span className="text-slate-800">₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-semibold text-red-500">
                      <span>Remaining Balance (50%):</span>
                      <span>-₱{downpaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-emerald-200/60">
                  <span className="font-bold text-slate-800 text-lg">Total Amount Paid</span>
                  <span className="text-2xl font-black text-emerald-600">₱{finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => {
                  localStorage.removeItem('isGuestCheckout')
                  localStorage.removeItem('guestEnrollmentData')
                  setCart([])
                  onNavigate('profile')
                }}
                className="flex-1 bg-white border-2 border-slate-200 text-slate-700 font-bold py-3.5 px-6 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View Profile
              </button>

              <button
                onClick={() => {
                  localStorage.removeItem('isGuestCheckout')
                  localStorage.removeItem('guestEnrollmentData')
                  setCart([])
                  onNavigate('home')
                }}
                className="flex-1 bg-gradient-to-r from-[#2157da] to-[#1e4ebf] text-white font-bold py-3.5 px-6 rounded-xl hover:from-[#1e4ebf] hover:to-[#1a45ab] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Return to Home
              </button>
            </div>
          </div>
        </div>
        <style>{`
          @keyframes bounce-in {
            0% { transform: scale(0.9); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes checkmark {
            0% { stroke-dashoffset: 50; }
            100% { stroke-dashoffset: 0; }
          }
        `}</style>
      </div>
    );
  }

  if (showPaymentFailed) {
    const failTitle = paymentFailReason === 'expired'
      ? 'Payment Session Expired'
      : paymentFailReason === 'cancelled'
        ? 'Payment Cancelled'
        : 'Payment Unsuccessful'

    const failMsg = paymentFailReason === 'expired'
      ? 'Your QR payment window has expired. Please generate a new QR and try again.'
      : paymentFailReason === 'cancelled'
        ? 'You cancelled the QR payment process before completion.'
        : 'We could not confirm your payment. Please try again.'

    return (
      <div className="min-h-screen bg-slate-50 pt-[100px] pb-12 font-poppins text-gray-800 flex flex-col items-center justify-center">
        <div className="bg-white rounded-3xl w-full max-w-2xl shadow-xl border border-slate-100 p-8 md:p-12 relative overflow-hidden" style={{ animation: 'bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)' }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute top-0 left-0 w-64 h-64 bg-amber-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 -translate-x-1/2 -translate-y-1/2"></div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-30"></div>
              <div className="w-24 h-24 bg-gradient-to-tr from-[#ef4444] to-[#f97316] rounded-full flex items-center justify-center shadow-xl shadow-red-500/20 relative z-10 ring-4 ring-red-50 text-white">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>

            <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight mb-3 text-center">{failTitle}</h1>
            <p className="text-slate-500 mb-8 text-center text-lg max-w-md">{failMsg}</p>

            <div className="w-full mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm font-medium">
              <div className="flex items-start gap-2">
                <span className="text-base">⚠️</span>
                <div>
                  <p className="font-bold">Payment Alert</p>
                  <p>No charges were confirmed from this session. You can safely retry your payment.</p>
                </div>
              </div>
            </div>

            <div className="w-full flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => {
                  setShowPaymentFailed(false)
                  setPaymentFailReason('cancelled')
                  setQrStatus('pending')
                }}
                className="flex-1 bg-gradient-to-r from-[#2157da] to-[#1e4ebf] text-white font-bold py-3.5 px-6 rounded-xl hover:from-[#1e4ebf] hover:to-[#1a45ab] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                Try Payment Again
              </button>

              <button
                onClick={() => onNavigate('home')}
                className="flex-1 bg-white border-2 border-slate-200 text-slate-700 font-bold py-3.5 px-6 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
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
                    disabled={!!starpayQR || isProcessing}
                    className={`group relative text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 ${(!!starpayQR || isProcessing) ? 'opacity-60 cursor-not-allowed' : ''} ${paymentType === "full" ? "border-[#2157da] bg-blue-50 shadow-md" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"}`}
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
                    disabled={!!starpayQR || isProcessing}
                    className={`group relative text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 ${(!!starpayQR || isProcessing) ? 'opacity-60 cursor-not-allowed' : ''} ${paymentType === "downpayment" ? "border-[#2157da] bg-blue-50 shadow-md" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"}`}
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
              <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${(!paymentType || !!starpayQR || isProcessing) ? 'opacity-40 pointer-events-none border-gray-100' : 'opacity-100 border-gray-100'}`}>
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
                  disabled={!paymentType || !paymentMethod || isProcessing || !!starpayQR}
                  className={`relative w-full py-4 sm:py-5 font-black text-base sm:text-lg text-white rounded-2xl overflow-hidden transition-all duration-300 ${paymentType && paymentMethod && !isProcessing && !starpayQR
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
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex items-center justify-center gap-1.5 text-gray-400 text-xs">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold">256-bit SSL Encrypted · Secure Payment</span>
                    </div>
                    {paymentMethod === 'starpay' && (
                      <p className="text-center text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 font-semibold">
                        StarPay session expires in 20 minutes. Unpaid transactions are automatically cancelled.
                      </p>
                    )}
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

                  <div className="p-3 sm:p-4 space-y-3">
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
                      <div className="space-y-2">
                        {/* TDC Schedule Container */}
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <img src="/assets/calendar-icon.svg" className="w-4 h-4" alt="Calendar" onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<span class="text-base">📅</span>' }} />
                              <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">
                                {scheduleSelection.pdcDate ? 'TDC Schedule' : 'Schedule'}
                              </p>
                            </div>
                          </div>

                          {scheduleSelection.isMotorcyclePDC ? (
                            <p className="text-[11px] font-bold text-white/80 text-left mt-1">Assigned by Admin after payment</p>
                          ) : (
                            <div className="mt-1 flex flex-col items-start text-left">
                              {scheduleSelection.slotDetails?.type?.toLowerCase() === 'tdc' && scheduleSelection.slotDetails?.end_date && scheduleSelection.slotDetails.end_date !== scheduleSelection.slotDetails.date ? (
                                <div className="w-full flex justify-between items-center">
                                  <div>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Day 1 & Day 2</p>
                                    <p className="text-[11px] font-semibold text-white/90">
                                      {scheduleSelection.date && new Date(scheduleSelection.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &amp; {new Date(scheduleSelection.slotDetails.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[11px] text-white/70 flex items-center gap-1">
                                      <span>🕒</span>{scheduleSelection.slotDetails?.time_range || scheduleSelection.slotDetails?.time}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex w-full justify-between items-center">
                                    <div>
                                      {scheduleSelection.date2 && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Day 1</p>}
                                      <p className="text-[11px] font-semibold text-white/90">
                                        {scheduleSelection.date && new Date(scheduleSelection.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[11px] text-white/70 flex items-center gap-1">
                                        <span>🕒</span>{scheduleSelection.slotDetails?.time_range || scheduleSelection.slotDetails?.time}
                                      </p>
                                    </div>
                                  </div>
                                  {scheduleSelection.date2 && (
                                    <div className="flex w-full justify-between items-center mt-1.5 pt-1.5 border-t border-white/5">
                                      <div>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Day 2</p>
                                        <p className="text-[11px] font-semibold text-white/90">
                                          {scheduleSelection.date2 && new Date(scheduleSelection.date2).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[11px] text-white/70 flex items-center gap-1">
                                          <span>🕒</span>{scheduleSelection.slotDetails2?.time_range || scheduleSelection.slotDetails2?.time}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* PDC Schedule Container(s) */}
                        {getPdcScheduleEntries().map((entry, idx) => (
                          <div key={`${entry.label}-${idx}`} className="p-3 bg-white/5 rounded-xl border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-base">🚘</span>
                                <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">{entry.label}</p>
                              </div>
                            </div>
                            <div className="mt-1 flex flex-col items-start text-left">
                              {entry.date2 ? (
                                <div className="w-full flex justify-between items-center">
                                  <div>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Day 1 & Day 2</p>
                                    <p className="text-[11px] font-semibold text-white/90">
                                      {fmtDate(entry.date1, { month: 'short', day: 'numeric' })} &amp; {fmtDate(entry.date2, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[11px] text-white/70 flex items-center justify-start gap-1">
                                      <span>🕒</span>
                                      {entry.time1 === entry.time2 ? entry.time1 : `${entry.time1} (D1) & ${entry.time2 || 'N/A'} (D2)`}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full flex justify-between items-center">
                                  <div>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Day 1</p>
                                    <p className="text-[11px] font-semibold text-white/90">{fmtDate(entry.date1)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[11px] text-white/70 flex items-center gap-1">
                                      <span>🕒</span>{entry.time1}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Single Change Button */}
                        <button onClick={() => handleEditSchedule('all')} className="w-full py-2 bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/40 rounded-lg text-[9px] font-black text-white/50 hover:text-blue-300 transition-all uppercase tracking-widest flex items-center justify-center gap-1.5 mt-2">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Change Schedule
                        </button>
                      </div>
                    )}

                    {/* Cart Items */}
                    <div className="space-y-2">
                      {activeCart.map((item, idx) => {
                        return (
                          <div key={idx} className="pb-2 border-b border-white/10 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center gap-2 mb-0.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-white/95 mb-0.5 leading-snug truncate">{item.name}</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] text-white/40">{item.duration} × {item.quantity}</span>
                                  {item.type && item.type !== 'standard' && (
                                    <span className="px-1 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-[9px] font-black uppercase border border-blue-400/20">
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

                        {(totalsData.reviewerTotal > 0 || totalsData.vehicleTipsTotal > 0 || totalsData.customAddonsTotal > 0) && (
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span>Add-ons</span>
                              {totalsData.reviewerTotal > 0 && <span className="text-[10px] text-white/40 ml-2">• Reviewer</span>}
                              {totalsData.vehicleTipsTotal > 0 && <span className="text-[10px] text-white/40 ml-2">• Vehicle Tips</span>}
                              {totalsData.customAddonsTotal > 0 && <span className="text-[10px] text-white/40 ml-2">• Custom Add-ons</span>}
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-white/90">₱{(totalsData.reviewerTotal + totalsData.vehicleTipsTotal + totalsData.customAddonsTotal).toLocaleString()}</span>
                              {totalsData.reviewerTotal > 0 && <span className="text-[10px] text-white/40">₱{totalsData.reviewerTotal.toLocaleString()}</span>}
                              {totalsData.vehicleTipsTotal > 0 && <span className="text-[10px] text-white/40">₱{totalsData.vehicleTipsTotal.toLocaleString()}</span>}
                              {totalsData.customAddonsTotal > 0 && <span className="text-[10px] text-white/40">₱{totalsData.customAddonsTotal.toLocaleString()}</span>}
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
                          <span className="font-bold">Bundle Discount ({totalsData.promoBundleDiscountPercent}% OFF)</span>
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
                  <div className="p-2 bg-white border-4 border-[#2157da] rounded-xl mb-3 shadow-sm">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(starpayQR.codeUrl)}&size=220x220&format=png`}
                      alt="StarPay QR"
                      className="w-[220px] h-[220px]"
                    />
                  </div>
                  <div className="bg-blue-50 text-blue-800 text-xs px-3 py-2 rounded-lg font-semibold mb-4 text-center max-w-[260px]">
                    📸 Please screenshot or take a picture of this QR code to upload to your e-wallet app.
                  </div>
                  <p className="text-sm font-bold text-gray-700 mb-1">Amount Due</p>
                  <p className="text-3xl font-black text-[#2157da] mb-4">₱{(starpayQR.amount || finalAmount).toLocaleString()}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                    Waiting for payment...
                  </div>
                  {qrSecondsLeft != null && (
                    <p className={`mt-2 text-xs font-semibold ${qrSecondsLeft > 0 ? 'text-amber-700' : 'text-red-600'}`}>
                      {qrSecondsLeft > 0
                        ? `Session expires in ${qrMinutesLeft}:${String(qrSecondsRem).padStart(2, '0')}`
                        : 'Session expired. This pending transaction will be cancelled.'}
                    </p>
                  )}
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
                    onClick={() => {
                      handlePaymentFailure('failed')
                    }}
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
                  onClick={() => {
                    handlePaymentFailure('cancelled')
                  }}
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
