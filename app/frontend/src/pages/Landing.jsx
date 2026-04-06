import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

/* ── keyframe animations ────────────────────────────────────────────────────── */
const STYLES = `
@keyframes fadeInUp {
  from { opacity:0; transform:translateY(32px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes fadeIn {
  from { opacity:0; }
  to   { opacity:1; }
}
@keyframes floatA {
  0%,100% { transform:translate(0,0) scale(1); }
  33%      { transform:translate(40px,-60px) scale(1.08); }
  66%      { transform:translate(-30px,40px) scale(0.95); }
}
@keyframes floatB {
  0%,100% { transform:translate(0,0) scale(1); }
  40%      { transform:translate(-50px,30px) scale(1.1); }
  70%      { transform:translate(30px,-40px) scale(0.92); }
}
@keyframes floatC {
  0%,100% { transform:translate(0,0) scale(1); }
  50%      { transform:translate(20px,50px) scale(1.06); }
}
@keyframes shimmerText {
  0%   { background-position:200% center; }
  100% { background-position:-200% center; }
}
@keyframes glowPulse {
  0%,100% { box-shadow:0 0 20px 0 rgba(99,102,241,0.3); }
  50%      { box-shadow:0 0 42px 8px rgba(99,102,241,0.55); }
}
@keyframes starFloat {
  0%,100% { opacity:0.15; transform:translateY(0); }
  50%      { opacity:0.65; transform:translateY(-14px); }
}
.anim-fadeIn    { animation:fadeIn    0.6s ease both; }
.anim-fadeInUp  { animation:fadeInUp  0.75s ease both; }
.shimmer-text   { background:linear-gradient(90deg,#818cf8 0%,#c084fc 30%,#60a5fa 60%,#818cf8 100%); background-size:300% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:shimmerText 5s linear infinite; }
.glow-btn       { animation:glowPulse 3s ease-in-out infinite; }
.reveal         { opacity:0; transform:translateY(28px); transition:opacity 0.65s ease, transform 0.65s ease; }
.reveal.in-view { opacity:1; transform:translateY(0); }
`

