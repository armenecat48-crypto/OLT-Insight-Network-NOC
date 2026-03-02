import { useState, useEffect } from 'react'
import { 
  LayoutDashboard, 
  Server, 
  Users, 
  AlertTriangle, 
  Activity, 
  FileText, 
  Settings,
  Search,
  LogOut,
  RefreshCw,
  Power,
  ChevronRight,
  Signal,
  Wifi,
  WifiOff,
  Cpu,
  Thermometer
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { api, useAuthStore } from '@/store/auth'
import { formatUptime, formatSignalQuality, cn } from '@/lib/utils'

type Page = 'dashboard' | 'olts' | 'onus' | 'alarms' | 'analytics' | 'reports'

// Login Page
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const { token, user } = await api.login(username, password)
      useAuthStore.getState().login(token, user)
      onLogin()
    } catch (err: any) {
      setError(err.message || 'Login failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <Server className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">OLT Insight</CardTitle>
          <p className="text-sm text-muted-foreground">Network Operations Center</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Input 
                placeholder="Username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <Input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <Button className="w-full" onClick={handleLogin} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Demo: admin / admin123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Sidebar
function Sidebar({ currentPage, onNavigate }: { currentPage: Page; onNavigate: (page: Page) => void }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'olts', label: 'OLT Devices', icon: Server },
    { id: 'onus', label: 'Subscribers', icon: Users },
    { id: 'alarms', label: 'Alarms', icon: AlertTriangle },
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'reports', label: 'Reports', icon: FileText },
  ]

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Server className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold">OLT Insight</h1>
            <p className="text-xs text-muted-foreground">Network NOC</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as Page)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              currentPage === item.id 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start"
          onClick={() => useAuthStore.getState().logout()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  )
}

