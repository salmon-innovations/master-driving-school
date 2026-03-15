import { useState, useEffect } from "react"
import { useNotification } from "../context/NotificationContext"
import { schedulesAPI } from "../services/api"

function Cart({ cart, setCart, showCart, setShowCart, onNavigate, isLoggedIn, preSelectedBranch, setSelectedCourseForSchedule }) {
  const { showNotification } = useNotification()
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [hasAvailableSlots, setHasAvailableSlots] = useState(true)

  // Check availability for the first cart item whenever cart or branch changes\n  useEffect(() => {\n    if (!preSelectedBranch || cart.length === 0) {\n      setHasAvailableSlots(true)\n      return\n    }\n    const primaryCourse = cart[0]\n    const checkAvailability = async () => {\n      setAvailabilityLoading(true)\n      setHasAvailableSlots(true)\n      try {\n        const name = (primaryCourse.name || '').toLowerCase()\n        const shortName = (primaryCourse.shortName || '').toLowerCase()\n        const category = primaryCourse.category || ''\n        const selectedType = primaryCourse.type || ''\n        const isTDC = category === 'TDC' || name.includes('tdc') || shortName.includes('tdc')\n        const slotType = isTDC ? 'TDC' : 'PDC'\n        const slots = await schedulesAPI.getSlotsByDate(null, preSelectedBranch.id, slotType)\n        const today = new Date()\n        today.setHours(0, 0, 0, 0)\n        const minDate = new Date(today)\n        minDate.setDate(today.getDate() + (isTDC ? 1 : 2))\n        // Token-based course_type matcher\n        const stopWords = new Set(['practical', 'driving', 'course', 'pdc', 'tdc', 'theoretical', 'dc', 'a', 'an', 'the', 'and', 'or', 'for', 'of', 'in', 'to'])\n        const extractTokens = (str) => (str || '').toLowerCase().replace(/[()\\[\\]{}'\"]/g, ' ').split(/[\\s\\-\\/,;|&+]+/).filter(t => t.length >= 2 && !stopWords.has(t))\n        const courseTokens = new Set(extractTokens(name + ' ' + shortName))\n        const courseTypeMatches = (slotCourseType) => {\n          if (!slotCourseType) return true\n          const norm = slotCourseType.toLowerCase().trim()\n          if (norm === 'both' || norm === 'any' || norm === 'all') return true\n          const slotTokens = extractTokens(slotCourseType)\n          if (slotTokens.length === 0) return true\n          return slotTokens.some(t => courseTokens.has(t))\n        }\n        const available = Array.isArray(slots) ? slots.filter(s => {\n          const slotDate = new Date((s.date || s.start_date) + 'T00:00:00')\n          if (slotDate < minDate) return false\n          if (isTDC && selectedType && s.course_type && s.course_type.toLowerCase() !== selectedType.toLowerCase()) return false\n          if (!isTDC && !courseTypeMatches(s.course_type)) return false\n          return s.available_slots == null || s.available_slots > 0\n        }) : []\n        setHasAvailableSlots(available.length > 0)\n      } catch (e) {\n        setHasAvailableSlots(true) // fail open on error\n      } finally {\n        setAvailabilityLoading(false)\n      }\n    }\n    checkAvailability()\n  }, [cart.length, preSelectedBranch?.id, cart[0]?.id])

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const updateQuantity = (id, change) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQuantity = item.quantity + change
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
      }
      return item
    }).filter(item => item.quantity > 0))
  }

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

  const getOrderTotals = () => {
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
    
    // Check if both TDC and PDC exist in the cart
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
  }

  const orderTotals = getOrderTotals();

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }

  const handleCheckout = () => {
    if (!preSelectedBranch) {
      showNotification("Please select a branch first from the Branches page", "error")
      setShowCart(false)
      onNavigate('branches')
      return
    }
    if (cart.length > 0) {
      // All courses now require a schedule selection before payment
      // Default the calendar view to the first course in the cart
      const primaryCourse = cart[0];
      // Only carry lightweight fields — cart items no longer contain images so this is already lean
      setSelectedCourseForSchedule({
        id: primaryCourse.id,
        name: primaryCourse.name,
        shortName: primaryCourse.shortName,
        duration: primaryCourse.duration,
        price: primaryCourse.price,
        category: primaryCourse.category,
        typeOptions: primaryCourse.typeOptions,
        hasTypeOption: primaryCourse.hasTypeOption,
        selectedType: primaryCourse.type || 'standard',
      });
      setShowCart(false);
      onNavigate('schedule');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <>
      {/* Cart Sidebar (opened via navbar/cart trigger) */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 animate-fadeIn" onClick={() => setShowCart(false)}>
          <div
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl overflow-y-auto animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-[#2157da]">Your Cart</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Your cart is empty</p>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map((item, index) => {
                      const totals = calculateItemTotals(item);
                      
                      return (
                      <div key={`${item.id}-${item.type}-${index}`} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-[#1a2332] text-sm">{item.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">{item.duration}</p>
                            {item.type && (
                              <p className="text-xs text-[#2157da] font-medium mt-1 uppercase">{item.type}</p>
                            )}
                            {/* All courses require a schedule, removing conditional TDC badge */}
                            <div className="flex items-center gap-1 mt-2">
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-semibold">
                                📅 Schedule Required
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-gray-400 hover:text-red-500 text-xl font-bold ml-2 transition-colors"
                          >
                            ×
                          </button>
                        </div>

                        <div className="flex justify-between items-center mt-3">
                          <span className="text-[#2157da] font-bold text-base">₱{(totals.finalItemPrice * item.quantity).toLocaleString()}</span>
                          <div className="flex items-center gap-2 bg-white rounded-md border border-gray-300">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>

                  {/* Branch Indicator */}
                  {preSelectedBranch ? (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-semibold text-blue-600 mb-1 flex items-center gap-1">
                        <span>📍</span> Selected Branch
                      </p>
                      <p className="text-sm font-bold text-gray-900">{preSelectedBranch.name}</p>
                    </div>
                  ) : (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                      <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                        <span>⚠️</span> Branch Required
                      </p>
                      <p className="text-xs text-amber-700">Please select a branch before checkout</p>
                    </div>
                  )}

                  <div className="border-t pt-4 mb-4">
                    <div className="space-y-1.5 text-sm text-gray-600 font-medium mb-4">
                      <div className="flex justify-between items-center">
                        <span>Course Price</span>
                        <span className="font-bold text-gray-900">₱{orderTotals.baseCoursePriceTotal.toLocaleString()}</span>
                      </div>
                      
                      {(orderTotals.reviewerTotal > 0 || orderTotals.vehicleTipsTotal > 0) && (
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span>Add-ons</span>
                            {orderTotals.reviewerTotal > 0 && <span className="text-xs text-gray-400 ml-2">• Reviewer</span>}
                            {orderTotals.vehicleTipsTotal > 0 && <span className="text-xs text-gray-400 ml-2">• Vehicle Tips</span>}
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-gray-900">₱{(orderTotals.reviewerTotal + orderTotals.vehicleTipsTotal).toLocaleString()}</span>
                            {orderTotals.reviewerTotal > 0 && <span className="text-xs text-gray-400">₱{orderTotals.reviewerTotal.toLocaleString()}</span>}
                            {orderTotals.vehicleTipsTotal > 0 && <span className="text-xs text-gray-400">₱{orderTotals.vehicleTipsTotal.toLocaleString()}</span>}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <span>Convenience Fee</span>
                        <span className="font-bold text-gray-900">₱{orderTotals.convenienceTotal.toLocaleString()}</span>
                      </div>

                      {orderTotals.discountTotal > 0 && (
                        <div className="flex justify-between items-center bg-green-50 px-2 py-1 -mx-2 rounded text-green-700 font-bold mt-1">
                          <span>Discount</span>
                          <span>- ₱{orderTotals.discountTotal.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-100 pt-3 flex justify-between items-center mb-2">
                      <span className="text-gray-600 font-semibold">Subtotal:</span>
                      <span className="font-semibold text-gray-900">₱{orderTotals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    {orderTotals.hasBundleDiscount && (
                      <div className="flex justify-between items-center bg-green-50 px-2 py-1.5 -mx-2 rounded text-green-700 font-bold mb-2">
                        <span>Bundle Discount (3% OFF)</span>
                        <span>- ₱{orderTotals.bundleDiscountValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xl font-bold text-[#2157da] mt-2">
                      <span>Total:</span>
                      <span>₱{orderTotals.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={!preSelectedBranch || availabilityLoading || !hasAvailableSlots}
                    className={`w-full py-3 rounded-full font-bold transition-all ${
                      !preSelectedBranch
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : availabilityLoading
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : !hasAvailableSlots
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-[#F3B74C] text-[#2157da] hover:bg-[#e1a63b] cursor-pointer'
                    }`}
                  >
                    {!preSelectedBranch
                      ? 'Select Branch First'
                      : availabilityLoading
                        ? 'Checking slots...'
                        : !hasAvailableSlots
                          ? 'No Available Slots'
                          : '📅 Select Schedule'
                    }
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Cart
