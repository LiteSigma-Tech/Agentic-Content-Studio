import axios from 'axios'

const PLATFORM = import.meta.env.VITE_PLATFORM_URL || 'http://localhost:8005'
const GATEWAY  = import.meta.env.VITE_GATEWAY_URL  || 'http://localhost:8001'
const STUDIO   = import.meta.env.VITE_STUDIO_URL   || 'http://localhost:8002'
const LEADS    = import.meta.env.VITE_LEADS_URL    || 'http://localhost:8003'
const AGENTS   = import.meta.env.VITE_AGENTS_URL   || 'http://localhost:8004'

function makeClient(baseURL) {
  const client = axios.create({ baseURL })
  client.interceptors.request.use(cfg => {
    const token = localStorage.getItem('token')
    if (token) cfg.headers['Authorization'] = 'Bearer ' + token
    return cfg
  })
  client.interceptors.response.use(
    r => r,
    async err => {
      if (err.response?.status === 401 && !err.config._retry) {
        err.config._retry = true
        const refresh = localStorage.getItem('refresh_token')
        if (refresh) {
          try {
            const { data } = await axios.post(PLATFORM + '/v1/refresh', { refresh_token: refresh })
            localStorage.setItem('token', data.token)
            if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
            err.config.headers['Authorization'] = 'Bearer ' + data.token
            return client.request(err.config)
          } catch {
            localStorage.removeItem('token')
            localStorage.removeItem('refresh_token')
            window.location.href = '/'
          }
        }
      }
      return Promise.reject(err)
    }
  )
  return client
}

const platformApi = makeClient(PLATFORM)
const gatewayApi  = makeClient(GATEWAY)
const studioApi   = makeClient(STUDIO)
const leadsApi    = makeClient(LEADS)
const agentsApi   = makeClient(AGENTS)

export const auth = {
  login: (email, password) =>
    platformApi.post('/v1/login', { email, password }).then(r => {
      localStorage.setItem('token', r.data.token)
      if (r.data.refresh_token) localStorage.setItem('refresh_token', r.data.refresh_token)
      return r.data
    }),
  logout: () => {
    const refresh_token = localStorage.getItem('refresh_token')
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    return platformApi.post('/v1/logout', { refresh_token }).catch(() => {})
  },
  whoami: () => platformApi.get('/v1/whoami').then(r => r.data),
  isLoggedIn: () => !!localStorage.getItem('token'),
}

export const modelsApi = {
  getProviders: () => gatewayApi.get('/v1/providers').then(r => r.data).catch(() => ({ providers: [] })),
  getConfig: () => gatewayApi.get('/v1/config/routing').then(r => r.data).catch(() => null),
  updateConfig: cfg => gatewayApi.put('/v1/config/routing', cfg).then(r => r.data),
}

export const studioApiCalls = {
  listProjects: (limit = 10, offset = 0) =>
    studioApi.get('/v1/projects', { params: { limit, offset } }).then(r => r.data).catch(() => ({ items: [], total: 0 })),
  createProject: (concept, genre) =>
    studioApi.post('/v1/projects', { concept, genre }).then(r => r.data),
  runProject: (id, body = {}) =>
    studioApi.post('/v1/projects/' + id + '/run', body).then(r => r.data),
  getProject: id =>
    studioApi.get('/v1/projects/' + id).then(r => r.data),
  videoUrl: id => `${STUDIO}/v1/projects/${id}/video`,
}

export const leadsApiCalls = {
  list: (params = {}) =>
    leadsApi.get('/v1/leads', { params }).then(r => r.data).catch(() => ({ items: [], total: 0 })),
  source: (n = 20) => leadsApi.post('/v1/leads/source', { n }).then(r => r.data),
  qualify: () => leadsApi.post('/v1/leads/qualify').then(r => r.data),
  compliance: () => leadsApi.post('/v1/leads/compliance').then(r => r.data),
  propose: lead_id => leadsApi.post('/v1/outreach/propose', { lead_id }).then(r => r.data),
  unsubscribe: email => leadsApi.post('/v1/unsubscribe', { email }).then(r => r.data),
}

export const agentsApiCalls = {
  listRuns: (params = {}) =>
    agentsApi.get('/v1/runs', { params }).then(r => r.data).catch(() => ({ items: [], total: 0 })),
  getRun: id => agentsApi.get('/v1/runs/' + id).then(r => r.data),
  approve: (runId, note = '') =>
    agentsApi.post('/v1/runs/' + runId + '/approve', { approved: true, note }).then(r => r.data),
  reject: (runId, note = '') =>
    agentsApi.post('/v1/runs/' + runId + '/approve', { approved: false, note }).then(r => r.data),
}

export const usageApi = {
  get: () => platformApi.get('/v1/usage').then(r => r.data).catch(() => null),
}

export const adminApi = {
  listTenants: () => platformApi.get('/admin/tenants').then(r => r.data).catch(() => ({ tenants: [], total: 0 })),
  createTenant: (name, adminEmail, adminPassword, plan = 'free') =>
    platformApi.post('/admin/tenants', {
      name, admin_email: adminEmail, admin_password: adminPassword, plan,
    }).then(r => r.data),
}

export const webhooksApi = {
  list: () => agentsApi.get('/v1/webhooks').then(r => r.data).catch(() => ({ webhooks: [] })),
  register: (url, events, secret = '') =>
    agentsApi.post('/v1/webhooks', { url, events, secret }).then(r => r.data),
  remove: id => agentsApi.delete('/v1/webhooks/' + id).then(r => r.data),
}
