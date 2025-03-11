# PowerShell script to generate HTML files from Markdown
# These HTML files can be opened directly in Word

function Convert-MarkdownToHTML {
    param (
        [string]$MarkdownContent,
        [string]$Title
    )
    
    # Simple markdown to HTML conversion
    $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>$Title</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.5; }
        h1 { color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        h2 { color: #3498db; margin-top: 30px; }
        h3 { color: #2980b9; }
        pre { background-color: #f8f8f8; border: 1px solid #ddd; padding: 10px; border-radius: 5px; overflow-x: auto; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>$Title</h1>
"@
    
    # Process content line by line
    $lines = $MarkdownContent -split "`n"
    $inCodeBlock = $false
    $inTable = $false
    
    foreach ($line in $lines) {
        # Handle headings
        if ($line -match '^# (.+)') {
            $html += "<h1>$($matches[1])</h1>`n"
        }
        elseif ($line -match '^## (.+)') {
            $html += "<h2>$($matches[1])</h2>`n"
        }
        elseif ($line -match '^### (.+)') {
            $html += "<h3>$($matches[1])</h3>`n"
        }
        elseif ($line -match '^#### (.+)') {
            $html += "<h4>$($matches[1])</h4>`n"
        }
        # Handle code blocks
        elseif ($line -match '^```') {
            if ($inCodeBlock) {
                $html += "</pre>`n"
                $inCodeBlock = $false
            } else {
                $html += "<pre>`n"
                $inCodeBlock = $true
            }
        }
        # Inside code block
        elseif ($inCodeBlock) {
            $html += "$($line -replace '<', '&lt;' -replace '>', '&gt;')`n"
        }
        # Handle empty lines
        elseif ($line -match '^\s*$') {
            $html += "<p></p>`n"
        }
        # Regular text
        else {
            $html += "<p>$line</p>`n"
        }
    }
    
    $html += @"
</body>
</html>
"@
    
    return $html
}

function Create-IndexHTML {
    param (
        [string]$OutputPath
    )
    
    $indexHTML = @"
<!DOCTYPE html>
<html>
<head>
    <title>Multi-Branch Banking System Documentation</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            line-height: 1.5;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            text-align: center;
        }
        .card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .card h2 {
            color: #3498db;
            margin-top: 0;
        }
        .card p {
            color: #555;
        }
        .buttons {
            display: flex;
            gap: 10px;
        }
        .button {
            display: inline-block;
            background-color: #3498db;
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
        }
        .button:hover {
            background-color: #2980b9;
        }
        .word-button {
            background-color: #2ecc71;
        }
        .word-button:hover {
            background-color: #27ae60;
        }
        .note {
            background-color: #f8f9fa;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <h1>Multi-Branch Banking System Documentation</h1>
    
    <div class="card">
        <h2>Implementation Guide</h2>
        <p>Comprehensive implementation guidelines for the multi-branch banking system built on ERPNext.</p>
        <div class="buttons">
            <a href="Multi_Branch_Banking_System.html" class="button">View HTML</a>
            <a href="javascript:openInWord('Multi_Branch_Banking_System.html');" class="button word-button">Open in Word</a>
        </div>
    </div>
    
    <div class="card">
        <h2>Database Schema</h2>
        <p>Detailed database schema documentation including data classification, replication configuration, and synchronization mechanisms.</p>
        <div class="buttons">
            <a href="Database_Schema.html" class="button">View HTML</a>
            <a href="javascript:openInWord('Database_Schema.html');" class="button word-button">Open in Word</a>
        </div>
    </div>
    
    <div class="card">
        <h2>Network Architecture</h2>
        <p>Network architecture diagrams and explanations for headquarters and branch connectivity.</p>
        <div class="buttons">
            <a href="Network_Architecture.html" class="button">View HTML</a>
            <a href="javascript:openInWord('Network_Architecture.html');" class="button word-button">Open in Word</a>
        </div>
    </div>
    
    <div class="card">
        <h2>Synchronization Flow</h2>
        <p>Data synchronization flow diagrams and explanations for branch-to-HQ, HQ-to-branch, and branch-to-branch communication.</p>
        <div class="buttons">
            <a href="Synchronization_Flow.html" class="button">View HTML</a>
            <a href="javascript:openInWord('Synchronization_Flow.html');" class="button word-button">Open in Word</a>
        </div>
    </div>
    
    <div class="note">
        <h3>Note for Management</h3>
        <p>To save these documents as Word files:</p>
        <ol>
            <li>Click the "Open in Word" button</li>
            <li>When the document opens in Word, click "File" → "Save As"</li>
            <li>Choose "Word Document (*.docx)" as the file type</li>
            <li>Click "Save"</li>
        </ol>
    </div>
    
    <script>
        function openInWord(htmlFile) {
            try {
                // Try to open in Word via ActiveX (works in IE)
                var word = new ActiveXObject("Word.Application");
                word.Visible = true;
                var doc = word.Documents.Open(window.location.href.replace("index.html", htmlFile));
            } catch (e) {
                // Fallback to just opening the HTML file
                window.open(htmlFile, "_blank");
                alert("Please open this file in Microsoft Word and use 'Save As' to save as a Word document.");
            }
        }
    </script>
</body>
</html>
"@
    
    Set-Content -Path $OutputPath -Value $indexHTML
    Write-Host "Created index file: $OutputPath"
}

# Create output directory if it doesn't exist
$outputDir = "./html_files"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

# Convert main documentation file
$MainDocContent = Get-Content -Path "../multi_branch_banking_system.md" -Raw
$MainDocHTML = Convert-MarkdownToHTML -MarkdownContent $MainDocContent -Title "Multi-Branch Banking System Implementation Guide"
Set-Content -Path "$outputDir/Multi_Branch_Banking_System.html" -Value $MainDocHTML
Write-Host "Created HTML file: $outputDir/Multi_Branch_Banking_System.html"

# Convert database schema file
$DatabaseSchemaContent = Get-Content -Path "../database_schema.md" -Raw
$DatabaseSchemaHTML = Convert-MarkdownToHTML -MarkdownContent $DatabaseSchemaContent -Title "Database Schema for Multi-Branch Banking System"
Set-Content -Path "$outputDir/Database_Schema.html" -Value $DatabaseSchemaHTML
Write-Host "Created HTML file: $outputDir/Database_Schema.html"

# Convert network architecture file
$NetworkArchContent = Get-Content -Path "../images/network_architecture.md" -Raw
$NetworkArchHTML = Convert-MarkdownToHTML -MarkdownContent $NetworkArchContent -Title "Network Architecture for Multi-Branch Banking System"
Set-Content -Path "$outputDir/Network_Architecture.html" -Value $NetworkArchHTML
Write-Host "Created HTML file: $outputDir/Network_Architecture.html"

# Convert synchronization flow file
$SyncFlowContent = Get-Content -Path "../images/synchronization_flow.md" -Raw
$SyncFlowHTML = Convert-MarkdownToHTML -MarkdownContent $SyncFlowContent -Title "Synchronization Flows for Multi-Branch Banking System"
Set-Content -Path "$outputDir/Synchronization_Flow.html" -Value $SyncFlowHTML
Write-Host "Created HTML file: $outputDir/Synchronization_Flow.html"

# Create index.html
Create-IndexHTML -OutputPath "$outputDir/index.html"

Write-Host "`nAll HTML files have been created in $outputDir"
Write-Host "You can open index.html to navigate between documents"
Write-Host "Or open the HTML files in Microsoft Word and save them as .docx files" 