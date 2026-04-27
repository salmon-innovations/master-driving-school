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
      setResetKey(prev => prev + 1)
      onVerifyRef.current?.('')
    }
  }))

  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpireRef.current = onExpire
    onErrorRef.current = onError
  }, [onVerify, onExpire, onError])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined

    let renderTimer;
    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current !== null) return
      
      // Small delay to ensure clean state
      renderTimer = setTimeout(() => {
        if (!containerRef.current || widgetIdRef.current !== null) return

        try {
          console.log('🛡️ Rendering Turnstile widget...')
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: 'light',
            callback: (token) => {
              console.log(`🛡️ Turnstile verified (token prefix: ${token.substring(0, 10)}...)`)
              onVerifyRef.current?.(token)
            },
            'expired-callback': () => {
              console.log('🛡️ Turnstile token expired')
              onVerifyRef.current?.('')
              onExpireRef.current?.()
            },
            'error-callback': () => {
              console.error('🛡️ Turnstile error')
              onVerifyRef.current?.('')
              onErrorRef.current?.()
            },
          })
        } catch (err) {
          console.error('Failed to render Turnstile:', err)
        }
      }, 100)
    }

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID)
    if (existingScript) {
      if (window.turnstile) {
        renderWidget()
      } else {
        existingScript.addEventListener('load', renderWidget)
      }

      return () => {
        clearTimeout(renderTimer)
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
      clearTimeout(renderTimer)
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
        <div key={resetKey} ref={containerRef} className="cf-turnstile" />
      </div>
    </div>
  )
})

export default TurnstileWidget