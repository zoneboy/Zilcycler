Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Zilcycler Android Build Helper" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check if JAVA_HOME is already set
if ($env:JAVA_HOME) {
    Write-Host "✅ JAVA_HOME is already set to: $env:JAVA_HOME" -ForegroundColor Green
} else {
    Write-Host "⚠️ JAVA_HOME is not set. Attempting to auto-locate JDK..." -ForegroundColor Yellow
    
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
                Write-Host "✅ Found and set JAVA_HOME temporarily: $($jdk.FullName)" -ForegroundColor Green
                $found = $true
                break
            }
        }
    }

    if (-not $found) {
        Write-Host "❌ Could not auto-locate JDK 17." -ForegroundColor Red
        Write-Host "👉 Tip: Restart VS Code to refresh environment variables if you just installed it."
        Write-Host "👉 Or set it manually: `$env:JAVA_HOME = 'C:\Path\To\Your\Jdk' "
        exit 1
    }
}

# 2. Run the build
if (Test-Path "android") {
    Write-Host "`n🚀 Building APK..."
    Set-Location android
    ./gradlew assembleDebug
    
    if ($LASTEXITCODE -eq 0) {
        Set-Location ..
        Write-Host "`n🎉 Build Successful!" -ForegroundColor Green
        $apkPath = "android\app\build\outputs\apk\debug"
        if (Test-Path $apkPath) {
             Write-Host "📂 Opening APK folder..."
             explorer.exe $apkPath
        }
    } else {
        Set-Location ..
        Write-Host "`n❌ Gradle build failed." -ForegroundColor Red
    }
} else {
    Write-Host "❌ 'android' folder not found. Please run 'npm run mobile:setup' first." -ForegroundColor Red
}
