# Makefile for OLT MVP

.PHONY: help install frontend backend clean test

help:
	@echo "OLT MVP - Available Commands"
	@echo "======================================"
	@echo "make install       - Install all dependencies"
	@echo "make frontend      - Start frontend development server"
	@echo "make backend       - Start backend API server"
	@echo "make build         - Build frontend for production"
	@echo "make clean         - Clean build artifacts"
	@echo "make test          - Run tests"

install:
	@echo "Installing dependencies..."
	cd frontend && npm install
	cd backend && go mod download

frontend:
	@echo "Starting frontend..."
	cd frontend && npm run dev

backend:
	@echo "Starting backend..."
	cd backend && go run main.go

build:
	@echo "Building frontend..."
	cd frontend && npm run build
	@echo "Build complete! Output in frontend/dist/"

clean:
	@echo "Cleaning..."
	rm -rf frontend/dist
	rm -f backend/olt-server
	rm -f backend/olt.db
	rm -rf frontend/node_modules

test:
	@echo "Running tests..."
	cd frontend && npm run build
