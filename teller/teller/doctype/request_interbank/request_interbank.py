# # Copyright (c) 2024, Mohamed AbdElsabour and contributors
# # For license information, please see license.txt

import frappe
from frappe.model.document import Document


# class Requestinterbank(Document):
#     @frappe.whitelist()
#     def create_booking(self):
#         currency_table = self.items

#         # Create a new Special Price Document
#         document = frappe.new_doc("Special price document")
#         document.customer = self.customer
#         document.custom_transaction = self.type

#         for row in currency_table:
#             if row.qty > 0:
#                 currency = row.currency

#                 # SQL Query to fetch interbank details
#                 sql = """
#                     SELECT 
#                         ib.name, 
#                         ibd.currency, 
#                         ibd.custom_qty, 
#                         ibd.booking_qty,
#                         ibd.rate
#                     FROM 
#                         `tabInterBank` ib 
#                     LEFT JOIN 
#                         `tabInterBank Details` ibd 
#                     ON 
#                         ibd.parent = ib.name
#                     WHERE 
#                         ibd.currency = %s
#                 """
#                 data = frappe.db.sql(sql, (currency,), as_dict=True)

#                 # Add matching data to the document
#                 # for record in data:
#                 #     if record.rate>0 and record.rate>0:    
#                 #         # return record
#                 #         document.append("booked_currency", {
#                 #             "currency": record.currency,
#                 #             "rate": record.rate,
#                 #             "custom_qty":record.custom_qty,
#                 #             "interbank":record.name,
#                 #             "booking_qty":row.qty
#                 #         })
#                 for record in data:
#                     if remaining_qty <= 0:
#                         break  # Stop if the required quantity is fulfilled
                    
#                     if record.custom_qty > 0 and record.rate > 0:
#                         # Determine the quantity to append
#                         append_qty = min(record.custom_qty, remaining_qty)
#                         remaining_qty -= append_qty  # Deduct the appended quantity

#                         # Append the data to booked_currency
#                         document.append("booked_currency", {
#                             "currency": record.currency,
#                             "rate": record.rate,
#                             "custom_qty": append_qty,
#                             "interbank": record.name,
#                             "booking_qty": row.qty
#                         })
#             # # Save the Special Price Document
#             document.insert(ignore_permissions=True)
#             frappe.db.commit()
#             frappe.msgprint(f"Special Price Document {document.name} has been created.")
#             return document.name
class Requestinterbank(Document):
    @frappe.whitelist()
    def create_booking(self):
        currency_table = self.items

        # Create a new Special Price Document
        document = frappe.new_doc("Booking Interbank")
        document.customer = self.customer
        document.type = self.type
        document.date = self.date
        document.time = self.time
        document.user = self.user
        document.branch = self.branch
        for row in currency_table:
            remaining_qty = row.qty  # Start with the requested quantity
            if remaining_qty > 0:
                currency = row.currency

                # Fetch interbank details for the specific currency
                sql = """
                    SELECT 
                        ib.name, 
                        ibd.currency,
                        ibd.custom_currency_code, 
                        ibd.custom_qty, 
                        ibd.rate,
                        ibd.creation
                    FROM 
                        `tabInterBank` ib 
                    LEFT JOIN 
                        `tabInterBank Details` ibd 
                    ON 
                        ibd.parent = ib.name
                    WHERE 
                        ibd.currency = %s
                    AND ib.docstatus = 1
                    ORDER BY ibd.creation ASC
                """
                data = frappe.db.sql(sql, (currency,), as_dict=True)

                # Loop through the data and distribute the quantity
                for record in data:
                    if remaining_qty <= 0:
                        break  # Stop if the required quantity is fulfilled
                    
                    if record.custom_qty > 0 and record.rate > 0:
                        # Determine the quantity to append
                        append_qty = min(record.custom_qty, remaining_qty)
                        remaining_qty -= append_qty  # Deduct the appended quantity

                        # Append the data to booked_currency
                        document.append("booked_currency", {
                            "currency_code":record.custom_currency_code,
                            "currency": record.currency,
                            "rate": record.rate,
                            "custom_qty": append_qty,
                            "interbank": record.name,
                            "booking_qty": row.qty
                        })

        # Save the Special Price Document
        document.insert()
        frappe.msgprint(f"Special Price Document {document.name} has been created.")
        booking_table = document.booked_currency
        result = []
        for row in booking_table:
            interbank_name = row.interbank
            interbank_currency = row.currency
            booking_qty = row.booking_qty
            interbank_doc = frappe.get_list("InterBank Details",fields=["name","booking_qty","custom_qty","currency","parent"],
            filters={'parent':interbank_name})
            for e in interbank_doc:
                interbank_detail = frappe.get_doc("InterBank Details", e.name)
                interbank_detail.booking_qty += booking_qty
                # Save the updated record
                interbank_detail.save()
                # Append the updated details to the result list (if needed)
                result.append(interbank_detail)

        # Return the accumulated results
        return result 