/* ── hooks ──────────────────────────────────────────────────────────────────── */
function useCountUp(target, duration, active) {
  const [val, setVal] = useState(300)
  useEffect(() => {
    if (!active) return
    const start = 300, t0 = performance.now()
    const tick = now => {
      const p = Math.min((now - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(start + (target - start) * e))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [active, target, duration])
  return val
}

function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { e.target.classList.add('in-view'); io.disconnect() }
    }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

/* ── Score ring ─────────────────────────────────────────────────────────────── */
function ScoreRing({ score, animated }) {
  const r    = 70
  const circ = 2 * Math.PI * r
  const pct  = (score - 300) / 550
  const offset = circ * (1 - pct)
  const color = score >= 740 ? '#34d399' : score >= 670 ? '#60a5fa' : score >= 580 ? '#fbbf24' : '#f87171'
  const label = score >= 740 ? 'Excellent' : score >= 670 ? 'Good' : score >= 580 ? 'Fair' : 'Poor'
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width:180, height:180 }}>
      <svg width="180" height="180" style={{ transform:'rotate(-90deg)' }}>
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={animated ? offset : circ}
          style={{ transition:'stroke-dashoffset 2s cubic-bezier(0.22,1,0.36,1)', filter:`drop-shadow(0 0 10px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white leading-none">{score}</span>
        <span className="text-xs font-bold mt-1" style={{ color }}>{label}</span>
        <span className="text-xs text-slate-600 mt-0.5">out of 850</span>
      </div>
    </div>
  )
}

/* ── Feature card ───────────────────────────────────────────────────────────── */
function FeatureCard({ icon, iconBg, title, desc, delay }) {
  const ref = useReveal()
  return (
    <div ref={ref} className="reveal group bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-left hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl" style={{ transitionDelay:`${delay}ms` }}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>{icon}</div>
      <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

/* ── Step card ──────────────────────────────────────────────────────────────── */
function StepCard({ num, title, desc, delay }) {
  const ref = useReveal()
  return (
    <div ref={ref} className="reveal flex gap-4" style={{ transitionDelay:`${delay}ms` }}>
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 text-sm font-bold">{num}</div>
      <div>
        <h4 className="text-white font-semibold text-sm mb-1">{title}</h4>
        <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

/* ── Stat pill ──────────────────────────────────────────────────────────────── */
function StatPill({ value, label, delay }) {
  const ref = useReveal()
  return (
    <div ref={ref} className="reveal text-center" style={{ transitionDelay:`${delay}ms` }}>
      <div className="text-3xl md:text-4xl font-black text-white mb-1">{value}</div>
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  )
}

/* ── Score band row ─────────────────────────────────────────────────────────── */
function BandRow({ range, label, desc, color, bg, border, barW, delay }) {
  const ref = useReveal()
  return (
    <div ref={ref} className="reveal flex items-center gap-4 rounded-2xl p-4 border transition-all duration-300 hover:-translate-y-0.5" style={{ background:bg, borderColor:border, transitionDelay:`${delay}ms` }}>
      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background:color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-bold" style={{ color }}>{label}</span>
          <span className="text-xs text-slate-600">{range}</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
          <div className="h-full rounded-full" style={{ width:barW, background:color, boxShadow:`0 0 6px ${color}60` }} />
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

/* ── Section header ─────────────────────────────────────────────────────────── */
function SectionHeader({ eyebrow, title, sub }) {
  const ref = useReveal()
  return (
    <div ref={ref} className="reveal text-center mb-10">
      {eyebrow && <p className="text-xs text-indigo-400 uppercase tracking-widest font-semibold mb-2">{eyebrow}</p>}
      <h2 className="text-2xl md:text-3xl font-black text-white">{title}</h2>
      {sub && <p className="text-slate-500 text-sm mt-2">{sub}</p>}
    </div>
  )
}

/* ── Final CTA section ──────────────────────────────────────────────────────── */
function FinalCTA({ onCta }) {
  const ref = useReveal()
  return (
    <section className="relative py-20 px-5 text-center" style={{ zIndex:1 }}>
      <div ref={ref} className="reveal max-w-md mx-auto">
        <div className="rounded-3xl p-8 border" style={{ background:'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)', borderColor:'rgba(99,102,241,0.2)' }}>
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Ready to see your score?</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">Join thousands of Ghanaians taking control of their financial future — no bank required.</p>
          <button onClick={onCta} className="glow-btn w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all duration-200 hover:scale-105">
            Get My Credit Score Free
          </button>
          <p className="text-xs text-slate-600 mt-3">Takes 2 minutes · 100% free · No sign-up</p>
        </div>
      </div>
    </section>
  )
}

/* ── star particles ──────────────────────────────────────────────────────────── */
const STARS = [
  { top:'12%', left:'8%',  size:3, dur:'4.2s', delay:'0s'   },
  { top:'27%', left:'92%', size:2, dur:'5.1s', delay:'1.3s' },
  { top:'60%', left:'5%',  size:4, dur:'6.5s', delay:'0.7s' },
  { top:'78%', left:'85%', size:3, dur:'3.8s', delay:'2s'   },
  { top:'43%', left:'50%', size:2, dur:'7s',   delay:'0.2s' },
  { top:'88%', left:'30%', size:3, dur:'5.5s', delay:'1.8s' },
  { top:'18%', left:'68%', size:2, dur:'4.8s', delay:'1s'   },
]

/* ── main component ─────────────────────────────────────────────────────────── */
export default function Landing() {
  const navigate   = useNavigate()
  const [ready, setReady]   = useState(false)
  const [ringOn, setRingOn] = useState(false)
  const score = useCountUp(742, 1900, ringOn)

  useEffect(() => {
    const t1 = setTimeout(() => setReady(true),  80)
    const t2 = setTimeout(() => setRingOn(true), 650)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const go = () => navigate('/dashboard')

  return (
    <>
      <style>{STYLES}</style>
      <div className="min-h-screen bg-[#0c0c18] flex flex-col overflow-x-hidden">

        {/* ── animated background ───────────────────────────────────────── */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex:0 }}>
          <div style={{ position:'absolute', top:'-15%', left:'25%', width:700, height:700, background:'radial-gradient(circle, rgba(99,102,241,0.16) 0%, transparent 70%)', animation:'floatA 18s ease-in-out infinite' }} />
          <div style={{ position:'absolute', bottom:'-10%', right:'5%',  width:550, height:550, background:'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', animation:'floatB 23s ease-in-out infinite' }} />
          <div style={{ position:'absolute', top:'35%',    left:'-5%',  width:400, height:400, background:'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', animation:'floatC 27s ease-in-out infinite' }} />
          {/* subtle grid */}
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize:'60px 60px' }} />
          {/* stars */}
          {STARS.map((s, i) => (
            <div key={i} style={{ position:'absolute', top:s.top, left:s.left, width:s.size, height:s.size, borderRadius:'50%', background:'rgba(129,140,248,0.7)', animation:`starFloat ${s.dur} ease-in-out ${s.delay} infinite` }} />
          ))}
        </div>

        {/* ── hero ──────────────────────────────────────────────────────── */}
        <main className="relative flex-1 flex flex-col items-center justify-center px-5 pt-20 pb-10 text-center" style={{ zIndex:1 }}>

          {/* badge */}
          <div className="anim-fadeIn inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium mb-8"
            style={{ animationDelay:'0.1s', opacity:0, background:'rgba(99,102,241,0.08)', borderColor:'rgba(99,102,241,0.25)', color:'#a5b4fc' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Free · Instant · Private · Ghana Cedis
          </div>

          {/* headline */}
          <h1 className="anim-fadeInUp text-4xl md:text-6xl font-black text-white leading-tight mb-5 max-w-2xl" style={{ animationDelay:'0.2s', opacity:0 }}>
            Know your financial<br />
            <span className="shimmer-text">credit score today</span>
          </h1>

          {/* sub */}
          <p className="anim-fadeInUp text-lg text-slate-400 max-w-md mb-10 leading-relaxed" style={{ animationDelay:'0.38s', opacity:0 }}>
            Built for Ghanaians — no bank account, no credit history required. We analyse your everyday financial habits and give you a real creditworthiness score.
          </p>

          {/* CTA */}
          <div className="anim-fadeInUp flex flex-col items-center gap-3" style={{ animationDelay:'0.52s', opacity:0 }}>
            <button onClick={go}
              className="glow-btn group relative px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-bold rounded-2xl shadow-xl transition-all duration-200 hover:scale-105 overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                Check My Score
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </button>
            <p className="text-xs text-slate-600">Takes about 2 minutes · No sign-up</p>
          </div>

          {/* animated score preview card */}
          <div className="anim-fadeInUp mt-16 flex flex-col md:flex-row items-center gap-8 rounded-3xl px-8 py-8 max-w-lg w-full border"
            style={{ animationDelay:'0.7s', opacity:0, background:'rgba(15,15,30,0.7)', borderColor:'rgba(99,102,241,0.15)', backdropFilter:'blur(16px)' }}>
            <ScoreRing score={score} animated={ringOn} />
            <div className="text-left space-y-3 flex-1 w-full">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Sample score preview</p>
              {[
                { label:'Income stability',   pct:88, color:'#34d399' },
                { label:'Expense discipline', pct:72, color:'#60a5fa' },
                { label:'Rent consistency',   pct:94, color:'#a78bfa' },
                { label:'Savings buffer',     pct:61, color:'#fbbf24' },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-semibold" style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: ringOn ? `${pct}%` : '0%',
                      background: color,
                      transition: 'width 1.8s cubic-bezier(0.22,1,0.36,1)',
                      boxShadow: `0 0 6px ${color}80`,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* ── stats bar ─────────────────────────────────────────────────── */}
        <section className="relative py-14 px-5 border-y border-slate-800/50" style={{ zIndex:1, background:'rgba(12,12,24,0.8)' }}>
          <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatPill value="99.35%" label="Model accuracy"   delay={0}   />
            <StatPill value="77k+"   label="Training records" delay={100} />
            <StatPill value="< 1s"   label="Score time"       delay={200} />
            <StatPill value="300–850" label="Score range"     delay={300} />
          </div>
        </section>

        {/* ── score bands ───────────────────────────────────────────────── */}
        <section className="relative py-16 px-5" style={{ zIndex:1 }}>
          <div className="max-w-2xl mx-auto">
            <SectionHeader eyebrow="Score bands" title="What does your score mean?" />
            <div className="space-y-3">
              <BandRow range="740 – 850" label="Excellent" desc="Top-tier creditworthiness. Best loan terms available."     color="#34d399" bg="rgba(52,211,153,0.07)"  border="rgba(52,211,153,0.2)"  barW="100%" delay={0}   />
              <BandRow range="670 – 739" label="Good"      desc="Strong financial habits. Good access to credit products."  color="#60a5fa" bg="rgba(96,165,250,0.07)"  border="rgba(96,165,250,0.2)"  barW="80%"  delay={80}  />
              <BandRow range="580 – 669" label="Fair"      desc="Room to grow. Some lenders may offer conditional credit."  color="#fbbf24" bg="rgba(251,191,36,0.07)"  border="rgba(251,191,36,0.2)"  barW="60%"  delay={160} />
              <BandRow range="300 – 579" label="Poor"      desc="Focus on reducing debt and building savings consistency."  color="#f87171" bg="rgba(248,113,113,0.07)" border="rgba(248,113,113,0.2)" barW="35%"  delay={240} />
            </div>
          </div>
        </section>

        {/* ── how it works ──────────────────────────────────────────────── */}
        <section className="relative py-16 px-5" style={{ zIndex:1, background:'rgba(10,10,20,0.6)' }}>
          <div className="max-w-2xl mx-auto">
            <SectionHeader eyebrow="Simple process" title="How it works" />
            <div className="space-y-7">
              <StepCard num={1} title="Enter your financial details"   desc="Income, expenses, rent, mobile transactions, and savings — all in Ghana Cedis (₵). Takes 2 minutes." delay={0}   />
              <StepCard num={2} title="Our AI analyses your profile"   desc="A machine-learning model trained on 77,000+ loan records evaluates your creditworthiness instantly." delay={80}  />
              <StepCard num={3} title="Get your score + smart tips"    desc="See your score from 300–850, understand what's driving it, and get personalised steps to improve."  delay={160} />
            </div>
          </div>
        </section>

        {/* ── feature cards ─────────────────────────────────────────────── */}
        <section className="relative py-16 px-5" style={{ zIndex:1 }}>
          <div className="max-w-2xl mx-auto">
            <SectionHeader title="Built for the unbanked" sub="No credit history? No problem." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FeatureCard delay={0}   iconBg="bg-indigo-500/10"
                icon={<svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                title="No Bank Account Needed"
                desc="We use alternative financial signals — no traditional credit history required."
              />
              <FeatureCard delay={80}  iconBg="bg-violet-500/10"
                icon={<svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                title="100% Private"
                desc="Your data is never linked to your identity. No sign-up, no tracking."
              />
              <FeatureCard delay={160} iconBg="bg-emerald-500/10"
                icon={<svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                title="Instant Results"
                desc="Score in under a second, with personalised tips to improve it."
              />
            </div>
          </div>
        </section>

        {/* ── final CTA ─────────────────────────────────────────────────── */}
        <FinalCTA onCta={go} />

        {/* ── footer ────────────────────────────────────────────────────── */}
        <footer className="relative text-center py-6 text-xs text-slate-700 px-5 border-t border-slate-900 space-y-2" style={{ zIndex:1 }}>
          <p>This is not an official credit score. For educational and informational purposes only.</p>
          <p className="flex items-center justify-center gap-4">
            <a href="/business" className="text-slate-600 hover:text-indigo-400 transition-colors">Business Portal</a>
            <span className="text-slate-800">·</span>
            <a href="/admin" className="text-slate-600 hover:text-slate-400 transition-colors">Admin</a>
          </p>
        </footer>
      </div>
    </>
  )
}
