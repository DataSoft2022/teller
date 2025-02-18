# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import json
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.model.mapper import make_mapped_doc
from frappe.utils import flt
class BookingInterbank(Document):
  pass        
@frappe.whitelist(allow_guest=True)
def make_teller_invoice(doc):
    # sales_invoice = "hi"
    self = json.loads(doc)
    sales_invoice = frappe.new_doc('Teller Invoice')
    sales_invoice.customer = self.get("customer")
    sales_invoice.due_date = self.get("date") 
    for item in self.get("booked_currency"):
          sales_invoice.append('transactions', {
              'paid_from': item.get("currency_code"),
              'qty': item.get("balance"),
              'rate': item.get("rate"),
          })
        
    frappe.msgprint(f"Sales Invoice Created")
    return sales_invoice

  
#################### i commmed it in 8 Jan to Test if it Not Used#############################  
#     @frappe.whitelist()
#     def update_interbank_details(self):
        
#         book_table = self.booked_currency
#         for row in book_table:
#             currency = row.currency
#             if row.booking_qty > 0:
#                 currency = row.currency
                  
#                 frappe.msgprint(f"doooooooooooo it {row.interbank}and {row.currency }")
                
# @frappe.whitelist()
# def make_interbank(source_name, target_doc=None):
#     print("Source Name:", source_name)
#     print("Target Doc:", target_doc)
#     def update_item(obj, target, source_parent):
#         print("===================my obj",obj.custom_qty )   
#         print("===================my obj",obj.booking_qty,target.custom_qty)  
#         target.custom_qty = flt(obj.custom_qty) - flt(obj.booking_qty) 
#     field_mappings = {
#         "InterBank": {
#             "doctype": "Special price document",
#             "field_map": {"customer": "customer"},
#             "validation": {"docstatus": ["=", 1]},
#         },
#         "InterBank Details": {
#             "doctype": "Booked Currency",
#             "field_map": {
#                 "name": "booked_currency",
#                 "parent": "booking_interbank",


#             },
#             "postprocess": update_item,
#             # "condition": lambda d: d.received_qty < d.qty,
#         }
#     }
#     print("===================my obj",field_mappings)  
#     doc = get_mapped_doc(
#     "InterBank",
#     source_name,
#     field_mappings,
#     target_doc=target_doc or frappe.new_doc("Special price document"))
#     if not target_doc:
#         doc.insert(ignore_permissions=True)
#         frappe.msgprint(f"Mapped and saved Document")
#     else:
#         frappe.msgprint(f"Data has been updated in the current document")

#     return doc
    

# @frappe.whitelist()
# def make_si(doc):
#     print("==================================", type(doc))  
#     try:
#         if isinstance(doc, str):
#             bi = json.loads(doc)
#             bi_details = bi.get("booked_currency")

#             # return bi_details
#             si = frappe.new_doc("Sales Invoice")
#             si.customer = bi.get("customer")
#             si.due_date = bi.get("date")
#             for i in bi_details:
#                 si.append(
#                   "items",
#                   {
#                     "item_code": i.get("currency_code"),
#                     "qty": i.get("booking_qty"),
#                     "rate":i.get("i.rate")
#                   },
#                 )
#             si.insert(ignore_permissions=True)   
#             frappe.db.commit()   
#             frappe(f"Sales_invoice Created")

#         else:
#             frappe.throw(_("The document is not a valid JSON string"))
#     except json.JSONDecodeError as e:
#         frappe.throw(_("Invalid JSON format: {0}".format(str(e))))

#     # si = frappe.new_doc("Sales Invoice")
#     # for i in items:
#     #     print("==================================",i.currency_code)  
#       # si.append(
#       #   "items",
#       #   {
#       #     "item_code": i.item_code,
#       #     "qty": 1,
#       #   },
#       # )
      

      