# Copyright (c) 2025, Ahmed Reda  and contributors
# For license information, please see license.txt

import frappe
from frappe import whitelist
from frappe.model.document import Document


class CloseShiftForBranch(Document):
	pass
@whitelist()
def get_active_shift():
    active_open_shift = frappe.db.get_list("Open Shift for Branch", {"shift_status": "Active"})
    if active_open_shift:
      active_open_shift_name = active_open_shift[0]["name"]
      return active_open_shift_name
    else:
        frappe.throw("there is not Open shift for branch")
@whitelist()
def active_active_user(shift):
    active_open_shift = frappe.get_doc("Open Shift for Branch",shift)
    # user = frappe.get_doc("User", frappe.session.user)
    return active_open_shift
@whitelist()
def call_from_class(self):
    return self.current_user, len(self.sales_table)
@whitelist(allow_guest=True)
def get_sales_invoice(current_open_shift):
  

    invoices = []
    invoice_names = frappe.db.get_all(
        "Teller Invoice",
        {"docstatus": 1, "shift": current_open_shift},
        order_by="name desc",
    )

    for invoice in invoice_names:
        doc = frappe.get_doc("Teller Invoice", invoice)
        invoices.append(doc)

    return invoices

@whitelist()
def get_purchase_invoices(current_open_shift):

    invoice_list = []

    invoice_names = frappe.db.get_list(
        "Teller Purchase",
        {"docstatus": 1, "shift": current_open_shift},
        order_by="name desc",
    )
    for i in invoice_names:
        doc = frappe.get_doc("Teller Purchase", i)
        invoice_list.append(doc)

    return invoice_list

class CloseShiftForBranch(Document):
    def validate(self):
        if not self.open_shift:
            frappe.throw("Please select an Open Shift")
            
    def on_submit(self):
        from teller.teller_customization.doctype.open_shift_for_branch.open_shift_for_branch import update_shift_end_date
        
        if self.open_shift:
            update_shift_end_date(self.open_shift, self.end_date)

@whitelist()
def get_shift_details(shift):
    """Get details from Open Shift for Branch"""
    open_shift = frappe.get_doc("Open Shift for Branch", shift)
    
    # Get employee's branch
    employee = frappe.get_doc("Employee", open_shift.current_user)
    
    return {
        "start_date": open_shift.start_date,
        "current_user": open_shift.current_user,
        "branch": employee.branch
    }

@whitelist()
def get_unclosed_shifts(doctype, txt, searchfield, start, page_len, filters):
    # Find open shifts that don't have a corresponding close shift
    return frappe.db.sql("""
        SELECT os.name, os.start_date, os.current_user
        FROM `tabOpen Shift for Branch` os
        WHERE os.shift_status = 'Active'
        AND os.docstatus = 1
        AND NOT EXISTS (
            SELECT 1 
            FROM `tabClose Shift For Branch` cs 
            WHERE cs.open_shift = os.name
            AND cs.docstatus = 1
        )
        AND (
            os.name LIKE %(txt)s OR
            os.current_user LIKE %(txt)s
        )
        ORDER BY os.start_date DESC
        LIMIT %(start)s, %(page_len)s
    """, {
        'txt': f"%{txt}%",
        'start': start,
        'page_len': page_len
    })