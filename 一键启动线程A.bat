@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\launch_preview.ps1" -Port 8080 -Page "STYLE_PREVIEW_THREAD_A.html"
