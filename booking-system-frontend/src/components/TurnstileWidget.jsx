import { useEffect, useRef, useState } from 'react'

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script'
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function TurnstileWidget({ onVerify, onExpire, onError, className = '' }) {
  const containerRef = useRef(null)
  const wrapperRef = useRef(null)
  const widgetIdRef = useRef(null)
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  const onErrorRef = useRef(onError)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  const [scale, setScale] = useState(1)

  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpireRef.current = onExpire
    onErrorRef.current = onError
  }, [onVerify, onExpire, onError])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current !== null) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'light',
        callback: (token) => onVerifyRef.current?.(token),
        'expired-callback': () => {
          onExpireRef.current?.()
        },
        'error-callback': () => {
          onErrorRef.current?.()
        },
      })
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
          window.turnstile.remove(widgetIdRef.current)
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
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [siteKey])

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
        <div ref={containerRef} className="cf-turnstile" />
      </div>
    </div>
  )
}

export default TurnstileWidget