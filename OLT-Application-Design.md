# OLT Multivendor Insight & Observation System - Application Design

## 1. ภาพรวมโครงการ (Project Overview)

ระบบ OLT Multivendor Insight & Observation System (OMIOS) ถูกออกแบบมาเพื่อรองรับการบริหารจัดการ subscriber ขนาดใหญ่สูงสุด 500,000 ราย โดยรวมข้อมูลจาก OLT หลายยี่ห้อ (ZTE, Huawei, Fiberhome) ผ่านโปรโตคอล SNMP, NETCONF และ CLI/SSH พร้อมเชื่อมต่อ Cisco Radius เพื่อให้ NOC และ Network Engineer สามารถมองเห็นสถานะ ONU และการเชื่อมต่อของ subscriber แบบ real-time และ predictive ผ่าน dashboard เดียว โดยไม่จำกัด vendor

ระบบนี้ใช้สถาปัตยกรรมแบบ Microservice ผสมผสานกับ Clean Architecture และ Domain-Driven Design (DDD) เพื่อให้สามารถ scale ได้อย่างอิสระ และรองรับการขยายตัวของธุรกิจในอนาคต โดยแต่ละ service จะถูกแบ่งออกตาม bounded context ทางธุรกิจ ทำให้ทีมพัฒนาสามารถทำงานได้อย่างเป็นอิสระและมีประสิทธิภาพ

## 2. สถาปัตยกรรมระบบ (System Architecture)

### 2.1 โครงสร้าง Microservices

ระบบถูกแบ่งออกเป็น microservices ตามหลัก DDD โดยแต่ละ bounded context จะถูก map เป็น 1 microservice ตามหลัก "One service per bounded context" ซึ่งทำให้สามารถ scale แต่ละ service ได้อย่างอิสระตามความต้องการใช้งาน และเมื่อมีการเพิ่ม vendor ใหม่ ก็สามารถทำได้โดยไม่กระทบกับ core service

| Service | Responsibility | Technology | Key Aggregates |
|---------|----------------|------------|----------------|
| OLT Integration Service | รวบรวมข้อมูลจาก OLT ทุก vendor ผ่าน Vendor Adapter และ publish event ออก Kafka | Go (Gin) | OltDevice, OnuDevice, PonPort, VendorAdapter |
| Radius Integration Service | รับข้อมูล RADIUS Accounting และ Authentication จาก Cisco Radius | Python (FastAPI) | RadiusSession, Subscriber, AuthRecord |
| Alarm Management Service | ประมวลผล event จาก Kafka, ประเมิน rule, สร้าง alarm | Go/Python | Alarm, AlarmRule, AlarmHistory |
| Signal Quality Service | เก็บและ query ข้อมูล optical signal strength ของ ONU แบบ time-series | Python (FastAPI) | SignalMetric, OnuPort |
| ONU Control Service | รับคำสั่ง Reboot/Reset ONU จาก API Gateway และส่งต่อไปยัง OLT Integration Service | Go (Gin) | OnuCommand, CommandQueue, AuditLog |
| Traffic Monitoring Service | เก็บ traffic metric ของ PON Port และ Uplink แบบ time-series | Python (FastAPI) | TrafficMetric, PonPort, UplinkPort |
| Notification Service | ส่งแจ้งเตือนผ่าน Email, SMS, LINE Notify | Python (FastAPI) | Notification, Channel, Template |
| Inventory & Reporting Service | จัดการ device inventory และ report | Python (FastAPI) | Device, Report |
| User Management Service | จัดการ user, role, permission | Python (FastAPI) | User, Role, Permission |

### 2.2 Clean Architecture ภายในแต่ละ Service

ทุก microservice ใช้ Clean Architecture ตามหลัก Dependency Rule ซึ่งกำหนดว่า dependency ต้องวิ่งเข้าหา domain เสมอ โดยห้ามไม่ให้ domain รู้จัก framework, database หรือ HTTP นี่คือโครงสร้างภายในแต่ละ service

