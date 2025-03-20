# Teller App Documentation

This directory contains documentation for the multi-branch banking system built with Frappe/ERPNext and the Teller app.

## Directory Structure

- **guides/**: Detailed documentation on various aspects of the system
  - Setup guides (prerequisites, database, message queue, etc.)
  - System architecture documentation
  - Database schema information
  
- **scripts/**: Shell scripts for automated setup and installation
  - `setup_hq.sh`: Script for setting up the headquarters node
  - `setup_branch.sh`: Script for setting up branch nodes
  - `fresh_install.sh`: Script for fresh installation of the HQ environment
  - `fresh_install_branch.sh`: Script for fresh installation of a branch environment
  - `cleanup.sh`: Script for cleaning up previous installations
  
- **fixes/**: Scripts and documentation for fixing common issues
  - `fix_site_access.sh`: Script to fix HQ site access issues
  - `fix_branch_access.sh`: Script to fix branch site access issues
  - `fix_readme.md`: Documentation explaining the site access issues and fixes
  
- **setup_files/**: Configuration files and readmes for setup processes
  - `fresh_install_readme.md`: Detailed instructions for fresh installation

- **images/**: Diagrams and visual documentation
  - Network architecture diagrams
  - Synchronization flow diagrams
  
- **word_docs/**: Word document generation scripts and related files
  - HTML files for document generation
  - PowerShell scripts for conversions

## Getting Started

For new installations, follow these steps:

1. Review the prerequisites in `guides/setup_guide_part1_prerequisites.md`
2. For a fresh installation:
   - Read `setup_files/fresh_install_readme.md`
   - Use the scripts in the `scripts/` directory
3. For troubleshooting:
   - Check the `fixes/` directory for common issues and their solutions

## Documentation Maintenance

When adding new documentation:

1. Place markdown files in the appropriate subdirectory
2. Update this README.md if necessary
3. Follow the existing naming conventions

For script files:
1. Place shell scripts in the `scripts/` directory
2. Make them executable with `chmod +x scripts/script_name.sh`
3. Add descriptive comments at the top of each script 