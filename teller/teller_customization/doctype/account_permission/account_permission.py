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
        
    return f"""`tabAccount Permission`.account in ({','.join(['%s']*len(account_list))})""" % tuple(account_list)

def has_permission(doc, ptype, user):
    """Permission handler for Account Permission doctype"""
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
    if treasury and doc.account == treasury.egy_account:
        return True
        
    # Check if account is in user's currency codes
    return frappe.db.exists("Currency Code", {
        "user": user,
        "account": doc.account
    }) 