**Domain Layer** ประกอบด้วย Entities, Value Objects, Domain Events และ Business Rules เช่น OnuDevice, PonPort, OnuStatusChangedEvent และ OpticalSignalSpec โดย layer นี้จะไม่รู้จัก vendor ใดๆ เลย ทำให้ business logic คงที่ไม่ว่าจะเปลี่ยน OLT vendor

**Application Layer** ประกอบด้วย Use Cases, Commands, Queries และ Interfaces (Port) เช่น PollOnuStatusUseCase, UpdateOnuStatusCommand, IOnuRepository และ IMessagePublisher โดย layer นี้จะเป็นตัวกลางในการเชื่อมต่อระหว่าง domain และ infrastructure

**Infrastructure Layer** ประกอบด้วย DB Adapters, Message Broker และ Vendor Adapters (SNMP/NETCONF/CLI) เช่น PostgresOnuRepository, KafkaPublisher, ZteSnmpAdapter และ HuaweiNetconfAdapter โดย layer นี้จะซ่อนความซับซ้อนของ vendor ต่างๆ ไว้ภายใน

**Presentation/API Layer** ประกอบด้วย REST Endpoints, WebSocket, Middleware และ DI Setup เช่น OnuController, AlarmWebSocketHandler และ AuthMiddleware

### 2.3 Vendor Adapter Pattern (Anticorruption Layer)

เนื่องจากระบบต้องรองรับ OLT หลาย vendor ซึ่งมี protocol และ data model ต่างกัน จึงใช้ Anticorruption Layer ผ่าน Vendor Adapter เพื่อแปลงข้อมูลจาก vendor ต่างๆ ให้เป็น format มาตรฐานภายในระบบ

```go
// Domain: ไม่รู้จัก ZTE/Huawei เลย
type IVendorAdapter interface {
    GetOnuStatus(ctx context.Context, oltID string) ([]OnuStatus, error)
    SendReboot(ctx context.Context, onuID string) error
    SubscribeEvents(ctx context.Context, handler EventHandler) error
}

// Infrastructure: Vendor-specific implementations
type ZteSnmpAdapter struct { ... }   // implements IVendorAdapter
type HuaweiNetconfAdapter struct { ... } // implements IVendorAdapter
type FiberhomeSshAdapter struct { ... }  // implements IVendorAdapter

// Application: ใช้ Interface เท่านั้น
type PollOnuStatusUseCase struct {
    adapter IVendorAdapter       // injected
    repo    IOnuRepository       // injected
    pub     IMessagePublisher    // injected
}
```

### 2.4 Database Architecture

ระบบใช้ database หลายประเภทเพื่อให้เหมาะสมกับการใช้งานแต่ละแบบ

**PostgreSQL (Patroni HA)** ใช้สำหรับข้อมูลที่ต้องการ ACID compliance เช่น inventory, subscriber data, alarm history โดยมีการ setup HA ด้วย Patroni และใช้ Pgbouncer connection pool

**InfluxDB Cluster** ใช้สำหรับ time-series data เช่น optical power, SNR, traffic rates โดยมี retention policy 6 เดือนและสามารถ query ได้ p99 < 200ms

**Elasticsearch** ใช้สำหรับ alarm search, audit log analysis และ full-text search

**Redis Cluster** ใช้สำหรับ session cache, ONU last status และ rate limit counters โดยตั้งเป้า cache hit > 90%

## 3. การออกแบบ API

### 3.1 API Gateway Design

API Gateway ทำหน้าที่เป็น single entry point สำหรับทุก client request โดยใช้ Kong + Nginx Ingress ซึ่งรองรับ rate limiting, JWT validation และ routing โดยมี target p99 < 100ms

### 3.2 REST API Endpoints

