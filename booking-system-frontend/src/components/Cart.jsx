import { useState, useEffect } from "react"
import { useNotification } from "../context/NotificationContext"
import { schedulesAPI } from "../services/api"

function Cart({ cart, setCart, showCart, setShowCart, onNavigate, isLoggedIn, preSelectedBranch, setSelectedCourseForSchedule, setScheduleSelection }) {
  const { showNotification } = useNotification()
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [hasAvailableSlots, setHasAvailableSlots] = useState(true)
  const getCartItemKey = (item) => `${item.id}::${String(item.type || 'online')}`
  const primaryCourse = cart[0]
  const primaryIsTdc = !!primaryCourse && (
    primaryCourse.category === 'TDC' ||
    (primaryCourse.name || '').toLowerCase().includes('tdc') ||
    (primaryCourse.shortName || '').toLowerCase().includes('tdc')
  )
  const primaryIsOnlineTdc = primaryIsTdc && String(primaryCourse?.type || '').toLowerCase() === 'online'

  // Check availability for the first cart item whenever cart or branch changes
  useEffect(() => {
    if (!preSelectedBranch || cart.length === 0) {
      setHasAvailableSlots(true)
      return
    }
    const primaryCourse = cart[0]
    const checkAvailability = async () => {
      setAvailabilityLoading(true)
      setHasAvailableSlots(true)
      try {
        const name = (primaryCourse.name || '').toLowerCase()
        const shortName = (primaryCourse.shortName || '').toLowerCase()
        const category = primaryCourse.category || ''
        const selectedType = String(primaryCourse.type || '').toLowerCase()
        const isTDC = category === 'TDC' || name.includes('tdc') || shortName.includes('tdc')
        const isOnlineTdc = isTDC && (selectedType.includes('online') || selectedType.includes('otdc') || name.includes('otdc'))
        
        if (isOnlineTdc) {
          setHasAvailableSlots(true)
          setAvailabilityLoading(false)
          return
        }

        const slotType = isTDC ? 'TDC' : 'PDC'
        const slots = await schedulesAPI.getSlotsByDate(null, preSelectedBranch.id, slotType)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const minDate = new Date(today)
        minDate.setDate(today.getDate() + (isTDC ? 1 : 2))
        
        // Token-based course_type matcher
        const stopWords = new Set(['practical', 'driving', 'course', 'pdc', 'tdc', 'theoretical', 'dc', 'a', 'an', 'the', 'and', 'or', 'for', 'of', 'in', 'to'])
        const extractTokens = (str) => (str || '').toLowerCase().replace(/[()\[\]{}'"]/g, ' ').split(/[\s\-\/,;|&+]+/).filter(t => t.length >= 2 && !stopWords.has(t))
        const courseTokens = new Set(extractTokens(name + ' ' + shortName))
        const courseTypeMatches = (slotCourseType) => {
          if (!slotCourseType) return true
          const norm = slotCourseType.toLowerCase().trim()
          if (norm === 'both' || norm === 'any' || norm === 'all') return true
          const slotTokens = extractTokens(slotCourseType)
          if (slotTokens.length === 0) return true
          return slotTokens.some(t => courseTokens.has(t))
        }

        const isAT = selectedType.includes('automatic') || selectedType === 'at' || selectedType.includes('auto') || name.includes('automatic') || name.includes('(at)')
        const isMT = selectedType.includes('manual') || selectedType === 'mt' || name.includes('manual') || name.includes('(mt)')

        const available = Array.isArray(slots) ? slots.filter(s => {
          const slotDate = new Date((s.date || s.start_date) + 'T00:00:00')
          if (slotDate < minDate) return false
          
          if (isTDC && selectedType && s.course_type && s.course_type.toLowerCase() !== selectedType.toLowerCase()) return false
          if (!isTDC && !courseTypeMatches(s.course_type)) return false

          if (!isTDC) {
            const tr = (s.transmission || '').toLowerCase()
            if (isAT && tr && tr !== 'both' && tr !== 'any' && !tr.includes('auto') && tr !== 'at') return false
            if (isMT && tr && tr !== 'both' && tr !== 'any' && !tr.includes('manual') && tr !== 'mt') return false
          }

          return s.available_slots == null || s.available_slots > 0
        }) : []
        setHasAvailableSlots(available.length > 0)
      } catch (e) {
        setHasAvailableSlots(true) // fail open on error
      } finally {
        setAvailabilityLoading(false)
      }
    }
    checkAvailability()
  }, [cart.length, preSelectedBranch?.id, cart[0]?.id])


  const removeFromCart = (id, type = 'online') => {
    const targetKey = `${id}::${String(type || 'online')}`
    setCart((prevCart) => prevCart.filter((item) => getCartItemKey(item) !== targetKey))
  }

  const updateQuantity = (id, type, change) => {
    const targetKey = `${id}::${String(type || 'online')}`
    setCart((prevCart) => {
      const next = prevCart
        .map((item) => {
          if (getCartItemKey(item) !== targetKey) return item
          const currentQty = Number(item.quantity) || 1
          const nextQty = currentQty + Number(change || 0)
          return { ...item, quantity: nextQty }
        })
        .filter((item) => (Number(item.quantity) || 0) > 0)

      return next
    })
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


  const getTotalItems = () => {
    return cart.reduce((total, item) => total + (Number(item.quantity) || 1), 0)
  }

  const handleItemCheckout = (item) => {
    if (!preSelectedBranch) {
      showNotification("Please select a branch first from the Branches page", "error")
      setShowCart(false)
      onNavigate('branches')
      return
    }

    const persistPostVerifyRedirect = (target, isOnlineTdc = false) => {
      const payload = {
        next: target,
        source: 'cart',
        isOnlineTdcNoSchedule: Boolean(isOnlineTdc),
        createdAt: Date.now(),
      }
      sessionStorage.setItem('postVerifyRedirect', JSON.stringify(payload))
      localStorage.setItem('postVerifyRedirect', JSON.stringify(payload))
    }

    const itemType = String(item.type || 'standard')
    const isItemTdc =
      item.category === 'TDC' ||
      (item.name || '').toLowerCase().includes('tdc') ||
      (item.shortName || '').toLowerCase().includes('tdc')
    const isOnlineTdc = isItemTdc && itemType.toLowerCase() === 'online'

    setSelectedCourseForSchedule({
      id: item.id,
      name: item.name,
      shortName: item.shortName,
      duration: item.duration,
      price: item.price,
      category: item.category,
      typeOptions: item.typeOptions,
      hasTypeOption: item.hasTypeOption,
      selectedType: itemType,
      addonsConfig: item.addonsConfig,
      selectedAddons: item.selectedAddons,
    })

    if (!isLoggedIn) {
      persistPostVerifyRedirect('schedule')
      setShowCart(false)
      onNavigate('signup')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (isOnlineTdc) {
      setScheduleSelection({
        noScheduleRequired: true,
        isOnlineTdcNoSchedule: true,
        providerName: 'drivetech.ph / OTDC.ph',
      })
      persistPostVerifyRedirect('payment', true)
      setShowCart(false)
      onNavigate('payment')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setScheduleSelection(null)
    setShowCart(false);
    onNavigate('schedule');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-[#2157da]">Your Cart</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl p-2"
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
                      const isItemTdc = item.category === 'TDC' || (item.name || '').toLowerCase().includes('tdc') || (item.shortName || '').toLowerCase().includes('tdc');
                      const isItemOnlineTdc = isItemTdc && String(item.type || '').toLowerCase() === 'online';
                      const qty = Number(item.quantity) || 1;
                      
                      return (
                      <div key={`${item.id}-${item.type}-${index}`} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-[#1a2332] text-sm">{item.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">{item.duration}</p>
                            {item.type && (
                              <p className="text-xs text-[#2157da] font-medium mt-1 uppercase">{item.type}</p>
                            )}
                            {/* Online TDC uses external provider and does not require local schedule selection */}
                            <div className="flex items-center gap-1 mt-2">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-semibold mt-1 inline-block">
                                {isItemOnlineTdc ? '♾ Online Provider (No Schedule)' : '📅 Schedule Required'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id, item.type)}
                            className="text-gray-400 hover:text-red-500 text-xl font-bold ml-2 transition-colors"
                          >
                            ×
                          </button>
                        </div>

                          <div className="border-t border-gray-200 mt-3 pt-3 space-y-2 text-sm text-gray-600 font-medium pb-4">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs sm:text-sm">Course Price</span>
                              <span className="font-bold text-gray-900 shrink-0">₱{totals.calcBasePrice.toLocaleString()}</span>
                            </div>
                            
                            {(totals.reviewerPrice > 0 || totals.vehicleTipsPrice > 0) && (
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex flex-col">
                                  <span className="text-xs sm:text-sm">Add-ons</span>
                                  {totals.reviewerPrice > 0 && <span className="text-[10px] sm:text-xs text-gray-400 ml-2">• Reviewer</span>}
                                  {totals.vehicleTipsPrice > 0 && <span className="text-[10px] sm:text-xs text-gray-400 ml-2">• Vehicle Tips</span>}
                                </div>
                                <div className="flex flex-col items-end shrink-0">
                                  <span className="font-bold text-gray-900">₱{(totals.reviewerPrice + totals.vehicleTipsPrice).toLocaleString()}</span>
                                  {totals.reviewerPrice > 0 && <span className="text-[10px] sm:text-xs text-gray-400">₱{totals.reviewerPrice.toLocaleString()}</span>}
                                  {totals.vehicleTipsPrice > 0 && <span className="text-[10px] sm:text-xs text-gray-400">₱{totals.vehicleTipsPrice.toLocaleString()}</span>}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs sm:text-sm">Convenience Fee</span>
                              <span className="font-bold text-gray-900 shrink-0">₱{totals.advFee.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between items-center gap-2 bg-gray-100 rounded p-2 mt-2">
                              <span className="text-sm font-bold text-gray-800">Total</span>
                              <span className="text-lg font-black text-[#2157da]">₱{(totals.finalItemPrice * qty).toLocaleString()}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleItemCheckout(item)}
                            disabled={!preSelectedBranch}
                            className={`w-full py-2.5 rounded-full font-bold transition-all text-sm ${
                              !preSelectedBranch
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-[#2157da] text-white hover:bg-[#1a3a8a] cursor-pointer shadow-sm'
                            }`}
                          >
                            {!preSelectedBranch
                              ? 'Select Branch First'
                              : (isItemOnlineTdc ? 'Proceed to Payment' : '📅 Select Schedule')
                            }
                          </button>
                        </div>
                      )
                    })}
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
