import { useState, useEffect, useRef, useCallback } from 'react'

const API = '/api'

const SCHEMA = [
  { col: 'loan_size',        type: 'float',   range: '5000 – 23800',   example: '10700.0', desc: 'Total loan amount requested' },
  { col: 'interest_rate',    type: 'float',   range: '5.25 – 13.24',   example: '7.672',   desc: 'Annual interest rate offered on the loan (%)' },
  { col: 'borrower_income',  type: 'integer', range: '30000 – 105200', example: '52800',   desc: "Borrower's annual income" },
  { col: 'debt_to_income',   type: 'float',   range: '0.00 – 0.71',    example: '0.4318',  desc: 'Total monthly debt payments ÷ monthly income' },
  { col: 'num_of_accounts',  type: 'integer', range: '0 – 16',         example: '5',       desc: 'Number of active credit/financial accounts' },
  { col: 'derogatory_marks', type: 'integer', range: '0 – 3',          example: '1',       desc: 'Count of missed payments, defaults, or negative marks' },
  { col: 'total_debt',       type: 'float',   range: '0 – 75200',      example: '22800',   desc: 'Total outstanding debt amount' },
  { col: 'loan_status',      type: 'integer', range: '0 or 1',         example: '0',       desc: '0 = healthy loan · 1 = high-risk loan (label)' },
]

const EXAMPLE_CSV = `loan_size,interest_rate,borrower_income,debt_to_income,num_of_accounts,derogatory_marks,total_debt,loan_status
10700.0,7.672,52800,0.431818,5,1,22800,0
8400.0,6.692,43600,0.311927,3,0,13600,0
19600.0,11.089,64900,0.562403,11,2,36500,1
17100.0,10.210,75800,0.540898,9,2,46800,1
9000.0,6.963,46100,0.349241,3,0,16100,0`

