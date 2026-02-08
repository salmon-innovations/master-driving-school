import { useState, useEffect } from "react"
import { useNotification } from "../context/NotificationContext"

function Payment({ cart, setCart, onNavigate, isLoggedIn }) {
  const { showNotification } = useNotification()
  const [paymentType, setPaymentType] = useState(null) // "full" or "downpayment"
  const [paymentMethod, setPaymentMethod] = useState(null) // "starpay" or "gcash"
  const [step, setStep] = useState(1)

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
  const downpaymentAmount = subtotal * 0.5
  const finalAmount = paymentType === "downpayment" ? downpaymentAmount : subtotal

  useEffect(() => {
    if (!isLoggedIn) {
      showNotification("Please sign in to proceed with payment", "error")
      onNavigate("signin")
      return
    }
    if (cart.length === 0) {
      onNavigate("courses")
    }
  }, [cart, onNavigate, isLoggedIn])

  const handleProcessPayment = () => {
    if (!paymentType || !paymentMethod) {
      showNotification("Please select both payment type and method", "error")
      return
    }
    
    // Simulate payment processing
    showNotification(`Processing ${paymentMethod.toUpperCase()} payment for ₱${finalAmount.toLocaleString()}...`, "info")
    
    setTimeout(() => {
      showNotification("Payment successful! Redirecting to home...", "success")
      setCart([]) // Clear cart
      onNavigate("home")
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Hero Section */}
      <section className="relative py-16 bg-[#2157da] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight" data-aos="fade-down">
            SECURE CHECKOUT
          </h1>
          <p className="text-blue-100 text-lg opacity-80" data-aos="fade-up">
            Choose your payment preference and method to finalize your enrollment.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-12">
            
            {/* Left Column: Selection */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Step 1: Payment Type */}
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl border border-gray-100" data-aos="fade-right">
                <div className="flex items-center gap-4 mb-8">
                  <span className="w-10 h-10 bg-blue-100 text-[#2157da] rounded-full flex items-center justify-center font-black">01</span>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Select Payment Type</h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Full Payment */}
                  <button 
                    onClick={() => setPaymentType("full")}
                    className={`relative p-8 rounded-[2rem] border-2 transition-all duration-300 text-left group ${
                      paymentType === "full" 
                      ? "border-[#2157da] bg-blue-50/50" 
                      : "border-gray-100 hover:border-blue-200"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 mb-4 flex items-center justify-center ${
                      paymentType === "full" ? "border-[#2157da]" : "border-gray-300"
                    }`}>
                      {paymentType === "full" && <div className="w-3 h-3 bg-[#2157da] rounded-full"></div>}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Full Payment</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">Secure your slot completely with 100% upfront payment.</p>
                    <div className="mt-4 text-[#2157da] font-black text-2xl">₱{subtotal.toLocaleString()}</div>
                  </button>

                  {/* Downpayment */}
                  <button 
                    onClick={() => setPaymentType("downpayment")}
                    className={`relative p-8 rounded-[2rem] border-2 transition-all duration-300 text-left group ${
                       paymentType === "downpayment" 
                      ? "border-[#2157da] bg-blue-50/50" 
                      : "border-gray-100 hover:border-blue-200"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 mb-4 flex items-center justify-center ${
                      paymentType === "downpayment" ? "border-[#2157da]" : "border-gray-300"
                    }`}>
                      {paymentType === "downpayment" && <div className="w-3 h-3 bg-[#2157da] rounded-full"></div>}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Downpayment (50%)</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">Pay half now and settle the balance before your second lesson.</p>
                    <div className="mt-4 text-[#2157da] font-black text-2xl">₱{downpaymentAmount.toLocaleString()}</div>
                  </button>
                </div>
              </div>

              {/* Step 2: Payment Method */}
              <div className={`bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl border border-gray-100 transition-opacity duration-500 ${!paymentType ? "opacity-50 pointer-events-none" : "opacity-100"}`} data-aos="fade-right" data-aos-delay="100">
                <div className="flex items-center gap-4 mb-8">
                  <span className="w-10 h-10 bg-blue-100 text-[#2157da] rounded-full flex items-center justify-center font-black">02</span>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Choose Payment Method</h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  {/* GCash */}
                  <button 
                    onClick={() => setPaymentMethod("gcash")}
                    className={`flex items-center gap-6 p-6 rounded-[1.5rem] border-2 transition-all duration-300 ${
                      paymentMethod === "gcash" 
                      ? "border-blue-400 bg-blue-50/30" 
                      : "border-gray-100 hover:border-blue-100"
                    }`}
                  >
                    <div className="w-16 h-16 bg-[#007dfe] rounded-2xl flex items-center justify-center shrink-0">
                       <span className="text-white font-black text-xl italic text-shadow-sm">G</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">GCash</h3>
                      <p className="text-gray-500 text-sm">Instant Pay via GCash App</p>
                    </div>
                    {paymentMethod === "gcash" && (
                      <div className="ml-auto w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>

                  {/* Star Pay */}
                  <button 
                    onClick={() => setPaymentMethod("starpay")}
                    className={`flex items-center gap-6 p-6 rounded-[1.5rem] border-2 transition-all duration-300 ${
                      paymentMethod === "starpay" 
                      ? "border-orange-400 bg-orange-50/30" 
                      : "border-gray-100 hover:border-orange-100"
                    }`}
                  >
                    <div className="w-16 h-16 bg-[#ff4d00] rounded-2xl flex items-center justify-center shrink-0">
                       <span className="text-white font-black text-xl tracking-tighter">SP</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">Star Pay</h3>
                      <p className="text-gray-500 text-sm">Secure Merchant Gateway</p>
                    </div>
                    {paymentMethod === "starpay" && (
                      <div className="ml-auto w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
              </div>

            </div>

            {/* Right Column: Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-32 bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl overflow-hidden shadow-blue-200/20" data-aos="fade-left">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-2xl"></div>
                
                <h2 className="text-2xl font-black mb-8 relative z-10 tracking-tight">Order Summary</h2>
                
                <div className="space-y-6 mb-8 relative z-10">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-4 pb-6 border-b border-white/10 last:border-0 last:pb-0">
                      <div>
                        <p className="font-bold text-sm text-white/90 uppercase tracking-wide">{item.name}</p>
                        <p className="text-xs text-white/50 mt-1">{item.duration} × {item.quantity}</p>
                      </div>
                      <span className="font-bold text-blue-400">₱{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 pt-4 relative z-10">
                  <div className="flex justify-between text-white/60">
                    <span>Subtotal:</span>
                    <span>₱{subtotal.toLocaleString()}</span>
                  </div>
                  {paymentType === "downpayment" && (
                     <div className="flex justify-between text-orange-400 font-medium">
                      <span>Downpayment (50%):</span>
                      <span>-₱{downpaymentAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-6 border-t border-white/20">
                    <span className="text-xl font-bold">Total Now</span>
                    <span className="text-3xl font-black text-blue-400 tracking-tighter">₱{finalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <button 
                  onClick={handleProcessPayment}
                  disabled={!paymentType || !paymentMethod}
                  className={`w-full mt-10 py-5 rounded-2xl font-black text-lg transition-all transform active:scale-95 shadow-xl ${
                    paymentType && paymentMethod 
                    ? "bg-[#2157da] hover:bg-blue-600 text-white shadow-blue-500/20" 
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                  }`}
                >
                  {paymentType && paymentMethod ? "COMPLETE PAYMENT" : "FINALIZE SELECTION"}
                </button>
                
                <div className="mt-8 flex items-center justify-center gap-6 opacity-40 grayscale group-hover:grayscale-0 transition-all duration-500">
                    <div className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest text-white">SSL SECURE</div>
                    <div className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest text-white">PCI DSS</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  )
}

export default Payment
