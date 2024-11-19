# # # Copyright (c) 2024, Mohamed AbdElsabour and contributors
# # # For license information, please see license.txt

# import frappe
# from frappe.model.document import Document
# from frappe.utils import flt
# class Requestinterbank(Document):
#     @frappe.whitelist()
#     def create_booking(self):
#         currency_table = self.items

#         # Create a new DOCTYPE Booking Interbank
#         document = frappe.new_doc("Booking Interbank")
#         document.customer = self.customer
#         document.type = self.type
#         document.date = self.date
#         document.time = self.time
#         document.user = self.user
#         document.branch = self.branch
#         selected_currency = []
#         for row in currency_table:
#             remaining_qty = row.qty 
#             currency = row.currency
#             selected_currency.append(currency)
#             frappe.msgprint(f" Currency  is : {currency}")
#         selected_currency = list({row.currency for row in currency_table})
#         if not selected_currency:
#             frappe.msgprint("No valid currencies to process.")
#             return
#         for currency in selected_currency:
#             if remaining_qty > 0:
#                 # Fetch interbank details for the specific currency
#                 sql = """
#                     SELECT 
#                         ib.name, 
#                         ibd.currency,
#                         ibd.currency_code, 
#                         ibd.qty, 
#                         ibd.booking_qty,
#                         ibd.rate,
#                         ibd.creation
#                     FROM 
#                         `tabInterBank` ib 
#                     LEFT JOIN 
#                         `tabInterBank Details` ibd 
#                     ON 
#                         ibd.parent = ib.name
#                     WHERE 
#                         ibd.currency = %s
#                     AND ib.docstatus = 1
#                     AND ib.status != 'Closed'
#                     ORDER BY ibd.creation ASC
#                 """
#                 data = frappe.db.sql(sql,(currency, ),as_dict=True)
#                 for record in data:
#                     if remaining_qty <= 0:
#                         break
#                     available_qty = record.qty - record.booking_qty
                    
#                     if record.currency == currency and available_qty > 0 and record.rate > 0:
                    
#                         # Determine the quantity to append
#                         frappe.msgprint(f" Currency {currency} available_qty {available_qty} in {record.name}")
                        
#                         append_qty = min(available_qty, remaining_qty)
#                         remaining_qty -= append_qty 
#                         document.append("booked_currency", {
#                             "currency_code":record.currency_code,
#                             "currency": record.currency,
#                             "rate": record.rate,
#                             "qty": append_qty,
#                             "interbank": record.name,
#                             "booking_qty": append_qty
#                         })

#                 document.insert()
#                 booking_table = document.booked_currency
#                 result = []
#                 found_interbank = False
#                 for row in booking_table:
#                     interbank_name = row.interbank
#                     if interbank_name:
#                         found_interbank = True
#                         interbank = frappe.get_doc("InterBank",interbank_name)
#                         booking_amount = row.booking_qty
#                         frappe.msgprint(f"booking_qty {booking_amount}")
#                         interbank_details = frappe.get_list("InterBank Details",fields=["name","booking_qty","qty","currency","parent"],
#                         filters={'parent':interbank_name})
#                         # return interbank_doc
#                         for detail in interbank_details:
#                               detail_doc = frappe.get_doc("InterBank Details", detail.name)
#                               detail_doc.booking_qty = flt(detail_doc.booking_qty) + flt(booking_amount)
#                               detail_doc.db_set("booking_qty", detail_doc.booking_qty)  
#                               interbank_doc = frappe.get_doc("InterBank", interbank_name)          
#                               if detail_doc.qty == detail_doc.booking_qty:
#                                   interbank_doc = frappe.get_doc("InterBank", interbank_name)
#                                   interbank_doc.db_set("status", "Closed")                                
#                               else:    
#                                   interbank_doc.db_set("status", "Submitted")    
#                               interbank_doc.save()
#                               result.append({
#                                     "name": detail_doc.name,
#                                     "booking_qty": detail_doc.booking_qty,
#                                     "qty": detail_doc.qty,
#                                     "currency": detail_doc.currency,
#                                     "parent": detail_doc.parent
#                               })
#                     else:
#                         frappe.msgprint("there are not avaliable InterBank")
#                 if not found_interbank:
#                         frappe.msgprint("No valid InterBank records were found.")        
#                 return result          
          
# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

# import frappe
# from frappe.model.document import Document
# from frappe.utils import flt

