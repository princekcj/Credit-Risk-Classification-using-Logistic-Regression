import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { businessCheckCredit, businessHistory, businessLogout } from '../api'

const BAND_STYLE = {
  Excellent: { ring: 'ring-emerald-500',   text: 'text-emerald-400',  bg: 'bg-emerald-500/10',  label: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  Good:      { ring: 'ring-blue-400',      text: 'text-blue-400',     bg: 'bg-blue-500/10',     label: 'bg-blue-500/20    text-blue-300    border-blue-500/40'    },
  Fair:      { ring: 'ring-amber-400',     text: 'text-amber-400',    bg: 'bg-amber-500/10',    label: 'bg-amber-500/20   text-amber-300   border-amber-500/40'   },
  Poor:      { ring: 'ring-rose-500',      text: 'text-rose-400',     bg: 'bg-rose-500/10',     label: 'bg-rose-500/20    text-rose-300    border-rose-500/40'    },
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function BandBadge({ band }) {
  const s = BAND_STYLE[band] ?? BAND_STYLE.Poor
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.label}`}>
      {band}
    </span>
  )
}

function ScoreRing({ score, band }) {
  const s    = BAND_STYLE[band] ?? BAND_STYLE.Poor
  const pct  = ((score - 300) / 550) * 100
  const r    = 52
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <div className="flex flex-col items-center">
      <div className={`relative inline-flex items-center justify-center rounded-full ring-4 ${s.ring}/40 p-1`}>
        <svg width="136" height="136" className="-rotate-90">
          <circle cx="68" cy="68" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle
            cx="68" cy="68" r={r} fill="none"
            stroke="currentColor" strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            className={s.text}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute text-center">
          <p className={`text-3xl font-black ${s.text}`}>{score}</p>
          <p className="text-xs text-slate-500 mt-0.5">/ 850</p>
        </div>
      </div>
      <BandBadge band={band} />
    </div>
  )
}

function FactorRow({ name, impact }) {
  const isPos = impact === '+'
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-sm text-slate-300">{name}</span>
      <span className={`text-xs font-bold px-2 py-0.5 rounded ${isPos ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
        {isPos ? '▲ Positive' : '▼ Negative'}
      </span>
    </div>
  )
}

export default function CompanyDashboard() {
  const navigate  = useNavigate()
  const fileRef   = useRef()
  const token     = localStorage.getItem('cs_biz_token')
  const compName  = localStorage.getItem('cs_biz_name') || 'Company'

  const [file, setFile]           = useState(null)
  const [clientRef, setClientRef] = useState('')
  const [dragging, setDragging]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)
  const [history, setHistory]     = useState([])
  const [histLoading, setHistLoading] = useState(true)

  useEffect(() => {
    if (!token) { navigate('/business'); return }
    loadHistory()
  }, [])

  async function loadHistory() {
    setHistLoading(true)
    try {
      const h = await businessHistory(token)
      setHistory(h.checks || [])
    } catch (err) {
      if (err?.response?.status === 401) handleLogout()
    } finally {
      setHistLoading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.toLowerCase().endsWith('.csv')) {
      setFile(f)
      setResult(null)
      setError(null)
    }
  }

  async function handleCheck() {
    if (!file) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const data = await businessCheckCredit(file, clientRef, token)
      setResult(data)
      setFile(null)
      setClientRef('')
      loadHistory()
    } catch (err) {
      if (err?.response?.status === 401) { handleLogout(); return }
      setError(err?.response?.data?.detail || 'Could not process the statement. Check the file format.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    try { await businessLogout(token) } catch {}
    localStorage.removeItem('cs_biz_token')
    localStorage.removeItem('cs_biz_name')
    localStorage.removeItem('cs_biz_email')
    navigate('/business')
  }

  function formatDate(ts) {
    if (!ts) return '—'
    try {
      return new Date(ts + 'Z').toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch { return ts.slice(0, 16).replace('T', ' ') }
  }

  const s = result ? (BAND_STYLE[result.band] ?? BAND_STYLE.Poor) : null

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">

      {/* Top bar */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-xl font-bold text-white">
              Clear<span className="text-indigo-400">Score</span>
            </a>
            <span className="text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
              Business
            </span>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-400">
              <span className="text-white font-semibold">{compName}</span>
            </p>
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Upload section */}
        <section>
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-1">
            Client Credit Check
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            Upload a client's bank statement CSV (last 3 months) — we'll analyse it and return a credit score instantly.
          </p>

          {/* Client reference field */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Client Reference <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <input
              type="text"
              value={clientRef}
              onChange={e => setClientRef(e.target.value)}
              placeholder="e.g. CUST-00123 or client name"
              className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 placeholder-slate-600 transition-all"
            />
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${dragging ? 'border-indigo-400 bg-indigo-500/10'
              : file    ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'}`}
          >
            <input
              ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={e => { setFile(e.target.files[0] ?? null); setResult(null); setError(null) }}
            />
            {file ? (
              <>
                <div className="w-10 h-10 mx-auto mb-3 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-emerald-400 font-semibold text-sm">{file.name}</p>
                <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 mx-auto mb-3 bg-slate-700/50 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-slate-300 font-medium text-sm">Drop a bank statement CSV here or click to browse</p>
                <p className="text-slate-500 text-xs mt-1">Supports GCB, Ecobank, Stanbic, Standard Chartered, Fidelity, and generic CSV exports</p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
              <p className="text-rose-400 text-sm font-semibold mb-0.5">Could not process statement</p>
              <p className="text-rose-300/80 text-xs">{error}</p>
            </div>
          )}

          <button
            onClick={handleCheck}
            disabled={!file || loading}
            className="mt-4 w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            {loading ? <><Spinner /> Analysing statement…</> : 'Get Credit Score'}
          </button>
        </section>

        {/* Result */}
        {result && (
          <section className={`border ${s.ring}/30 rounded-2xl p-6 ${s.bg} space-y-5`}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <ScoreRing score={result.score} band={result.band} />

              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Credit Score Result</p>
                  <p className={`text-4xl font-black mt-1 ${s.text}`}>{result.score}</p>
                  <p className="text-slate-400 text-sm mt-0.5">
                    {result.band} · {result.model_prediction === 'healthy' ? 'Low credit risk' : 'High credit risk'}
                    {' '}·{' '}{result.confidence}% confidence
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 justify-center sm:justify-start text-xs text-slate-400">
                  <span>📅 {result.months_analysed} month{result.months_analysed !== 1 ? 's' : ''} analysed</span>
                  <span>🏦 {result.bank_layout}</span>
                  <span>📈 Income: ₵{result.income?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo</span>
                  <span>📉 Expenses: ₵{result.expenses?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo</span>
                </div>

                {result.warnings?.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-amber-300 text-xs">⚠ {w}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {result.factors?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Credit Factors</p>
                  <div className="bg-slate-900/50 rounded-xl px-4 py-2">
                    {result.factors.map((f, i) => <FactorRow key={i} name={f.name} impact={f.impact} />)}
                  </div>
                </div>
              )}

              {result.tips?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Recommendations</p>
                  <ul className="space-y-2">
                    {result.tips.map((t, i) => (
                      <li key={i} className="bg-slate-900/50 rounded-xl px-4 py-3 text-sm text-slate-300 flex gap-2">
                        <span className="text-indigo-400 shrink-0">→</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="border-t border-slate-800" />

        {/* History */}
        <section>
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Check History</h2>

          {histLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Spinner /> Loading…</div>
          ) : history.length === 0 ? (
            <p className="text-slate-600 text-sm">No checks yet. Upload a bank statement above to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    {['Client Ref', 'Score', 'Band', 'Months', 'Date'].map(h => (
                      <th key={h} className="py-2 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wide last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {history.map(row => {
                    const bs = BAND_STYLE[row.band] ?? BAND_STYLE.Poor
                    return (
                      <tr key={row.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 pr-4 text-slate-300 font-mono text-xs">{row.client_ref || <span className="text-slate-600">—</span>}</td>
                        <td className={`py-3 pr-4 font-bold ${bs.text}`}>{row.score}</td>
                        <td className="py-3 pr-4"><BandBadge band={row.band} /></td>
                        <td className="py-3 pr-4 text-slate-400">{row.months ?? '—'}</td>
                        <td className="py-3 text-slate-500 text-xs">{formatDate(row.timestamp)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