| Endpoint | Service | Description |
|----------|---------|-------------|
| GET /api/v1/olts | Inventory Service | ดูรายการ OLT ทั้งหมด |
| GET /api/v1/olts/:id | Inventory Service | ดูรายละเอียด OLT เฉพาะ |
| GET /api/v1/onus | Inventory Service | ดูรายการ ONU ทั้งหมด |
| GET /api/v1/onus/:serial | Inventory Service | ดูรายละเอียด ONU เฉพาะ |
| GET /api/v1/onus/:serial/signal | Signal Quality Service | ดูประวัติ signal strength |
| POST /api/v1/onus/:serial/reboot | ONU Control Service | สั่ง reboot ONU |
| POST /api/v1/onus/:serial/reset | ONU Control Service | สั่ง factory reset ONU |
| GET /api/v1/alarms | Alarm Service | ดูรายการ alarm |
| GET /api/v1/alarms/:id | Alarm Service | ดูรายละเอียด alarm |
| POST /api/v1/alarms/:id/acknowledge | Alarm Service | Acknowledge alarm |
| GET /api/v1/traffic/pon-port/:id | Traffic Monitoring Service | ดู traffic ของ PON port |
| GET /api/v1/subscribers/:id | Inventory Service | ดูข้อมูล subscriber แบบ 360° |
| GET /api/v1/reports/summary | Inventory Service | ดู report summary |

### 3.3 WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| WS /api/v1/ws/alarms | Real-time alarm updates |
| WS /api/v1/ws/onu-status | Real-time ONU status changes |
| WS /api/v1/ws/traffic | Real-time traffic updates |

### 3.4 Event Schemas (Kafka)

```json
// onu.status.changed
{
  "event_type": "onu.status.changed",
  "olt_id": "uuid",
  "olt_name": "OLT-BKK-01",
  "vendor": "ZTE",
  "onu_serial": "string",
  "pon_port": "1/1/4",
  "status": "ONLINE|OFFLINE|LOOPBACK",
  "rx_power": -20.5,
  "tx_power": 3.2,
  "timestamp": "2024-01-15T10:30:00Z"
}

// alarm.triggered
{
  "event_type": "alarm.triggered",
  "alarm_id": "uuid",
  "severity": "CRITICAL|MAJOR|MINOR|WARNING",
  "alarm_type": "ONU_OFFLINE|OLT_DOWN|HIGH_TEMP",
  "source": "olt_id" | "onu_serial",
  "message": "ONU AL-1234 ตัดการเชื่อมต่อ",
  "timestamp": "2024-01-15T10:30:00Z"
}

// onu.command
{
  "event_type": "onu.command",
  "command_id": "uuid",
  "command_type": "REBOOT|RESET|CONFIG",
  "onu_serial": "string",
  "requested_by": "user_id",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 4. การออกแบบฐานข้อมูล (Database Schema)

### 4.1 PostgreSQL Schema

```sql
-- OLT Devices
CREATE TABLE olts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    vendor VARCHAR(50) NOT NULL CHECK (vendor IN ('ZTE', 'HUAWEI', 'FIBERHOME')),
    ip_address INET NOT NULL,
    snmp_version VARCHAR(10) DEFAULT 'v2c',
    snmp_community VARCHAR(100),
    ssh_username VARCHAR(100),
    ssh_password_encrypted VARCHAR(255),
    netconf_port INTEGER DEFAULT 830,
    region VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PON Ports
CREATE TABLE pon_ports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    olt_id UUID REFERENCES olts(id) ON DELETE CASCADE,
    port_number VARCHAR(20) NOT NULL,
    slot_number VARCHAR(20) NOT NULL,
    total_onu_slots INTEGER DEFAULT 64,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(olt_id, port_number, slot_number)
);

-- ONUs
CREATE TABLE onus (
    serial_number VARCHAR(50) PRIMARY KEY,
    olt_id UUID REFERENCES olts(id),
    pon_port_id UUID REFERENCES pon_ports(id),
    onu_model VARCHAR(100),
    vendor VARCHAR(50),
    status VARCHAR(20) DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'LOOPBACK', 'PENDING')),
    subscriber_ref_id VARCHAR(50),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_address TEXT,
    installed_at TIMESTAMP,
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Signal Metrics (Latest)
CREATE TABLE onu_signal_latest (
    onu_serial VARCHAR(50) REFERENCES onus(serial_number) ON DELETE CASCADE,
    rx_power FLOAT,
    tx_power FLOAT,
    bias_current FLOAT,
    temperature FLOAT,
    voltage FLOAT,
    optical_status VARCHAR(20),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (onu_serial)
);

