# ============================================================
# Zilcycler Release AAB Build Script
# Builds a signed Android App Bundle (AAB) for Play Store upload
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Zilcycler Release Build (Signed AAB)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# ----- Pre-flight checks -----

# 1. Java - Capacitor 8 compiles against Java 21, JDK 17 will NOT work.
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
    # Android Studio's bundled JBR ships JDK 21
    $studioJbr = "C:\Program Files\Android\Android Studio\jbr"
    if (Test-Path "$studioJbr\bin\java.exe") {
        $env:JAVA_HOME = $studioJbr
    } else {
        foreach ($path in @("C:\Program Files\Microsoft", "C:\Program Files\Java", "C:\Program Files\Eclipse Adoptium")) {
            if (Test-Path $path) {
                $jdk = Get-ChildItem -Path $path -Filter "jdk-21*" -Directory -Recurse -Depth 1 -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($jdk) { $env:JAVA_HOME = $jdk.FullName; break }
            }
        }
    }
}

if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
    Write-Host "ERROR: JDK 21 not found. Capacitor 8 requires it." -ForegroundColor Red
    Write-Host "Install from https://adoptium.net/ or set `$env:JAVA_HOME manually." -ForegroundColor Yellow
    exit 1
}

$javaVersionLine = & "$env:JAVA_HOME\bin\java.exe" -version 2>&1 | Select-Object -First 1
if ($javaVersionLine -match '"(\d+)') {
    if ([int]$matches[1] -lt 21) {
        Write-Host "ERROR: Capacitor 8 requires JDK 21, found JDK $($matches[1]) at $env:JAVA_HOME." -ForegroundColor Red
        exit 1
    }
}
Write-Host "[1/6] Java OK ($env:JAVA_HOME)" -ForegroundColor Green

# 2. Keystore exists
if (-not (Test-Path "zilcycler-release.keystore")) {
    Write-Host "ERROR: zilcycler-release.keystore not found at repo root." -ForegroundColor Red
    Write-Host "Run generate-keystore.ps1 first, or restore from your backup." -ForegroundColor Yellow
    exit 1
}
Write-Host "[2/6] Keystore OK" -ForegroundColor Green

# 3. keystore.properties exists
if (-not (Test-Path "keystore.properties")) {
    Write-Host "ERROR: keystore.properties not found at repo root." -ForegroundColor Red
    Write-Host "Create it from the Stage 2D template, with your real password." -ForegroundColor Yellow
    exit 1
}
Write-Host "[3/6] keystore.properties OK" -ForegroundColor Green

# 4. android folder exists
if (-not (Test-Path "android")) {
    Write-Host "ERROR: android/ folder not found." -ForegroundColor Red
    Write-Host "Run 'npm run mobile:setup' to generate the android folder first." -ForegroundColor Yellow
    exit 1
}
Write-Host "[4/6] android/ folder OK" -ForegroundColor Green

# 5. Android SDK
$sdkPath = $env:ANDROID_HOME
if (-not $sdkPath) {
    $defaultSdk = "$env:USERPROFILE\AppData\Local\Android\Sdk"
    if (Test-Path $defaultSdk) {
        $sdkPath = $defaultSdk
        $env:ANDROID_HOME = $sdkPath
    }
}
if (-not $sdkPath) {
    Write-Host "ERROR: Android SDK not found." -ForegroundColor Red
    Write-Host "Install Android Studio and ensure SDK is at default location." -ForegroundColor Yellow
    exit 1
}
Write-Host "[5/6] Android SDK at: $sdkPath" -ForegroundColor Green

# Configure local.properties so Gradle finds the SDK
$sdkPathFormatted = $sdkPath -replace "\\", "/"
"sdk.dir=$sdkPathFormatted" | Out-File -FilePath "android\local.properties" -Encoding ascii
Write-Host "[6/6] android/local.properties configured" -ForegroundColor Green

Write-Host ""
Write-Host "Pre-flight checks passed. Starting build..." -ForegroundColor Cyan
Write-Host ""

# ----- Build web assets -----
Write-Host "Step 1/3: Building web assets (npm run build)..." -ForegroundColor Yellow
& cmd /c "npm run build"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Web build failed." -ForegroundColor Red
    exit 1
}

# ----- Sync to Capacitor -----
Write-Host ""
Write-Host "Step 2/3: Syncing to Capacitor (npx cap sync)..." -ForegroundColor Yellow
& cmd /c "npx cap sync"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Capacitor sync failed." -ForegroundColor Red
    exit 1
}

# ----- Build signed AAB -----
Write-Host ""
Write-Host "Step 3/3: Building signed AAB (this takes 3-5 minutes)..." -ForegroundColor Yellow
Set-Location android

& cmd /c ".\gradlew bundleRelease"
$gradleExit = $LASTEXITCODE

Set-Location ..

if ($gradleExit -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Gradle build failed (exit code $gradleExit)." -ForegroundColor Red
    Write-Host "Common causes:" -ForegroundColor Yellow
    Write-Host "  - JDK version mismatch (must be 17+)" -ForegroundColor White
    Write-Host "  - Wrong keystore password in keystore.properties" -ForegroundColor White
    Write-Host "  - Missing Android SDK 36" -ForegroundColor White
    Write-Host "  - ProGuard rule conflict (try minifyEnabled=false in build.gradle to test)" -ForegroundColor White
    exit 1
}

# ----- Success -----
$aabPath = "android\app\build\outputs\bundle\release\app-release.aab"
if (Test-Path $aabPath) {
    $aab = Get-Item $aabPath
    Write-Host ""
    Write-Host "==============================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESSFUL" -ForegroundColor Green
    Write-Host "==============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "AAB file: $($aab.FullName)" -ForegroundColor Green
    Write-Host "Size: $([Math]::Round($aab.Length / 1MB, 2)) MB" -ForegroundColor Green
    Write-Host "Modified: $($aab.LastWriteTime)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Upload this AAB to Google Play Console" -ForegroundColor White
    Write-Host "  2. Create a Closed Testing track first (NOT Production)" -ForegroundColor White
    Write-Host "  3. Add yourself as a tester" -ForegroundColor White
    Write-Host "  4. Test thoroughly before promoting to Production" -ForegroundColor White
    Write-Host ""
    
    $explorer = Read-Host "Open AAB folder in Explorer? (y/n)"
    if ($explorer -eq "y") {
        explorer.exe "android\app\build\outputs\bundle\release"
    }
} else {
    Write-Host "ERROR: AAB was not produced at expected path." -ForegroundColor Red
    Write-Host "Expected: $aabPath" -ForegroundColor Yellow
    exit 1
}