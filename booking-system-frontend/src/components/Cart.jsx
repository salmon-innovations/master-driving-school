import { useNotification } from "../context/NotificationContext"

function Cart({ cart, setCart, showCart, setShowCart, onNavigate, isLoggedIn }) {
  const { showNotification } = useNotification()

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

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }

  const handleCheckout = () => {
    if (!isLoggedIn) {
      showNotification("Please sign in to checkout", "error")
      setShowCart(false)
      onNavigate('signin')
      return
    }
    if (cart.length > 0) {
      setShowCart(false)
      onNavigate('payment')
      window.scrollTo({ top: 0, behavior: 'smooth' })
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
                    {cart.map((item, index) => (
                      <div key={`${item.id}-${item.type}-${index}`} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-800 text-sm">{item.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">{item.duration}</p>
                            {item.type && (
                              <p className="text-xs text-[#2157da] font-medium mt-1 uppercase">{item.type}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 hover:text-red-700 text-xl"
                          >
                            ×
                          </button>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#2157da] font-bold">₱{item.price.toLocaleString()}</span>
                          <div className="flex items-center gap-2 bg-white rounded-md border border-gray-300">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100"
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-semibold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold">₱{getTotalPrice().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xl font-bold text-[#2157da]">
                      <span>Total:</span>
                      <span>₱{getTotalPrice().toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    className="w-full bg-[#F3B74C] text-[#2157da] py-3 rounded-full font-bold hover:bg-[#e1a63b] transition-all"
                  >
                    Proceed to Booking
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
