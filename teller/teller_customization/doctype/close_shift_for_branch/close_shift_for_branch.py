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
        filters={
            "docstatus": 1, 
            "shift": current_open_shift,
            "is_returned": 0  # Only get non-returned invoices
        },
        order_by="name desc",
    )

    for invoice in invoice_names:
        doc = frappe.get_doc("Teller Invoice", invoice)
        invoices.append(doc)

    return invoices

@whitelist()
def get_purchase_invoices(current_open_shift):
    """Get all purchase transactions for the current shift"""
    try:
        frappe.log_error(f"Fetching purchases for shift: {current_open_shift}", "Debug Purchases")
        
        # First check if there are any purchases for this shift
        purchase_count = frappe.db.count('Teller Purchase', 
            {'shift': current_open_shift, 'docstatus': 1, 'is_returned': 0})
            
        frappe.log_error(f"Found {purchase_count} purchases", "Debug Purchases")
        
        if purchase_count == 0:
            return []
            
        # Get all submitted teller purchases for this shift
        purchases = frappe.db.sql("""
            SELECT 
                tp.name,
                tp.posting_date,
                tp.buyer,
                tp.purchase_receipt_number,
                tp.movement_number,
                tpc.currency_code,
                tpc.quantity,
                tpc.exchange_rate,
                tpc.egy_amount
            FROM `tabTeller Purchase` tp
            INNER JOIN `tabTeller Purchase Child` tpc ON tp.name = tpc.parent
            WHERE tp.docstatus = 1 
            AND tp.shift = %(shift)s
            AND tp.is_returned = 0
            ORDER BY tp.posting_date DESC
        """, {'shift': current_open_shift}, as_dict=1)
        
        frappe.log_error(f"Found {len(purchases)} purchase transactions: {purchases}", "Debug Purchases")
        return purchases
        
    except Exception as e:
        frappe.log_error(
            message=f"Error in get_purchase_invoices: {str(e)}\n{frappe.get_traceback()}",
            title="Purchase Fetch Error"
        )
        return []

