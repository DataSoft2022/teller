# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class ReturnRequestInterbank(Document):
    def on_submit(self):
        request_ref = self.request_reference
        table = self.items
        request_doc = frappe.get_doc("Request interbank", request_ref)
        request_details = frappe.db.get_all(
            "Interbank Request Details",
            fields=["name", "qty", "currency", "parent"],
            filters={"parent": request_ref},
        )
        # Update quantities where currency matches
        for row in request_details:
            for item in table:
                if row.currency == item.currency:
                    # Update the qty field
                    qty = item.get("qty")
                    print(f"xxxxxxxxxxxxxxx====== {qty}")
                    booking_interbank_doc = frappe.get_doc("Interbank Request Details",row['name'])
                    booking_interbank_doc.db_set("qty",qty)
                    frappe.db.commit()  # Commit after each update (optional, depending on context)
        booked_currency = frappe.get_all(
              "Booked Currency",
              fields=["name", "qty", "currency", "parent","interbank_reference"],
              filters={"request_reference": request_ref})   
        for row in booked_currency:
            for item in table:
                interbank_name = row['interbank_reference']
                if row.currency == item.currency:    
                    booked_currency = frappe.get_doc("Booked Currency",row['name'])
                    booked_currency.db_set("booking_qty",qty)
        # Log for debugging (replace with frappe.log if needed)
        interbank_details = frappe.db.get_all(
                    "InterBank Details",
                    fields=["name", "booking_qty", "qty", "currency", "parent"],
                    filters={"parent": interbank_name},
                    ignore_permissions=True
                )
        for row in interbank_details:
            for item in table:
                if row.currency == item.currency:    
                  interbank_detail = frappe.get_doc("InterBank Details",row['name'])
                  interbank_detail.db_set("booking_qty",row['booking_qty']- (item.request_qty - item.qty))
        print(f"booked_cuurency ====== {booked_currency}")
