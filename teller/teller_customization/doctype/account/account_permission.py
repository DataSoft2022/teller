import frappe
from frappe import _

def get_permission_query_conditions(user=None):
    """Return SQL conditions with user permissions for Account."""
    try:
        if not user:
            user = frappe.session.user
            
        if "System Manager" in frappe.get_roles(user):
            return ""
            
        # Get the user's egy_account
        egy_account = frappe.db.get_value('User', user, 'egy_account')
        
        # Get the employee linked to the current user
        employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
        
        conditions = []
        
        # Always add egy_account condition if it exists
        if egy_account:
            conditions.append(f"`tabAccount`.name = '{egy_account}'")
        
        # If employee exists, check for active shift and its treasury
        if employee:
            active_shift = frappe.db.get_value(
                "Open Shift for Branch",
                {
                    "current_user": employee,
                    "shift_status": "Active",
                    "docstatus": 1
                },
                "teller_treasury"
            )
            if active_shift:
                conditions.append(f"`tabAccount`.custom_teller_treasury = '{active_shift}'")
        
        # If no conditions, check if user has required roles
        if not conditions and not any(role in frappe.get_roles(user) for role in ["Teller", "Sales User", "Accounts User"]):
            return "1=0"
        
        # Return combined conditions with OR
        if conditions:
            return "(" + " OR ".join(conditions) + ")"
        return ""
        
    except Exception as e:
        frappe.log_error(f"Error in get_permission_query_conditions: {str(e)}", "Account Permission Error")
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
            
        # Get the employee linked to the current user
        employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
        if not employee:
            return False
            
        # Get active shift for the employee
        active_shift = frappe.db.get_value(
            "Open Shift for Branch",
            {
                "current_user": employee,
                "shift_status": "Active",
                "docstatus": 1
            },
            "teller_treasury"
        )
        
        # For create permission, also check roles
        if ptype == "create":
            has_role = any(role in frappe.get_roles(user) for role in ["Teller", "Sales User", "Accounts User"])
            if not has_role:
                return False
        
        # Check if account belongs to user's treasury
        if active_shift and doc.custom_teller_treasury:
            return doc.custom_teller_treasury == active_shift
            
        # If it's an EGY account
        return doc.name == egy_account
        
    except Exception as e:
        frappe.log_error(f"Error in has_permission for doc {doc.name}: {str(e)}", "Account Permission Error")
        return False 