// Dashboard Page
function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      const data = await api.getStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

  const statCards = [
    { 
      title: 'Total ONUs', 
      value: stats?.total_onus?.toLocaleString() || '0', 
      icon: Wifi,
      color: 'text-blue-500',
      bg: 'bg-blue-500/20'
    },
    { 
      title: 'Online', 
      value: stats?.online_onus?.toLocaleString() || '0', 
      icon: Wifi,
      color: 'text-green-500',
      bg: 'bg-green-500/20'
    },
    { 
      title: 'Offline', 
      value: stats?.offline_onus?.toLocaleString() || '0', 
      icon: WifiOff,
      color: 'text-red-500',
      bg: 'bg-red-500/20'
    },
    { 
      title: 'Total OLTs', 
      value: stats?.total_olts || '0', 
      icon: Server,
      color: 'text-purple-500',
      bg: 'bg-purple-500/20'
    },
  ]

  const alarmCards = [
    { title: 'Critical', value: stats?.critical_alarms || 0, color: 'text-red-500', bg: 'bg-red-500/20' },
    { title: 'Major', value: stats?.major_alarms || 0, color: 'text-orange-500', bg: 'bg-orange-500/20' },
    { title: 'Minor', value: stats?.minor_alarms || 0, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
    { title: 'Warning', value: stats?.warning_alarms || 0, color: 'text-blue-500', bg: 'bg-blue-500/20' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={loadStats}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={cn("p-3 rounded-lg", stat.bg)}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alarm Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Active Alarms</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {alarmCards.map((alarm, i) => (
            <Card key={i} className="bg-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{alarm.title}</p>
                    <p className={cn("text-3xl font-bold mt-1", alarm.color)}>{alarm.value}</p>
                  </div>
                  <div className={cn("p-3 rounded-lg", alarm.bg)}>
                    <AlertTriangle className={cn("h-6 w-6", alarm.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cpu className="h-5 w-5 text-muted-foreground" />
                  <span>Average CPU Usage</span>
                </div>
                <Badge variant="success">32%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  <span>Memory Usage</span>
                </div>
                <Badge variant="success">48%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Thermometer className="h-5 w-5 text-muted-foreground" />
                  <span>Avg Temperature</span>
                </div>
                <Badge variant="warning">42°C</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">PON Port Utilization</span>
                <span className="font-semibold">67%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Average Signal (dBm)</span>
                <span className="font-semibold text-green-500">-21.3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Uplink Utilization</span>
                <span className="font-semibold">45%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active Sessions</span>
                <span className="font-semibold">124,567</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// OLTs Page
function OLTsPage({ onSelectOLT }: { onSelectOLT: (id: string) => void }) {
  const [olts, setOlts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOLTs()
  }, [])

  const loadOLTs = async () => {
    try {
      const data = await api.getOLTs()
      setOlts(data)
    } catch (err) {
      console.error('Failed to load OLTs:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">OLT Devices</h1>
        <Button variant="outline" size="sm" onClick={loadOLTs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {olts.map((olt) => (
          <Card 
            key={olt.id} 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onSelectOLT(String(olt.id))}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{olt.name}</CardTitle>
                <Badge variant={olt.status === 'online' ? 'success' : 'destructive'}>
                  {olt.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vendor</span>
                  <span className="font-medium">{olt.vendor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium font-mono">{olt.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IP Address</span>
                  <span className="font-medium font-mono">{olt.ip_address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ports</span>
                  <span className="font-medium">{olt.total_ports}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-medium">{formatUptime(olt.uptime)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">CPU</p>
                    <p className="font-semibold">{olt.cpu?.toFixed(0)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Memory</p>
                    <p className="font-semibold">{olt.memory?.toFixed(0)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Temp</p>
                    <p className="font-semibold">{olt.temperature?.toFixed(0)}°C</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// OLT Detail Page
function OLTDetailPage({ oltId, onBack }: { oltId: string; onBack: () => void }) {
  const [data, setData] = useState<{ olt: any; ports: any[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOLTDetail()
  }, [oltId])

  const loadOLTDetail = async () => {
    try {
      const result = await api.getOLTById(oltId)
      setData(result)
    } catch (err) {
      console.error('Failed to load OLT detail:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!data) return <div className="p-8 text-center text-muted-foreground">OLT not found</div>

  const { olt, ports } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronRight className="h-4 w-4 rotate-180" />
        </Button>
        <h1 className="text-3xl font-bold">{olt.name}</h1>
        <Badge variant={olt.status === 'online' ? 'success' : 'destructive'}>
          {olt.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Info Cards */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Device Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium">{olt.vendor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium">{olt.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IP Address</span>
                <span className="font-medium font-mono">{olt.ip_address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uptime</span>
                <span className="font-medium">{formatUptime(olt.uptime)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">CPU</span>
                  <span className="font-medium">{olt.cpu?.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${olt.cpu}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Memory</span>
                  <span className="font-medium">{olt.memory?.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500" style={{ width: `${olt.memory}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Temperature</span>
                  <span className="font-medium">{olt.temperature?.toFixed(1)}°C</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: `${(olt.temperature / 80) * 100}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PON Port Grid */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>PON Ports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {ports.map((port, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all cursor-pointer hover:scale-105",
                      port.online_onus > 0 
                        ? "border-green-500/50 bg-green-500/10" 
                        : "border-border bg-secondary"
                    )}
                  >
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">PON {port.index}</p>
                      <p className="text-2xl font-bold mt-1">{port.online_onus}/{port.total_onus}</p>
                      <p className="text-xs text-muted-foreground">ONUs</p>
                      {port.avg_signal && (
                        <p className={cn(
                          "text-xs font-semibold mt-2",
                          formatSignalQuality(port.avg_signal).color
                        )}>
                          {port.avg_signal?.toFixed(1)} dBm
                        </p>
                      )}
                      <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500" 
                          style={{ width: `${port.traffic_util}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ONUs/Subscribers Page
function ONUsPage() {
  const [onus, setOnus] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    loadONUs()
  }, [search, statusFilter])

  const loadONUs = async () => {
    try {
      const params: any = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      const data = await api.getONUs(params)
      setOnus(data.slice(0, 50)) // Limit for performance
    } catch (err) {
      console.error('Failed to load ONUs:', err)
    }
    setLoading(false)
  }

  const handleReboot = async (serial: string) => {
    if (!confirm(`Reboot ONU ${serial}?`)) return
    try {
      await api.rebootONU(serial)
      alert('Reboot initiated')
      loadONUs()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Subscribers / ONUs</h1>
        <Button variant="outline" size="sm" onClick={loadONUs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by Serial, MAC, Name, or Subscriber ID..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="px-3 py-2 rounded-md border bg-background text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serial Number</TableHead>
              <TableHead>MAC Address</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Signal (dBm)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : onus.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No ONUs found
                </TableCell>
              </TableRow>
            ) : (
              onus.map((onu) => {
                const signal = formatSignalQuality(onu.current_signal_dbm)
                return (
                  <TableRow key={onu.id}>
                    <TableCell className="font-mono text-sm">{onu.serial_number}</TableCell>
                    <TableCell className="font-mono text-sm">{onu.mac_address}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{onu.customer_name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{onu.subscriber_ref_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={signal.color}>{onu.current_signal_dbm?.toFixed(1)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={onu.status === 'online' ? 'success' : 'destructive'}>
                        {onu.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {onu.last_seen}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleReboot(onu.serial_number)}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

// Alarms Page
function AlarmsPage() {
  const [alarms, setAlarms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [severity, setSeverity] = useState('')

  useEffect(() => {
    loadAlarms()
    const interval = setInterval(loadAlarms, 30000)
    return () => clearInterval(interval)
  }, [severity])

  const loadAlarms = async () => {
    try {
      const params: any = { status: 'active' }
      if (severity) params.severity = severity
      const data = await api.getAlarms(params)
      setAlarms(data)
    } catch (err) {
      console.error('Failed to load alarms:', err)
    }
    setLoading(false)
  }

  const handleAck = async (id: string) => {
    try {
      await api.acknowledgeAlarm(id)
      loadAlarms()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'major': return 'danger'
      case 'minor': return 'warning'
      default: return 'info'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Alarms</h1>
        <div className="flex gap-2">
          <select 
            className="px-3 py-2 rounded-md border bg-background text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="warning">Warning</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadAlarms}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : alarms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No active alarms
                </TableCell>
              </TableRow>
            ) : (
              alarms.map((alarm) => (
                <TableRow key={alarm.id}>
                  <TableCell>
                    <Badge variant={getSeverityVariant(alarm.severity) as any}>
                      {alarm.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{alarm.message}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{alarm.resource_type}</p>
                      <p className="text-xs text-muted-foreground font-mono">{alarm.resource_id}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {alarm.created_at}
                  </TableCell>
                  <TableCell>
                    <Badge variant={alarm.status === 'active' ? 'secondary' : 'outline'}>
                      {alarm.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {alarm.status === 'active' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleAck(String(alarm.id))}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

// Analytics Page
function AnalyticsPage() {
  const [onus, setOnus] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const data = await api.getONUs({ status: 'online' })
      setOnus(data.slice(0, 100))
    } catch (err) {
      console.error('Failed to load data:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

  const signalRanges = [
    { range: 'Excellent (-15 to -20)', min: -20, max: -15, count: 0, color: '#22c55e' },
    { range: 'Good (-20 to -23)', min: -23, max: -20, count: 0, color: '#4ade80' },
    { range: 'Fair (-23 to -25)', min: -25, max: -23, count: 0, color: '#eab308' },
    { range: 'Poor (-25 to -27)', min: -27, max: -25, count: 0, color: '#f97316' },
    { range: 'Bad (-27 to -30)', min: -30, max: -27, count: 0, color: '#ef4444' },
  ]

  onus.forEach(onu => {
    const signal = onu.current_signal_dbm
    signalRanges.forEach(r => {
      if (signal >= r.min && signal < r.max) r.count++
    })
  })

  const total = signalRanges.reduce((sum, r) => sum + r.count, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Signal Quality Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {signalRanges.map((r, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{r.range}</span>
                    <span className="font-semibold">{r.count} ({total ? ((r.count / total) * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="h-3 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all"
                      style={{ width: `${total ? (r.count / total) * 100 : 0}%`, backgroundColor: r.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                <div className="flex items-center gap-3">
                  <Signal className="h-5 w-5 text-green-500" />
                  <span>Excellent Signal</span>
                </div>
                <span className="font-semibold text-green-500">
                  {signalRanges[0].count + signalRanges[1].count} ONUs
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                <div className="flex items-center gap-3">
                  <Signal className="h-5 w-5 text-yellow-500" />
                  <span>Fair Signal</span>
                </div>
                <span className="font-semibold text-yellow-500">
                  {signalRanges[2].count} ONUs
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                <div className="flex items-center gap-3">
                  <Signal className="h-5 w-5 text-red-500" />
                  <span>Poor Signal</span>
                </div>
                <span className="font-semibold text-red-500">
                  {signalRanges[3].count + signalRanges[4].count} ONUs
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Degraded ONUs */}
      <Card>
        <CardHeader>
          <CardTitle>ONUs with Poor Signal (-25 dBm or worse)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Signal</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {onus
                .filter(onu => onu.current_signal_dbm <= -25)
                .slice(0, 10)
                .map((onu) => (
                  <TableRow key={onu.id}>
                    <TableCell className="font-mono">{onu.serial_number}</TableCell>
                    <TableCell>{onu.customer_name || '-'}</TableCell>
                    <TableCell className="text-red-500 font-semibold">
                      {onu.current_signal_dbm?.toFixed(1)} dBm
                    </TableCell>
                    <TableCell>
                      <Badge variant={onu.status === 'online' ? 'success' : 'destructive'}>
                        {onu.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// Reports Page
function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reports</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: 'Daily Network Summary', desc: 'Overview of network performance' },
          { title: 'Signal Quality Report', desc: 'ONUs with poor signal' },
          { title: 'Alarm Summary', desc: 'Daily alarm statistics' },
          { title: 'OLT Utilization', desc: 'Port and bandwidth usage' },
          { title: 'Subscriber Report', desc: 'New and inactive subscribers' },
          { title: 'Capacity Planning', desc: 'Growth trends and predictions' },
        ].map((report, i) => (
          <Card key={i} className="cursor-pointer hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="text-lg">{report.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{report.desc}</p>
              <Button variant="outline" className="mt-4 w-full">
                Generate Report
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Main App
export default function App() {
  const { isAuthenticated } = useAuthStore()
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [selectedOLT, setSelectedOLT] = useState<string | null>(null)

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => {}} />
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      
      <main className="flex-1 overflow-auto">
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search OLT, ONU, Subscriber..." 
                className="pl-10 w-80"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="success">System Online</Badge>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                A
              </div>
              <span className="text-sm font-medium">admin</span>
            </div>
          </div>
        </header>

        <div className="p-6">
          {selectedOLT ? (
            <OLTDetailPage oltId={selectedOLT} onBack={() => setSelectedOLT(null)} />
          ) : currentPage === 'dashboard' && (
            <DashboardPage />
          )}
          {currentPage === 'olts' && (
            <OLTsPage onSelectOLT={setSelectedOLT} />
          )}
          {currentPage === 'onus' && <ONUsPage />}
          {currentPage === 'alarms' && <AlarmsPage />}
          {currentPage === 'analytics' && <AnalyticsPage />}
          {currentPage === 'reports' && <ReportsPage />}
        </div>
      </main>
    </div>
  )
}
