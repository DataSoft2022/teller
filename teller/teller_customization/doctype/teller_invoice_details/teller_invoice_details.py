# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import _  # Import _ from frappe directly
from frappe.model.document import Document
from frappe.utils import flt  # Import specific utilities as needed


class TellerInvoiceDetails(Document):
	def validate(self):
		if not self.account:
			frappe.throw(_("Account is required"))
			
		# Get parent document
		parent = frappe.get_doc("Teller Invoice", self.parent) if self.parent else None
		if not parent:
			return
			
		# Validate account belongs to treasury
		account = frappe.get_doc("Account", self.account)
		if account.custom_teller_treasury != parent.treasury_code:
			frappe.throw(_("Account {0} is not assigned to your treasury").format(self.account))
			
		# Calculate amounts
		self.amount = flt(self.quantity) * flt(self.exchange_rate)
		self.egy_amount = self.amount
		
		# Check and update balance
		current_balance = frappe.db.get_value("Account", self.account, "balance")
		self.balance_after = flt(current_balance) + flt(self.quantity)
		
		if self.balance_after < 0:
			frappe.throw(_("Insufficient balance in account {0}").format(self.account))

		if hasattr(self, 'usd_amount') and hasattr(self, 'rate'):
			if self.usd_amount and self.rate:
				self.total_amount = flt(self.usd_amount) * flt(self.rate)

		self.validate_exchange_rate()
		self.calculate_amounts()

	def validate_exchange_rate(self):
		if self.currency:
			# Get the latest exchange rate
			currency_exchange = frappe.get_list(
				"Currency Exchange",
				filters={"from_currency": self.currency},
				fields=["custom_selling_exchange_rate"],
				order_by="creation desc",
				limit=1
			)
			
			if currency_exchange:
				self.exchange_rate = currency_exchange[0].custom_selling_exchange_rate
			else:
				frappe.throw(f"No exchange rate found for currency {self.currency}")

	def calculate_amounts(self):
		if self.quantity and self.exchange_rate:
			self.amount = self.quantity
			self.egy_amount = self.quantity * self.exchange_rate
