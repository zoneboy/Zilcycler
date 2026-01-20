Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Zilcycler Android Build Helper" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check if JAVA_HOME is already set
if ($env:JAVA_HOME) {
    Write-Host "JAVA_HOME is already set to: $env:JAVA_HOME" -ForegroundColor Green
} else {
    Write-Host "JAVA_HOME is not set. Attempting to auto-locate JDK..." -ForegroundColor Yellow
    
    # Common installation paths for OpenJDK / Android Studio
    $searchPaths = @(
        "C:\Program Files\Microsoft",
        "C:\Program Files\Java",
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Android\Android Studio\jbr"
    )

    $found = $false
    foreach ($path in $searchPaths) {
        if (Test-Path $path) {
            # Try to find a folder named jdk-17 or similar
            $jdk = Get-ChildItem -Path $path -Filter "jdk-17*" -Directory -Recurse -Depth 1 | Select-Object -First 1
            
            # If not found, look for any jdk
            if (-not $jdk) {
                $jdk = Get-ChildItem -Path $path -Filter "jdk*" -Directory -Recurse -Depth 1 | Select-Object -First 1
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
        Write-Host "Could not auto-locate JDK 17." -ForegroundColor Red
        Write-Host "Tip: Restart VS Code to refresh environment variables if you just installed it."
        Write-Host "Or set it manually: `$env:JAVA_HOME = 'C:\Path\To\Your\Jdk' "
        exit 1
    }
}

# 2. Check for Android SDK and setup local.properties
Write-Host "`nChecking Android SDK configuration..."
$sdkPath = $env:ANDROID_HOME

if (-not $sdkPath) {
    # Check common default location
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

# Create local.properties if we found an SDK or if ANDROID_HOME was set
if ($sdkPath -and (Test-Path "android")) {
    $localPropsPath = "android\local.properties"
    # Convert backslashes to forward slashes for Gradle compatibility
    $sdkPathFormatted = $sdkPath -replace "\\", "/"
    
    "sdk.dir=$sdkPathFormatted" | Out-File -FilePath $localPropsPath -Encoding ascii
    Write-Host "Updated $localPropsPath with SDK location." -ForegroundColor Green
}

# 3. Run the build
if (Test-Path "android") {
    Write-Host "`nBuilding APK..."
    Set-Location android
    
    # Run Gradle
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
        Write-Host "Please check the error message above."
        Write-Host "If it says 'SDK location not found', ensure Android Studio is installed."
    }
} else {
    Write-Host "Android folder not found. Please run 'npm run mobile:setup' first." -ForegroundColor Red
}