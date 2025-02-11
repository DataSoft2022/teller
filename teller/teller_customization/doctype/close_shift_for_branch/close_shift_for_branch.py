# Copyright (c) 2025, Ahmed Reda  and contributors
# For license information, please see license.txt

import frappe
from frappe import whitelist, _
from frappe.model.document import Document
from frappe.utils import flt


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
            frappe.throw(_("Please select an Open Shift"))
            
        self.fetch_and_set_invoices()
            
    def fetch_and_set_invoices(self):
        """Fetch and set all sales invoices for this shift"""
        try:
            # Clear existing sales invoice entries
            self.sales_invoice = []
            
            # Get all submitted teller invoices for this shift with their details
            invoices = frappe.db.sql("""
                SELECT 
                    ti.name,
                    ti.posting_date,
                    ti.client,
                    ti.receipt_number,
                    ti.movement_number,
                    COALESCE(tid.currency, a.account_currency) as currency_code,
                    tid.quantity as total,
                    tid.amount as total_amount,
                    tid.egy_amount as total_egy
                FROM `tabTeller Invoice` ti
                LEFT JOIN `tabTeller Invoice Details` tid ON ti.name = tid.parent
                LEFT JOIN `tabAccount` a ON tid.account = a.name
                WHERE ti.docstatus = 1 
                AND ti.shift = %s
                AND ti.is_returned = 0
                ORDER BY ti.posting_date ASC
            """, self.open_shift, as_dict=1)
            
            total_sales = 0
            
            for inv in invoices:
                # Add each invoice to the sales_invoice table with proper currency
                self.append("sales_invoice", {
                    "invoice": inv.name,
                    "posting_date": inv.posting_date,
                    "client": inv.client,
                    "receipt_no": inv.receipt_number,
                    "movement_no": inv.movement_number,
                    "currency_code": inv.currency_code,
                    "total": inv.total,
                    "total_amount": inv.total_amount,
                    "total_egy": inv.total_egy
                })
                
                total_sales += flt(inv.total_egy)  # Use EGY amount for total
            
            # Set the total sales
            self.total_sales = total_sales
            
            frappe.msgprint(_("Successfully fetched {0} sales invoices").format(len(invoices)))
            
        except Exception as e:
            frappe.log_error(
                message=f"Error fetching sales invoices: {str(e)}\n{frappe.get_traceback()}",
                title="Close Shift Error"
            )
            frappe.throw(_("Error fetching sales invoices: {0}").format(str(e)))
            
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