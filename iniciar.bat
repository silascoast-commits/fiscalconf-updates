@echo off
chcp 65001 >nul
title FiscalConf
cd /d "%~dp0"

echo ============================================
echo   FiscalConf - iniciando
echo ============================================

rem Executado de dentro do ZIP (WinRAR/7-Zip/Windows abrem so o .bat numa pasta temporaria)
if not exist "%~dp0package.json" (
  echo.
  echo [ATENCAO] O arquivo foi aberto de dentro do ZIP, sem extrair.
  echo Pasta atual: %~dp0
  echo.
  echo Feche o WinRAR, clique com o botao direito no ZIP e escolha
  echo "Extrair para..." ^(ex.: C:\FiscalConf^). Depois abra o iniciar.bat
  echo que esta DENTRO da pasta extraida.
  pause
  exit /b 1
)
if not exist "%~dp0dist\index.cjs" (
  echo.
  echo [ERRO] Pasta dist nao encontrada. Baixe o projeto completo novamente.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERRO] Node.js nao encontrado.
  echo Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo Node.js %%v encontrado.

rem Verifica se o banco de dados (better-sqlite3) funciona nesta maquina
node -e "new (require('better-sqlite3'))(':memory:')" >nul 2>nul
if errorlevel 1 (
  echo.
  echo Preparando as dependencias para o Windows ^(so na primeira vez, pode levar alguns minutos^)...
  call npm install
  node -e "new (require('better-sqlite3'))(':memory:')" >nul 2>nul
  if errorlevel 1 call npm rebuild better-sqlite3
  node -e "new (require('better-sqlite3'))(':memory:')" >nul 2>nul
  if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel preparar o banco de dados ^(better-sqlite3^).
    echo Tire um print desta janela e envie para o suporte.
    pause
    exit /b 1
  )
)

set NODE_ENV=production
if "%PORT%"=="" set PORT=5000

echo.
echo Sistema em http://localhost:%PORT%
echo Deixe esta janela ABERTA enquanto usa o sistema. Para encerrar, feche a janela.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:%PORT%/#/reforma"
node dist\index.cjs

echo.
echo O servidor parou. Se apareceu algum erro acima, tire um print e envie.
pause
