# Document Generation for Management

This directory contains scripts to convert our technical Markdown documentation into formats suitable for management review.

## Available Options

1. **Word Documents (Direct Conversion)** - Converts Markdown directly to Word format
2. **Word Documents (HTML-Based)** - Converts Markdown to HTML first, then to Word (better formatting)
3. **HTML Files** - Generates HTML files that can be opened in Word or a browser

## How to Use

The simplest way to generate documents is to double-click the `Generate_Word_Documents.bat` file and follow the prompts.

Alternatively, you can run one of the following PowerShell scripts directly:

1. `convert_to_word.ps1` - Direct Markdown to Word conversion
2. `convert_to_html.ps1` - HTML-based Word conversion
3. `generate_html_files.ps1` - Generate HTML files

## Generated Documents

The scripts will create the following documents:

1. **Multi-Branch Banking System Implementation Guide** - Main implementation guide
2. **Database Schema** - Database schema documentation
3. **Network Architecture** - Network architecture diagrams and explanations
4. **Synchronization Flow** - Data synchronization flow diagrams and explanations

## Notes for Management

- The HTML files option (3) is the most reliable and works without requiring complex PowerShell scripts
- To convert HTML to Word: open the HTML file in Word, then use "Save As" and select Word Document (.docx)
- These documents are generated from the source Markdown files, so any updates to the technical documentation should be made to the Markdown files first, then regenerated

## Technical Notes

- The Word conversion scripts require Microsoft Word to be installed
- The HTML files can be viewed in any web browser
- If you encounter any issues with the scripts, please contact the development team 