Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Zilcycler Android Build Helper (v6)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check JAVA_HOME
if ($env:JAVA_HOME) {
    Write-Host "JAVA_HOME is already set to: $env:JAVA_HOME" -ForegroundColor Green
} else {
    Write-Host "JAVA_HOME is not set. Attempting to auto-locate JDK 17+..." -ForegroundColor Yellow
    
    # Capacitor 6 requires JDK 17+
    $searchPaths = @(
        "C:\Program Files\Microsoft",
        "C:\Program Files\Java",
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Android\Android Studio\jbr"
    )

    $found = $false
    foreach ($path in $searchPaths) {
        if (Test-Path $path) {
            # Capacitor 6 needs JDK 17 or 21
            $jdk = Get-ChildItem -Path $path -Filter "jdk-17*" -Directory -Recurse -Depth 1 -ErrorAction SilentlyContinue | Select-Object -First 1
            
            if (-not $jdk) {
                $jdk = Get-ChildItem -Path $path -Filter "jdk-21*" -Directory -Recurse -Depth 1 -ErrorAction SilentlyContinue | Select-Object -First 1
            }
            
            if (-not $jdk) {
                $jdk = Get-ChildItem -Path $path -Filter "jdk*" -Directory -Recurse -Depth 1 -ErrorAction SilentlyContinue | Select-Object -First 1
            }

            if ($jdk) {
                $env:JAVA_HOME = $jdk.FullName
                Write-Host "Found and set JAVA_HOME temporarily: $($jdk.FullName)" -ForegroundColor Green
                $found = $true
                break
            }
        }
    }

    if (-not $found) {
        Write-Host "Could not auto-locate JDK 17 or 21." -ForegroundColor Red
        Write-Host "Capacitor 6 REQUIRES JDK 17 or higher. Download from: https://adoptium.net/" -ForegroundColor Yellow
        Write-Host "Or set manually: `$env:JAVA_HOME = 'C:\Path\To\Your\Jdk17' "
        exit 1
    }
}

# 2. Verify Java version is 17+
try {
    $javaVersion = & "$env:JAVA_HOME\bin\java.exe" -version 2>&1 | Select-Object -First 1
    Write-Host "Java version: $javaVersion" -ForegroundColor Green
    if ($javaVersion -match '"(\d+)') {
        $majorVersion = [int]$matches[1]
        if ($majorVersion -lt 17) {
            Write-Host "WARNING: Capacitor 6 requires JDK 17+. Found JDK $majorVersion." -ForegroundColor Red
            Write-Host "The build may fail. Please install JDK 17 or 21." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "Could not verify Java version. Continuing anyway..." -ForegroundColor Yellow
}

# 3. Check Android SDK
Write-Host "`nChecking Android SDK configuration..."
$sdkPath = $env:ANDROID_HOME

if (-not $sdkPath) {
    $defaultSdk = "$env:USERPROFILE\AppData\Local\Android\Sdk"
    if (Test-Path $defaultSdk) {
        $sdkPath = $defaultSdk
        $env:ANDROID_HOME = $sdkPath
        Write-Host "Auto-located Android SDK at: $sdkPath" -ForegroundColor Green
    } else {
        Write-Host "Could not automatically find Android SDK." -ForegroundColor Red
        Write-Host "Please ensure Android Studio is installed and the SDK is at $defaultSdk"
    }
} else {
    Write-Host "ANDROID_HOME is set to: $sdkPath" -ForegroundColor Green
}

# 4. Set up local.properties for Gradle
if ($sdkPath -and (Test-Path "android")) {
    $localPropsPath = "android\local.properties"
    $sdkPathFormatted = $sdkPath -replace "\\", "/"
    
    "sdk.dir=$sdkPathFormatted" | Out-File -FilePath $localPropsPath -Encoding ascii
    Write-Host "Updated $localPropsPath with SDK location." -ForegroundColor Green
}

# 5. Sync Web Assets
Write-Host "`nSyncing web assets to Android project (Capacitor v6)..." -ForegroundColor Yellow
cmd /c "npm run mobile:sync"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to sync web assets. Fix errors above." -ForegroundColor Red
    exit 1
}

# 6. Build APK
if (Test-Path "android") {
    Write-Host "`nBuilding APK (Debug)..." -ForegroundColor Yellow
    Write-Host "Note: For Play Store submission, you need a SIGNED RELEASE AAB instead." -ForegroundColor Cyan
    Write-Host "      Run: cd android && ./gradlew bundleRelease (after configuring signing)`n" -ForegroundColor Cyan
    
    Set-Location android
    
    ./gradlew assembleDebug
    
    if ($LASTEXITCODE -eq 0) {
        Set-Location ..
        Write-Host "`nBuild Successful!" -ForegroundColor Green
        $apkPath = "android\app\build\outputs\apk\debug"
        if (Test-Path $apkPath) {
             Write-Host "Opening APK folder..."
             explorer.exe $apkPath
        }
    } else {
        Set-Location ..
        Write-Host "`nGradle build failed." -ForegroundColor Red
        Write-Host "Common Capacitor 6 issues:"
        Write-Host "  - Need JDK 17 or higher"
        Write-Host "  - Need Android SDK 34"
        Write-Host "  - If upgrading from v5: delete the android folder and run 'npm run mobile:setup'"
    }
} else {
    Write-Host "Android folder not found." -ForegroundColor Red
    Write-Host "First-time setup: Run 'npm run mobile:setup' to create the android folder." -ForegroundColor Yellow
}