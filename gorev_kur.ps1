# Gorev Zamanlayici kurulum betigi
$skriptYolu = "C:\Users\Burçak Sarıgül\Satinalma Mobil\yedekleme.ps1"

# Eski gorevi kaldir (varsa)
Unregister-ScheduledTask -TaskName "SatinalmaMobilYedekleme" -Confirm:$false -ErrorAction SilentlyContinue

# Eylem: Her gun saat 18:00'de calistir
$eylem = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$skriptYolu`""

# Tetikleyici: Her gun saat 18:00
$tetikleyici = New-ScheduledTaskTrigger -Daily -At "18:00"

# Ayarlar: Bilgisayar kapali olsa bile bir sonraki baslatmada calistir
$ayarlar = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

# Gorevi kaydet
Register-ScheduledTask `
    -TaskName    "SatinalmaMobilYedekleme" `
    -Description "Satinalma Mobil - Her gun saat 18:00 otomatik yedekleme" `
    -Action      $eylem `
    -Trigger     $tetikleyici `
    -Settings    $ayarlar `
    -RunLevel    Highest `
    -Force

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Gorev Zamanlayici gorevi basariyla olusturuldu!" -ForegroundColor Green
Write-Host " Her gun saat 18:00'de otomatik yedek alinacak." -ForegroundColor Green
Write-Host " Konum: G:\Yedekler\SATINALMA MOBIL\" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
