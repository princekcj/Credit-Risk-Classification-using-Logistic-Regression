import { useState, useRef } from 'react'
import { predictScore, explainScore, chatWithAI, parseBankStatement } from '../api'

const EMPLOYMENT_OPTIONS = [
  { value: 'employed',      label: 'Employed (full-time)' },
  { value: 'part_time',     label: 'Part-time employed' },
  { value: 'self_employed', label: 'Self-employed / Business owner' },
  { value: 'unemployed',    label: 'Unemployed' },
  { value: 'student',       label: 'Student' },
]

const REGIONS = [
  { value: '',              label: 'Select region (optional)' },
  { value: 'greater_accra', label: 'Greater Accra' },
  { value: 'ashanti',       label: 'Ashanti' },
  { value: 'western',       label: 'Western' },
  { value: 'western_north', label: 'Western North' },
  { value: 'central',       label: 'Central' },
  { value: 'eastern',       label: 'Eastern' },
  { value: 'volta',         label: 'Volta' },
  { value: 'oti',           label: 'Oti' },
  { value: 'bono',          label: 'Bono' },
  { value: 'bono_east',     label: 'Bono East' },
  { value: 'ahafo',         label: 'Ahafo' },
  { value: 'northern',      label: 'Northern' },
  { value: 'savannah',      label: 'Savannah' },
  { value: 'north_east',    label: 'North East' },
  { value: 'upper_east',    label: 'Upper East' },
  { value: 'upper_west',    label: 'Upper West' },
]

const BAND_COLORS = {
  Excellent: { ring: '#34d399', label: 'text-emerald-400' },
  Good:      { ring: '#60a5fa', label: 'text-blue-400'    },
  Fair:      { ring: '#fbbf24', label: 'text-amber-400'   },
  Poor:      { ring: '#f87171', label: 'text-rose-400'    },
}

const STEPS = [
  { key: 'income',              label: 'Monthly Income (₵)',        type: 'number', placeholder: 'e.g. 2500',  hint: 'Your average monthly take-home income in Ghana Cedis.' },
  { key: 'employment_type',     label: 'Employment Type',           type: 'select', options: EMPLOYMENT_OPTIONS },
  { key: 'expenses',            label: 'Monthly Expenses (₵)',      type: 'number', placeholder: 'e.g. 900',   hint: 'Total monthly outgoings — rent, food, transport, bills, etc.' },
  { key: 'rent_consistency',    label: 'Rent / Utility Consistency', type: 'slider', min: 0, max: 1, step: 0.05, hint: 'How consistently do you pay rent or utilities on time? 0 = never, 1 = always.' },
  { key: 'mobile_transactions', label: 'Mobile Money Transactions/Month', type: 'number', placeholder: 'e.g. 15', hint: 'Average number of MoMo or mobile banking transactions per month.' },
  { key: 'savings',             label: 'Current Savings (₵)',       type: 'number', placeholder: 'e.g. 500',   hint: 'Your current savings or emergency fund balance.' },
  { key: 'region',              label: 'Region (optional)',          type: 'select', options: REGIONS },
]

function ScoreRing({ score, band }) {
  const r    = 70
  const circ = 2 * Math.PI * r
  const pct  = (score - 300) / 550
  const off  = circ * (1 - pct)
  const color = BAND_COLORS[band]?.ring ?? '#818cf8'
  const labelCls = BAND_COLORS[band]?.label ?? 'text-indigo-400'
  return (
    <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
      <svg width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)', filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white leading-none">{score}</span>
        <span className={`text-sm font-bold mt-1 ${labelCls}`}>{band}</span>
        <span className="text-xs text-slate-500">out of 850</span>
      </div>
    </div>
  )
}

function FactorRow({ name, impact }) {
  const isPos = impact === '+'
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-800/60 last:border-0">
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isPos ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
        {isPos ? '▲' : '▼'}
      </span>
      <span className="text-sm text-slate-300">{name}</span>
    </div>
  )
}

