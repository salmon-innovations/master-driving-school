import { useState, useEffect } from "react"
import { useNotification } from "../context/NotificationContext"
import { schedulesAPI } from "../services/api"

function Cart({ cart, setCart, showCart, setShowCart, onNavigate, isLoggedIn, preSelectedBranch, setSelectedCourseForSchedule, setScheduleSelection }) {
  const { showNotification } = useNotification()
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [hasAvailableSlots, setHasAvailableSlots] = useState(true)

  const getCartItemKey = (item) => `${item.id}::${String(item.type || 'online')}`
  
  const toggleSelectItem = (item) => {
    const targetKey = getCartItemKey(item)
    const isPromo = String(item.category || '').toLowerCase() === 'promo'
    const isCurrentSelected = !!item.selected

    setCart(prevCart => {
      return prevCart.map(ci => {
        const ciKey = getCartItemKey(ci)
        if (ciKey === targetKey) {
          // If we are selecting a promo, deselect everything else
          if (!isCurrentSelected && isPromo) {
             return { ...ci, selected: true }
          }
          // Regular toggle
          return { ...ci, selected: !isCurrentSelected }
        } else {
          // If we are selecting a promo (targetKey), all other items must be deselected
          if (!isCurrentSelected && isPromo) {
            return { ...ci, selected: false }
          }
          // If we are selecting a regular item (targetKey), deselect any existing promos
          if (!isCurrentSelected && !isPromo) {
            if (String(ci.category || '').toLowerCase() === 'promo') {
              return { ...ci, selected: false }
            }
          }
          return ci
        }
      })
    })
  }

  const primaryCourse = cart.find(i => i.selected) || cart[0]
  const primaryIsTdc = !!primaryCourse && (
    primaryCourse.category === 'TDC' ||
    (primaryCourse.name || '').toLowerCase().includes('tdc') ||
    (primaryCourse.shortName || '').toLowerCase().includes('tdc')
  )
  const primaryIsOnlineTdc = primaryIsTdc && String(primaryCourse?.type || '').toLowerCase() === 'online'

  // Check availability for all selected items whenever cart or branch changes
  useEffect(() => {
    const selectedItems = cart.filter(i => i.selected)
    if (!preSelectedBranch || selectedItems.length === 0) {
      setHasAvailableSlots(true)
      return
    }

    const checkAvailability = async () => {
      setAvailabilityLoading(true)
      setHasAvailableSlots(true) // assume true until we find a missing component

      try {
        const branchId = preSelectedBranch.id
        
        // Helper to check if a list of slots contains a valid future slot for a given course name/type
        const validateSlotsForCourse = (slots, item, isTDC, minAdvance) => {
          if (!Array.isArray(slots) || slots.length === 0) return false
          
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const minDate = new Date(today)
          minDate.setDate(today.getDate() + minAdvance)

          const name = (item.name || '').toLowerCase()
          const shortName = (item.shortName || '').toLowerCase()
          const selectedType = String(item.type || '').toLowerCase()

          // Token matching
          const stopWords = new Set(['practical', 'driving', 'course', 'pdc', 'tdc', 'theoretical', 'dc', 'a', 'an', 'the', 'and', 'or', 'for', 'of', 'in', 'to'])
          const extractTokens = (str) => (str || '').toLowerCase().replace(/[()\[\]{}'"]/g, ' ').split(/[\s\-\/,;|&+]+/).filter(t => t.length >= 2 && !stopWords.has(t))
          const courseTokens = new Set(extractTokens(name + ' ' + shortName + ' ' + (item.type || '')))
          
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

          return slots.some(s => {
            const slotDate = new Date((s.date || s.start_date) + 'T00:00:00')
            if (slotDate < minDate) return false
            
            if (isTDC && selectedType && s.course_type && s.course_type.toLowerCase() !== selectedType.toLowerCase()) {
              // For F2F TDC, if it's a specific type (e.g. Motorcycle only TDC), it must match
              if (selectedType !== 'f2f' && selectedType !== 'standard') return false
            }

            if (!isTDC && !courseTypeMatches(s.course_type)) return false

            if (!isTDC) {
              const tr = (s.transmission || '').toLowerCase()
              if (isAT && tr && tr !== 'both' && tr !== 'any' && !tr.includes('auto') && tr !== 'at') return false
              if (isMT && tr && tr !== 'both' && tr !== 'any' && !tr.includes('manual') && tr !== 'mt') return false
            }

            return s.available_slots == null || s.available_slots > 0
          })
        }

        for (const item of selectedItems) {
          const isPromo = String(item.category || '').toLowerCase() === 'promo'
          const name = (item.name || '').toLowerCase()
          const type = String(item.type || '').toLowerCase()
          
          if (isPromo) {
            // 1. Check TDC if not Online
            // Use course_type (bundle key) to determine TDC type — NEVER item.name.
            // The admin can rename a package freely; the bundle key is the authoritative source.
            const bundleKey = String(item.course_type || item.type || '').toLowerCase();
            const tdcPart = bundleKey.includes('+') ? bundleKey.split('+')[0].trim() : bundleKey;
            const isOnlineTdc = tdcPart.includes('online') || tdcPart.includes('otdc');
            if (!isOnlineTdc) {
              const tdcSlots = await schedulesAPI.getSlotsByDate(null, branchId, 'TDC')
              if (!validateSlotsForCourse(tdcSlots, { ...item, type: 'F2F' }, true, 1)) {
                setHasAvailableSlots(false)
                return
              }
            }

            // 2. Check PDC Components
            // Promos usually have type like "Online TDC + Car MT | Motorcycle MT"
            const plusIndex = type.indexOf('+')
            if (plusIndex !== -1) {
              const pdcSection = type.slice(plusIndex + 1).trim()
              const pdcTracks = pdcSection.split('|').map(t => t.trim()).filter(Boolean)
              
              if (pdcTracks.length > 0) {
                const pdcSlots = await schedulesAPI.getSlotsByDate(null, branchId, 'PDC')
                for (const track of pdcTracks) {
                  // We create a virtual "sub-item" to test slots for this specific track
                  const virtualItem = { 
                    name: `PDC ${track}`, 
                    shortName: track, 
                    type: track 
                  }
                  if (!validateSlotsForCourse(pdcSlots, virtualItem, false, 2)) {
                    setHasAvailableSlots(false)
                    return
                  }
                }
              }
            }
          } else {
            // Regular Course
            const isTDC = item.category === 'TDC' || name.includes('tdc')
            // Use item.type (explicitly set when added to cart) — NEVER item.name for online detection.
            // course_type is the bundle key for Promo; for regular TDC, type is set to 'online'/'f2f'.
            const courseTypeKey = String(item.course_type || '').toLowerCase();
            const isOnline = isTDC && (
              type === 'online' ||
              courseTypeKey.includes('otdc') ||
              courseTypeKey.split('+')[0].trim().includes('online')
            )
            
            if (!isOnline) {
              const slotType = isTDC ? 'TDC' : 'PDC'
              const slots = await schedulesAPI.getSlotsByDate(null, branchId, slotType)
              if (!validateSlotsForCourse(slots, item, isTDC, isTDC ? 1 : 2)) {
                setHasAvailableSlots(false)
                return
              }
            }
          }
        }
      } catch (err) {
        console.error("Availability check failed:", err)
        setHasAvailableSlots(true) // fail open
      } finally {
        setAvailabilityLoading(false)
      }
    }

    checkAvailability()
  }, [cart.some(i => i.selected), preSelectedBranch?.id, cart.filter(i => i.selected).map(i => i.id + i.type).join('')])


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
    
    const isPromo = String(item.category || '').toLowerCase() === 'promo';

    if (item.hasTypeOption && item.typeOptions) {
      const activeType = item.typeOptions.find(opt => opt.value === item.type);
      if (activeType) {
        calcBasePrice = parseFloat(activeType.price) || calcBasePrice;
        // Don't apply discount rate for promo bundles as requested
        calcDiscountRate = isPromo ? 0 : (activeType.discount || parseFloat(item.discount) || 0);
      }
    } else {
      calcDiscountRate = isPromo ? 0 : (parseFloat(item.discount) || 0);
    }

    let calcDiscountValue = 0;
    let hasDiscount = false;
    if (calcDiscountRate > 0) {
      hasDiscount = true;
      calcDiscountValue = calcBasePrice * (calcDiscountRate / 100);
    }

    // Note: Reviewer and Vehicle Tips are now charged ONCE per transaction, not per item.
    // We calculate them here only for UI display purposes if needed.
    const reviewerPrice = item.selectedAddons?.reviewer ? parseFloat(item.addonsConfig?.reviewer || 30) : 0;
    const vehicleTipsPrice = item.selectedAddons?.vehicleTips ? parseFloat(item.addonsConfig?.vehicleTips || 20) : 0;
    
    const advFee = parseFloat(item.addonsConfig?.convenienceFee || 25);
    
    // finalItemPrice now only includes base price and discount
    const finalItemPrice = calcBasePrice - calcDiscountValue;

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

  const calculateGrandTotal = () => {
    const selectedItems = cart.filter(item => item.selected);
    if (selectedItems.length === 0) return 0;

    let totalBaseAmount = 0;
    let hasReviewer = false;
    let hasVehicleTips = false;

    selectedItems.forEach(item => {
      const totals = calculateItemTotals(item);
      totalBaseAmount += totals.finalItemPrice * (item.quantity || 1);
      if (item.selectedAddons?.reviewer) hasReviewer = true;
      if (item.selectedAddons?.vehicleTips) hasVehicleTips = true;
    });

    // Add flat convenience fee per transaction
    const firstItem = selectedItems[0];
    const flatFee = parseFloat(firstItem?.addonsConfig?.convenienceFee || 25);
    
    const reviewerFee = hasReviewer ? parseFloat(firstItem?.addonsConfig?.reviewer || 30) : 0;
    const tipsFee = hasVehicleTips ? parseFloat(firstItem?.addonsConfig?.vehicleTips || 20) : 0;

    return totalBaseAmount + flatFee + reviewerFee + tipsFee;
  };


  const getTotalItems = () => {
    return cart.reduce((total, item) => total + (Number(item.quantity) || 1), 0)
  }

  const handleCartCheckout = () => {
    if (!preSelectedBranch) {
      showNotification("Please select a branch first from the Branches page", "error")
      setShowCart(false)
      onNavigate('branches')
      return
    }

    const selectedItems = cart.filter(item => item.selected);
    if (selectedItems.length === 0) {
      showNotification("Please select at least one course to proceed", "error")
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

    // Identify primary item for the schedule page selection
    // If multiple regular courses, the first one is used as trigger
    const item = selectedItems[0]
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
      // Pass all selected items as a property if needed, 
      // though typically Schedule.jsx looks at the 'cart' itself.
    })

    if (!isLoggedIn) {
      persistPostVerifyRedirect('schedule')
      setShowCart(false)
      onNavigate('signup')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (isOnlineTdc && selectedItems.length === 1) {
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
                      const isSelected = !!item.selected;
                      
                      return (
                      <div key={`${item.id}-${item.type}-${index}`} className={`p-4 rounded-lg transition-all border ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-transparent'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex gap-3">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelectItem(item)}
                              className="w-5 h-5 mt-1 rounded border-gray-300 text-[#2157da] focus:ring-[#2157da] cursor-pointer"
                            />
                            <div className="flex-1">
                              <h3 className="font-semibold text-[#1a2332] text-sm">
                                {item.name}
                              </h3>
                              <p className="text-xs text-gray-500 mt-1">{item.duration}</p>
                              {item.type && (
                                <p className="text-xs text-[#2157da] font-medium mt-1 uppercase">{item.type}</p>
                              )}
                              <div className="flex items-center gap-1 mt-2">
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-semibold mt-1 inline-block">
                                  {isItemOnlineTdc ? '♾ Online Provider' : '📅 Schedule Required'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id, item.type)}
                            className="text-gray-400 hover:text-red-500 text-xl font-bold ml-2 transition-colors"
                          >
                            ×
                          </button>
                        </div>

                          <div className="border-t border-gray-200 mt-3 pt-3 space-y-2 text-sm text-gray-600 font-medium">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs sm:text-sm">Course Price</span>
                              <span className="font-bold text-gray-900 shrink-0">₱{totals.finalItemPrice.toLocaleString()}</span>
                            </div>
                            
                            {(item.selectedAddons?.reviewer || item.selectedAddons?.vehicleTips) && (
                              <div className="space-y-1 bg-gray-50/50 p-2 rounded">
                                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Add-ons (Charged Once)</span>
                                {item.selectedAddons?.reviewer && (
                                  <div className="flex justify-between text-gray-400 text-[10px] italic">
                                    <span>• Reviewer</span>
                                    <span>[Accounted]</span>
                                  </div>
                                )}
                                {item.selectedAddons?.vehicleTips && (
                                  <div className="flex justify-between text-gray-400 text-[10px] italic">
                                    <span>• Vehicle Tips</span>
                                    <span>[Accounted]</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="flex justify-between items-center gap-2 bg-gray-100 rounded p-2 mt-2">
                              <span className="text-sm font-bold text-gray-800">Item Total</span>
                              <span className="text-lg font-black text-[#2157da]">₱{(totals.finalItemPrice * qty).toLocaleString()}</span>
                            </div>
                          </div>
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

                  {/* Summary Bar */}
                  {cart.some(item => item.selected) && (
                    <div className="border-t-2 border-gray-100 pt-4 mb-6 space-y-3">
                        {/* Per-transaction Addons Breakdown */}
                        {cart.some(i => i.selected && i.selectedAddons?.reviewer) && (
                          <div className="flex justify-between items-center text-gray-600">
                             <span className="text-sm">Exam Reviewer Fee</span>
                             <span className="font-bold text-gray-900">₱30</span>
                          </div>
                        )}
                        {cart.some(i => i.selected && i.selectedAddons?.vehicleTips) && (
                          <div className="flex justify-between items-center text-gray-600">
                             <span className="text-sm">Vehicle Tips Fee</span>
                             <span className="font-bold text-gray-900">₱20</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center text-gray-600">
                          <span className="text-sm">Convenience Fee</span>
                          <span className="font-bold text-gray-900">₱25</span>
                        </div>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-[#1a2332]">Grand Total</span>
                        <span className="text-2xl font-black text-[#2157da]">₱{calculateGrandTotal().toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {!hasAvailableSlots && !availabilityLoading && cart.some(i => i.selected) && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg animate-pulse">
                      <p className="text-xs font-bold text-red-600 mb-1 flex items-center gap-1">
                        <span>❌</span> Slots Unavailable
                      </p>
                      <p className="text-[10px] text-red-500 leading-tight">
                        One or more components of your selected courses are currently fully booked at this branch. Please try another branch or check back later.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleCartCheckout}
                    disabled={!preSelectedBranch || !cart.some(item => item.selected) || !hasAvailableSlots || availabilityLoading}
                    className={`w-full py-4 rounded-full font-bold transition-all text-base shadow-lg ${
                      !preSelectedBranch || !cart.some(item => item.selected) || !hasAvailableSlots || availabilityLoading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#2157da] text-white hover:bg-[#1a3a8a] cursor-pointer'
                    }`}
                  >
                    {!preSelectedBranch
                      ? 'Select Branch First'
                      : (!cart.some(item => item.selected) 
                          ? 'Select Courses' 
                          : (availabilityLoading 
                              ? 'Checking Slots...' 
                              : (!hasAvailableSlots ? 'Strictly No Slots' : 'Proceed to Checkout')))
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