-- Alarms
CREATE TABLE alarms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alarm_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'MAJOR', 'MINOR', 'WARNING')),
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('OLT', 'ONU', 'PON_PORT')),
    source_id VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    cleared_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alarm Rules
CREATE TABLE alarm_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    condition JSONB NOT NULL,
    severity VARCHAR(20) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'NOC', 'L1_SUPPORT', 'L2_SUPPORT', 'L3_SUPPORT', 'VIEWER')),
    region VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_onus_olt_id ON onus(olt_id);
CREATE INDEX idx_onus_status ON onus(status);
CREATE INDEX idx_onus_subscriber_ref ON onus(subscriber_ref_id);
CREATE INDEX idx_alarms_severity ON alarms(severity);
CREATE INDEX idx_alarms_created_at ON alarms(created_at);
CREATE INDEX idx_alarms_acknowledged ON alarms(is_acknowledged);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

### 4.2 InfluxDB Measurements

```influxdb
-- Optical Signal Measurement
CREATE MEASUREMENT optical_signal
TAGS: onu_sn, olt_id, pon_port, region, vendor
FIELDS: rx_power, tx_power, bias_current, temperature, voltage

-- Traffic Measurement
CREATE MEASUREMENT pon_traffic
TAGS: olt_id, pon_port, pon_port_id
FIELDS: rx_bytes, tx_bytes, rx_packets, tx_packets, rx_errors, tx_errors

-- Uplink Traffic Measurement
CREATE MEASUREMENT uplink_traffic
TAGS: olt_id, uplink_port
FIELDS: rx_bytes, tx_bytes, rx_packets, tx_packets, utilization_percent
```

## 5. การออกแบบ Frontend (UI/UX)

### 5.1 Technology Stack

Frontend ใช้ React.js กับ Vite เป็น build tool โดยมี state management เป็น React Query สำหรับ server state และ Zustand สำหรับ global UI state ส่วน visual library ใช้ Tailwind CSS ร่วมกับ ShadCN UI components และใช้ Recharts สำหรับ timeseries visualization และ React Flow สำหรับ topology maps

### 5.2 Visual Design System (NOC Theme)

เนื่องจากระบบนี้เป็น NOC dashboard ที่ต้องใช้งานตลอด 24 ชั่วโมง จึงเลือกใช้ Dark Mode เป็นค่าเริ่มต้นเพื่อลดความเมื่อยล้าของสายตา

| Element | Color Code | Description |
|---------|------------|-------------|
| Background | #0f172a (Slate 900) | พื้นหลังหลัก |
| Panel | #1e293b (Slate 800) | พื้นหลังการ์ด/panel |
| Border | #334155 (Slate 700) | เส้นขอบ |
| Primary | #3b82f6 (Blue 500) | ปุ่มและ links |
| Critical | #ef4444 (Red 500) | LOS/Down alarm |
| Major | #f97316 (Orange 500) | High Temp/Low Signal |
| Warning | #eab308 (Yellow 500) | Warnings |
| Healthy | #22c55e (Green 500) | Online/Healthy |
| Text Primary | #f8fafc (Slate 50) | ข้อความหลัก |
| Text Secondary | #94a3b8 (Slate 400) | ข้อความรอง |

### 5.3 Typography

สำหรับ UI ใช้ font Inter ซึ่งอ่านง่ายและมีความชัดเจน ส่วนสำหรับ logs, CLI output และข้อมูลทางเทคนิค เช่น IP address, MAC address จะใช้ JetBrains Mono เพื่อให้อ่านได้ง่ายและแยกแยะได้ชัดเจน

| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 (Page Title) | Inter | 24px | 600 |
| H2 (Section Title) | Inter | 20px | 600 |
| H3 (Card Title) | Inter | 16px | 600 |
| Body | Inter | 14px | 400 |
| Small | Inter | 12px | 400 |
| Code/Logs | JetBrains Mono | 12px | 400 |