# class Requestinterbank(Document):
#     @frappe.whitelist()
#     def create_booking(self):
#         currency_table = self.items

#         # Create a new DOCTYPE Booking Interbank
#         document = frappe.new_doc("Booking Interbank")
#         document.customer = self.customer
#         document.type = self.type
#         document.date = self.date
#         document.time = self.time
#         document.user = self.user
#         document.branch = self.branch

#         # Collect unique currencies
#         selected_currency = list({row.currency for row in currency_table})
#         if not selected_currency:
#             frappe.msgprint("No valid currencies to process.")
#             return

#         for currency in selected_currency:
#             remaining_qty = sum([row.qty for row in currency_table if row.currency == currency])  # Calculate remaining qty per currency
#             frappe.msgprint(f"Processing Currency: {currency}, Remaining Qty: {remaining_qty}")

#             if remaining_qty > 0:
#                 # Fetch interbank details for the specific currency
#                 sql = """
#                     SELECT 
#                         ib.name, 
#                         ibd.currency,
#                         ibd.currency_code, 
#                         ibd.qty, 
#                         ibd.booking_qty,
#                         ibd.rate,
#                         ibd.creation
#                     FROM 
#                         `tabInterBank` ib 
#                     LEFT JOIN 
#                         `tabInterBank Details` ibd 
#                     ON 
#                         ibd.parent = ib.name
#                     WHERE 
#                         ibd.currency = %s
#                     AND ib.docstatus = 1
#                     AND ib.status != 'Closed'
#                     ORDER BY ibd.creation ASC
#                 """
#                 data = frappe.db.sql(sql, (currency,), as_dict=True)

#                 for record in data:
#                     if remaining_qty <= 0:
#                         break

#                     available_qty = record.qty - record.booking_qty
#                     if available_qty > 0 and record.rate > 0 and currency == record.currency:
#                         # Determine the quantity to append
#                         append_qty = min(available_qty, remaining_qty)
#                         remaining_qty -= append_qty

#                         frappe.msgprint(f"Currency {currency} available_qty {available_qty} in {record.name}")
#                         frappe.msgprint(f"Appending Qty: {append_qty}, Remaining Qty: {remaining_qty}")

#                         # Append to booked currency in the document
#                         document.append("booked_currency", {
#                             "currency_code": record.currency_code,
#                             "currency": record.currency,
#                             "rate": record.rate,
#                             "qty": append_qty,
#                             "interbank": record.name,
#                             "booking_qty": append_qty
#                         })

#         if not document.booked_currency:
#             frappe.msgprint("No bookings could be created due to insufficient quantity.")
#             return

#         document.insert()  # Insert document once after all currencies are processed

#         # Update interbank details based on booked currencies
#         booking_table = document.booked_currency
#         result = []
#         found_interbank = False

#         for row in booking_table:
#             interbank_name = row.interbank
#             if interbank_name:
#                 found_interbank = True
#                 booking_amount = row.booking_qty
#                 frappe.msgprint(f"Booking Qty: {booking_amount}")

#                 interbank_details = frappe.get_list(
#                     "InterBank Details",
#                     fields=["name", "booking_qty", "qty", "currency", "parent"],
#                     filters={"parent": interbank_name},
#                 )

#                 for detail in interbank_details:
#                     detail_doc = frappe.get_doc("InterBank Details", detail.name)
#                     detail_doc.booking_qty = flt(detail_doc.booking_qty) + flt(booking_amount)
#                     detail_doc.db_set("booking_qty", detail_doc.booking_qty)

#                     interbank_doc = frappe.get_doc("InterBank", interbank_name)
#                     if detail_doc.qty == detail_doc.booking_qty:
#                         interbank_doc.db_set("status", "Closed")
#                         row = [row.name for row in currency_table if row.currency == currency]
#                         row.db_set("status", "Reserved")
#                     else:
#                         interbank_doc.db_set("status", "Submitted")

#                     interbank_doc.save()

#                     result.append({
#                         "name": detail_doc.name,
#                         "booking_qty": detail_doc.booking_qty,
#                         "qty": detail_doc.qty,
#                         "currency": detail_doc.currency,
#                         "parent": detail_doc.parent,
#                     })

#         if not found_interbank:
#             frappe.msgprint("No valid InterBank records were found.")
#         else:
#             frappe.msgprint("Booking created successfully.")

