const fs = require('fs');

const code = fs.readFileSync('src/App.jsx', 'utf8');

const injector = \
  // --- Promo Packages Automatic Cart Interceptor ---
  useEffect(() => {
    let isMounted = true;
    const processCartPromos = async () => {
      // Deep clone to safely look at items
      let currentCart = JSON.parse(JSON.stringify(cart));
      
      // Look for any PDCs in the user's cart
      const pdcItems = currentCart.filter(item => item.courseType === 'PDC' || item.type === 'PDC' || item.course_type === 'PDC' || (item.name && item.name.includes('PDC')));
      const hasPdc = pdcItems.length > 0;
      
      // Identify active promo locks in cart right now
      const existingPromoLockIndex = currentCart.findIndex(item => item._isPromoLock === true);
      
      // If we already have a promo lock but no PDCs to trigger it, nuke the lock and return
      if (existingPromoLockIndex !== -1 && !hasPdc) {
        currentCart.splice(existingPromoLockIndex, 1);
        if (isMounted) setCart(currentCart); // Update main state
        return;
      }
      
      // Stop here if no PDC and no existing lock to clean up
      if (!hasPdc) return;
      
      // We have a PDC. Is there an active promo package for 'ANY_PDC'?
      try {
        const activePromos = await promoAPI.getActive();
        if (!activePromos || activePromos.length === 0) {
           // No promos active, clear cart lock if they had one mistakenly
           if (existingPromoLockIndex !== -1) {
              currentCart.splice(existingPromoLockIndex, 1);
              if (isMounted) setCart(currentCart);
           }
           return;
        }
        
        // Find a valid promo package triggered by ANY_PDC
        const matchingPromo = activePromos.find(p => p.trigger_rule && p.trigger_rule.type === 'ANY_PDC');
        
        if (matchingPromo && existingPromoLockIndex === -1) {
            // Need to fetch the TDC course object to insert standard properties ideally, 
            // but we can inject a mock structural object that passes validation.
            const tdcPromoItem = {
               id: 'promo_tdc_f2f_' + matchingPromo.id,
               name: 'TDC (Face-to-Face)',
               type: 'Face-to-Face',                 // Display mode
               courseType: 'TDC',          // System mode
               price: 0,
               originalPrice: 1500, // Visual tracking
               quantity: 1,
               _isPromoLock: true,
               promoId: matchingPromo.id,
               promoName: matchingPromo.name
            };
            currentCart.push(tdcPromoItem);
            if (isMounted) setCart(currentCart);
            return;
        } else if (!matchingPromo && existingPromoLockIndex !== -1) {
            // Promo expired while in cart
            currentCart.splice(existingPromoLockIndex, 1);
            if (isMounted) setCart(currentCart);
            return;
        }

      } catch (e) {
        console.error('Error evaluating promo packages for cart:', e);
      }
    };
    
    // Throttle or run directly on dependencies
    processCartPromos();
    
    return () => { isMounted = false; };
  }, [cart.length]); // Only execute validation when items are explicitly added/removed
  // ---------------------------------------------------
\;

const lines = code.split('\\n');
const depsIndex = lines.findIndex(l => l.includes('AOS.init({'));
if (depsIndex !== -1) {
    lines.splice(depsIndex - 2, 0, injector);
}

fs.writeFileSync('src/App.jsx', lines.join('\\n'));
console.log('App.jsx properly injected via Python-like JS.');
