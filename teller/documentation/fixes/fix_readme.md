# Site Access Fix for Multi-Branch Banking System

## Problem Description

In the multi-branch banking system setup, there is a discrepancy between the configured bench directory and the actual location where Frappe/ERPNext creates sites:

1. The Docker configuration specifies:
   - HQ: `FRAPPE_BENCH_DIR=/home/frappe/frappe-bench-hq`
   - Branch: `FRAPPE_BENCH_DIR=/home/frappe/frappe-bench-branch`

2. However, Frappe/ERPNext still creates sites in the default location:
   - `/home/frappe/frappe-bench/sites/`

This leads to a "Not Found" error when trying to access the site via the browser, as the server is looking for the site in the wrong location.

## Solution

We have created two scripts to fix this issue:

1. **fix_site_access.sh** - For the HQ setup
2. **fix_branch_access.sh** - For Branch setups

These scripts:
- Set the site as the default site
- Create a symbolic link from the actual site location to the configured bench directory
- Create a Procfile to fix the `bench start` command
- Restart the container to apply the changes

## Usage

### For HQ Setup

```bash
# Make the script executable
chmod +x fix_site_access.sh

# Run the script
./fix_site_access.sh
```

### For Branch Setup

```bash
# Make the script executable
chmod +x fix_branch_access.sh

# Run the script (replace BR01 with your branch ID)
./fix_branch_access.sh BR01
```

## When to Use These Scripts

Run these scripts:
1. After completing the initial setup with `post_setup_hq.sh` or `post_setup_branch.sh`
2. When you're getting a "Not Found" error when trying to access the site
3. If you need to recreate the symbolic links after container recreation

## Note for Future Setups

To avoid this issue in the future, consider modifying the Docker Compose files to use the default bench directory path instead of custom paths. Alternatively, you can integrate these fixes directly into the `post_setup_hq.sh` and `post_setup_branch.sh` scripts. 