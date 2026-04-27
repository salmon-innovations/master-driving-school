import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script'
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const TurnstileWidget = forwardRef(({ onVerify, onExpire, onError, className = '' }, ref) => {
  const containerRef = useRef(null)
  const wrapperRef = useRef(null)
  const widgetIdRef = useRef(null)
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  const onErrorRef = useRef(onError)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  const [scale, setScale] = useState(1)
  const [resetKey, setResetKey] = useState(0)

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.reset(widgetIdRef.current)
        } catch (e) {
          console.warn('Turnstile reset failed:', e)
        }
        onVerifyRef.current?.('') // Clear parent state
      } else {
        // If not rendered yet or turnstile not ready, increment key to force re-render
        setResetKey(prev => prev + 1)
        onVerifyRef.current?.('')
      }
    }
  }))

  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpireRef.current = onExpire
    onErrorRef.current = onError
  }, [onVerify, onExpire, onError])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current !== null) return
      
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => {
            onVerifyRef.current?.(token)
          },
          'expired-callback': () => {
            onVerifyRef.current?.('')
            onExpireRef.current?.()
          },
          'error-callback': () => {
            onVerifyRef.current?.('')
            onErrorRef.current?.()
          },
        })
      } catch (err) {
        console.error('Failed to render Turnstile:', err)
      }
    }

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID)
    if (existingScript) {
      if (window.turnstile) {
        renderWidget()
      } else {
        existingScript.addEventListener('load', renderWidget)
      }

      return () => {
        existingScript.removeEventListener('load', renderWidget)
        if (window.turnstile && widgetIdRef.current !== null) {
          try {
            window.turnstile.remove(widgetIdRef.current)
          } catch (e) {}
          widgetIdRef.current = null
        }
      }
    }

    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = renderWidget
    document.head.appendChild(script)

    return () => {
      script.removeEventListener('load', renderWidget)
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch (e) {}
        widgetIdRef.current = null
      }
    }
  }, [siteKey, resetKey])

  useEffect(() => {
    const baseWidth = 300
    const mobileBreakpoint = 640
    const updateScale = () => {
      const width = wrapperRef.current?.offsetWidth || baseWidth
      const isMobile = window.innerWidth < mobileBreakpoint
      if (!isMobile) {
        setScale(1)
        return
      }

      setScale(width < baseWidth ? width / baseWidth : 1)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
    }
  }, [])

  if (!siteKey) {
    return (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Human verification is not configured. Set VITE_TURNSTILE_SITE_KEY in frontend environment.
      </p>
    )
  }

  return (
    <div ref={wrapperRef} className={`w-full flex justify-center overflow-hidden ${className}`.trim()}>
      <div style={{ width: '300px', transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        {/* 
           We use a key here tied to resetKey to force a fresh div on explicit reset.
           We avoid the 'cf-turnstile' class name to prevent the Cloudflare script 
           from trying to perform implicit rendering, which can conflict with our 
           explicit 'window.turnstile.render' call.
        */}
        <div key={resetKey} ref={containerRef} className="turnstile-widget-container" />
      </div>
    </div>
  )
})

export default TurnstileWidget