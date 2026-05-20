@echo off
title FiscalConf - Iniciando...
color 0A

echo.
echo  =============================================
echo   FISCALCONF - Reforma Tributaria 2026
echo  =============================================
echo.
echo  Aguarde, iniciando o sistema...
echo.

:: Instala dependencias se necessario
if not exist "node_modules" (
    echo  Primeira execucao - instalando componentes...
    echo  Isso pode demorar alguns minutos...
    echo.
    npm install
    echo.
)

:: Abre o navegador apos 4 segundos
start "" timeout /t 4 /nobreak >nul & start "" "http://localhost:5000"

:: Inicia o servidor
echo  Sistema iniciando em: http://localhost:5000
echo.
echo  DEIXE ESTA JANELA ABERTA enquanto usar o sistema.
echo  Para encerrar: feche esta janela ou pressione CTRL+C
echo.
npm run dev

pause
