import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

export async function predictScore(formData) {
  const { data } = await client.post('/predict', formData)
  return data
}

export async function explainScore(formData, score) {
  const { data } = await client.post('/explain', { ...formData, score })
  return data
}

export async function chatWithAI(message, formData, score) {
  const { data } = await client.post('/chat', { message, ...formData, score })
  return data
}

export async function getStats() {
  const { data } = await client.get('/stats')
  return data
}

export async function parseBankStatement(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post('/parse/bank-statement', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
  return data
}

export async function getMoMoAuthUrl(redirectUri) {
  const params = redirectUri ? { redirect_uri: redirectUri } : {}
  const { data } = await client.get('/momo/auth-url', { params })
  return data
}

export async function handleMoMoCallback(code, state) {
  const { data } = await client.post('/momo/callback', { code, state })
  return data
}

// ── Business / Company API ──────────────────────────────────────────────────────

function bearerHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

export async function businessLogin(email, password) {
  const { data } = await client.post('/business/login', { email, password })
  return data
}

export async function businessLogout(token) {
  await client.post('/business/logout', {}, { headers: bearerHeader(token) })
}

export async function businessMe(token) {
  const { data } = await client.get('/business/me', { headers: bearerHeader(token) })
  return data
}

export async function businessCheckCredit(file, clientRef, token) {
  const form = new FormData()
  form.append('file', file)
  if (clientRef) form.append('client_ref', clientRef)
  const { data } = await client.post('/business/check-credit', form, {
    headers: { ...bearerHeader(token), 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data
}

export async function businessHistory(token) {
  const { data } = await client.get('/business/history', { headers: bearerHeader(token) })
  return data
}

// ── Admin company management ────────────────────────────────────────────────────

function basicHeader(username, password) {
  return { Authorization: 'Basic ' + btoa(`${username}:${password}`) }
}

export async function adminCreateCompany(name, email, password, adminUser, adminPass) {
  const { data } = await client.post(
    '/admin/companies',
    { name, email, password },
    { headers: basicHeader(adminUser, adminPass) },
  )
  return data
}

export async function adminListCompanies(adminUser, adminPass) {
  const { data } = await client.get('/admin/companies', { headers: basicHeader(adminUser, adminPass) })
  return data
}
