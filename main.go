package main

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

const (
	DBPath         = "./olt.db"
	JWTSecret      = "olt-mvp-secret-key-2024"
	SignalMin      = -28.0
	SignalMax      = -18.0
)

// Database models
type User struct {
	ID           int64  `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	Role         string `json:"role"`
	CreatedAt    string `json:"created_at"`
}

type OLT struct {
	ID           int64   `json:"id"`
	Name         string  `json:"name"`
	Vendor       string  `json:"vendor"`
	Model        string  `json:"model"`
	IPAddress    string  `json:"ip_address"`
	TotalPorts   int     `json:"total_ports"`
	LocationLat  float64 `json:"location_lat"`
	LocationLong float64 `json:"location_long"`
	Status       string  `json:"status"`
	CPU          float64 `json:"cpu"`
	Memory       float64 `json:"memory"`
	Temperature  float64 `json:"temperature"`
	Uptime       int64   `json:"uptime"`
	CreatedAt    string  `json:"created_at"`
}

type ONU struct {
	ID                int64   `json:"id"`
	OLTID             int64   `json:"olt_id"`
	PONPortIndex      int     `json:"pon_port_index"`
	SerialNumber      string  `json:"serial_number"`
	MACAddress        string  `json:"mac_address"`
	Status            string  `json:"status"`
	CurrentSignalDbm  float64 `json:"current_signal_dbm"`
	TxPower           float64 `json:"tx_power"`
	Distance          int     `json:"distance"`
	Vendor            string  `json:"vendor"`
	Model             string  `json:"model"`
	SubscriberRefID   string  `json:"subscriber_ref_id"`
	CustomerName      string  `json:"customer_name"`
	CustomerPhone     string  `json:"customer_phone"`
	LastSeen          string  `json:"last_seen"`
	CreatedAt         string  `json:"created_at"`
}

type Alarm struct {
	ID           int64  `json:"id"`
	Severity     string `json:"severity"`
	Message      string `json:"message"`
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
	Status       string `json:"status"`
	CreatedAt    string `json:"created_at"`
	AckedBy      string `json:"acked_by"`
	AckedAt      string `json:"acked_at"`
}

type SignalMetric struct {
	ID          int64   `json:"id"`
	ONUSerial   string  `json:"onu_serial"`
	SignalValue float64 `json:"signal_value"`
	RxPower     float64 `json:"rx_power"`
	TxPower     float64 `json:"tx_power"`
	Timestamp   string  `json:"timestamp"`
}

type DashboardStats struct {
	TotalOLTs       int `json:"total_olts"`
	TotalONUs       int `json:"total_onus"`
	OnlineONUs      int `json:"online_onus"`
	OfflineONUs     int `json:"offline_onus"`
	CriticalAlarms  int `json:"critical_alarms"`
	MajorAlarms     int `json:"major_alarms"`
	MinorAlarms     int `json:"minor_alarms"`
	WarningAlarms   int `json:"warning_alarms"`
}

var db *sql.DB

func initDB() {
	var err error
	db, err = sql.Open("sqlite", DBPath)
	if err != nil {
		log.Fatal(err)
	}

	// Create tables
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'viewer',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS olts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		vendor TEXT NOT NULL,
		model TEXT,
		ip_address TEXT NOT NULL,
		total_ports INTEGER DEFAULT 8,
		location_lat REAL,
		location_long REAL,
		status TEXT DEFAULT 'online',
		cpu REAL DEFAULT 0,
		memory REAL DEFAULT 0,
		temperature REAL DEFAULT 0,
		uptime INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS onus (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		olt_id INTEGER NOT NULL,
		pon_port_index INTEGER NOT NULL,
		serial_number TEXT UNIQUE NOT NULL,
		mac_address TEXT,
		status TEXT DEFAULT 'offline',
		current_signal_dbm REAL DEFAULT -30,
		tx_power REAL DEFAULT 0,
		distance INTEGER DEFAULT 0,
		vendor TEXT,
		model TEXT,
		subscriber_ref_id TEXT,
		customer_name TEXT,
		customer_phone TEXT,
		last_seen DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(olt_id) REFERENCES olts(id)
	);

	CREATE TABLE IF NOT EXISTS alarms (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		severity TEXT NOT NULL,
		message TEXT NOT NULL,
		resource_type TEXT NOT NULL,
		resource_id TEXT NOT NULL,
		status TEXT DEFAULT 'active',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		acked_by TEXT,
		acked_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS signal_metrics (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		onu_serial TEXT NOT NULL,
		signal_value REAL NOT NULL,
		rx_power REAL,
		tx_power REAL,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_onus_olt_id ON onus(olt_id);
	CREATE INDEX IF NOT EXISTS idx_onus_status ON onus(status);
	CREATE INDEX IF NOT EXISTS idx_alarms_status ON alarms(status);
	CREATE INDEX IF NOT EXISTS idx_alarms_severity ON alarms(severity);
	`

	_, err = db.Exec(schema)
	if err != nil {
		log.Fatal(err)
	}

	// Seed initial data
	seedData()
}

