import frappe
from frappe import _

def get_permission_query_conditions(user=None):
    """Return SQL conditions with user permissions."""
    if not user:
        user = frappe.session.user
        
    if user == "Administrator" or "System Manager" in frappe.get_roles(user):
        return ""
        
    # Get user's treasury permission
    treasury_permission = frappe.db.get_value(
        "User Permission",
        {"user": user, "allow": "Teller Treasury"},
        "for_value"
    )
    
    if not treasury_permission:
        return "1=0"
        
    # Get treasury's EGP account
    treasury = frappe.get_doc("Teller Treasury", treasury_permission)
    if not treasury:
        return "1=0"
    
    account_list = [treasury.egy_account] if treasury.egy_account else []
    account_list.extend(frappe.get_all("Account", 
        filters={"custom_teller_treasury": treasury_permission},
        pluck="name"
    ))
    
    if not account_list:
        return "1=0"
        
    return f"""`tabAccount`.name in ({','.join(['%s']*len(account_list))})""" % tuple(account_list)

def has_permission(doc, ptype, user):
    """Permission handler for Account doctype"""
    if not user:
        user = frappe.session.user
        
    if user == "Administrator" or "System Manager" in frappe.get_roles(user):
        return True
        
    # Get user's treasury permission
    treasury_permission = frappe.db.get_value(
        "User Permission",
        {"user": user, "allow": "Teller Treasury"},
        "for_value"
    )
    
    if not treasury_permission:
        return False
        
    # Get treasury's EGP account
    treasury = frappe.get_doc("Teller Treasury", treasury_permission)
    if treasury and doc.name == treasury.egy_account:
        return True
        
    # Check if account is in user's currency codes
    return frappe.db.exists("Currency Code", {
        "user": user,
        "account": doc.name
    })

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