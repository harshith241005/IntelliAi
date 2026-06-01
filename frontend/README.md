# Store Intelligence Edge Platform

An AI-driven operational dashboard for physical retail stores. The system processes video CCTV streams using YOLOv8, maps visitors to configured zones, and ingests these telemetry events into an asynchronous Python FastAPI backend. The results are visible through a React dashboard.

## Quick Start

### 1. Launch the Backend API
cd store-intelligence
.\venv\Scripts\activate
pip install -r requirements.txt
python run_backend.py

### 2. Launch the AI Pipeline
cd store-intelligence
.\venv\Scripts\activate
python runner.py --source 0

### 3. Start the Frontend
cd frontend
npm install
npm run dev
