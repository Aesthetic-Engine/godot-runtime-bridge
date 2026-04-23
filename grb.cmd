@echo off
setlocal

where node >nul 2>nul
if errorlevel 1 (
  >&2 echo GRB requires Node.js on PATH.
  exit /b 1
)

set "SCRIPT_DIR=%~dp0"
node "%SCRIPT_DIR%cli\grb.mjs" %*
exit /b %ERRORLEVEL%
