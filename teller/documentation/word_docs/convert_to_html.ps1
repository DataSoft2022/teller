# PowerShell script to convert Markdown to HTML and then to Word
# This provides an alternative approach that may be more reliable

function Convert-MarkdownToHTML {
    param (
        [string]$MarkdownContent
    )
    
    # Simple markdown to HTML conversion
    $html = "<html><head><style>"
    $html += "body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.5; }"
    $html += "h1 { color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px; }"
    $html += "h2 { color: #3498db; margin-top: 30px; }"
    $html += "h3 { color: #2980b9; }"
    $html += "pre { background-color: #f8f8f8; border: 1px solid #ddd; padding: 10px; border-radius: 5px; overflow-x: auto; }"
    $html += "table { border-collapse: collapse; width: 100%; margin: 20px 0; }"
    $html += "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }"
    $html += "th { background-color: #f2f2f2; }"
    $html += "</style></head><body>"
    
    $inCodeBlock = $false
    $inTable = $false
    $tableHeader = $false
    
    # Process content line by line
    $lines = $MarkdownContent -split "`n"
    foreach ($line in $lines) {
        # Handle code blocks
        if ($line -match "^```") {
            if ($inCodeBlock) {
                $html += "</pre>"
                $inCodeBlock = $false
            } else {
                $html += "<pre>"
                $inCodeBlock = $true
            }
            continue
        }
        
        if ($inCodeBlock) {
            $html += [System.Web.HttpUtility]::HtmlEncode($line) + "`n"
            continue
        }
        
        # Handle headings
        if ($line -match "^#\s+(.+)$") {
            $html += "<h1>" + $matches[1] + "</h1>"
        }
        elseif ($line -match "^##\s+(.+)$") {
            $html += "<h2>" + $matches[1] + "</h2>"
        }
        elseif ($line -match "^###\s+(.+)$") {
            $html += "<h3>" + $matches[1] + "</h3>"
        }
        elseif ($line -match "^####\s+(.+)$") {
            $html += "<h4>" + $matches[1] + "</h4>"
        }
        # Handle tables
        elseif ($line -match "^\|(.+)\|$") {
            if (!$inTable) {
                $html += "<table>"
                $inTable = $true
                $tableHeader = $true
            }
            
            $cells = $line -split "\|" | Where-Object { $_ -ne "" }
            
            if ($tableHeader) {
                $html += "<tr>"
                foreach ($cell in $cells) {
                    $html += "<th>" + $cell.Trim() + "</th>"
                }
                $html += "</tr>"
                $tableHeader = $false
            }
            elseif ($line -match "^\|-+\|") {
                # Skip the separator line
                continue
            }
            else {
                $html += "<tr>"
                foreach ($cell in $cells) {
                    $html += "<td>" + $cell.Trim() + "</td>"
                }
                $html += "</tr>"
            }
        }
        # End table if we're no longer in a table row
        elseif ($inTable -and !($line -match "^\|")) {
            $html += "</table>"
            $inTable = $false
            
            # Process the current line normally
            if ($line -match "^\s*$") {
                $html += "<p></p>"
            } else {
                $html += "<p>" + $line + "</p>"
            }
        }
        # Regular paragraph
        elseif ($line -match "^\s*$") {
            $html += "<p></p>"
        } else {
            $html += "<p>" + $line + "</p>"
        }
    }
    
    # Close any open tags
    if ($inCodeBlock) {
        $html += "</pre>"
    }
    if ($inTable) {
        $html += "</table>"
    }
    
    $html += "</body></html>"
    return $html
}

function Create-WordFromHTML {
    param (
        [string]$Title,
        [string]$HtmlContent,
        [string]$OutputPath
    )
    
    # Create temporary HTML file
    $tempHtmlPath = [System.IO.Path]::GetTempFileName() + ".html"
    Set-Content -Path $tempHtmlPath -Value $HtmlContent
    
    # Create Word application
    $Word = New-Object -ComObject Word.Application
    $Word.Visible = $false
    
    # Create new document
    $Document = $Word.Documents.Add()
    
    # Add title
    $TitleStyle = $Document.Styles.Item("Title")
    $Selection = $Word.Selection
    $Selection.Style = $TitleStyle
    $Selection.TypeText($Title)
    $Selection.TypeParagraph()
    
    # Insert HTML content
    $Selection.InsertFile($tempHtmlPath)
    
    # Save document
    $Document.SaveAs([ref]$OutputPath, [ref]16) # 16 = wdFormatDocumentDefault
    $Document.Close()
    $Word.Quit()
    
    # Release COM objects
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($Document) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($Word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    # Remove temporary file
    Remove-Item -Path $tempHtmlPath -Force
    
    Write-Host "Created Word document: $OutputPath"
}

# Add reference to System.Web for HTML encoding
Add-Type -AssemblyName System.Web

# Convert main documentation file
$MainDocContent = Get-Content -Path "../multi_branch_banking_system.md" -Raw
$MainDocHTML = Convert-MarkdownToHTML -MarkdownContent $MainDocContent
Create-WordFromHTML -Title "Multi-Branch Banking System Implementation Guide" -HtmlContent $MainDocHTML -OutputPath "./Multi_Branch_Banking_System_HTML.docx"

# Convert database schema file
$DatabaseSchemaContent = Get-Content -Path "../database_schema.md" -Raw
$DatabaseSchemaHTML = Convert-MarkdownToHTML -MarkdownContent $DatabaseSchemaContent
Create-WordFromHTML -Title "Database Schema for Multi-Branch Banking System" -HtmlContent $DatabaseSchemaHTML -OutputPath "./Database_Schema_HTML.docx"

# Convert network architecture file
$NetworkArchContent = Get-Content -Path "../images/network_architecture.md" -Raw
$NetworkArchHTML = Convert-MarkdownToHTML -MarkdownContent $NetworkArchContent
Create-WordFromHTML -Title "Network Architecture for Multi-Branch Banking System" -HtmlContent $NetworkArchHTML -OutputPath "./Network_Architecture_HTML.docx"

# Convert synchronization flow file
$SyncFlowContent = Get-Content -Path "../images/synchronization_flow.md" -Raw
$SyncFlowHTML = Convert-MarkdownToHTML -MarkdownContent $SyncFlowContent
Create-WordFromHTML -Title "Synchronization Flows for Multi-Branch Banking System" -HtmlContent $SyncFlowHTML -OutputPath "./Synchronization_Flow_HTML.docx"

Write-Host "All HTML-based Word documents have been created in the documentation/word_docs directory." 