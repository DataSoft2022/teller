# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import (
    add_days,
    cint,
    cstr,
    flt,
    formatdate,
    get_link_to_form,
    getdate,
    nowdate,
)
from erpnext.accounts.utils import get_balance_on

class TreasuryTransfer(Document):
	def validate(self):
		self.validate_treasuries()
		self.validate_accounts()
		self.validate_balance()
		
	def validate_treasuries(self):
		"""Ensure treasuries are different and valid"""
		if self.from_treasury == self.to_treasury:
			frappe.throw("Source and destination treasuries must be different")
			
	def validate_accounts(self):
		"""Validate accounts belong to respective treasuries and match currency"""
		if not self.from_account or not self.to_account:
			return
			
		# Check source account
		from_account = frappe.get_doc("Account", self.from_account)
		if from_account.custom_teller_treasury != self.from_treasury:
			frappe.throw(f"Account {self.from_account} does not belong to treasury {self.from_treasury}")
			
		# Check destination account
		to_account = frappe.get_doc("Account", self.to_account)
		if to_account.custom_teller_treasury != self.to_treasury:
			frappe.throw(f"Account {self.to_account} does not belong to treasury {self.to_treasury}")
			
		# Ensure accounts have same currency
		if from_account.account_currency != to_account.account_currency:
			frappe.throw("Source and destination accounts must have the same currency")
			
	def validate_balance(self):
		"""Check if source account has sufficient balance"""
		if not self.from_account or not self.amount:
			return
			
		balance = get_balance_on(account=self.from_account)
		
		if flt(balance) < flt(self.amount):
			frappe.throw(f"Insufficient balance in account {self.from_account}. Available: {balance}")

	def on_submit(self):
		if not (self.amount and self.from_account and self.to_account):
			frappe.throw("Please fill in all required fields")
			
		try:
			# Create GL Entry for source account (credit)
			frappe.get_doc({
				"doctype": "GL Entry",
				"posting_date": nowdate(),
				"account": self.from_account,
				"credit": self.amount,
				"voucher_type": "Treasury Transfer",
				"voucher_no": self.name,
				"against": self.to_account,
				"remarks": f"Transfer to {self.to_treasury}",
				"credit_in_account_currency": self.amount
			}).insert(ignore_permissions=True).submit()
			
			# Create GL Entry for destination account (debit)
			frappe.get_doc({
				"doctype": "GL Entry",
				"posting_date": nowdate(),
				"account": self.to_account,
				"debit": self.amount,
				"voucher_type": "Treasury Transfer",
				"voucher_no": self.name,
				"against": self.from_account,
				"remarks": f"Transfer from {self.from_treasury}",
				"debit_in_account_currency": self.amount
			}).insert(ignore_permissions=True).submit()
			
		except Exception as e:
			frappe.db.rollback()
			frappe.throw(f"Error creating GL entries: {str(e)}")

@frappe.whitelist()
def get_account_from_code(treasury, currency_code):
	"""Get account and currency for a specific currency code in a treasury"""
	account = frappe.db.get_value("Account",
		{
			"custom_teller_treasury": treasury,
			"custom_currency_code": currency_code,
			"is_group": 0,  # Ensure we get a child account, not a parent
			"disabled": 0,  # Only get active accounts
			"account_type": ["in", ["Cash", "Bank"]]  # Only get cash or bank accounts
		},
		["name", "account_currency"],
		as_dict=1
	)
	
	if account:
		return {
			"account": account.name,
			"currency": account.account_currency
		}
	return None

@frappe.whitelist()
def get_account_by_currency(treasury, currency):
	"""Get account for a specific currency in a treasury"""
	account = frappe.db.get_value("Account",
		{
			"custom_teller_treasury": treasury,
			"account_currency": currency,
			"is_group": 0,  # Ensure we get a child account, not a parent
			"disabled": 0,  # Only get active accounts
			"account_type": ["in", ["Cash", "Bank"]]  # Only get cash or bank accounts
		},
		"name"
	)
	
	return account

@frappe.whitelist()
def get_account_balance(account):
	"""Get current balance of an account"""
	try:
		balance = get_balance_on(account=account)
		return flt(balance)
	except Exception as e:
		frappe.log_error(f"Error getting balance for account {account}: {str(e)}")
		return 0