class CloseShiftForBranch(Document):
    def validate(self):
        if not self.open_shift:
            frappe.throw(_("Please select an Open Shift"))
            
        self.fetch_and_set_invoices()
        self.fetch_and_set_purchases()
            
    def fetch_and_set_invoices(self):
        """Fetch and set all sales invoices for this shift"""
        try:
            # Clear existing sales invoice entries
            self.sales_invoice = []
            
            # Get all submitted teller invoices for this shift with their details
            invoices = frappe.db.sql("""
                SELECT DISTINCT
                    ti.name,
                    ti.posting_date,
                    ti.client,
                    ti.receipt_number,
                    ti.movement_number,
                    c.name as currency_name,
                    tid.currency_code,
                    tid.quantity,
                    tid.egy_amount as total_egy
                FROM `tabTeller Invoice` ti
                INNER JOIN `tabTeller Invoice Details` tid ON ti.name = tid.parent
                LEFT JOIN `tabCurrency` c ON c.custom_currency_code = tid.currency_code
                WHERE ti.docstatus = 1 
                AND ti.shift = %s
                AND ti.is_returned = 0
                ORDER BY ti.posting_date ASC
            """, self.open_shift, as_dict=1)
            
            total_sales = 0
            
            for inv in invoices:
                # Get the actual Currency document name (USD, EUR, etc.)
                currency_doc = frappe.get_value('Currency', {'custom_currency_code': inv.currency_code}, 'name')
                if not currency_doc:
                    frappe.throw(_(f"Currency not found for code {inv.currency_code}"))
                
                # Add each invoice to the sales_invoice table with proper currency
                self.append("sales_invoice", {
                    "invoice": inv.name,
                    "posting_date": inv.posting_date,
                    "client": inv.client,
                    "receipt_no": inv.receipt_number,
                    "movement_no": inv.movement_number,
                    "currency_code": currency_doc,  # This should be the Currency document name (USD, EUR, etc.)
                    "total": inv.quantity,  # Original currency amount
                    "total_amount": inv.quantity,  # Original currency amount
                    "total_egy": flt(inv.total_egy)  # EGY amount
                })
                
                total_sales += flt(inv.total_egy)  # Use EGY amount for total
            
            # Format total_sales with EGP currency indicator
            self.total_sales = f"EGP {frappe.format(total_sales, 'Currency')}"
            
        except Exception as e:
            frappe.log_error(
                message=f"Error fetching sales invoices: {str(e)}\n{frappe.get_traceback()}",
                title="Close Shift Error"
            )
            frappe.throw(_("Error fetching sales invoices: {0}").format(str(e)))

    def fetch_and_set_purchases(self):
        """Fetch and set all purchase transactions for this shift"""
        try:
            # Clear existing purchase entries
            self.purchase_close_table = []
            
            # Get all submitted teller purchases for this shift with their details
            purchases = frappe.db.sql("""
                SELECT DISTINCT
                    tp.name,
                    tp.posting_date,
                    tp.buyer,
                    tp.purchase_receipt_number,
                    tp.movement_number,
                    c.name as currency_name,
                    tpc.currency_code,
                    tpc.quantity,
                    tpc.egy_amount as total_egy
                FROM `tabTeller Purchase` tp
                INNER JOIN `tabTeller Purchase Child` tpc ON tp.name = tpc.parent
                LEFT JOIN `tabCurrency` c ON c.custom_currency_code = tpc.currency_code
                WHERE tp.docstatus = 1 
                AND tp.shift = %s
                AND tp.is_returned = 0
                ORDER BY tp.posting_date ASC
            """, self.open_shift, as_dict=1)
            
            total_purchases = 0
            
            for purchase in purchases:
                # Get the actual Currency document name (USD, EUR, etc.)
                currency_doc = frappe.get_value('Currency', {'custom_currency_code': purchase.currency_code}, 'name')
                if not currency_doc:
                    frappe.throw(_(f"Currency not found for code {purchase.currency_code}"))
                
                # Add each purchase to the purchase_close_table with proper currency
                self.append("purchase_close_table", {
                    "reference": purchase.name,
                    "posting_date": purchase.posting_date,
                    "client": purchase.buyer,
                    "receipt_number": purchase.purchase_receipt_number,
                    "movement_no": purchase.movement_number,
                    "currency_code": currency_doc,  # This should be the Currency document name (USD, EUR, etc.)
                    "total": purchase.quantity,  # Original currency amount
                    "total_amount": purchase.quantity,  # Original currency amount
                    "total_egy": flt(purchase.total_egy)  # EGY amount
                })
                
                total_purchases += flt(purchase.total_egy)  # Use EGY amount for total
            
            # Format total_purchases with EGP currency indicator
            self.total_purchase = f"EGP {frappe.format(total_purchases, 'Currency')}"
            
        except Exception as e:
            frappe.log_error(
                message=f"Error fetching purchase transactions: {str(e)}\n{frappe.get_traceback()}",
                title="Close Shift Error"
            )
            frappe.throw(_("Error fetching purchase transactions: {0}").format(str(e)))

    def on_submit(self):
        """Handle shift closure on submit"""
        try:
            if not self.open_shift:
                frappe.throw(_("Please select an Open Shift"))
            
            if not self.end_date:
                frappe.throw(_("Please set an End Date"))
            
            # Import the function directly from the module
            from teller.teller_customization.doctype.open_shift_for_branch.open_shift_for_branch import update_shift_end_date
            
            # Update the open shift's end date and status
            update_shift_end_date(self.open_shift, self.end_date)
            
        except Exception as e:
            frappe.log_error(
                message=f"Error during shift closure: {str(e)}\n{frappe.get_traceback()}",
                title="Close Shift Error"
            )
            frappe.throw(_("Error closing shift: {0}").format(str(e)))

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