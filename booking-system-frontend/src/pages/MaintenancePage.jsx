import React, { useEffect, useRef } from 'react';

// Load GSAP from CDN — free for non-commercial/open use on a single site
const loadGSAP = () =>
  new Promise((resolve) => {
    if (window.gsap) { resolve(window.gsap); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
    script.onload = () => resolve(window.gsap);
    document.head.appendChild(script);
  });

const logo = '/images/logo.png';

const MaintenancePage = () => {
  const overlayRef     = useRef(null);
  const cardRef        = useRef(null);
  const roadRef        = useRef(null);
  const carRef         = useRef(null);
  const wheelRef       = useRef(null);
  const trafficRef     = useRef(null);
  const titleRef       = useRef(null);
  const subtitleRef    = useRef(null);
  const statusRef      = useRef(null);
  const barRef         = useRef(null);
  const dotsRef        = useRef([]);
  const conesRef       = useRef([]);

  useEffect(() => {
    let ctx;
    loadGSAP().then((gsap) => {
      ctx = gsap.context(() => {

        // ── 1. Card entrance ──────────────────────────────────────
        gsap.from(cardRef.current, {
          opacity: 0, y: 60, scale: 0.92,
          duration: 0.9, ease: 'back.out(1.4)'
        });

        // ── 2. Logo bounce in ─────────────────────────────────────
        gsap.from('.mnt-logo', {
          opacity: 0, scale: 0.5, rotation: -20,
          duration: 0.8, delay: 0.3, ease: 'back.out(2)'
        });

        // ── 3. Title letter-by-letter reveal ─────────────────────
        gsap.from(titleRef.current, {
          opacity: 0, y: 30,
          duration: 0.7, delay: 0.5, ease: 'power3.out'
        });
        gsap.from(subtitleRef.current, {
          opacity: 0, y: 20,
          duration: 0.6, delay: 0.7, ease: 'power2.out'
        });
        gsap.from(statusRef.current, {
          opacity: 0, y: 15,
          duration: 0.5, delay: 0.9, ease: 'power2.out'
        });

        // ── 4. Road lane dashes scroll infinitely ────────────────
        const dashes = dotsRef.current.filter(Boolean);
        dashes.forEach((dash, i) => {
          gsap.to(dash, {
            x: '-100%',
            duration: 1.2,
            delay: i * 0.18,
            ease: 'none',
            repeat: -1,
            modifiers: {
              x: (x) => {
                const val = parseFloat(x);
                return val <= -120 ? '120%' : x;
              }
            }
          });
        });

        // ── 5. Car drives across the road ────────────────────────
        if (carRef.current) {
          gsap.set(carRef.current, { x: '-160px' });
          gsap.to(carRef.current, {
            x: 'calc(100% + 160px)',
            duration: 3.5,
            ease: 'none',
            repeat: -1,
            delay: 0.2,
          });
          // Subtle bounce while driving
          gsap.to(carRef.current, {
            y: -3,
            duration: 0.25,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          });
        }

        // ── 6. Steering wheel spin ────────────────────────────────
        if (wheelRef.current) {
          gsap.to(wheelRef.current, {
            rotation: 360,
            duration: 3,
            ease: 'none',
            repeat: -1,
            transformOrigin: '50% 50%'
          });
        }

        // ── 7. Traffic light cycle ────────────────────────────────
        const tl = gsap.timeline({ repeat: -1 });
        const red    = document.getElementById('tl-red');
        const yellow = document.getElementById('tl-yellow');
        const green  = document.getElementById('tl-green');
        if (red && yellow && green) {
          tl.set([red, yellow, green], { opacity: 0.15 })
            .to(red,    { opacity: 1, duration: 0.4 })
            .to(red,    { opacity: 0.15, duration: 0.4, delay: 1.5 })
            .to(yellow, { opacity: 1, duration: 0.4 })
            .to(yellow, { opacity: 0.15, duration: 0.4, delay: 0.6 })
            .to(green,  { opacity: 1, duration: 0.4 })
            .to(green,  { opacity: 0.15, duration: 0.4, delay: 1.5 });
        }

        // ── 8. Progress bar shimmer loop ─────────────────────────
        if (barRef.current) {
          const shimmer = barRef.current.querySelector('.mnt-bar-shimmer');
          gsap.to(barRef.current.querySelector('.mnt-bar-fill'), {
            scaleX: 1,
            duration: 2.5,
            ease: 'power2.inOut',
            onComplete: () => {
              gsap.to(barRef.current.querySelector('.mnt-bar-fill'), {
                scaleX: 0.35,
                duration: 1.5,
                ease: 'power2.inOut',
                yoyo: true,
                repeat: -1
              });
            }
          });
          if (shimmer) {
            gsap.to(shimmer, {
              x: '200%',
              duration: 1.6,
              ease: 'power1.inOut',
              repeat: -1,
              delay: 0.5
            });
          }
        }

        // ── 9. Traffic cones sway ─────────────────────────────────
        conesRef.current.filter(Boolean).forEach((cone, i) => {
          gsap.to(cone, {
            rotation: i % 2 === 0 ? 6 : -6,
            duration: 0.9 + i * 0.1,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            transformOrigin: 'bottom center'
          });
        });

        // ── 10. Dot pulse on status indicator ────────────────────
        gsap.to('.mnt-status-dot', {
          scale: 1.5,
          opacity: 0.4,
          duration: 0.7,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1
        });

      }, overlayRef);
    });

    return () => ctx?.revert();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .mnt-overlay {
          position: fixed; inset: 0; z-index: 99999;
          font-family: 'Inter', sans-serif;
          background: #f5f7ff;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          overflow: hidden;
        }

        /* Subtle grid background matching website */
        .mnt-overlay::before {
          content: '';
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(33,87,218,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(33,87,218,0.04) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        /* Brand gradient blobs */
        .mnt-blob {
          position: absolute; border-radius: 50%;
          filter: blur(70px); pointer-events: none;
        }
        .mnt-blob-1 {
          width: 400px; height: 400px; top: -100px; left: -80px;
          background: radial-gradient(circle, rgba(33,87,218,0.12) 0%, transparent 70%);
        }
        .mnt-blob-2 {
          width: 350px; height: 350px; bottom: -80px; right: -60px;
          background: radial-gradient(circle, rgba(243,183,76,0.15) 0%, transparent 70%);
        }
        .mnt-blob-3 {
          width: 250px; height: 250px; top: 40%; left: 60%;
          background: radial-gradient(circle, rgba(33,87,218,0.08) 0%, transparent 70%);
        }

        /* ── Main card ─────────────────────────── */
        .mnt-card {
          position: relative; z-index: 2;
          background: #fff;
          border: 1.5px solid rgba(33,87,218,0.12);
          border-radius: 28px;
          padding: 44px 40px 36px;
          max-width: 540px; width: 92%;
          text-align: center;
          box-shadow:
            0 4px 6px rgba(33,87,218,0.05),
            0 20px 50px rgba(33,87,218,0.10),
            0 0 0 1px rgba(255,255,255,0.8) inset;
        }

        /* Gold top border accent */
        .mnt-card::before {
          content: ''; position: absolute;
          top: 0; left: 20px; right: 20px; height: 3px;
          background: linear-gradient(90deg, #F3B74C, #2157da, #F3B74C);
          border-radius: 0 0 3px 3px;
          opacity: 0.8;
        }

        /* ── Logo ──────────────────────────────── */
        .mnt-logo {
          height: 70px; width: auto;
          margin: 0 auto 20px;
          display: block;
          filter: drop-shadow(0 4px 12px rgba(33,87,218,0.15));
        }

        /* ── Road scene ────────────────────────── */
        .mnt-scene {
          position: relative;
          background: #1e293b;
          border-radius: 12px;
          height: 72px; overflow: hidden;
          margin-bottom: 28px;
          border: 1px solid #334155;
        }

        /* Asphalt texture stripes */
        .mnt-scene::before {
          content: '';
          position: absolute; inset: 0;
          background: repeating-linear-gradient(
            90deg,
            transparent, transparent 20px,
            rgba(255,255,255,0.01) 20px, rgba(255,255,255,0.01) 21px
          );
        }

        /* Road side lines */
        .mnt-road-edge {
          position: absolute; left: 0; right: 0; height: 3px;
          background: #F3B74C; opacity: 0.7;
        }
        .mnt-road-edge.top    { top: 10px; }
        .mnt-road-edge.bottom { bottom: 10px; }

        /* Lane dashes */
        .mnt-dashes {
          position: absolute; top: 50%;
          transform: translateY(-50%);
          display: flex; gap: 18px;
          left: 0; width: 200%;
        }
        .mnt-dash {
          width: 36px; height: 4px;
          background: #fff; border-radius: 2px;
          opacity: 0.5; flex-shrink: 0;
        }

        /* Car SVG */
        .mnt-car {
          position: absolute;
          bottom: 14px; left: 0;
          width: 100px;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));
        }

        /* Traffic light */
        .mnt-traffic {
          position: absolute;
          right: 18px; top: 4px;
          display: flex; flex-direction: column;
          background: #0f172a;
          border-radius: 6px; padding: 4px 5px; gap: 3px;
          border: 1px solid #334155;
        }
        .mnt-tl-light {
          width: 10px; height: 10px;
          border-radius: 50%;
        }
        .mnt-tl-light.red    { background: #ef4444; }
        .mnt-tl-light.yellow { background: #F3B74C; }
        .mnt-tl-light.green  { background: #22c55e; }

        /* Traffic cones */
        .mnt-cone {
          position: absolute; bottom: 14px;
          width: 0; height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-bottom: 22px solid #F3B74C;
          filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4));
        }
        .mnt-cone::after {
          content: ''; position: absolute;
          bottom: -22px; left: -7px;
          width: 14px; height: 4px;
          background: #e2e8f0; border-radius: 1px;
        }
        .mnt-cone::before {
          content: ''; position: absolute;
          top: 50%; left: -5px;
          width: 10px; height: 3px;
          background: #fff; opacity: 0.4;
          border-radius: 1px;
        }

        /* ── Text ──────────────────────────────── */
        .mnt-title {
          font-size: 1.7rem; font-weight: 900;
          color: #0f172a; margin-bottom: 10px;
          letter-spacing: -0.03em; line-height: 1.15;
        }
        .mnt-title span { color: #2157da; }

        .mnt-subtitle {
          font-size: 0.95rem; color: #64748b;
          line-height: 1.65; margin-bottom: 24px;
          font-weight: 400;
        }

        /* ── Progress bar ──────────────────────── */
        .mnt-bar-wrap {
          background: #f1f5f9;
          border-radius: 99px; height: 8px;
          overflow: hidden; margin-bottom: 20px;
          position: relative;
        }
        .mnt-bar-fill {
          height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, #2157da 0%, #F3B74C 100%);
          transform-origin: left center;
          transform: scaleX(0.35);
          position: relative; overflow: hidden;
        }
        .mnt-bar-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(90deg,
            transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%);
          width: 50%;
        }

        /* ── Status row ────────────────────────── */
        .mnt-status {
          display: flex; align-items: center;
          justify-content: center; gap: 8px;
          font-size: 0.82rem; font-weight: 600;
          color: #64748b; margin-bottom: 20px;
        }
        .mnt-status-dot {
          width: 8px; height: 8px;
          background: #22c55e; border-radius: 50%;
          box-shadow: 0 0 8px #22c55e;
          flex-shrink: 0;
        }

        /* ── Save notice ───────────────────────── */
        .mnt-notice {
          display: flex; align-items: center;
          gap: 8px; padding: 10px 14px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          font-size: 0.78rem; font-weight: 600;
          color: #15803d; text-align: left;
        }

        /* ── Steering wheel badge ──────────────── */
        .mnt-wheel-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: #eff6ff;
          border: 1.5px solid rgba(33,87,218,0.15);
          border-radius: 20px;
          padding: 6px 14px; margin-bottom: 20px;
          font-size: 0.78rem; font-weight: 700;
          color: #2157da; letter-spacing: 0.03em;
        }

        .mnt-footer {
          position: relative; z-index: 2;
          margin-top: 24px;
          font-size: 0.75rem; color: #94a3b8;
          font-weight: 500;
        }
      `}</style>

      <div className="mnt-overlay" ref={overlayRef}>
        {/* Ambient blobs */}
        <div className="mnt-blob mnt-blob-1" />
        <div className="mnt-blob mnt-blob-2" />
        <div className="mnt-blob mnt-blob-3" />

        {/* Card */}
        <div className="mnt-card" ref={cardRef}>

          {/* Logo */}
          <img src={logo} alt="Master Driving School" className="mnt-logo" />

          {/* Steering wheel badge */}
          <div className="mnt-wheel-badge">
            <svg ref={wheelRef} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="2" x2="12" y2="9"/>
              <line x1="12" y1="15" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="9" y2="12"/>
              <line x1="15" y1="12" x2="22" y2="12"/>
            </svg>
            SYSTEM MAINTENANCE
          </div>

          {/* Animated road scene */}
          <div className="mnt-scene" ref={roadRef}>
            {/* Road edges */}
            <div className="mnt-road-edge top" />
            <div className="mnt-road-edge bottom" />

            {/* Lane dashes */}
            <div className="mnt-dashes">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className="mnt-dash"
                  ref={el => dotsRef.current[i] = el}
                />
              ))}
            </div>

            {/* Traffic cones */}
            {[30, 55, 80].map((pct, i) => (
              <div
                key={i}
                className="mnt-cone"
                ref={el => conesRef.current[i] = el}
                style={{ left: `${pct}%` }}
              />
            ))}

            {/* Traffic light */}
            <div className="mnt-traffic" ref={trafficRef}>
              <div id="tl-red"    className="mnt-tl-light red"    style={{ opacity: 0.15 }} />
              <div id="tl-yellow" className="mnt-tl-light yellow" style={{ opacity: 0.15 }} />
              <div id="tl-green"  className="mnt-tl-light green"  style={{ opacity: 0.15 }} />
            </div>

            {/* Car SVG */}
            <svg
              ref={carRef}
              className="mnt-car"
              viewBox="0 0 120 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Body */}
              <rect x="8" y="22" width="104" height="20" rx="5" fill="#2157da"/>
              {/* Cabin */}
              <path d="M28 22 L36 8 L82 8 L92 22 Z" fill="#1a3a8a"/>
              {/* Windows */}
              <path d="M38 10 L44 22 L78 22 L84 10 Z" fill="#93c5fd" opacity="0.7"/>
              {/* Window divider */}
              <line x1="61" y1="10" x2="61" y2="22" stroke="#1a3a8a" strokeWidth="1.5"/>
              {/* Grill / front bumper */}
              <rect x="100" y="28" width="8" height="8" rx="1" fill="#F3B74C" opacity="0.9"/>
              {/* Rear */}
              <rect x="10" y="28" width="6" height="6" rx="1" fill="#ef4444" opacity="0.9"/>
              {/* Wheels */}
              <circle cx="32" cy="42" r="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5"/>
              <circle cx="32" cy="42" r="2.5" fill="#64748b"/>
              <circle cx="88" cy="42" r="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5"/>
              <circle cx="88" cy="42" r="2.5" fill="#64748b"/>
              {/* Underline shadow */}
              <ellipse cx="60" cy="46" rx="42" ry="2" fill="#000" opacity="0.2"/>
            </svg>
          </div>

          {/* Text */}
          <h1 className="mnt-title" ref={titleRef}>
            We're <span>upgrading</span> for you
          </h1>
          <p className="mnt-subtitle" ref={subtitleRef}>
            Master Driving School's booking portal is currently being updated. We'll be back online shortly — sit tight!
          </p>

          {/* Progress bar */}
          <div className="mnt-bar-wrap" ref={barRef}>
            <div className="mnt-bar-fill">
              <div className="mnt-bar-shimmer" />
            </div>
          </div>

          {/* Status */}
          <div className="mnt-status" ref={statusRef}>
            <span className="mnt-status-dot" />
            Checking for updates every 5 seconds
          </div>

          {/* Session save notice */}
          <div className="mnt-notice">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Your progress has been saved. You can continue right where you left off once we're back.
          </div>
        </div>

        <div className="mnt-footer">
          © {new Date().getFullYear()} Master Driving School PH · All rights reserved
        </div>
      </div>
    </>
  );
};

export default MaintenancePage;
