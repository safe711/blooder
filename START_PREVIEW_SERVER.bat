@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\scripts\serve_preview.ps1" -Port 8080
pause
