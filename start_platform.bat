@echo off
echo ==================================================
echo   Store Intelligence System - MVP Startup
echo ==================================================
echo.

echo [1/4] MongoDB (optional - use Docker: docker compose up -d mongodb)
echo       Ensure MongoDB is running on mongodb://127.0.0.1:27017
echo.

echo [2/4] Backend API (Node.js + Express + Socket.IO)...
cd backend
if not exist node_modules (
  call npm install
)
start cmd /k "title StoreIntel-Backend && npm run dev"
cd ..

timeout /t 3 /nobreak >nul

echo [3/4] Frontend Dashboard (React)...
cd frontend
if not exist node_modules (
  call npm install
)
start cmd /k "title StoreIntel-Frontend && npm run dev"
cd ..

echo.
echo [4/4] AI Service (optional - run in separate terminal):
echo   cd ai-service
echo   pip install -r requirements.txt
echo   python detection.py
echo.
echo ==================================================
echo   Backend:  http://localhost:5000/api/health
echo   Dashboard: http://localhost:3000
echo ==================================================