### 5.4 Core Views และ Components

#### 5.4.1 Main NOC Dashboard (หน้าหลัก)

หน้านี้เป็น "Bird's Eye View" ที่แสดงภาพรวมของระบบทั้งหมด โดยมีองค์ประกอบดังนี้

**Global Status Bar** แสดงตัวเลขรวมของ ONUs ทั้งหมด, จำนวน Online/Offline, Active Alarms แบบแยกตาม severity และ system health score

**Traffic Heatmap** แสดงแผนที่หรือ logical map ที่แบ่งตาม region โดยแสดงสีตามระดับความแออัด (congestion) ของแต่ละพื้นที่

**Top Offenders Widget** แสดงรายการ PON ports ที่มี error rate สูงสุด 10 อันดับ

**Recent Alarms Table** แสดง alarm ล่าสุด 20 รายการ พร้อม link ไปยัง alarm detail

**System Health Overview** แสดงกราฟ CPU/RAM ของ OLTs ที่มีการใช้งานสูง

#### 5.4.2 OLT Detail View

หน้านี้แสดงรายละเอียดของ OLT เฉพาะตัว โดยมีองค์ประกอบดังนี้

**Visual Rack View** เป็น SVG representation ของ OLT chassis ที่แสดง slots และ ports แบบ interactive สามารถ click เพื่อดูรายละเอียดของแต่ละ port ได้

**Port Status Grid** แสดง grid ของ PON ports ทั้งหมดพร้อมสถานะ (Online/Offline/Warning) และสีที่แสดงตามสถานะ

**Port Utilization Sparklines** แสดง mini charts สำหรับ bandwidth ของแต่ละ PON port

**OLT Information Card** แสดงข้อมูลพื้นฐาน เช่น IP, Vendor, Model, Uptime, CPU, Memory, Temperature

**Uplink Status** แสดงสถานะของ uplink ports พร้อม traffic metrics

#### 5.4.3 Subscriber "360 Insight" View

หน้านี้เป็น "Fix It Screen" สำหรับดูข้อมูล subscriber แบบครบถ้วน โดยมีองค์ประกอบดังนี้

**Header Section** แสดง Customer Name, Account ID, ONU Model, Vendor, และ Status Badge

**Live Status Panel** แสดงข้อมูลแบบ real-time ได้แก่ Optical Power (Rx/Tx), Distance, Uptime และสถานะการเชื่อมต่อ

**Signal History Chart** แสดงกราฟเส้นของ optical power ในช่วง 24 ชั่วโมง โดยดึงข้อมูลจาก InfluxDB

**Action Panel** มีปุ่มสำหรับ actions ต่างๆ ได้แก่ Reboot ONU, CATV On/Off และ Run Ping Test

**Logs Section** แสดง combined view ของ Radius Auth logs และ OLT traps สำหรับ SN นี้

**Connection Timeline** แสดง timeline ของการเปลี่ยนแปลงสถานะและ events ต่างๆ

#### 5.4.4 Alarm Management View

หน้านี้สำหรับจัดการ alarm ทั้งหมด โดยมีองค์ประกอบดังนี้

**Alarm Statistics** แสดงตัวเลขสถิติของ alarm แยกตาม severity และประเภท

**Alarm List Table** แสดงรายการ alarm ทั้งหมดพร้อม sorting, filtering และ pagination

**Alarm Detail Modal** แสดงรายละเอียดเมื่อ click เข้าไปดู alarm เฉพาะ

**Alarm Rules Configuration** หน้าสำหรับ config alarm rules

#### 5.4.5 Signal Quality Analytics View

หน้านี้สำหรับวิเคราะห์คุณภาพสัญญาณ โดยมีองค์ประกอบดังนี้

**Signal Distribution Chart** แสดง distribution ของ Rx power ของ ONUs ทั้งหมด

**Degraded ONUs List** แสดงรายการ ONUs ที่มี signal degradation

**Flapping Detection** แสดงรายการ ONUs ที่มีการ on/off บ่อย (flapping)

