import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  username: string
  role: string
}

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      login: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'olt-auth',
    }
  )
)

// Mock data for demo mode
const MOCK_MODE = true // Set to true for demo without backend

const mockOLTs = [
  { id: 1, name: 'OLT-BKK-01', vendor: 'ZTE', model: 'C300', ip_address: '10.1.1.1', total_ports: 8, status: 'online', cpu: 25, memory: 38, temperature: 42, uptime: 86400 * 5 },
  { id: 2, name: 'OLT-BKK-02', vendor: 'Huawei', model: 'MA5800', ip_address: '10.1.2.1', total_ports: 16, status: 'online', cpu: 32, memory: 45, temperature: 38, uptime: 86400 * 3 },
  { id: 3, name: 'OLT-CNB-01', vendor: 'Fiberhome', model: 'AN5516', ip_address: '10.1.3.1', total_ports: 8, status: 'online', cpu: 18, memory: 28, temperature: 35, uptime: 86400 * 7 },
  { id: 4, name: 'OLT-RYG-01', vendor: 'ZTE', model: 'C300', ip_address: '10.1.4.1', total_ports: 8, status: 'online', cpu: 42, memory: 55, temperature: 48, uptime: 86400 * 2 },
  { id: 5, name: 'OLT-NRK-01', vendor: 'Huawei', model: 'MA5800', ip_address: '10.1.5.1', total_ports: 16, status: 'online', cpu: 22, memory: 35, temperature: 40, uptime: 86400 * 4 },
]

