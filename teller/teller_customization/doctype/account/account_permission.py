import frappe
from frappe import _

def get_permission_query_conditions(user=None):
    """Return SQL conditions with user permissions for Account."""
    if not user:
        user = frappe.session.user
        
    if "System Manager" in frappe.get_roles(user):
        return ""
        
    # Get the employee linked to the current user
    employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
    if not employee:
        return "1=0"  # No access if no employee record
        
    # Get active shift for the employee to find their treasury
    active_shift = frappe.db.get_value(
        "Open Shift for Branch",
        {
            "current_user": employee,
            "shift_status": "Active",
            "docstatus": 1
        },
        "teller_treasury"
    )
    
    if not active_shift:
        return "1=0"  # No access if no active shift
        
    # Return condition to only show accounts linked to the user's treasury
    return f"`tabAccount`.custom_teller_treasury = '{active_shift}'"

def has_permission(doc, ptype="read", user=None):
    """Permission handler for Account"""
    if not user:
        user = frappe.session.user
        
    if "System Manager" in frappe.get_roles(user):
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
    
    if not active_shift:
        return False
        
    # Check if account belongs to user's treasury
    return doc.custom_teller_treasury == active_shift 