**PON Port Signal Overview** แสดงภาพรวมของ signal quality ของแต่ละ PON port

#### 5.4.6 Reports View

หน้านี้สำหรับ generate และดู reports ต่างๆ โดยมีองค์ประกอบดังนี้

**Report Templates** แสดงรายการ templates ที่มีอยู่

**Scheduled Reports** แสดงรายการ reports ที่ตั้งเวลาไว้

**Custom Report Builder** เครื่องมือสำหรับสร้าง report แบบกำหนดเอง

**Export Options** รองรับการ export เป็น PDF, Excel, CSV

### 5.5 Reusable Components

```tsx
// Signal Strength Gauge Component
interface SignalGaugeProps {
  rxPower: number; // dBm
  txPower: number; // dBm
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Port Status Indicator
interface PortStatusProps {
  status: 'online' | 'offline' | 'warning' | 'disabled';
  onuCount?: number;
  maxOnu?: number;
}

// ONU Status Badge
interface OnuStatusBadgeProps {
  status: 'ONLINE' | 'OFFLINE' | 'LOOPBACK' | 'PENDING';
  showIcon?: boolean;
}

// Alarm Severity Badge
interface AlarmSeverityBadgeProps {
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'WARNING';
}

// Optical Power Chart (Time Series)
interface SignalChartProps {
  data: SignalDataPoint[];
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
}

// Interactive Chassis View
interface ChassisViewProps {
  vendor: 'ZTE' | 'HUAWEI' | 'FIBERHOME';
  slots: SlotConfig[];
  onPortClick?: (portId: string) => void;
}

// Command Terminal (Web CLI)
interface TerminalProps {
  oltId: string;
  isConnected: boolean;
  onCommand: (cmd: string) => void;
}

// Data Table with Filtering
interface OnuTableProps {
  data: Onu[];
  onSort: (field: string, order: 'asc' | 'desc') => void;
  onFilter: (filters: Filter[]) => void;
  onSelect: (onus: Onu[]) => void;
  onBatchAction: (action: string, onus: Onu[]) => void;
}
```

## 6. การออกแบบ Security

### 6.1 Authentication และ Authorization

ระบบใช้ Keycloak สำหรับ OAuth2 + JWT SSO โดยมี role-based access control (RBAC) แบ่งตามระดับดังนี้

| Role | Permissions |
|------|-------------|
| ADMIN | Full access, ทำได้ทุกอย่าง |
| NOC | View all, Reboot ONU, Acknowledge alarms |
| L1_SUPPORT | View subscriber, View alarms |
| L2_SUPPORT | View all, Reboot ONU |
| L3_SUPPORT | Full access, Config OLT |
| VIEWER | Read only |

### 6.2 Network Security

ระบบมีการแบ่ง network zones ดังนี้

**DMZ Zone** มี Nginx Load Balancer และ CDN (Cloudflare) สำหรับรับ traffic จาก internet

**Kubernetes Cluster** มี Nginx Ingress + Kong API Gateway, Microservice pods, Kafka Cluster และ Redis Cluster

**Database Layer** มี PostgreSQL (Patroni HA), InfluxDB Cluster และ Elasticsearch Cluster

**Network Devices (Private VPN)** มี OLTs (ZTE, Huawei, Fiberhome) และ Radius Server โดย OLT Integration Service เข้าถึงได้ผ่าน private VPN เท่านั้น

### 6.3 Transport Security

ทุก communication ใช้ TLS 1.3 โดย HTTPS สำหรับ API และ mTLS สำหรับ inter-service communication ผ่าน Istio Service Mesh

### 6.4 Secret Management

ใช้ HashiCorp Vault สำหรับจัดการ secrets ทั้งหมด เช่น OLT credentials, RADIUS secret และ SMTP password โดยไม่เขียนใน env file

## 7. Scalability และ High Availability

### 7.1 Scaling Strategy

