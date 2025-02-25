import frappe
from frappe import _

def get_permission_query_conditions(user=None):
    """Return SQL conditions with user permissions for Account."""
    try:
        if not user:
            user = frappe.session.user
            
        if "System Manager" in frappe.get_roles(user):
            return ""
            
        conditions = []
        
        # Get the user's egy_account
        egy_account = frappe.db.get_value('User', user, 'egy_account')
        if egy_account:
            conditions.append(f"`tabAccount`.`name` = '{egy_account}'")
            
        # Get treasuries assigned to user through User Permission
        treasury_permissions = frappe.get_all(
            "User Permission",
            filters={
                "user": user,
                "allow": "Teller Treasury"
            },
            pluck="for_value"
        )
        
        if treasury_permissions:
            # Properly quote the treasury values
            quoted_treasuries = [f"'{t}'" for t in treasury_permissions]
            treasury_condition = f"`tabAccount`.`custom_teller_treasury` in ({','.join(quoted_treasuries)})"
            conditions.append(treasury_condition)
            
        # Check direct account permissions
        account_permissions = frappe.get_all(
            "User Permission",
            filters={
                "user": user,
                "allow": "Account"
            },
            pluck="for_value"
        )
        
        if account_permissions:
            # Properly quote the account values
            quoted_accounts = [f"'{a}'" for a in account_permissions]
            account_condition = f"`tabAccount`.`name` in ({','.join(quoted_accounts)})"
            conditions.append(account_condition)
        
        # If no conditions and no required roles, return no access
        if not conditions and not any(role in frappe.get_roles(user) for role in ["Sales User", "Accounts User"]):
            return "1=0"
            
        return " OR ".join(conditions) if conditions else "1=0"
        
    except Exception as e:
        frappe.log_error(f"Error in permission query: {str(e)}\n{frappe.get_traceback()}")
        return "1=0"

def has_permission(doc, ptype="read", user=None):
    """Permission handler for Account"""
    try:
        if not user:
            user = frappe.session.user
            
        if "System Manager" in frappe.get_roles(user):
            return True
            
        # Check if this is the user's egy_account
        egy_account = frappe.db.get_value('User', user, 'egy_account')
        if egy_account and doc.name == egy_account:
            return True
            
        # Check if account belongs to a treasury the user has permission for
        if doc.custom_teller_treasury:
            has_treasury_permission = frappe.db.exists("User Permission", {
                "user": user,
                "allow": "Teller Treasury",
                "for_value": doc.custom_teller_treasury
            })
            if has_treasury_permission:
                return True
        
        # Check direct account permission
        has_account_permission = frappe.db.exists("User Permission", {
            "user": user,
            "allow": "Account",
            "for_value": doc.name
        })
        if has_account_permission:
            return True
            
        return False
        
    except Exception as e:
        frappe.log_error(f"Error in has_permission for doc {doc.name}: {str(e)}", "Account Permission Error")
        return False 