function makeAuthHeader(username, password) {
  return 'Basic ' + btoa(`${username}:${password}`)
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Badge({ color, children }) {
  const cls = {
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    blue:  'bg-blue-500/15    text-blue-400    border-blue-500/30',
    amber: 'bg-amber-500/15   text-amber-400   border-amber-500/30',
    slate: 'bg-slate-500/15   text-slate-400   border-slate-500/30',
  }[color] ?? 'bg-slate-500/15 text-slate-400'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono border ${cls}`}>
      {children}
    </span>
  )
}

// ── Login screen ───────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/admin/model-info`, {
        headers: { Authorization: makeAuthHeader(username, password) },
      })
      if (res.status === 401) {
        setError('Incorrect username or password.')
      } else if (res.ok) {
        // Store in sessionStorage so page refresh requires re-login
        sessionStorage.setItem('admin_user', username)
        sessionStorage.setItem('admin_pass', password)
        onLogin(username, password)
      } else {
        setError('Unexpected error — is the backend running?')
      }
    } catch {
      setError('Could not reach the backend API.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-slate-600'

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">
            Clear<span className="text-indigo-400">Score</span>
          </h1>
          <div className="inline-block mt-2 text-xs font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full">
            Admin Login
          </div>
          <p className="text-slate-500 text-sm mt-3">Sign in with your superadmin credentials.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className={inputCls}
              placeholder="superadmin"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••••••"
            />
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying…
              </span>
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Companies section ───────────────────────────────────────────────────────────

function CompaniesSection({ authHeader, onLogout }) {
  const [companies, setCompanies]   = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [creating, setCreating]     = useState(false)
  const [createErr, setCreateErr]   = useState('')
  const [createOk, setCreateOk]     = useState('')

  const inputCls = 'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-slate-600'

  useEffect(() => { loadCompanies() }, [])

  async function loadCompanies() {
    setListLoading(true)
    try {
      const res = await fetch(`${API}/admin/companies`, { headers: { Authorization: authHeader } })
      if (res.status === 401) { onLogout(); return }
      const data = await res.json()
      setCompanies(data.companies || [])
    } catch {
      setCompanies([])
    } finally {
      setListLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!name || !email || !password) return
    setCreating(true)
    setCreateErr('')
    setCreateOk('')
    try {
      const res = await fetch(`${API}/admin/companies`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      if (res.status === 401) { onLogout(); return }
      const data = await res.json()
      if (!res.ok) {
        setCreateErr(data.detail || 'Failed to create company.')
      } else {
        setCreateOk(`Company "${data.name}" created successfully.`)
        setName(''); setEmail(''); setPassword('')
        loadCompanies()
      }
    } catch {
      setCreateErr('Could not reach the backend API.')
    } finally {
      setCreating(false)
    }
  }

  function formatDate(ts) {
    if (!ts) return '—'
    try { return new Date(ts + 'Z').toLocaleDateString() } catch { return ts.slice(0, 10) }
  }

  return (
    <section>
      <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Company Accounts</h2>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Create form */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-200 mb-4">Add new company</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Company name" className={`${inputCls} w-full`}
            />
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email address" className={`${inputCls} w-full`}
            />
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Set a password" className={`${inputCls} w-full`}
            />
            {createErr && <p className="text-rose-400 text-xs">{createErr}</p>}
            {createOk  && <p className="text-emerald-400 text-xs">{createOk}</p>}
            <button
              type="submit"
              disabled={creating || !name || !email || !password}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all"
            >
              {creating ? 'Creating…' : 'Create Account'}
            </button>
          </form>
          <p className="text-xs text-slate-600 mt-3">
            The company will log in at <span className="text-slate-500 font-mono">/business</span> with their email and this password.
          </p>
        </div>

        {/* Company list */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-200 mb-4">
            Registered companies{' '}
            <span className="text-slate-500 font-normal">({companies.length})</span>
          </p>
          {listLoading ? (
            <p className="text-slate-500 text-sm">Loading…</p>
          ) : companies.length === 0 ? (
            <p className="text-slate-600 text-sm">No companies yet.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {companies.map(c => (
                <li key={c.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm text-white font-semibold">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.email}</p>
                  </div>
                  <p className="text-xs text-slate-600">{formatDate(c.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </section>
  )
}


// ── Admin panel ────────────────────────────────────────────────────────────────

function AdminPanel({ username, password, onLogout }) {
  const authHeader = makeAuthHeader(username, password)
  const [modelInfo, setModelInfo]     = useState(null)
  const [infoLoading, setInfoLoading] = useState(true)
  const [file, setFile]               = useState(null)
  const [dragging, setDragging]       = useState(false)
  const [training, setTraining]       = useState(false)
  const [result, setResult]           = useState(null)
  const [error, setError]             = useState(null)
  const fileRef = useRef()

  useEffect(() => { fetchModelInfo() }, [])

  async function fetchModelInfo() {
    setInfoLoading(true)
    try {
      const res  = await fetch(`${API}/admin/model-info`, { headers: { Authorization: authHeader } })
      if (res.status === 401) { onLogout(); return }
      setModelInfo(await res.json())
    } catch {
      setModelInfo(null)
    } finally {
      setInfoLoading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.csv')) setFile(f)
  }

  async function handleRetrain() {
    if (!file) return
    setTraining(true)
    setResult(null)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch(`${API}/admin/retrain`, {
        method: 'POST',
        headers: { Authorization: authHeader },
        body: form,
      })
      if (res.status === 401) { onLogout(); return }
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'Training failed.')
      } else {
        setResult(data)
        setFile(null)
        fetchModelInfo()
      }
    } catch {
      setError('Could not reach the backend API.')
    } finally {
      setTraining(false)
    }
  }

  function downloadExample() {
    const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv' })
    const a    = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: 'clearscore_training_example.csv'
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Clear<span className="text-indigo-400">Score</span>
              <span className="ml-3 text-sm font-normal bg-rose-600/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                Admin Panel
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Signed in as <span className="text-white font-semibold">{username}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors">← Back to app</a>
            <button
              onClick={onLogout}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Current model stats */}
        <section>
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Current Model</h2>
          {infoLoading ? (
            <p className="text-slate-500 text-sm">Loading model info…</p>
          ) : modelInfo ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <StatCard label="Accuracy"          value={`${modelInfo.accuracy}%`}           sub="hold-out test set" />
                <StatCard label="Training rows"     value={modelInfo.total_samples?.toLocaleString()} sub={`${modelInfo.healthy_samples} healthy · ${modelInfo.risky_samples} risky`} />
                <StatCard label="Healthy precision" value={`${modelInfo.precision_healthy}%`} sub={`recall ${modelInfo.recall_healthy}%`} />
                <StatCard label="Risky precision"   value={`${modelInfo.precision_risky}%`}   sub={`recall ${modelInfo.recall_risky}%`} />
              </div>
              <p className="text-xs text-slate-500">
                Last trained: <span className="text-slate-400">{modelInfo.trained_at}</span>
              </p>
            </>
          ) : (
            <p className="text-rose-400 text-sm">Could not load model info.</p>
          )}
        </section>

        <div className="border-t border-slate-800" />

        {/* Data format */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">CSV Data Format</h2>
            <button
              onClick={downloadExample}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download example CSV
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">
              Your CSV must have a <strong className="text-slate-200">header row</strong> with exactly these{' '}
              <strong className="text-slate-200">8 columns</strong> (column order doesn't matter, but names must match exactly).
              Each row is one historical loan record.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Column', 'Type', 'Valid range', 'Example', 'Description'].map(h => (
                      <th key={h} className="text-left py-2 pr-4 text-slate-400 font-semibold last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {SCHEMA.map(row => (
                    <tr key={row.col}>
                      <td className="py-2.5 pr-4">
                        <Badge color={row.col === 'loan_status' ? 'amber' : 'blue'}>{row.col}</Badge>
                      </td>
                      <td className="py-2.5 pr-4"><Badge color="slate">{row.type}</Badge></td>
                      <td className="py-2.5 pr-4 text-slate-400">{row.range}</td>
                      <td className="py-2.5 pr-4 font-mono text-emerald-400">{row.example}</td>
                      <td className="py-2.5 text-slate-400">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-4 py-3 space-y-1.5">
              <p className="text-amber-300 text-xs font-semibold">Rules</p>
              <ul className="text-amber-200/70 text-xs space-y-1 list-disc list-inside">
                <li><code className="bg-amber-900/30 px-1 rounded">loan_status</code> must be <strong className="text-amber-200">0</strong> (healthy) or <strong className="text-amber-200">1</strong> (high-risk) only.</li>
                <li>File must contain <strong className="text-amber-200">at least one row of each class</strong>.</li>
                <li>New rows are <strong className="text-amber-200">appended</strong> to existing training data — the model grows over time.</li>
                <li>Duplicate rows are automatically removed before retraining.</li>
              </ul>
            </div>

            <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-lg px-4 py-3 space-y-1.5">
              <p className="text-indigo-300 text-xs font-semibold">How many rows do you need?</p>
              <ul className="text-indigo-200/70 text-xs space-y-1.5 list-disc list-inside">
                <li><strong className="text-indigo-200">Minimum (functional):</strong> 50 rows — enough to pass validation and trigger a retrain, but accuracy impact will be negligible against the existing 77k rows.</li>
                <li><strong className="text-indigo-200">Recommended (noticeable shift):</strong> 500 – 2,000 rows with a roughly balanced split (e.g. 70% healthy, 30% high-risk) to meaningfully influence the model's decision boundary.</li>
                <li><strong className="text-indigo-200">High impact:</strong> 5,000+ rows — at this scale you will see measurable changes in accuracy, precision, and recall reported after retraining.</li>
                <li>Keep classes <strong className="text-indigo-200">balanced</strong>: if your upload is more than 90% one class, the model may become biased toward that class.</li>
              </ul>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-2">Example file preview:</p>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-emerald-300 overflow-x-auto leading-relaxed font-mono">
                {EXAMPLE_CSV}
              </pre>
            </div>
          </div>
        </section>

        <div className="border-t border-slate-800" />

        {/* Company accounts */}
        <CompaniesSection authHeader={authHeader} onLogout={onLogout} />

        <div className="border-t border-slate-800" />

        {/* Upload & retrain */}
        <section>
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Upload & Retrain</h2>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${dragging  ? 'border-indigo-400 bg-indigo-500/10'
              : file      ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'}`}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={e => setFile(e.target.files[0] ?? null)} />
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
                <p className="text-slate-300 font-medium text-sm">Drop your CSV here or click to browse</p>
                <p className="text-slate-500 text-xs mt-1">Only .csv files accepted</p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
              <p className="text-rose-400 text-sm font-semibold mb-1">Training failed</p>
              <p className="text-rose-300/80 text-xs">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-4">
              <p className="text-emerald-400 font-semibold text-sm mb-3">Model retrained successfully</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-white">{result.new_rows_added}</p>
                  <p className="text-xs text-slate-400 mt-0.5">New rows added</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{result.total_samples?.toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Total training rows</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-400">{result.accuracy}%</p>
                  <p className="text-xs text-slate-400 mt-0.5">New accuracy</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">Trained at: {result.trained_at}</p>
            </div>
          )}

          <button
            onClick={handleRetrain}
            disabled={!file || training}
            className="mt-4 w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/20"
          >
            {training ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Retraining model…
              </span>
            ) : 'Retrain Model'}
          </button>
          <p className="text-xs text-slate-500 text-center mt-2">
            The model retrains from scratch on the combined dataset. Existing predictions continue to work during training.
          </p>
        </section>

      </div>
    </div>
  )
}

// ── Root component: gate login ─────────────────────────────────────────────────

export default function Admin() {
  const [creds, setCreds] = useState(() => {
    const u = sessionStorage.getItem('admin_user')
    const p = sessionStorage.getItem('admin_pass')
    return u && p ? { username: u, password: p } : null
  })

  function handleLogin(username, password) {
    setCreds({ username, password })
  }

  function handleLogout() {
    sessionStorage.removeItem('admin_user')
    sessionStorage.removeItem('admin_pass')
    setCreds(null)
  }

  if (!creds) return <LoginScreen onLogin={handleLogin} />
  return <AdminPanel username={creds.username} password={creds.password} onLogout={handleLogout} />
}