func seedData() {
	// Check if users exist
	var count int
	db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count > 0 {
		return
	}

	// Create default users
	users := []struct {
		username string
		password string
		role     string
	}{
		{"admin", "admin123", "admin"},
		{"noc", "noc123", "noc"},
		{"viewer", "viewer123", "viewer"},
	}

	for _, u := range users {
		hash, _ := bcrypt.GenerateFromPassword([]byte(u.password), bcrypt.DefaultCost)
		db.Exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", u.username, string(hash), u.role)
	}

	// Create sample OLTs
	vendors := []string{"ZTE", "Huawei", "Fiberhome"}
	locations := []struct {
		lat  float64
		long float64
		loc  string
	}{
		{13.7563, 100.5018, "Bangkok Central"},
		{13.0823, 100.3412, "Chonburi"},
		{12.7790, 101.1459, "Rayong"},
		{14.9799, 102.0779, "Nakhon Ratchasima"},
		{15.1184, 104.8984, "Ubon Ratchathani"},
	}

	for i, loc := range locations {
		oltName := fmt.Sprintf("OLT-%s-%02d", strings.Split(loc.loc, " ")[0], i+1)
		vendor := vendors[i%len(vendors)]
		db.Exec(`INSERT INTO olts (name, vendor, model, ip_address, total_ports, location_lat, location_long, status, cpu, memory, temperature, uptime) 
			VALUES (?, ?, ?, ?, ?, ?, ?, 'online, ?, ?, ?, ?)`,
			oltName, vendor, "C300", fmt.Sprintf("10.%d.%d.1", i/10+1, i%10+1), 8, loc.lat, loc.long,
			float64(20+rand.Intn(30)), float64(30+rand.Intn(40)), float64(35+rand.Intn(20)), int64(86400+rand.Intn(86400*7)))
	}

	// Create sample ONUs for each OLT
	var oltCount int
	db.QueryRow("SELECT COUNT(*) FROM olts").Scan(&oltCount)

	for oltID := 1; oltID <= oltCount; oltID++ {
		for port := 0; port < 8; port++ {
			onuCount := 16 + rand.Intn(48) // 16-64 ONUs per port
			for j := 0; j < onuCount; j++ {
				serial := fmt.Sprintf("ALCL%08X", rand.Intn(0xFFFFFFFF))
				mac := fmt.Sprintf("00:1A:2B:%02X:%02X:%02X", rand.Intn(256), rand.Intn(256), rand.Intn(256))
				status := "online"
				if rand.Float32() < 0.05 {
					status = "offline"
				}
				signal := SignalMin + rand.Float64()*(SignalMax-SignalMin)
				txPower := 1.5 + rand.Float64()*2.0

				db.Exec(`INSERT INTO onus (olt_id, pon_port_index, serial_number, mac_address, status, current_signal_dbm, tx_power, distance, vendor, model, subscriber_ref_id, customer_name, customer_phone, last_seen)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					oltID, port, serial, mac, status, signal, txPower, 1000+rand.Intn(20000),
					"ZTE", "F660", fmt.Sprintf("SUB%06d", rand.Intn(999999)),
					fmt.Sprintf("Customer %d", rand.Intn(9999)),
					fmt.Sprintf("08%d", 1000000+rand.Intn(9000000)),
					time.Now().Add(-time.Duration(rand.Intn(86400))*time.Second).Format("2006-01-02 15:04:05"))
			}
		}
	}

	// Create sample alarms
	alarmTypes := []struct {
		severity string
		message  string
	}{
		{"critical", "ONU Loss of Signal - Multiple ONUs affected"},
		{"critical", "OLT Device Unreachable"},
		{"major", "High CPU Usage on OLT"},
		{"major", "PON Port Traffic Threshold Exceeded"},
		{"minor", "Temperature Warning"},
		{"warning", "Signal Degradation Detected"},
	}

	for i := 0; i < 15; i++ {
		alarm := alarmTypes[rand.Intn(len(alarmTypes))]
		resourceType := "onu"
		if rand.Float32() < 0.2 {
			resourceType = "olt"
		}
		db.Exec(`INSERT INTO alarms (severity, message, resource_type, resource_id, status) VALUES (?, ?, ?, ?, ?)`,
			alarm.severity, alarm.message, resourceType, fmt.Sprintf("RES-%06d", rand.Intn(999999)), "active")
	}

	log.Println("Database seeded successfully!")
}

// JWT Middleware
func JWTRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString = strings.TrimPrefix(tokenString, "Bearer ")
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(JWTSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		claims, _ := token.Claims.(jwt.MapClaims)
		c.Set("user_id", claims["user_id"])
		c.Set("username", claims["username"])
		c.Set("role", claims["role"])

		c.Next()
	}
}

// Handlers
func login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user User
	err := db.QueryRow("SELECT id, username, password_hash, role FROM users WHERE username = ?", req.Username).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.Role)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"role":     user.Role,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, _ := token.SignedString([]byte(JWTSecret))

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"role":     user.Role,
		},
	})
}

func getDashboardStats(c *gin.Context) {
	var stats DashboardStats

	db.QueryRow("SELECT COUNT(*) FROM olts").Scan(&stats.TotalOLTs)
	db.QueryRow("SELECT COUNT(*) FROM onus").Scan(&stats.TotalONUs)
	db.QueryRow("SELECT COUNT(*) FROM onus WHERE status = 'online'").Scan(&stats.OnlineONUs)
	db.QueryRow("SELECT COUNT(*) FROM onus WHERE status = 'offline'").Scan(&stats.OfflineONUs)
	db.QueryRow("SELECT COUNT(*) FROM alarms WHERE status = 'active' AND severity = 'critical'").Scan(&stats.CriticalAlarms)
	db.QueryRow("SELECT COUNT(*) FROM alarms WHERE status = 'active' AND severity = 'major'").Scan(&stats.MajorAlarms)
	db.QueryRow("SELECT COUNT(*) FROM alarms WHERE status = 'active' AND severity = 'minor'").Scan(&stats.MinorAlarms)
	db.QueryRow("SELECT COUNT(*) FROM alarms WHERE status = 'active' AND severity = 'warning'").Scan(&stats.WarningAlarms)

	c.JSON(http.StatusOK, stats)
}

func getOLTs(c *gin.Context) {
	rows, err := db.Query(`SELECT id, name, vendor, model, ip_address, total_ports, status, cpu, memory, temperature, uptime FROM olts ORDER BY id`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var olts []OLT
	for rows.Next() {
		var olt OLT
		err := rows.Scan(&olt.ID, &olt.Name, &olt.Vendor, &olt.Model, &olt.IPAddress, &olt.TotalPorts, &olt.Status, &olt.CPU, &olt.Memory, &olt.Temperature, &olt.Uptime)
		if err != nil {
			continue
		}

		// Get ONU counts
		db.QueryRow("SELECT COUNT(*) FROM onus WHERE olt_id = ? AND status = 'online'", olt.ID).Scan(&olt.TotalPorts)
		db.QueryRow("SELECT COUNT(*) FROM onus WHERE olt_id = ?", olt.ID).Scan(&olt.TotalPorts)

		olts = append(olts, olt)
	}

	c.JSON(http.StatusOK, olts)
}

func getOLTByID(c *gin.Context) {
	id := c.Param("id")

	var olt OLT
	err := db.QueryRow(`SELECT id, name, vendor, model, ip_address, total_ports, location_lat, location_long, status, cpu, memory, temperature, uptime FROM olts WHERE id = ?`, id).Scan(
		&olt.ID, &olt.Name, &olt.Vendor, &olt.Model, &olt.IPAddress, &olt.TotalPorts, &olt.LocationLat, &olt.LocationLong, &olt.Status, &olt.CPU, &olt.Memory, &olt.Temperature, &olt.Uptime)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "OLT not found"})
		return
	}

	// Get PON port stats
	type PonPortStats struct {
		Index       int     `json:"index"`
		TotalONUs   int     `json:"total_onus"`
		OnlineONUs  int     `json:"online_onus"`
		AvgSignal   float64 `json:"avg_signal"`
		TrafficUtil float64 `json:"traffic_util"`
	}

	var ports []PonPortStats
	for i := 0; i < olt.TotalPorts; i++ {
		var stats PonPortStats
		stats.Index = i
		db.QueryRow("SELECT COUNT(*), SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END), AVG(current_signal_dbm) FROM onus WHERE olt_id = ? AND pon_port_index = ?", olt.ID, i).Scan(&stats.TotalONUs, &stats.OnlineONUs, &stats.AvgSignal)
		stats.TrafficUtil = float64(stats.OnlineONUs) / 64.0 * 100
		ports = append(ports, stats)
	}

	c.JSON(http.StatusOK, gin.H{"olt": olt, "ports": ports})
}

func getONUs(c *gin.Context) {
	oltID := c.Query("olt_id")
	status := c.Query("status")
	search := c.Query("search")

	query := "SELECT id, olt_id, pon_port_index, serial_number, mac_address, status, current_signal_dbm, tx_power, distance, vendor, model, subscriber_ref_id, customer_name, customer_phone, last_seen FROM onus WHERE 1=1"
	args := []interface{}{}

	if oltID != "" {
		query += " AND olt_id = ?"
		args = append(args, oltID)
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}
	if search != "" {
		query += " AND (serial_number LIKE ? OR mac_address LIKE ? OR customer_name LIKE ? OR subscriber_ref_id LIKE ?)"
		searchPattern := "%" + search + "%"
		args = append(args, searchPattern, searchPattern, searchPattern, searchPattern)
	}

	query += " LIMIT 100"

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var onus []ONU
	for rows.Next() {
		var onu ONU
		err := rows.Scan(&onu.ID, &onu.OLTID, &onu.PONPortIndex, &onu.SerialNumber, &onu.MACAddress, &onu.Status, &onu.CurrentSignalDbm, &onu.TxPower, &onu.Distance, &onu.Vendor, &onu.Model, &onu.SubscriberRefID, &onu.CustomerName, &onu.CustomerPhone, &onu.LastSeen)
		if err != nil {
			continue
		}
		onus = append(onus, onu)
	}

	c.JSON(http.StatusOK, onus)
}

func getONUBySerial(c *gin.Context) {
	serial := c.Param("serial")

	var onu ONU
	err := db.QueryRow(`SELECT id, olt_id, pon_port_index, serial_number, mac_address, status, current_signal_dbm, tx_power, distance, vendor, model, subscriber_ref_id, customer_name, customer_phone, last_seen FROM onus WHERE serial_number = ?`, serial).Scan(
		&onu.ID, &onu.OLTID, &onu.PONPortIndex, &onu.SerialNumber, &onu.MACAddress, &onu.Status, &onu.CurrentSignalDbm, &onu.TxPower, &onu.Distance, &onu.Vendor, &onu.Model, &onu.SubscriberRefID, &onu.CustomerName, &onu.CustomerPhone, &onu.LastSeen)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ONU not found"})
		return
	}

	c.JSON(http.StatusOK, onu)
}

func rebootONU(c *gin.Context) {
	serial := c.Param("serial")

	result, err := db.Exec("UPDATE onus SET status = 'offline' WHERE serial_number = ?", serial)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "ONU not found"})
		return
	}

	// Create alarm
	db.Exec(`INSERT INTO alarms (severity, message, resource_type, resource_id, status) VALUES (?, ?, ?, ?, ?)`,
		"warning", "ONU Reboot Initiated", "onu", serial, "active")

	c.JSON(http.StatusOK, gin.H{"message": "ONU reboot initiated", "serial": serial})
}

func getAlarms(c *gin.Context) {
	status := c.Query("status")
	severity := c.Query("severity")

	query := "SELECT id, severity, message, resource_type, resource_id, status, created_at, acked_by, acked_at FROM alarms WHERE 1=1"
	args := []interface{}{}

	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}
	if severity != "" {
		query += " AND severity = ?"
		args = append(args, severity)
	}

	query += " ORDER BY created_at DESC LIMIT 100"

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var alarms []Alarm
	for rows.Next() {
		var alarm Alarm
		err := rows.Scan(&alarm.ID, &alarm.Severity, &alarm.Message, &alarm.ResourceType, &alarm.ResourceID, &alarm.Status, &alarm.CreatedAt, &alarm.AckedBy, &alarm.AckedAt)
		if err != nil {
			continue
		}
		alarms = append(alarms, alarm)
	}

	c.JSON(http.StatusOK, alarms)
}

func acknowledgeAlarm(c *gin.Context) {
	id := c.Param("id")
	username, _ := c.Get("username")

	result, err := db.Exec("UPDATE alarms SET status = 'acked', acked_by = ?, acked_at = datetime('now') WHERE id = ?", username, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alarm not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alarm acknowledged"})
}

func getSignalHistory(c *gin.Context) {
	serial := c.Query("serial")
	hours := c.DefaultQuery("hours", "24")

	limit := 288 // 24 hours with 5-minute intervals
	if hours == "1" {
		limit = 12
	}

	rows, err := db.Query(`SELECT signal_value, rx_power, tx_power, timestamp FROM signal_metrics 
		WHERE onu_serial = ? AND timestamp > datetime('now', '-' || ? || ' hours')
		ORDER BY timestamp ASC LIMIT ?`, serial, hours, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var metrics []SignalMetric
	for rows.Next() {
		var m SignalMetric
		err := rows.Scan(&m.SignalValue, &m.RxPower, &m.TxPower, &m.Timestamp)
		if err != nil {
			continue
		}
		metrics = append(metrics, m)
	}

	c.JSON(http.StatusOK, metrics)
}

// Signal simulation goroutine
func startSignalSimulation() {
	ticker := time.NewTicker(5 * time.Second)
	go func() {
		for range ticker.C {
			// Randomly update signal values for online ONUs
			db.Exec(`UPDATE onus SET 
				current_signal_dbm = CASE 
					WHEN status = 'online' THEN current_signal_dbm + (random() % 10 - 5) * 0.1 
					ELSE current_signal_dbm 
				END,
				current_signal_dbm = CASE 
					WHEN current_signal_dbm < -30 THEN -25
					WHEN current_signal_dbm > -15 THEN -20
					ELSE current_signal_dbm
				END
			`)

			// Randomly toggle some ONUs offline/online (1% chance)
			if rand.Float32() < 0.01 {
				db.Exec(`UPDATE onus SET status = CASE 
					WHEN status = 'online' THEN 'offline' 
					ELSE 'online' 
				END WHERE random() % 100 = 0`)
			}

			// Insert signal metrics
			db.Exec(`INSERT INTO signal_metrics (onu_serial, signal_value, rx_power, tx_power, timestamp)
				SELECT serial_number, current_signal_dbm, current_signal_dbm, tx_power, datetime('now')
				FROM onus WHERE status = 'online' AND random() % 10 = 0`)
		}
	}()
}

func main() {
	// Initialize database
	initDB()

	// Start signal simulation
	startSignalSimulation()

	// Setup Gin
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Public routes
	r.POST("/api/login", login)

	// Protected routes
	api := r.Group("/api")
	api.Use(JWTRequired())
	{
		// Dashboard
		api.GET("/stats/global", getDashboardStats)

		// OLTs
		api.GET("/olts", getOLTs)
		api.GET("/olts/:id", getOLTByID)

		// ONUs
		api.GET("/onus", getONUs)
		api.GET("/onus/:serial", getONUBySerial)
		api.POST("/onus/:serial/reboot", rebootONU)
		api.GET("/onus/:serial/signal-history", getSignalHistory)

		// Alarms
		api.GET("/alarms", getAlarms)
		api.POST("/alarms/:id/acknowledge", acknowledgeAlarm)
	}

	// Serve static files in production
	if os.Getenv("ENV") == "production" {
		r.Static("/static", "./static")
		r.LoadHTMLGlob("templates/*")
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("OLT MVP Backend running on port %s", port)
	r.Run(":" + port)
}
