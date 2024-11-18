# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import flt
class BookingInterbank(Document):
    @frappe.whitelist()
    def update_interbank_details(self):
        
        book_table = self.booked_currency
        for row in book_table:
            currency = row.currency
            if row.booking_qty > 0:
                currency = row.currency
                  
                frappe.msgprint(f"doooooooooooo it {row.interbank}and {row.currency }")
                
@frappe.whitelist()
def make_interbank(source_name, target_doc=None):
    print("Source Name:", source_name)
    print("Target Doc:", target_doc)
    def update_item(obj, target, source_parent):
        print("===================my obj",obj.custom_qty )   
        print("===================my obj",obj.booking_qty,target.custom_qty)  
        target.custom_qty = flt(obj.custom_qty) - flt(obj.booking_qty) 
    field_mappings = {
        "InterBank": {
            "doctype": "Special price document",
            "field_map": {"customer": "customer"},
            "validation": {"docstatus": ["=", 1]},
        },
        "InterBank Details": {
            "doctype": "Booked Currency",
            "field_map": {
                "name": "booked_currency",
                "parent": "booking_interbank",


            },
            "postprocess": update_item,
            # "condition": lambda d: d.received_qty < d.qty,
        }
    }
    print("===================my obj",field_mappings)  
    doc = get_mapped_doc(
    "InterBank",
    source_name,
    field_mappings,
    target_doc=target_doc or frappe.new_doc("Special price document"))
    if not target_doc:
        doc.insert(ignore_permissions=True)
        frappe.msgprint(f"Mapped and saved Document")
    else:
        frappe.msgprint(f"Data has been updated in the current document")

    return doc
    