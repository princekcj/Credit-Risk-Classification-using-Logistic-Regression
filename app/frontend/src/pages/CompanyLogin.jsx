import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { businessLogin } from '../api'

export default function CompanyLogin() {
  const navigate = useNavigate()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      const result = await businessLogin(email, password)
      localStorage.setItem('cs_biz_token', result.token)
      localStorage.setItem('cs_biz_name', result.name)
      localStorage.setItem('cs_biz_email', result.email)
      navigate('/business/dashboard')
    } catch (err) {
      const msg = err?.response?.data?.detail
      setError(msg || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm ' +
    'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 ' +
    'transition-all placeholder-slate-600'

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <a href="/" className="text-2xl font-bold text-white">
            Clear<span className="text-indigo-400">Score</span>
          </a>
          <div className="inline-block mt-2 ml-2 text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full">
            Business Portal
          </div>
          <p className="text-slate-500 text-sm mt-3">
            Sign in to check your clients' creditworthiness.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Company Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputCls}
              placeholder="company@example.com"
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
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          Don't have an account?{' '}
          <span className="text-slate-500">Contact your ClearScore administrator.</span>
        </p>
      </div>
    </div>
  )
}
