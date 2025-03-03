# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from teller.teller.doctype.request_interbank.request_interbank import Requestinterbank


class BranchDealinterbank(Document):
	def on_submit(self):
		"""When a branch deal is submitted, update the related interbank records"""
		self.update_interbank_records()
		self.create_booking_interbank()
	
	@frappe.whitelist()
	def create_booking_interbank(self):
		"""Create a booking interbank record from this branch deal"""
		if not self.branch_deal_details:
			frappe.msgprint(_("No branch deal details found. Cannot create booking."))
			return
		
		# Create a new booking interbank document
		booking = frappe.new_doc("Booking Interbank")
		
		# Set the customer field from the bank field
		booking.customer = self.bank
		
		# Set other fields
		booking.date = self.date
		booking.time = self.time
		booking.user = self.user
		booking.branch = self.branch
		booking.transaction = "Purchasing"  # Default to purchasing for branch deals
		
		# Add currencies from branch deal details
		for deal_row in self.branch_deal_details:
			booking.append("booked_currency", {
				"currency_code": deal_row.currency_code,
				"currency": deal_row.currency,
				"qty": deal_row.qty,
				"booking_qty": deal_row.qty,
				"request_reference": self.name
			})
		
		# Insert the booking
		try:
			booking.insert(ignore_permissions=True)
			frappe.msgprint(_("Booking Interbank {0} created successfully").format(booking.name))
			return booking
		except Exception as e:
			frappe.msgprint(_("Error creating Booking Interbank: {0}").format(str(e)))
			return None
	
	@frappe.whitelist()
	def update_interbank_records(self):
		"""Update interbank records with booking information from this branch deal"""
		if not self.branch_deal_details:
			frappe.msgprint(_("No branch deal details found."))
			return
		
		# Get all interbank records that might be affected
		interbank_records = frappe.get_all(
			"InterBank",
			filters={"status": ["in", ["Deal", "Open"]]},
			fields=["name"]
		)
		
		if not interbank_records:
			frappe.msgprint(_("No active interbank records found."))
			return
		
		updated_records = []
		
		# For each currency in the branch deal
		for deal_row in self.branch_deal_details:
			currency = deal_row.currency
			qty = deal_row.qty
			
			# Find matching interbank records with this currency
			for interbank in interbank_records:
				interbank_name = interbank.name
				
				# Get interbank details for this currency
				interbank_details = frappe.get_all(
					"InterBank Details",
					fields=["name", "booking_qty", "qty", "currency"],
					filters={"parent": interbank_name, "currency": currency}
				)
				
				for detail in interbank_details:
					# Update the booking quantity
					detail_doc = frappe.get_doc("InterBank Details", detail.name)
					current_booking_qty = detail_doc.booking_qty or 0
					new_booking_qty = current_booking_qty + qty
					
					# Don't exceed the total quantity
					if new_booking_qty > detail_doc.qty:
						new_booking_qty = detail_doc.qty
					
					# Update the booking quantity
					detail_doc.db_set("booking_qty", new_booking_qty)
					
					# Calculate and update the percentage
					self.calculate_and_update_percentage(interbank_name)
					
					updated_records.append(interbank_name)
					frappe.msgprint(_(f"Updated interbank {interbank_name} for currency {currency}"))
		
		if not updated_records:
			frappe.msgprint(_("No interbank records were updated."))
		
		return {"success": True, "updated_records": updated_records}
	
	def calculate_and_update_percentage(self, interbank_name):
		"""Calculate and update booking percentage for an interbank record"""
		# Use the existing calculate_precent method from Requestinterbank
		req_interbank = Requestinterbank()
		req_interbank.calculate_precent(interbank_name)
		
		frappe.msgprint(_(f"Updated booking percentage for interbank {interbank_name}"))
