# PowerShell script to convert Markdown content to Word documents
# This script creates basic Word documents from our Markdown documentation

# Function to create a Word document from text content
function Create-WordDocument {
    param (
        [string]$Title,
        [string]$Content,
        [string]$OutputPath
    )
    
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
    
    # Add content
    $NormalStyle = $Document.Styles.Item("Normal")
    $Selection.Style = $NormalStyle
    
    # Process content line by line
    $ContentLines = $Content -split "`n"
    foreach ($Line in $ContentLines) {
        # Check if line is a heading
        if ($Line -match "^#+\s+(.+)$") {
            $HeadingLevel = ($Line -split " ")[0].Length
            $HeadingText = $Line -replace "^#+\s+", ""
            
            # Apply heading style based on level
            if ($HeadingLevel -eq 1) {
                $Selection.Style = $Document.Styles.Item("Heading 1")
            } elseif ($HeadingLevel -eq 2) {
                $Selection.Style = $Document.Styles.Item("Heading 2")
            } elseif ($HeadingLevel -eq 3) {
                $Selection.Style = $Document.Styles.Item("Heading 3")
            } else {
                $Selection.Style = $Document.Styles.Item("Heading 4")
            }
            
            $Selection.TypeText($HeadingText)
            $Selection.TypeParagraph()
            $Selection.Style = $NormalStyle
        }
        # Check if line is a code block start/end
        elseif ($Line -match "^```") {
            # Skip code block markers
            continue
        }
        # Regular text
        else {
            $Selection.TypeText($Line)
            $Selection.TypeParagraph()
        }
    }
    
    # Save document
    $Document.SaveAs([ref]$OutputPath, [ref]16) # 16 = wdFormatDocumentDefault
    $Document.Close()
    $Word.Quit()
    
    # Release COM objects
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($Document) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($Word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    Write-Host "Created Word document: $OutputPath"
}

# Convert main documentation file
$MainDocContent = Get-Content -Path "../multi_branch_banking_system.md" -Raw
Create-WordDocument -Title "Multi-Branch Banking System Implementation Guide" -Content $MainDocContent -OutputPath "./Multi_Branch_Banking_System.docx"

# Convert database schema file
$DatabaseSchemaContent = Get-Content -Path "../database_schema.md" -Raw
Create-WordDocument -Title "Database Schema for Multi-Branch Banking System" -Content $DatabaseSchemaContent -OutputPath "./Database_Schema.docx"

# Convert network architecture file
$NetworkArchContent = Get-Content -Path "../images/network_architecture.md" -Raw
Create-WordDocument -Title "Network Architecture for Multi-Branch Banking System" -Content $NetworkArchContent -OutputPath "./Network_Architecture.docx"

# Convert synchronization flow file
$SyncFlowContent = Get-Content -Path "../images/synchronization_flow.md" -Raw
Create-WordDocument -Title "Synchronization Flows for Multi-Branch Banking System" -Content $SyncFlowContent -OutputPath "./Synchronization_Flow.docx"

Write-Host "All Word documents have been created in the documentation/word_docs directory." 