const mockOnus = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  olt_id: Math.floor(i / 10) + 1,
  pon_port_index: i % 8,
  serial_number: `ALCL${String(i).padStart(8, '0')}`,
  mac_address: `00:1A:2B:${String(Math.floor(i / 256)).padStart(2, '0')}:${String(i % 256).padStart(2, '0')}:00`,
  status: Math.random() > 0.05 ? 'online' : 'offline',
  current_signal_dbm: -18 - Math.random() * 12,
  tx_power: 1.5 + Math.random() * 2,
  distance: 1000 + Math.floor(Math.random() * 20000),
  vendor: 'ZTE',
  model: 'F660',
  subscriber_ref_id: `SUB${String(i).padStart(6, '0')}`,
  customer_name: `Customer ${i + 1}`,
  customer_phone: `08${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
  last_seen: new Date(Date.now() - Math.random() * 86400000).toISOString(),
}))

const mockAlarms = [
  { id: 1, severity: 'critical', message: 'ONU Loss of Signal - Multiple ONUs affected', resource_type: 'olt', resource_id: 'OLT-BKK-01', status: 'active', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 2, severity: 'critical', message: 'OLT Device Unreachable', resource_type: 'olt', resource_id: 'OLT-CNB-02', status: 'active', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 3, severity: 'major', message: 'High CPU Usage on OLT', resource_type: 'olt', resource_id: 'OLT-RYG-01', status: 'active', created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: 4, severity: 'major', message: 'PON Port Traffic Threshold Exceeded', resource_type: 'onu', resource_id: 'ALCL00000010', status: 'active', created_at: new Date(Date.now() - 900000).toISOString() },
  { id: 5, severity: 'minor', message: 'Temperature Warning', resource_type: 'olt', resource_id: 'OLT-BKK-02', status: 'acked', acked_by: 'admin', created_at: new Date(Date.now() - 10800000).toISOString() },
  { id: 6, severity: 'warning', message: 'Signal Degradation Detected', resource_type: 'onu', resource_id: 'ALCL00000025', status: 'active', created_at: new Date(Date.now() - 600000).toISOString() },
]

// API helper
const API_BASE = '/api'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (MOCK_MODE) {
    // Return mock data
    await new Promise(resolve => setTimeout(resolve, 300)) // Simulate network delay
    
    if (endpoint === '/login') {
      return { token: 'mock-jwt-token', user: { id: 1, username: 'admin', role: 'admin' } } as T
    }
    if (endpoint === '/stats/global') {
      return {
        total_olts: 5,
        total_onus: mockOnus.length,
        online_onus: mockOnus.filter(o => o.status === 'online').length,
        offline_onus: mockOnus.filter(o => o.status === 'offline').length,
        critical_alarms: mockAlarms.filter(a => a.severity === 'critical' && a.status === 'active').length,
        major_alarms: mockAlarms.filter(a => a.severity === 'major' && a.status === 'active').length,
        minor_alarms: mockAlarms.filter(a => a.severity === 'minor' && a.status === 'active').length,
        warning_alarms: mockAlarms.filter(a => a.severity === 'warning' && a.status === 'active').length,
      } as T
    }
    if (endpoint === '/olts') {
      return mockOLTs as T
    }
    if (endpoint.startsWith('/olts/')) {
      const id = endpoint.split('/')[2]
      const olt = mockOLTs.find(o => o.id === parseInt(id))
      if (olt) {
        const ports = Array.from({ length: olt.total_ports }, (_, i) => ({
          index: i,
          total_onus: 32 + Math.floor(Math.random() * 32),
          online_onus: 28 + Math.floor(Math.random() * 32),
          avg_signal: -20 - Math.random() * 5,
          traffic_util: 40 + Math.random() * 40,
        }))
        return { olt, ports } as T
      }
    }
    if (endpoint === '/onus' || endpoint.startsWith('/onus?')) {
      let result = [...mockOnus]
      const params = new URLSearchParams(endpoint.split('?')[1] || '')
      if (params.get('status')) {
        result = result.filter(o => o.status === params.get('status'))
      }
      if (params.get('search')) {
        const search = params.get('search')!.toLowerCase()
        result = result.filter(o => 
          o.serial_number.toLowerCase().includes(search) ||
          o.customer_name.toLowerCase().includes(search) ||
          o.subscriber_ref_id.toLowerCase().includes(search)
        )
      }
      return result.slice(0, 50) as T
    }
    if (endpoint.startsWith('/onus/') && endpoint.includes('/reboot')) {
      return { message: 'ONU reboot initiated' } as T
    }
    if (endpoint === '/alarms' || endpoint.startsWith('/alarms?')) {
      let result = [...mockAlarms]
      const params = new URLSearchParams(endpoint.split('?')[1] || '')
      if (params.get('status')) {
        result = result.filter(a => a.status === params.get('status'))
      }
      if (params.get('severity')) {
        result = result.filter(a => a.severity === params.get('severity'))
      }
      return result as T
    }
    if (endpoint.includes('/acknowledge')) {
      const id = endpoint.split('/')[2]
      const alarm = mockAlarms.find(a => a.id === parseInt(id))
      if (alarm) {
        alarm.status = 'acked'
        alarm.acked_by = 'admin'
        alarm.acked_at = new Date().toISOString()
      }
      return { message: 'Alarm acknowledged' } as T
    }
    throw new Error('Unknown endpoint')
  }
  
  const token = useAuthStore.getState().token
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }
  
  return res.json()
}

export const api = {
  // Auth
  login: (username: string, password: string) => 
    fetchApi<{ token: string; user: User }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // Dashboard
  getStats: () => fetchApi<{
    total_olts: number
    total_onus: number
    online_onus: number
    offline_onus: number
    critical_alarms: number
    major_alarms: number
    minor_alarms: number
    warning_alarms: number
  }>('/stats/global'),

  // OLTs
  getOLTs: () => fetchApi<any[]>('/olts'),
  getOLTById: (id: string) => fetchApi<{ olt: any; ports: any[] }>(`/olts/${id}`),

  // ONUs
  getONUs: (params?: { olt_id?: string; status?: string; search?: string }) => {
    const query = new URLSearchParams(params as any).toString()
    return fetchApi<any[]>(`/onus${query ? `?${query}` : ''}`)
  },
  getONUBySerial: (serial: string) => fetchApi<any>(`/onus/${serial}`),
  rebootONU: (serial: string) => 
    fetchApi<{ message: string }>(`/onus/${serial}/reboot`, { method: 'POST' }),
  getSignalHistory: (serial: string, hours?: string) => {
    const query = new URLSearchParams({ serial, hours: hours || '24' }).toString()
    return fetchApi<any[]>(`/onus/${serial}/signal-history?${query}`)
  },

  // Alarms
  getAlarms: (params?: { status?: string; severity?: string }) => {
    const query = new URLSearchParams(params as any).toString()
    return fetchApi<any[]>(`/alarms${query ? `?${query}` : ''}`)
  },
  acknowledgeAlarm: (id: string) => 
    fetchApi<{ message: string }>(`/alarms/${id}/acknowledge`, { method: 'POST' }),
}
