@echo off
REM Solaria Agent - shim para cmd.exe (el .ps1 no corre directo en cmd).
setlocal
set "BIN=%LOCALAPPDATA%\solaria\solaria-agent.exe"
if exist "%BIN%" (
  start "" "%BIN%" %*
  exit /b 0
)
where solaria-agent >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" solaria-agent %*
  exit /b 0
)
echo Error: no se encuentra el binario de Solaria.
echo Instalalo con el instalador .exe del Release (recomendado) o con:
echo   irm https://raw.githubusercontent.com/Angelcmp/solaria/main/install.ps1 ^| iex
exit /b 1
