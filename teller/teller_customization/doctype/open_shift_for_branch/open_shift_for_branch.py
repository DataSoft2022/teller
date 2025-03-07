# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
import json



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

@frappe.whitelist()
def get_branch_employees(branch):
    """Get all employees belonging to a branch with their active shift status and treasury"""
    employees = frappe.get_all(
        "Employee",
        filters={
            "branch": branch,
            "status": "Active"
        },
        fields=["name", "employee_name", "user_id"]
    )
    
    # Enhance employee data with active shift status and treasury info
    for emp in employees:
        # Check if employee has an active shift
        active_shift = frappe.db.exists("Open Shift for Branch", {
            "current_user": emp.name,
            "shift_status": "Active",
            "docstatus": 1
        })
        
        emp["has_active_shift"] = bool(active_shift)
        
        # Get treasury permission if user_id exists
        if emp.user_id:
            treasury = frappe.db.get_value(
                "User Permission",
                {
                    "user": emp.user_id,
                    "allow": "Teller Treasury"
                },
                "for_value"
            )
            emp["treasury"] = treasury
        else:
            emp["treasury"] = None
    
    return employees

@frappe.whitelist()
def bulk_create_shifts(branch, start_date, employees):
    """Create shifts for multiple employees at once"""
    if not isinstance(employees, list):
        employees = json.loads(employees)
    
    results = {
        "success": 0,
        "failed": 0,
        "errors": []
    }
    
    for employee_id in employees:
        try:
            # Check if employee already has an active shift
            active_shift = frappe.db.exists("Open Shift for Branch", {
                "current_user": employee_id,
                "shift_status": "Active",
                "docstatus": 1
            })
            
            if active_shift:
                results["failed"] += 1
                results["errors"].append(f"Employee {employee_id} already has an active shift")
                continue
            
            # Get employee details
            employee = frappe.get_doc("Employee", employee_id)
            
            # Get treasury permission
            if not employee.user_id:
                results["failed"] += 1
                results["errors"].append(f"Employee {employee_id} has no user account")
                continue
                
            treasury = frappe.db.get_value(
                "User Permission",
                {
                    "user": employee.user_id,
                    "allow": "Teller Treasury"
                },
                "for_value"
            )
            
            if not treasury:
                results["failed"] += 1
                results["errors"].append(f"Employee {employee_id} has no treasury permission")
                continue
            
            # Get active printing roll for this branch
            active_roll = frappe.db.get_value(
                "Printing Roll",
                {
                    "branch": branch,
                    "active": 1
                },
                "name"
            )
            
            if not active_roll:
                results["failed"] += 1
                results["errors"].append(f"No active printing roll found for branch {branch}")
                continue
            
            # Create the shift
            shift = frappe.new_doc("Open Shift for Branch")
            shift.current_user = employee_id
            shift.branch = branch
            shift.treasury_permission = treasury
            shift.start_date = start_date
            shift.shift_status = "Active"
            shift.printing_roll = active_roll
            
            # Save and submit
            shift.insert()
            shift.submit()
            
            results["success"] += 1
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"Error creating shift for {employee_id}: {str(e)}")
            frappe.log_error(
                message=f"Error in bulk shift creation for {employee_id}: {str(e)}\n{frappe.get_traceback()}",
                title="Bulk Shift Creation Error"
            )
    
    return results
