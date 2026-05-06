# ============================================================
# Zilcycler Release Keystore Generator
# Run ONCE to create the production signing keystore.
# DO NOT run this if zilcycler-release.keystore already exists.
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Zilcycler Release Keystore Generator" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if keytool exists (using Get-Command, more reliable than try/catch)
$keytoolCmd = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytoolCmd) {
    Write-Host "ERROR: keytool command not found." -ForegroundColor Red
    Write-Host "Install JDK 17+ and ensure it's on your PATH." -ForegroundColor Yellow
    Write-Host "Download: https://adoptium.net/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found keytool at: $($keytoolCmd.Source)" -ForegroundColor Green
Write-Host ""

# Check if keystore already exists - DO NOT overwrite
$keystorePath = "zilcycler-release.keystore"
if (Test-Path $keystorePath) {
    Write-Host "ERROR: $keystorePath already exists!" -ForegroundColor Red
    Write-Host "If you really want to regenerate it, delete the existing file first." -ForegroundColor Yellow
    Write-Host "WARNING: Regenerating means losing the ability to update your existing Play Store app." -ForegroundColor Red
    exit 1
}

Write-Host "This script will generate a release signing keystore for your app." -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANT REMINDERS:" -ForegroundColor Yellow
Write-Host "  1. This keystore is PERMANENT - you cannot change it after publishing." -ForegroundColor Yellow
Write-Host "  2. If you LOSE it, you can never update your app on Play Store." -ForegroundColor Yellow
Write-Host "  3. If someone STEALS it, they can publish malicious updates as you." -ForegroundColor Yellow
Write-Host "  4. Back it up to at least TWO secure locations after generation." -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Type 'yes' to continue"
if ($confirm -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "You will now be prompted for keystore details. Use the following:" -ForegroundColor Cyan
Write-Host "  - Keystore password: a STRONG password (min 12 chars). WRITE IT DOWN." -ForegroundColor Cyan
Write-Host "  - Key password: SAME as keystore password (simpler)." -ForegroundColor Cyan
Write-Host "  - First and last name: Your full legal name OR company name." -ForegroundColor Cyan
Write-Host "  - Organizational unit: e.g. 'Engineering' or just press Enter." -ForegroundColor Cyan
Write-Host "  - Organization: 'Zilcycler' (or your registered business name)." -ForegroundColor Cyan
Write-Host "  - City/Locality: e.g. 'Lagos'" -ForegroundColor Cyan
Write-Host "  - State/Province: e.g. 'Lagos State'" -ForegroundColor Cyan
Write-Host "  - Country code: 'NG' (2-letter ISO code for Nigeria)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Enter when ready to begin keystore generation..."
Read-Host

# Generate keystore using RSA 2048-bit key, valid for 27 years (Play Store recommendation)
& keytool -genkey -v `
    -keystore $keystorePath `
    -alias zilcycler `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storetype PKCS12

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Keystore generation FAILED." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  Keystore generated successfully!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "File created: $((Get-Item $keystorePath).FullName)" -ForegroundColor Green
Write-Host "Size: $((Get-Item $keystorePath).Length) bytes" -ForegroundColor Green
Write-Host ""
Write-Host "CRITICAL NEXT STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. BACKUP THE KEYSTORE FILE TO MULTIPLE LOCATIONS:" -ForegroundColor Yellow
Write-Host "   - Encrypted USB drive (offline)" -ForegroundColor White
Write-Host "   - Password-protected cloud storage (e.g. Bitwarden Send, 1Password)" -ForegroundColor White
Write-Host "   - Encrypted email to yourself" -ForegroundColor White
Write-Host ""
Write-Host "2. SAVE THE PASSWORD IN A PASSWORD MANAGER:" -ForegroundColor Yellow
Write-Host "   - Bitwarden, 1Password, or Google Password Manager" -ForegroundColor White
Write-Host "   - Write it on physical paper as backup" -ForegroundColor White
Write-Host ""
Write-Host "3. ADD KEYSTORE TO .gitignore (already done by Stage 2D)." -ForegroundColor Yellow
Write-Host "   NEVER COMMIT THE KEYSTORE TO GIT." -ForegroundColor Red
Write-Host ""
Write-Host "4. Verify the keystore details:" -ForegroundColor Yellow
Write-Host "   keytool -list -v -keystore $keystorePath" -ForegroundColor White
Write-Host ""
Write-Host "Once backed up, proceed to Section C of Stage 2D for the AAB build." -ForegroundColor Cyan