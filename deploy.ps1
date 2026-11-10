# Stellt den Ordner "upload" aus den aktuellen Projektdateien zusammen
# (alle .html-Seiten, robots.txt, sitemap.xml, favicon.ico, .htaccess, assets/)
# und lädt ihn per verschlüsseltem FTP (FTPS) in public_html des
# Hetzner-Webhostings hoch.
#
# Aufruf:  powershell -ExecutionPolicy Bypass -File .\deploy.ps1
# Nur zusammenstellen, ohne Upload:  ... -File .\deploy.ps1 -NurVorbereiten
# Benutzername und Passwort stehen in konsoleH unter
# Domain -> Einstellungen -> Logindaten (FTP). Das Passwort wird nur
# verdeckt abgefragt und nirgends gespeichert.
#
# Was das Skript zusätzlich erledigt:
# - Versionsnummern von styles.css und main.js (?v=...) werden im Upload-Ordner
#   automatisch aus dem Dateiinhalt berechnet. Besucher bekommen dadurch nach
#   jeder Änderung sofort die neue Fassung, obwohl der Browser die Dateien
#   lange zwischenspeichern darf.
# - Die .htaccess (Komprimierung, Zwischenspeicher) wird zuerst hochgeladen und
#   danach geprüft, ob die Website noch antwortet. Bei einem Serverfehler wird
#   sie sofort wieder entfernt bzw. die vorherige Fassung zurückgespielt.

