# Stellt den Ordner "upload" aus den aktuellen Projektdateien zusammen
# (alle .html-Seiten, robots.txt, sitemap.xml, assets/) und lädt ihn per
# verschlüsseltem FTP (FTPS) in public_html des Hetzner-Webhostings hoch.
#
# Aufruf:  powershell -ExecutionPolicy Bypass -File .\deploy.ps1
# Nur zusammenstellen, ohne Upload:  ... -File .\deploy.ps1 -NurVorbereiten
# Benutzername und Passwort stehen in konsoleH unter
# Domain -> Einstellungen -> Logindaten (FTP). Das Passwort wird nur
# verdeckt abgefragt und nirgends gespeichert.

param(
    [string]$FtpHost = 'www806.your-server.de',
    [string]$RemoteDir = 'public_html',
    # Nur den Ordner "upload" neu zusammenstellen, nichts hochladen
    [switch]$NurVorbereiten
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'upload'

# Upload-Ordner jedes Mal frisch aus dem Projekt zusammenstellen,
# damit immer der aktuelle Stand hochgeladen wird.
if (Test-Path $source) {
    # Nur den Inhalt leeren - der Ordner selbst darf z. B. im Explorer geöffnet sein
    Get-ChildItem -Path $source -Force | Remove-Item -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $source | Out-Null
}
Get-ChildItem -Path $PSScriptRoot -File | Where-Object { $_.Extension -eq '.html' -or $_.Name -in @('robots.txt', 'sitemap.xml') } |
    Copy-Item -Destination $source
Copy-Item -Path (Join-Path $PSScriptRoot 'assets') -Destination $source -Recurse
$count = (Get-ChildItem -Path $source -Recurse -File).Count
Write-Host "Upload-Ordner neu zusammengestellt: $count Dateien." -ForegroundColor Cyan

if ($NurVorbereiten) { exit 0 }

Write-Host ''
Write-Host "Upload nach ftps://$FtpHost/$RemoteDir/" -ForegroundColor Cyan
$user = Read-Host 'FTP-Benutzername'
$secure = Read-Host 'FTP-Passwort (Eingabe bleibt unsichtbar)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

# Zugangsdaten nur für die Dauer des Uploads in eine temporäre netrc-Datei,
# damit das Passwort nicht in der Befehlszeile steht.
$netrc = [IO.Path]::GetTempFileName()
try {
    # Passwörter mit Leer- oder Anführungszeichen in netrc-Schreibweise quoten
    $pw = $plain
    if ($pw -match '[\s"\\]') { $pw = '"' + ($pw -replace '\\', '\\' -replace '"', '\"') + '"' }
    [IO.File]::WriteAllText($netrc, "machine $FtpHost login $user password $pw", (New-Object Text.UTF8Encoding($false)))
    $pw = $null
    $plain = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    $files = Get-ChildItem -Path $source -Recurse -File | Sort-Object FullName
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
}
