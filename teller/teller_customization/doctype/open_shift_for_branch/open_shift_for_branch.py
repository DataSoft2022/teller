# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _

def get_permission_query_conditions(user=None):
    """Return SQL conditions with user permissions for Open Shift for Branch."""
    if not user:
        user = frappe.session.user
        
    # Only System Manager and Administrator can create/view shifts
    if user == "Administrator" or "System Manager" in frappe.get_roles(user):
        return ""
        
    # Regular employees cannot create shifts - they can only view their own
    employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
    if not employee:
        return "1=0"
        
    # Regular users can only view shifts assigned to them
    return f"`tabOpen Shift for Branch`.current_user = '{employee}'"

def has_permission(doc, ptype="read", user=None):
    """Permission handler for Open Shift for Branch"""
    if not user:
        user = frappe.session.user
        
    # System Manager and Administrator have full access
    if user == "Administrator" or "System Manager" in frappe.get_roles(user):
        return True
        
    # Get the employee linked to the current user
    employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
    if not employee:
        return False
        
    # Check if user has role-based permissions
    if frappe.has_permission("Open Shift for Branch", ptype=ptype, user=user):
        # For read operations, users can access their own shifts
        if ptype == "read":
            return doc.current_user == employee
        # For create/write operations, check if user has explicit permissions
        return True
        
    return False

@frappe.whitelist()
def get_available_employees(doctype, txt, searchfield, start, page_len, filters):
    """Get list of all active employees"""
    return frappe.db.sql("""
        SELECT e.name, e.employee_name
        FROM `tabEmployee` e
        WHERE e.status = 'Active'
        AND (
            e.name LIKE %s 
            OR e.employee_name LIKE %s
        )
        ORDER BY e.employee_name
        LIMIT %s, %s
    """, (
        f"%{txt}%", f"%{txt}%",
        start, page_len
    ))

class OpenShiftforBranch(Document):
    def validate(self):
        self.validate_active_shift()
        self.validate_treasury()
        self.set_printing_roll()
        
    def validate_active_shift(self):
        """Check if employee already has an active shift"""
        active_shift = frappe.db.exists("Open Shift for Branch", {
            "current_user": self.current_user,
            "shift_status": "Active",
            "docstatus": 1,
            "name": ["!=", self.name]
        })
        
        if active_shift:
            frappe.throw(_(f"Employee {self.current_user} already has an active shift"))
            
    def validate_treasury(self):
        """Validate treasury assignment through user permissions"""
        if not self.current_user:
            return
            
        # Get the employee's user ID
        user_id = frappe.db.get_value('Employee', self.current_user, 'user_id')
        if not user_id:
            frappe.throw(_("Selected employee has no user account"))
            
        # Get teller_treasury from user permissions
        treasury = frappe.db.get_value('User Permission', 
            {
                'user': user_id,
                'allow': 'Teller Treasury'
            }, 
            'for_value'
        )
        
        if not treasury:
            frappe.throw(_("Selected employee's user has no treasury permission"))
            
        self.treasury_permission = treasury
        
    def set_printing_roll(self):
        """Set the active printing roll for this branch"""
        if not self.branch:
            return
            
        # Get active printing roll for this branch
        active_roll = frappe.db.get_value("Printing Roll",
            {
                "branch": self.branch,
                "active": 1
            },
            "name"
        )
        
        if not active_roll:
            frappe.throw(_("No active printing roll found for branch {0}. Please configure one first.").format(self.branch))
            
        self.printing_roll = active_roll

@frappe.whitelist()
def make_close_shift(source_name, target_doc=None):
    """Create Close Shift for Branch from Open Shift"""
    from frappe.model.mapper import get_mapped_doc
    
    def set_missing_values(source, target):
        target.open_shift = source.name
        target.start_date = source.start_date
        target.shift_employee = source.current_user
        # Get employee's details
        employee = frappe.get_doc("Employee", source.current_user)
        target.branch = employee.branch
        target.employee_name = employee.employee_name

    doc = get_mapped_doc("Open Shift for Branch", source_name, {
        "Open Shift for Branch": {
            "doctype": "Close Shift For Branch",
            "validation": {
                "docstatus": ["=", 1],
                "shift_status": ["=", "Active"]
            }
        }
    }, target_doc, set_missing_values)

    return doc

@frappe.whitelist()
def update_shift_end_date(shift_name, end_date):
    """Update the end date and status of an open shift when it's closed"""
    try:
        # Get the open shift document
        open_shift = frappe.get_doc("Open Shift for Branch", shift_name)
        
        # Update end date and status
        open_shift.db_set("end_date", end_date)
        open_shift.db_set("shift_status", "Closed")
        
        frappe.db.commit()
        
        return True
    except Exception as e:
        frappe.log_error(
            message=f"Error updating shift end date: {str(e)}\n{frappe.get_traceback()}",
            title="Shift Update Error"
        )
        frappe.throw(_("Error updating shift end date: {0}").format(str(e)))
