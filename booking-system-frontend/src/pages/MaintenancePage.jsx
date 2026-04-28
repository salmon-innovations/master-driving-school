import React, { useEffect, useRef } from 'react';

const MaintenancePage = () => {
  const canvasRef = useRef(null);

  // Floating particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animFrame;
    let particles = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 0.6;
        this.speedY = (Math.random() - 0.5) * 0.6;
        this.opacity = Math.random() * 0.5 + 0.1;
        this.hue = Math.random() > 0.5 ? 220 : 200; // blue spectrum
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
      }
      draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = `hsl(${this.hue}, 80%, 65%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    for (let i = 0; i < 60; i++) particles.push(new Particle());

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Connect nearby particles
      particles.forEach((p, i) => {
        particles.slice(i + 1).forEach(q => {
          const dx = p.x - q.x, dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.save();
            ctx.globalAlpha = (1 - dist / 100) * 0.15;
            ctx.strokeStyle = '#2157da';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
            ctx.restore();
          }
        });
        p.update();
        p.draw();
      });
      animFrame = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');

        .mnt-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          font-family: 'Inter', sans-serif;
          background: linear-gradient(135deg, #0a0f2e 0%, #0d1b4b 40%, #071428 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .mnt-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .mnt-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .mnt-glow-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(33,87,218,0.25) 0%, transparent 70%);
          top: -100px; left: -100px;
          animation: mnt-drift1 8s ease-in-out infinite alternate;
        }
        .mnt-glow-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%);
          bottom: -80px; right: -80px;
          animation: mnt-drift2 10s ease-in-out infinite alternate;
        }
        .mnt-glow-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%);
          top: 50%; left: 50%; transform: translate(-50%,-50%);
          animation: mnt-pulse 4s ease-in-out infinite;
        }

        @keyframes mnt-drift1 { from { transform: translate(0,0); } to { transform: translate(60px, 40px); } }
        @keyframes mnt-drift2 { from { transform: translate(0,0); } to { transform: translate(-50px, -30px); } }
        @keyframes mnt-pulse { 0%,100% { opacity: 0.6; transform: translate(-50%,-50%) scale(1); } 50% { opacity: 1; transform: translate(-50%,-50%) scale(1.2); } }

        .mnt-card {
          position: relative;
          z-index: 2;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 28px;
          padding: 56px 48px;
          max-width: 520px;
          width: 90%;
          text-align: center;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset;
          animation: mnt-card-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        @keyframes mnt-card-in {
          from { opacity: 0; transform: translateY(40px) scale(0.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .mnt-gear-ring {
          width: 100px; height: 100px;
          margin: 0 auto 28px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mnt-gear-ring::before {
          content: '';
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px solid transparent;
          border-top-color: #2157da;
          border-right-color: #6366f1;
          animation: mnt-spin 2s linear infinite;
        }

        .mnt-gear-ring::after {
          content: '';
          position: absolute;
          inset: -14px;
          border-radius: 50%;
          border: 1.5px solid transparent;
          border-bottom-color: rgba(99,102,241,0.4);
          border-left-color: rgba(6,182,212,0.4);
          animation: mnt-spin 3.5s linear infinite reverse;
        }

        @keyframes mnt-spin { to { transform: rotate(360deg); } }

        .mnt-gear-inner {
          width: 72px; height: 72px;
          background: linear-gradient(135deg, #1a3f9e, #2157da);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 32px rgba(33,87,218,0.6), 0 0 0 6px rgba(33,87,218,0.12);
          animation: mnt-icon-pulse 3s ease-in-out infinite;
        }

        @keyframes mnt-icon-pulse {
          0%,100% { box-shadow: 0 0 32px rgba(33,87,218,0.6), 0 0 0 6px rgba(33,87,218,0.12); }
          50% { box-shadow: 0 0 48px rgba(33,87,218,0.9), 0 0 0 12px rgba(33,87,218,0.08); }
        }

        .mnt-gear-svg {
          width: 36px; height: 36px;
          color: #fff;
          animation: mnt-spin 6s linear infinite;
        }

        .mnt-title {
          font-size: 2rem;
          font-weight: 900;
          color: #fff;
          margin-bottom: 12px;
          letter-spacing: -0.03em;
          line-height: 1.1;
        }

        .mnt-title span {
          background: linear-gradient(90deg, #60a5fa, #818cf8, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .mnt-desc {
          font-size: 1rem;
          color: rgba(255,255,255,0.55);
          line-height: 1.7;
          margin-bottom: 36px;
          font-weight: 400;
        }

        .mnt-bar-wrap {
          background: rgba(255,255,255,0.07);
          border-radius: 99px;
          height: 6px;
          overflow: hidden;
          margin-bottom: 28px;
        }

        .mnt-bar {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #2157da, #6366f1, #38bdf8);
          background-size: 200% 100%;
          animation: mnt-bar-anim 2.5s ease-in-out infinite;
        }

        @keyframes mnt-bar-anim {
          0% { background-position: 100% 0; width: 30%; }
          50% { background-position: 0% 0; width: 75%; }
          100% { background-position: 100% 0; width: 30%; }
        }

        .mnt-status-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(255,255,255,0.45);
          margin-bottom: 10px;
        }

        .mnt-dot {
          width: 8px; height: 8px;
          background: #22c55e;
          border-radius: 50%;
          box-shadow: 0 0 10px #22c55e;
          animation: mnt-blink 1.4s ease-in-out infinite;
          flex-shrink: 0;
        }

        @keyframes mnt-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

        .mnt-chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 28px;
        }

        .mnt-chip {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 5px 12px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.45);
          background: rgba(255,255,255,0.05);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .mnt-footer {
          position: relative;
          z-index: 2;
          margin-top: 28px;
          font-size: 0.78rem;
          color: rgba(255,255,255,0.2);
          font-weight: 500;
          letter-spacing: 0.04em;
        }

        .mnt-save-notice {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.2);
          border-radius: 12px;
          font-size: 0.78rem;
          color: rgba(134,239,172,0.8);
          font-weight: 600;
          text-align: left;
          margin-top: 20px;
        }

        .mnt-save-notice svg { flex-shrink: 0; }
      `}</style>

      <div className="mnt-overlay">
        {/* Animated canvas background */}
        <canvas ref={canvasRef} className="mnt-canvas" />

        {/* Ambient glows */}
        <div className="mnt-glow mnt-glow-1" />
        <div className="mnt-glow mnt-glow-2" />
        <div className="mnt-glow mnt-glow-3" />

        {/* Main card */}
        <div className="mnt-card">
          {/* Animated gear icon */}
          <div className="mnt-gear-ring">
            <div className="mnt-gear-inner">
              <svg className="mnt-gear-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>

          <h1 className="mnt-title">
            System <span>Maintenance</span>
          </h1>

          <p className="mnt-desc">
            We're upgrading the Master Driving School booking portal to bring you a faster, smarter experience. We'll be back online shortly.
          </p>

          {/* Animated progress bar */}
          <div className="mnt-bar-wrap">
            <div className="mnt-bar" />
          </div>

          <div className="mnt-status-row">
            <span className="mnt-dot" />
            Working on updates — checking every 30 seconds
          </div>

          <div className="mnt-save-notice">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Your progress has been saved. You can continue right where you left off.
          </div>

          <div className="mnt-chips">
            {['Database', 'Performance', 'Security', 'Updates'].map(tag => (
              <span key={tag} className="mnt-chip">{tag}</span>
            ))}
          </div>
        </div>

        <div className="mnt-footer">© {new Date().getFullYear()} Master Driving School PH</div>
      </div>
    </>
  );
};

export default MaintenancePage;