| Component | Strategy | Target SLA |
|-----------|----------|-------------|
| All Microservices | Kubernetes HPA, minimum 3 replicas, Liveness/Readiness Probes | 99.9% uptime |
| Kafka | 3-node Cluster, replication factor 3, retention 7 days | Zero message loss |
| PostgreSQL | Patroni + Etcd HA, async replication + Pgbouncer | RPO < 5 min, RTO < 30 sec |
| InfluxDB | Cluster mode, 3 nodes, 6-month retention | Query p99 < 200ms |
| Redis | 6-node Cluster (3 master + 3 replica) | Cache hit > 90% |
| API Gateway | Kong + Nginx LB, Rate Limiting 1000 req/s per service | p99 < 100ms |

### 7.2 OLT Polling Strategy

เนื่องจากระบบต้องรองรับ 500,000 subscribers การ polling จึงใช้ strategy ดังนี้

**Sharded Polling** จะ assign OLTs ไปยัง specific poller workers ผ่าน Consistent Hashing เพื่อให้สามารถ scale ได้อย่าง uniform

**Bulk Retrieval** ไม่ poll ONUs แต่ละตัวผ่าน SNMP โดยตรง (ช้าเกินไป) แต่จะใช้วิธี Bulk Retrieval เช่น SNMP BulkWalk หรือ file transfer จาก OLT เพื่อดึงข้อมูลสำหรับ ONUs ทั้งหมดบน PON port พร้อมกัน

**Polling Interval** สำหรับ critical data (status) จะ poll ทุก 60 วินาที และใช้ SNMP Trap สำหรับ instant events

## 8. Next Steps และ Implementation Plan

### 8.1 Priority Actions

| Priority | Action | Owner |
|----------|--------|-------|
| P0 | ทดสอบ SNMP/NETCONF connection กับ OLT ทุก Vendor ใน Lab - Confirm MIB OIDs และ YANG Models | Network Engineer |
| P0 | กำหนด Kafka Event Schema (JSON Schema/Protobuf) สำหรับ onu.status.changed และ subscriber.session ก่อนเริ่ม Development | Tech Lead |
| P1 | Implement OLT Integration Service สำหรับ ZTE ก่อน (Vendor ที่มี OLT มากสุด) แล้วค่อย Add HW/FH Adapter | Dev Team |
| P1 | ออกแบบ PostgreSQL Schema และ InfluxDB Measurement สำหรับ ONU Status History + Radius Sessions | DB Architect |
| P2 | Setup Kubernetes Cluster พร้อม Kafka + PostgreSQL (Patroni) ใน Staging Environment | DevOps |
| P2 | Run Event Storming Session สำหรับ Alarm Management เพื่อ Clarify Rule Engine Requirements | Product + Dev |
| P3 | Security Audit + Penetration Testing ก่อน Go-live | Security Team |
| P3 | Load Test ด้วย Simulator สำหรับ OLT 100 ตัว, ONU 50,000 ตัว, Subscriber 500,000 ราย | QA + DevOps |

### 8.2 Open Questions ที่ต้องตอบก่อนเริ่ม Development

1. OLT แต่ละ Vendor รองรับ SNMP v2c หรือ v3? มี Community String หรือ Auth Protocol ที่ต้องตั้งค่า?
2. Cisco Radius ส่ง Accounting ผ่าน UDP ตรง หรือผ่าน Proxy Radius?
3. ต้องการ Multi-tenancy หรือ Role แยก Region สำหรับ NOC ในพื้นที่ต่างกัน?
4. Data Retention Policy: เก็บ Time-Series Metric นานแค่ไหน? (InfluxDB cost)
5. จะ Integrate กับ CRM / Trouble Ticket System ไหน? API format เป็น REST หรือ SOAP?
6. ONU Control (Reboot) ต้องผ่าน Approval Workflow หรือสั่งได้ทันที?

---

เอกสารนี้ได้อธิบายรายละเอียดของ Application Design ตามสถาปัตยกรรมที่กำหนดในไฟล์ OLT-Architecture-Design.docx แล้ว หากต้องการให้ผมดำเนินการต่อในส่วนใดเพิ่มเติม เช่น การสร้าง prototype, API documentation, หรือ UI mockups กรุณาแจ้งได้เลย