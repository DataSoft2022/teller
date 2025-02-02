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