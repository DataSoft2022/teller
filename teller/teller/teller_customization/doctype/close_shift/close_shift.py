# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import whitelist
import time


class CloseShift(Document):
    @whitelist()
    def call_from_class(self):
        return self.current_user, len(self.sales_table)


##############################


@whitelist()
def active_active_user():
    user = frappe.get_doc("User", frappe.session.user)
    return user


@whitelist()
def get_active_shift():
    active_open_shift = frappe.db.get_list("OPen Shift", {"active": 1})

    active_open_shift_name = active_open_shift[0]["name"]
    return active_open_shift_name


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
