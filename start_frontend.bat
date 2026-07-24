@echo off
setlocal enabledelayedexpansion

rem ============================================================
rem  Real Estate frontend development launcher
rem  Run this from the repository root (or double-click it).
rem ============================================================

echo Starting frontend...

rem --- Step 1: Move into the frontend directory (relative to this
rem     script's own location, so it works from any working dir).
cd /d "%~dp0frontend"
if errorlevel 1 (
    echo ERROR: Could not find the frontend directory next to this script.
    pause
    exit /b 1
)

rem --- Step 2: Verify this is really the frontend project
rem     (package.json must exist) before doing anything else.
if not exist "package.json" (
    echo ERROR: package.json not found in projects\real-estate\frontend. Aborting.
    pause
    exit /b 1
)

rem --- Step 3: Verify Node.js and npm are installed. Fail
rem     gracefully with a clear message if either is missing.
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found on PATH. Install it from https://nodejs.org and try again.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm was not found on PATH. It normally ships with Node.js - please reinstall Node.js.
    pause
    exit /b 1
)

rem --- Step 3: Install dependencies only if node_modules is missing.
if not exist "node_modules" (
    echo Installing dependencies, this may take a minute...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed. Check the output above for details.
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed, skipping npm install.
)

rem --- Step 3b: If .next contains production build output (next build
rem     was run here), the dev server's Turbopack HMR panics on that
rem     state and the browser reloads in a loop. Clear it first.
if exist ".next\BUILD_ID" (
    echo Removing stale production build cache ^(.next^) so the dev server starts clean...
    rmdir /s /q ".next"
)

rem --- Step 4: Start the Next.js dev server in its own window so
rem     this window is free to wait for it and open the browser.
rem     The dev server window stays open on its own to keep serving.
rem     Port 3001 is used (not the default 3000) because the
rem     betting project's frontend already occupies port 3000.
start "Real Estate Frontend - Dev Server" cmd /k "npm run dev -- -p 3001"

echo Waiting for development server...

rem --- Step 5: Poll http://localhost:3001 until it responds
rem     (or give up after ~60 seconds) before opening the browser.
set /a attempts=0
:waitloop
curl -s -o nul -w "" http://localhost:3001
if not errorlevel 1 goto serverup
set /a attempts+=1
if !attempts! geq 30 (
    echo WARNING: Server did not respond after 60 seconds. Opening browser anyway...
    goto openbrowser
)
timeout /t 2 >nul
goto waitloop

:serverup
:openbrowser
echo Opening browser...
start "" http://localhost:3001

echo Frontend is running.
echo (The dev server is running in a separate window - close that window to stop it.)
pause

endlocal
