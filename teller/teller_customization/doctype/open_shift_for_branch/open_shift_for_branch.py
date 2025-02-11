# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.permissions import add_user_permission, remove_user_permission


def get_permission_query_conditions(user=None):
    """Return SQL conditions with user permissions."""
    if not user:
        user = frappe.session.user
        
    if "System Manager" in frappe.get_roles(user):
        return ""
        
    # Get the employee linked to the current user
    employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
    if not employee:
        return "1=0"
        
    # Return condition to show only shifts where user is the current_user
    return f"`tabOpen Shift for Branch`.current_user = '{employee}'"

def has_permission(doc, ptype="read", user=None):
    """Permission handler for Open Shift for Branch"""
    if not user:
        user = frappe.session.user
        
    if "System Manager" in frappe.get_roles(user):
        return True
        
    # Get the employee linked to the current user
    employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
    if not employee:
        return False
        
    # For read permission, check if user is the current_user of the shift
    if ptype == "read":
        return employee == doc.current_user
        
    # For write/create permission, check if user has Teller role
    if ptype in ["write", "create"]:
        return "Teller" in frappe.get_roles(user)
        
    return False


class OpenShiftforBranch(Document):
    def validate(self):
        self.validate_active_shift()
        self.validate_treasury_assignment()
        
    def validate_active_shift(self):
        """Check if employee already has an active shift"""
        active_shift = frappe.db.exists("Open Shift for Branch", {
            "current_user": self.current_user,
            "shift_status": "Active",
            "docstatus": 1,
            "name": ["!=", self.name]
        })
        
        if active_shift:
            frappe.throw(f"Employee {self.current_user} already has an active shift")
            
    def validate_treasury_assignment(self):
        """Ensure treasury belongs to correct branch"""
        treasury = frappe.get_doc("Teller Treasury", self.teller_treasury)
        self.branch = treasury.branch  # Set the branch from treasury
        
    def before_save(self):
        if not self.shift_status:
            self.shift_status = "Active"

    def on_submit(self):
        """Set up permissions when shift is opened"""
        self.setup_shift_permissions()
        
    def on_cancel(self):
        """Remove permissions when shift is closed"""
        self.remove_shift_permissions()
        
    def setup_shift_permissions(self):
        """Set up all necessary permissions for the shift"""
        user = frappe.get_value("Employee", self.current_user, "user_id")
        if not user:
            frappe.throw(f"No user linked to employee {self.current_user}")
            
        # Get treasury details
        treasury = frappe.get_doc("Teller Treasury", self.teller_treasury)
        
        # Add permission for treasury
        add_user_permission(
            "Teller Treasury", 
            self.teller_treasury, 
            user,
            ignore_permissions=True
        )
        
        # Add permissions for accounts linked to this treasury
        accounts = frappe.get_all("Account", 
            filters={
                "custom_teller_treasury": self.teller_treasury,
                "account_type": ["in", ["Bank", "Cash"]]
            },
            pluck="name"
        )
        
        for account in accounts:
            add_user_permission(
                "Account", 
                account, 
                user,
                ignore_permissions=True
            )
            
    def remove_shift_permissions(self):
        """Remove all permissions when shift is closed"""
        user = frappe.get_value("Employee", self.current_user, "user_id")
        if not user:
            return
            
        # Remove treasury permission without applicable_for filter
        frappe.db.delete(
            "User Permission",
            {
                "user": user,
                "allow": "Teller Treasury",
                "for_value": self.teller_treasury
            }
        )
        
        # Remove permissions for accounts
        accounts = frappe.get_all("Account", 
            filters={
                "custom_teller_treasury": self.teller_treasury,
                "account_type": ["in", ["Bank", "Cash"]]
            },
            pluck="name"
        )
        
        for account in accounts:
            frappe.db.delete(
                "User Permission",
                {
                    "user": user,
                    "allow": "Account",
                    "for_value": account
                }
            )

@frappe.whitelist()
def get_treasury_employees(treasury):
    # Get the branch from treasury
    treasury_doc = frappe.get_doc("Teller Treasury", treasury)
    
    # Get all employees in that branch
    employees = frappe.db.sql("""
        SELECT name 
        FROM `tabEmployee` 
        WHERE branch = %(branch)s 
        AND status = 'Active'
    """, {'branch': treasury_doc.branch}, as_dict=1)
    
    return [emp.name for emp in employees] if employees else []

def update_shift_end_date(open_shift, end_date):
    """Called from Close Shift when it's submitted"""
    if open_shift:
        doc = frappe.get_doc("Open Shift for Branch", open_shift)
        doc.end_date = end_date
        doc.shift_status = "Closed"
        doc.db_set('end_date', end_date)
        doc.db_set('shift_status', 'Closed')
        frappe.db.commit()

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
        target.employee_name = employee.employee_name  # Add employee name

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
