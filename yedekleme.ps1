# ============================================================
# SATINALMA MOBİL - Otomatik Günlük Yedekleme Betiği
# Her gün G:\Yedekler\SATINALMA MOBİL\ altına yedek alır
# ============================================================

# ── AYARLAR ─────────────────────────────────────────────────
$SUPABASE_URL     = "https://nfkxadtjdvsuhiotgqay.supabase.co"
$SERVICE_ROLE_KEY = "BURAYA_SERVICE_ROLE_KEY_YAPISTIRIN"   # Supabase Dashboard > Settings > API > service_role
$YEDEK_KLASORU    = "G:\Yedekler\SATINALMA MOBİL"
$KACGUN_SAKLA     = 60    # Kaç günlük yedek saklansın (60 gün öncekiler silinir)

# ── KLASÖR HAZIRLA ───────────────────────────────────────────
$tarih        = Get-Date -Format "yyyy-MM-dd_HH-mm"
$gunluKlasor  = Join-Path $YEDEK_KLASORU $tarih
New-Item -ItemType Directory -Force -Path $gunluKlasor | Out-Null

# Log dosyası
$logDosyasi = Join-Path $YEDEK_KLASORU "yedekleme_log.txt"
function Yaz($mesaj) {
    $satir = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $mesaj"
    Write-Host $satir
    Add-Content -Path $logDosyasi -Value $satir -Encoding UTF8
}

Yaz "======================================================"
Yaz "Yedekleme başlatıldı → $gunluKlasor"

# ── SUPABASE API BAŞLIKLARI ──────────────────────────────────
$headers = @{
    "apikey"        = $SERVICE_ROLE_KEY
    "Authorization" = "Bearer $SERVICE_ROLE_KEY"
    "Content-Type"  = "application/json"
    "Prefer"        = "count=exact"
}

# ── TABLOLARI YEDEKLE ────────────────────────────────────────
$tablolar = @("orders", "profiles")

foreach ($tablo in $tablolar) {
    try {
        Yaz "$tablo tablosu indiriliyor..."

        $uri    = "$SUPABASE_URL/rest/v1/$tablo`?select=*&order=created_at.desc&limit=10000"
        $veri   = Invoke-RestMethod -Uri $uri -Headers $headers -Method GET

        $adet = $veri.Count

        # JSON olarak kaydet
        $jsonDosya = Join-Path $gunluKlasor "$tablo.json"
        $veri | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonDosya -Encoding UTF8

        # CSV olarak kaydet (Excel'de açılabilir)
        $csvDosya = Join-Path $gunluKlasor "$tablo.csv"
        if ($adet -gt 0) {
            $veri | Export-Csv -Path $csvDosya -NoTypeInformation -Encoding UTF8
        }

        Yaz "$tablo → $adet kayıt yedeklendi ✓"

    } catch {
        Yaz "HATA: $tablo tablosu yedeklenemedi! → $_"
    }
}

# ── ÖZET DOSYASI OLUŞTUR ─────────────────────────────────────
$ozet = @"
SATINALMA MOBİL - Yedekleme Özeti
==================================
Tarih    : $(Get-Date -Format 'dd.MM.yyyy HH:mm')
Klasör   : $gunluKlasor
Tablolar : $($tablolar -join ', ')
==================================
"@
$ozet | Out-File -FilePath (Join-Path $gunluKlasor "OZET.txt") -Encoding UTF8

# ── ESKİ YEDEKLERİ TEMİZLE ──────────────────────────────────
Yaz "$KACGUN_SAKLA günden eski yedekler temizleniyor..."
$sinirTarih = (Get-Date).AddDays(-$KACGUN_SAKLA)

Get-ChildItem -Path $YEDEK_KLASORU -Directory | Where-Object {
    $_.CreationTime -lt $sinirTarih
} | ForEach-Object {
    Remove-Item -Path $_.FullName -Recurse -Force
    Yaz "Silindi: $($_.Name)"
}

# ── BİTİŞ BİLDİRİMİ ─────────────────────────────────────────
Yaz "Yedekleme tamamlandı ✓"
Yaz "======================================================"

# Windows bildirim baloncuğu göster
Add-Type -AssemblyName System.Windows.Forms
$balon = New-Object System.Windows.Forms.NotifyIcon
$balon.Icon = [System.Drawing.SystemIcons]::Information
$balon.BalloonTipIcon  = "Info"
$balon.BalloonTipTitle = "Satınalma Mobil - Yedekleme Tamam ✓"
$balon.BalloonTipText  = "$(Get-Date -Format 'dd.MM.yyyy HH:mm') tarihli yedek G:\Yedekler\SATINALMA MOBİL\ klasörüne kaydedildi."
$balon.Visible = $true
$balon.ShowBalloonTip(8000)
Start-Sleep 2
$balon.Dispose()