#         return result
import frappe
from frappe.model.document import Document
from frappe.utils import flt

class Requestinterbank(Document):
    @frappe.whitelist()
    def create_booking(self):
        currency_table = self.items

        # Create a new DOCTYPE Booking Interbank
        document = frappe.new_doc("Booking Interbank")
        document.customer = self.customer
        document.type = self.type
        document.date = self.date
        document.time = self.time
        document.user = self.user
        document.branch = self.branch

        # Collect unique currencies
        selected_currency = list({row.currency for row in currency_table})
        if not selected_currency:
            frappe.msgprint("No valid currencies to process.")
            return

        for currency in selected_currency:
            remaining_qty = sum([row.qty for row in currency_table if row.currency == currency])  # Calculate remaining qty per currency
            # frappe.msgprint(f"Processing Currency: {currency}, Remaining Qty: {remaining_qty}")

            if remaining_qty > 0:
                # Fetch interbank details for the specific currency
                sql = """
                    SELECT 
                        ib.name, 
                        ibd.currency,
                        ibd.currency_code, 
                        ibd.qty, 
                        ibd.booking_qty,
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
                    AND ib.status != 'Closed'
                    ORDER BY ibd.creation ASC
                """
                data = frappe.db.sql(sql, (currency,), as_dict=True)

                for record in data:
                    if remaining_qty <= 0:
                        break

                    available_qty = record.qty - record.booking_qty
                    if available_qty > remaining_qty and record.rate > 0 and currency == record.currency:
                        # Determine the quantity to append
                        append_qty = min(available_qty, remaining_qty)
                        remaining_qty -= append_qty

                        frappe.msgprint(f"Currency {currency} available_qty {available_qty} in {record.name}")
                        frappe.msgprint(f"Appending Qty: {append_qty}, Remaining Qty: {remaining_qty}")

                        # Append to booked currency in the document
                        document.append("booked_currency", {
                            "currency_code": record.currency_code,
                            "currency": record.currency,
                            "rate": record.rate,
                            "qty": append_qty,
                            "interbank": record.name,
                            "booking_qty": append_qty
                        })

        if not document.booked_currency:
            frappe.msgprint("No bookings could be created due to insufficient quantity.")
            return

        document.insert()  # Insert document once after all currencies are processed

        # Update interbank details based on booked currencies
        booking_table = document.booked_currency
        result = []
        found_interbank = False  # Move this outside the loop

        # Loop through each row in the booking table to handle individual currencies
        for row in booking_table:
            interbank_name = row.interbank
            if interbank_name:
                found_interbank = True
                booking_amount = row.booking_qty
                currency = row.currency  # Use currency from the booking row
                frappe.msgprint(f"Booking Qty: {booking_amount} for Currency: {currency}")

                # Get interbank details for the interbank record, filtered by currency
                interbank_details = frappe.get_list(
                    "InterBank Details",
                    fields=["name", "booking_qty", "qty", "currency", "parent"],
                    filters={"parent": interbank_name, "currency": currency},  # Ensure we only get the matching currency
                )

                for detail in interbank_details:
                    detail_doc = frappe.get_doc("InterBank Details", detail.name)
                    
                    # Check if the currency matches
                    if currency == detail_doc.currency:
                        # This means we update the matched currency
                        detail_doc.booking_qty = flt(detail_doc.booking_qty) + flt(booking_amount)
                        detail_doc.db_set("booking_qty", detail_doc.booking_qty)

                        # Get the parent InterBank document
                        interbank_doc = frappe.get_doc("InterBank", interbank_name)

                        # Check if the total quantity has been booked
                        if detail_doc.qty == detail_doc.booking_qty:
                            interbank_doc.db_set("status", "Closed")
                            
                            # Update the status for matching currency rows in the items table
                            for item in currency_table:
                                if item.currency == currency:
                                    item.db_set("status", "Reserved")
                        else:
                            interbank_doc.db_set("status", "Submitted")

                        interbank_doc.save()

                        # Append result for tracking processed interbank details
                        result.append({
                            "name": detail_doc.name,
                            "booking_qty": detail_doc.booking_qty,
                            "qty": detail_doc.qty,
                            "currency": detail_doc.currency,
                            "parent": detail_doc.parent,
                        })

        if not found_interbank:
            frappe.msgprint("No valid InterBank records were found.")
        else:
            frappe.msgprint("Booking created successfully.")

        return result
