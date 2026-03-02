# OLT Multivendor Insight & Observation System

## Live Demo

🌐 **Demo URL**: https://f5lf8fovjcdw.space.minimax.io

**Login Credentials:**
- Username: `admin`
- Password: `admin123`

---

## Quick Start

### Frontend Only (Demo Mode)

```bash
cd frontend
npm install
npm run dev
```

### Full Stack

**Backend:**
```bash
cd backend
go mod download
go run main.go
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
olt-mvp/
├── README.md           # Full documentation
├── Makefile           # Build automation
├── .gitignore         # Git ignore rules
├── backend/
│   ├── main.go        # Go API server
│   ├── go.mod         # Go dependencies
│   └── go.sum         # Go checksums
└── frontend/
    ├── src/           # React source code
    ├── package.json    # Node dependencies
    └── dist/          # Built files
```

---

## Features

- Dashboard with network overview
- OLT device management
- PON port visualization
- Subscriber/ONU monitoring
- Alarm management
- Signal quality analytics
- Dark mode NOC theme

---

## License

MIT
