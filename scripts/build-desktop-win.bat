@echo off
REM PlumbPro Inventory Desktop Build Script for Windows
REM This script builds the Windows installer (.exe)

echo =========================================
echo PlumbPro Inventory Desktop Build (Windows)
echo =========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Get the project root directory
set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

echo Step 0: Cleaning old builds...
if exist "dist" rmdir /s /q "dist"
if exist "desktop\dist" rmdir /s /q "desktop\dist"
if exist "desktop\release" rmdir /s /q "desktop\release"
echo Done!
echo.

echo Step 1: Installing frontend dependencies...
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo ERROR: Failed to install frontend dependencies
    pause
    exit /b 1
)
echo Done!
echo.

echo Step 2: Building frontend...
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed
    pause
    exit /b 1
)
echo Done!
echo.

echo Step 3: Installing desktop dependencies...
cd desktop
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install desktop dependencies
    pause
    exit /b 1
)
echo Done!
echo.

echo Step 4: Building Windows installer (.exe)...
echo This may take a few minutes...
call npm run package:win
if errorlevel 1 (
    echo ERROR: Desktop build failed
    pause
    exit /b 1
)
echo Done!
echo.

echo =========================================
echo BUILD COMPLETED SUCCESSFULLY!
echo =========================================
echo.
echo Windows installer location:
echo   desktop\release\[version]\PlumbPro-Inventory-Setup-[version].exe
echo.
echo Next steps:
echo   1. Test the installer: .\desktop\release\[version]\PlumbPro-Inventory-Setup-[version].exe
echo   2. Upload to GitHub Releases for distribution
echo.
pause
