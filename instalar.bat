@echo off
chcp 65001 >nul
title GissBot — Instalador

echo ============================================================
echo   GissBot — Instalacao automatica
echo ============================================================
echo.

:: Verifica Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado.
    echo Baixe em: https://www.python.org/downloads/
    echo Marque "Add Python to PATH" durante a instalacao.
    pause
    exit /b 1
)

echo [1/3] Instalando dependencias Python...
python -m pip install --upgrade pip --quiet
python -m pip install playwright requests pillow playwright-stealth --quiet
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
)

echo [2/3] Instalando navegador Chromium...
python -m playwright install chromium
if errorlevel 1 (
    echo [ERRO] Falha ao instalar Chromium.
    pause
    exit /b 1
)

echo [3/3] Tudo pronto!
echo.
echo ============================================================
echo   Iniciando GissBot...
echo ============================================================
python app_giss.py

pause
