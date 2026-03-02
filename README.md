# OLT Multivendor Insight & Observation System

A Network Operations Center (NOC) Dashboard for managing OLT/ONU devices across multiple vendors (ZTE, Huawei, Fiberhome) in real-time.

![OLT Insight Dashboard](https://img.shields.io/badge/Status-Active-brightgreen)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 📋 Overview

This is an MVP (Minimum Viable Product) implementation of the OLT Multivendor Insight & Observation System designed for ISPs managing up to 500,000 subscribers. The system provides real-time monitoring of OLT devices and ONUs with a modern NOC dashboard interface.

## 🏗️ Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React.js + Vite + Tailwind CSS |
| Backend | Go (Gin Framework) |
| Database | SQLite (Demo) / PostgreSQL (Production) |
| Authentication | JWT |

### Project Structure

```
olt-mvp/
├── backend/                 # Go backend API server
│   ├── main.go            # Main application entry point
│   ├── go.mod            # Go module dependencies
│   └── olt.db            # SQLite database (runtime)
├── frontend/               # React.js frontend application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── store/        # State management
│   │   ├── lib/          # Utility functions
│   │   └── App.tsx       # Main application
│   ├── package.json       # Node.js dependencies
│   └── vite.config.ts    # Vite configuration
└── README.md              # This file
```

## 🚀 Features

- **Dashboard** - Real-time overview of network status
- **OLT Management** - View and manage OLT devices
- **PON Port Visualization** - Interactive chassis view with port status
- **Subscriber/ONU Management** - Monitor ONUs with signal quality
- **Alarm Management** - View, acknowledge, and manage alarms
- **Analytics** - Signal quality distribution and network insights
- **Reports** - Report templates for network analysis
- **Dark Mode** - NOC-optimized dark theme

## 🛠️ Quick Start

### Option 1: Demo Mode (Frontend Only)

The frontend includes built-in mock data for demonstration purposes:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Then open `http://localhost:5173` in your browser.

**Login Credentials:**
- Username: `admin`
- Password: `admin123`

### Option 2: Full Stack (Frontend + Backend)

#### Prerequisites

- Node.js 18+ 
- Go 1.21+

#### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Download dependencies
go mod download

# Run the server
go run main.go
```

The backend will start on `http://localhost:8080`

#### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Then open `http://localhost:5173` in your browser.

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | User login |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats/global` | Get global statistics |

### OLT Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/olts` | List all OLTs |
| GET | `/api/olts/:id` | Get OLT details with ports |

### ONU Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/onus` | List ONUs (with filters) |
| POST | `/api/onus/:serial/reboot` | Reboot ONU |

### Alarms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alarms` | List alarms |
| POST | `/api/alarms/:id/acknowledge` | Acknowledge alarm |

## 🎨 UI Screenshots

### Login Page
Modern dark-themed login interface with username/password authentication.

### Dashboard
High-level overview showing:
- Total ONUs (Online/Offline)
- Active Alarms by Severity
- System Health Metrics
- Network Overview

### OLT Detail View
Interactive chassis visualization showing PON port status, CPU/Memory usage, and temperature.

### Alarm Management
Real-time alarm list with severity indicators and acknowledge functionality.

## 🔧 Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8080 | Server port |
| DB_PATH | ./olt.db | Database file path |
| JWT_SECRET | olt-mvp-secret-key | JWT signing key |

### Frontend Configuration

The frontend includes a demo mode with mock data by default. To connect to a real backend, edit `frontend/src/store/auth.ts` and set:

```typescript
const MOCK_MODE = false; // Set to false to use real backend
```

## 📝 Demo Users

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Administrator |
| noc | noc123 | NOC Operator |
| viewer | viewer123 | Read-only Viewer |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Design based on OLT Architecture Design Document
- UI components from ShadCN UI
- Icons from Lucide React

---

**Note:** This is an MVP implementation. For production use, please implement proper security measures, database clustering, and microservices architecture as described in the architecture design document.
