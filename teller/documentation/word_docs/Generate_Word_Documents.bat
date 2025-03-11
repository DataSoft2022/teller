@echo off
echo ===================================================
echo    Generating Documents for Management
echo ===================================================
echo.
echo This will create documents from the Markdown documentation.
echo.
echo Choose conversion method:
echo 1. Direct Markdown to Word conversion (requires Word)
echo 2. HTML-based conversion (requires Word)
echo 3. Generate HTML files (can be opened in Word or browser)
echo.
set /p choice="Enter your choice (1, 2, or 3): "

if "%choice%"=="1" (
    echo.
    echo Running direct conversion...
    powershell -ExecutionPolicy Bypass -File .\convert_to_word.ps1
) else if "%choice%"=="2" (
    echo.
    echo Running HTML-based conversion...
    powershell -ExecutionPolicy Bypass -File .\convert_to_html.ps1
) else if "%choice%"=="3" (
    echo.
    echo Generating HTML files...
    powershell -ExecutionPolicy Bypass -File .\generate_html_files.ps1
    
    echo.
    echo HTML files have been created in the html_files folder.
    echo Opening index.html in your default browser...
    
    start html_files\index.html
) else (
    echo.
    echo Invalid choice. Please run again and select 1, 2, or 3.
    goto end
)

echo.
echo ===================================================
echo    Process Complete
echo ===================================================
echo.

:end
pause 