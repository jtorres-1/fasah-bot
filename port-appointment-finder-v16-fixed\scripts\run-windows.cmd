@echo off
setlocal
cd /d "%~dp0.."

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed. Install LTS from https://nodejs.org/
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo npm not found. Reinstall Node.js LTS from https://nodejs.org/
  exit /b 1
)

set NEED_INSTALL=0
if not exist "node_modules\" set NEED_INSTALL=1
if "%NEED_INSTALL%"=="0" (
  call npm ls prompts --omit=dev >nul 2>&1
  if errorlevel 1 set NEED_INSTALL=1
)

if "%NEED_INSTALL%"=="1" (
  echo Installing dependencies...
  call npm ci --omit=dev
  if errorlevel 1 (
    echo npm ci failed, trying npm install --omit=dev
    call npm install --omit=dev
    if errorlevel 1 exit /b 1
  )
)

node dist\index.js
exit /b %ERRORLEVEL%
