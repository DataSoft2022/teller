# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class TellerInvoiceDetails(Document):
	def validate(self):
		if not self.account:
			frappe.throw("Account is required")
			
		# Get parent document
		parent = frappe.get_doc("Teller Invoice", self.parent) if self.parent else None
		if not parent:
			return
			
		# Validate account belongs to treasury
		account = frappe.get_doc("Account", self.account)
		if account.custom_teller_treasury != parent.teller_treasury:
			frappe.throw(f"Account {self.account} is not assigned to your treasury")
			
		# Calculate amounts
		self.amount = self.quantity * self.exchange_rate
		self.egy_amount = self.amount
		
		# Check and update balance
		current_balance = frappe.db.get_value("Account", self.account, "balance")
		self.balance_after = current_balance + self.quantity
		
		if self.balance_after < 0:
			frappe.throw(f"Insufficient balance in account {self.account}")