export default function Dashboard() {
  const [step, setStep]             = useState(0)
  const [form, setForm]             = useState({
    income: '', employment_type: 'employed', expenses: '',
    rent_consistency: 0.8, mobile_transactions: '', savings: '', region: '',
  })
  const [result, setResult]         = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [explanation, setExplanation] = useState(null)
  const [explainLoading, setExplainLoading] = useState(false)
  const [messages, setMessages]     = useState([])
  const [chatInput, setChatInput]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [parseLoading, setParseLoading] = useState(false)
  const [parseError, setParseError] = useState('')
  const fileRef = useRef()
  const chatEndRef = useRef()

  const current = STEPS[step]

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function isStepValid() {
    const val = form[current.key]
    if (current.type === 'select' && current.key === 'region') return true
    if (current.type === 'slider') return true
    if (current.type === 'number') return val !== '' && !isNaN(Number(val)) && Number(val) >= 0
    if (current.type === 'select') return !!val
    return true
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const payload = {
        income:              Number(form.income),
        employment_type:     form.employment_type,
        expenses:            Number(form.expenses),
        rent_consistency:    Number(form.rent_consistency),
        mobile_transactions: Number(form.mobile_transactions),
        savings:             Number(form.savings),
        region:              form.region || undefined,
      }
      const data = await predictScore(payload)
      setResult(data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Something went wrong. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  async function handleExplain() {
    if (!result) return
    setExplainLoading(true)
    try {
      const payload = {
        income:              Number(form.income),
        employment_type:     form.employment_type,
        expenses:            Number(form.expenses),
        rent_consistency:    Number(form.rent_consistency),
        mobile_transactions: Number(form.mobile_transactions),
        savings:             Number(form.savings),
        region:              form.region || undefined,
      }
      const data = await explainScore(payload, result.score)
      setExplanation(data)
    } catch {}
    setExplainLoading(false)
  }

  async function handleChat(e) {
    e.preventDefault()
    if (!chatInput.trim() || !result) return
    const msg = chatInput.trim()
    setChatInput('')
    setMessages(m => [...m, { role: 'user', text: msg }])
    setChatLoading(true)
    try {
      const payload = {
        income:              Number(form.income),
        employment_type:     form.employment_type,
        expenses:            Number(form.expenses),
        rent_consistency:    Number(form.rent_consistency),
        mobile_transactions: Number(form.mobile_transactions),
        savings:             Number(form.savings),
        region:              form.region || undefined,
      }
      const data = await chatWithAI(msg, payload, result.score)
      setMessages(m => [...m, { role: 'ai', text: data.response }])
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Sorry, I could not process that. Please try again.' }])
    }
    setChatLoading(false)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function handleBankStatement(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseLoading(true)
    setParseError('')
    try {
      const data = await parseBankStatement(file)
      setForm(f => ({
        ...f,
        income:              String(Math.round(data.income)),
        expenses:            String(Math.round(data.expenses)),
        rent_consistency:    data.rent_consistency,
        mobile_transactions: String(data.mobile_transactions),
        savings:             String(Math.round(data.savings)),
        employment_type:     data.employment_type || f.employment_type,
      }))
      setStep(STEPS.length - 1)
    } catch (err) {
      setParseError(err?.response?.data?.detail || 'Could not parse the bank statement.')
    }
    setParseLoading(false)
    e.target.value = ''
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-slate-600'

  if (result) {
    const bandColor = BAND_COLORS[result.band]?.ring ?? '#818cf8'
    return (
      <div className="min-h-screen bg-[#0c0c18] text-white p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <a href="/" className="text-xl font-bold">Clear<span className="text-indigo-400">Score</span></a>
            <button onClick={() => { setResult(null); setStep(0); setMessages([]); setExplanation(null) }}
              className="text-sm text-slate-400 hover:text-white transition-colors">← Start over</button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col items-center gap-6">
            <ScoreRing score={result.score} band={result.band} />
            <div className="text-center">
              <p className="text-slate-400 text-sm">{result.model_prediction === 'healthy' ? 'Low credit risk' : 'High credit risk'} · {result.confidence}% confidence</p>
              <p className="text-xs text-slate-600 mt-1">This is not an official credit score.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {result.factors?.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Credit Factors</p>
                {result.factors.map((f, i) => <FactorRow key={i} name={f.name} impact={f.impact} />)}
              </div>
            )}
            {result.tips?.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Tips to Improve</p>
                <ul className="space-y-2">
                  {result.tips.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-300">
                      <span className="text-indigo-400 shrink-0">→</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">AI Explanation</p>
              {!explanation && (
                <button onClick={handleExplain} disabled={explainLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 transition-colors disabled:opacity-50">
                  {explainLoading ? 'Loading…' : 'Explain my score'}
                </button>
              )}
            </div>
            {explanation ? (
              <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
                <p>{explanation.explanation}</p>
              </div>
            ) : (
              <p className="text-slate-600 text-sm">Click "Explain my score" for a plain-English breakdown.</p>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Ask the AI Assistant</p>
            <div className="space-y-3 max-h-64 overflow-y-auto mb-3 pr-1">
              {messages.length === 0 && (
                <p className="text-slate-600 text-sm">Ask me anything about your score — e.g. "How can I improve it?" or "Will I qualify for a loan?"</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs rounded-xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-xl px-4 py-2.5 text-slate-400 text-sm">…</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleChat} className="flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                placeholder="Ask a question…"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 placeholder-slate-600" />
              <button type="submit" disabled={!chatInput.trim() || chatLoading}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-all">
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0c0c18] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <a href="/" className="text-xl font-bold">Clear<span className="text-indigo-400">Score</span></a>
          <span className="text-xs text-slate-500">Step {step + 1} of {STEPS.length}</span>
        </div>

        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-200">{current.label}</label>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleBankStatement} />
              {step === 0 && (
                <button onClick={() => fileRef.current?.click()} disabled={parseLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 transition-colors disabled:opacity-50">
                  {parseLoading ? 'Parsing…' : '📄 Import bank statement'}
                </button>
              )}
            </div>
          </div>

          {parseError && <p className="text-rose-400 text-xs">{parseError}</p>}

          {current.hint && <p className="text-slate-500 text-xs leading-relaxed">{current.hint}</p>}

          {current.type === 'number' && (
            <input type="number" min="0" step="any"
              value={form[current.key]}
              onChange={e => setField(current.key, e.target.value)}
              placeholder={current.placeholder}
              className={inputCls}
              autoFocus
            />
          )}

          {current.type === 'select' && (
            <select value={form[current.key]} onChange={e => setField(current.key, e.target.value)} className={inputCls}>
              {current.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}

          {current.type === 'slider' && (
            <div className="space-y-2">
              <input type="range" min={current.min} max={current.max} step={current.step}
                value={form[current.key]}
                onChange={e => setField(current.key, parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Never (0)</span>
                <span className="text-white font-bold text-sm">{(form[current.key] * 100).toFixed(0)}%</span>
                <span>Always (1)</span>
              </div>
            </div>
          )}

          {error && <p className="text-rose-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-sm font-semibold transition-all">
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!isStepValid()}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold transition-all">
                Continue
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
                {loading ? (
                  <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Calculating…</>
                ) : 'Get My Score'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
