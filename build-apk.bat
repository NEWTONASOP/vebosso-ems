@echo off
echo Building VEBOSSO EMS APK...
echo.
echo Setting up Java 17...
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%

echo.
echo Building Release APK...
cd android
call gradlew.bat assembleRelease

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Your APK is located at:
echo android\app\build\outputs\apk\release\app-release.apk
echo.
pause