param(
    [string]$FtpHost = 'www806.your-server.de',
    [string]$RemoteDir = 'public_html',
    [string]$SiteUrl = 'https://clavis-itservice.de/',
    # Nur den Ordner "upload" neu zusammenstellen, nichts hochladen
    [switch]$NurVorbereiten
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'upload'
$utf8 = New-Object Text.UTF8Encoding($false)
$htMarker = 'Clavis IT Service - Auslieferung'

# Upload-Ordner jedes Mal frisch aus dem Projekt zusammenstellen,
# damit immer der aktuelle Stand hochgeladen wird.
if (Test-Path $source) {
    # Nur den Inhalt leeren - der Ordner selbst darf z. B. im Explorer geöffnet sein
    Get-ChildItem -Path $source -Force | Remove-Item -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $source | Out-Null
}
Get-ChildItem -Path $PSScriptRoot -File -Force |
    Where-Object { $_.Extension -eq '.html' -or $_.Name -in @('robots.txt', 'sitemap.xml', 'favicon.ico', '.htaccess') } |
    Copy-Item -Destination $source
Copy-Item -Path (Join-Path $PSScriptRoot 'assets') -Destination $source -Recurse

# Versionsnummern (?v=...) aus dem Inhalt von styles.css und main.js berechnen
$stamps = @{}
foreach ($asset in @('assets\css\styles.css', 'assets\js\main.js')) {
    $assetPath = Join-Path $source $asset
    if (Test-Path $assetPath) {
        $stamps[[IO.Path]::GetFileName($asset)] = (Get-FileHash -Path $assetPath -Algorithm SHA1).Hash.Substring(0, 8).ToLower()
    }
}
Get-ChildItem -Path $source -Filter '*.html' -File | ForEach-Object {
    $text = [IO.File]::ReadAllText($_.FullName, $utf8)
    $new = $text
    foreach ($name in $stamps.Keys) {
        $new = [regex]::Replace($new, [regex]::Escape($name) + '\?v=[0-9A-Za-z]+', ($name + '?v=' + $stamps[$name]))
    }
    if ($new -ne $text) { [IO.File]::WriteAllText($_.FullName, $new, $utf8) }
}

$count = (Get-ChildItem -Path $source -Recurse -File -Force).Count
Write-Host "Upload-Ordner neu zusammengestellt: $count Dateien." -ForegroundColor Cyan

if ($NurVorbereiten) { exit 0 }

Write-Host ''
Write-Host "Upload nach ftps://$FtpHost/$RemoteDir/" -ForegroundColor Cyan
$user = Read-Host 'FTP-Benutzername'
$secure = Read-Host 'FTP-Passwort (Eingabe bleibt unsichtbar)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

# Antwortet die Website? Liefert den HTTP-Status (0 = nicht erreichbar).
function Get-SiteStatus {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $response = Invoke-WebRequest -Uri $SiteUrl -UseBasicParsing -TimeoutSec 20
        return [int]$response.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

# Zugangsdaten nur für die Dauer des Uploads in eine temporäre netrc-Datei,
# damit das Passwort nicht in der Befehlszeile steht.
$netrc = [IO.Path]::GetTempFileName()
$oldHt = [IO.Path]::GetTempFileName()
try {
    # Passwörter mit Leer- oder Anführungszeichen in netrc-Schreibweise quoten
    $pw = $plain
    if ($pw -match '[\s"\\]') { $pw = '"' + ($pw -replace '\\', '\\' -replace '"', '\"') + '"' }
    [IO.File]::WriteAllText($netrc, "machine $FtpHost login $user password $pw", $utf8)
    $pw = $null
    $plain = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    # --- .htaccess: vorhandene Fassung auf dem Server sichern -----------------
    $htLocal = Join-Path $source '.htaccess'
    $uploadHt = Test-Path $htLocal
    $hadOldHt = $false
    if ($uploadHt) {
        & curl.exe --silent --ssl-reqd --netrc-file $netrc -o $oldHt "ftp://$FtpHost/$RemoteDir/.htaccess"
        if ($LASTEXITCODE -eq 0 -and (Get-Item $oldHt).Length -gt 0) {
            $hadOldHt = $true
            $oldText = [IO.File]::ReadAllText($oldHt)
            if ($oldText -notmatch [regex]::Escape($htMarker)) {
                $backup = Join-Path $PSScriptRoot ("htaccess-server-backup-{0}.txt" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
                Copy-Item $oldHt $backup
                Write-Host ''
                Write-Host 'Auf dem Server liegt bereits eine andere .htaccess.' -ForegroundColor Yellow
                Write-Host "Sicherungskopie gespeichert: $backup" -ForegroundColor Yellow
                $answer = Read-Host 'Durch die neue Datei aus dem Projekt ersetzen? (j/n)'
                if ($answer -notmatch '^[jJyY]') {
                    $uploadHt = $false
                    Write-Host 'Die .htaccess auf dem Server bleibt unverändert.' -ForegroundColor Yellow
                }
            }
        }
    }

    # .htaccess zuerst, danach alle übrigen Dateien
    $files = @(Get-ChildItem -Path $source -Recurse -File -Force | Where-Object { $_.Name -ne '.htaccess' } | Sort-Object FullName)
    if ($uploadHt) { $files = @(Get-Item -LiteralPath $htLocal -Force) + $files }
    $total = $files.Count
    $i = 0
    $failed = @()
    foreach ($f in $files) {
        $i++
        $rel = $f.FullName.Substring($source.Length + 1).Replace('\', '/')
        $url = "ftp://$FtpHost/$RemoteDir/$rel"
        Write-Host ("[{0,2}/{1}] {2}" -f $i, $total, $rel)
        & curl.exe --silent --show-error --ssl-reqd --ftp-create-dirs --netrc-file $netrc -T $f.FullName $url
        if ($LASTEXITCODE -ne 0) {
            $failed += $rel
            if ($i -eq 1) {
                Write-Host 'Erste Datei fehlgeschlagen – vermutlich falscher Benutzername oder falsches Passwort. Abbruch.' -ForegroundColor Red
                exit 1
            }
            continue
        }

        # Sicherheitsprüfung direkt nach der .htaccess: läuft die Website noch?
        if ($rel -eq '.htaccess') {
            Start-Sleep -Seconds 2
            $status = Get-SiteStatus
            if ($status -ge 500) {
                Write-Host "Die Website meldet nach der neuen .htaccess einen Serverfehler ($status)." -ForegroundColor Red
                if ($hadOldHt) {
                    & curl.exe --silent --show-error --ssl-reqd --netrc-file $netrc -T $oldHt $url
                    Write-Host 'Die vorherige .htaccess wurde zurückgespielt.' -ForegroundColor Yellow
                } else {
                    & curl.exe --silent --show-error --ssl-reqd --netrc-file $netrc -Q "DELE $RemoteDir/.htaccess" "ftp://$FtpHost/" | Out-Null
                    Write-Host 'Die .htaccess wurde wieder vom Server entfernt.' -ForegroundColor Yellow
                }
                Write-Host ("Status danach: {0}. Die übrigen Dateien werden trotzdem hochgeladen." -f (Get-SiteStatus)) -ForegroundColor Yellow
                $failed += '.htaccess (vom Server abgelehnt)'
            } else {
                Write-Host "       Website antwortet weiterhin (Status $status)." -ForegroundColor DarkGray
            }
        }
    }

    Write-Host ''
    if ($failed.Count -eq 0) {
        Write-Host "Fertig: $total Dateien hochgeladen." -ForegroundColor Green
    } else {
        Write-Host ("Fertig mit Fehlern: {0} von {1} Dateien nicht hochgeladen:" -f $failed.Count, $total) -ForegroundColor Yellow
        $failed | ForEach-Object { Write-Host "  $_" }
        exit 2
    }
}
finally {
    if (Test-Path $netrc) { Remove-Item $netrc -Force }
    if (Test-Path $oldHt) { Remove-Item $oldHt -Force }
}
