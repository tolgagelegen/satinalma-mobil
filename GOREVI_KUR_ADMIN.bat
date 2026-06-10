@echo off
:: Yonetici olarak calistir
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Yonetici yetkisi gerekli, yukseltiliyor...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

echo Gorev Zamanlayici gorevi olusturuluyor...
powershell -ExecutionPolicy Bypass -File "%~dp0gorev_kur.ps1"
echo.
echo Tamamlandi. Bu pencereyi kapatabilirsiniz.
pause
