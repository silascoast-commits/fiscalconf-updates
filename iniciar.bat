@echo off
title FiscalConf - Iniciando...
color 0A

echo.
echo  =============================================
echo   FISCALCONF - Reforma Tributaria 2026
echo  =============================================
echo.
echo  Atualizando componentes, aguarde...
echo.

npm install

echo.
echo  Iniciando servidor...
echo.

:: Abre o navegador apos 6 segundos
start /b cmd /c "timeout /t 6 /nobreak >nul && start http://localhost:5000"

echo  Sistema rodando em: http://localhost:5000
echo.
echo  DEIXE ESTA JANELA ABERTA enquanto usar o sistema.
echo  Para encerrar: feche esta janela ou pressione CTRL+C
echo.

npm run dev

pause
