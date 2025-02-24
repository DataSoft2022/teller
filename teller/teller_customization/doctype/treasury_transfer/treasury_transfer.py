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
		self.validate_balances()
		
	def validate_treasuries(self):
		"""Ensure treasuries are different and valid"""
		if self.from_treasury == self.to_treasury:
			frappe.throw("Source and destination treasuries must be different")
			
	def validate_accounts(self):
		"""Validate accounts belong to respective treasuries and match currency"""
		for row in self.currency_transfers:
			# Check source account
			if not frappe.db.exists("Account", {
				"name": row.from_account,
				"custom_teller_treasury": self.from_treasury
			}):
				frappe.throw(f"Account {row.from_account} does not belong to treasury {self.from_treasury}")
				
			# Check destination account
			if not frappe.db.exists("Account", {
				"name": row.to_account,
				"custom_teller_treasury": self.to_treasury
			}):
				frappe.throw(f"Account {row.to_account} does not belong to treasury {self.to_treasury}")
				
			# Ensure accounts have same currency
			from_currency = frappe.db.get_value("Account", row.from_account, "account_currency")
			to_currency = frappe.db.get_value("Account", row.to_account, "account_currency")
			if from_currency != to_currency:
				frappe.throw(f"Currency mismatch for accounts {row.from_account} and {row.to_account}")
			
	def validate_balances(self):
		"""Check if source accounts have sufficient balance"""
		for row in self.currency_transfers:
			if not row.amount:
				continue
				
			balance = get_balance_on(account=row.from_account)
			if flt(balance) < flt(row.amount):
				frappe.throw(f"Insufficient balance in account {row.from_account}. Available: {balance}")

	def on_submit(self):
		if not self.currency_transfers:
			frappe.throw("Please add at least one currency transfer")
			
		try:
			for row in self.currency_transfers:
				if not row.amount:
					continue
					
				# Create GL Entry for source account (credit)
				frappe.get_doc({
					"doctype": "GL Entry",
					"posting_date": nowdate(),
					"account": row.from_account,
					"credit": row.amount,
					"voucher_type": "Treasury Transfer",
					"voucher_no": self.name,
					"against": row.to_account,
					"remarks": f"Transfer to {self.to_treasury}",
					"credit_in_account_currency": row.amount
				}).insert(ignore_permissions=True).submit()
				
				# Create GL Entry for destination account (debit)
				frappe.get_doc({
					"doctype": "GL Entry",
					"posting_date": nowdate(),
					"account": row.to_account,
					"debit": row.amount,
					"voucher_type": "Treasury Transfer",
					"voucher_no": self.name,
					"against": row.from_account,
					"remarks": f"Transfer from {self.from_treasury}",
					"debit_in_account_currency": row.amount
				}).insert(ignore_permissions=True).submit()
				
		except Exception as e:
			frappe.db.rollback()
			frappe.throw(f"Error creating GL entries: {str(e)}")

@frappe.whitelist()
def get_available_currencies(from_treasury):
	"""Get all currencies available in the source treasury"""
	accounts = frappe.get_all(
		"Account",
		filters={
			"custom_teller_treasury": from_treasury,
			"is_group": 0,
			"disabled": 0,
			"account_type": ["in", ["Cash", "Bank"]]
		},
		fields=["name", "account_currency", "custom_currency_code"]
	)
	
	currencies = []
	for account in accounts:
		if not account.custom_currency_code:
			continue
			
		balance = get_balance_on(account=account.name)
		currencies.append({
			"currency_code": account.custom_currency_code,
			"currency_name": account.account_currency,
			"account": account.name,
			"balance": balance
		})
	
	return currencies

@frappe.whitelist()
def get_available_currency_codes(doctype, txt, searchfield, start, page_len, filters):
	"""Get list of currency codes available in the specified treasury"""
	treasury = filters.get('treasury')
	if not treasury:
		return []
		
	return frappe.db.sql("""
		SELECT DISTINCT 
			a.custom_currency_code as currency_code,
			c.name as currency_name
		FROM `tabAccount` a
		LEFT JOIN `tabCurrency` c ON c.custom_currency_code = a.custom_currency_code
		WHERE a.custom_teller_treasury = %s
		AND a.is_group = 0
		AND a.disabled = 0
		AND a.account_type IN ('Cash', 'Bank')
		AND a.custom_currency_code IS NOT NULL
		AND (
			a.custom_currency_code LIKE %s
			OR c.name LIKE %s
		)
		ORDER BY a.custom_currency_code
		LIMIT %s, %s
	""", (
		treasury,
		f"%{txt}%",
		f"%{txt}%",
		start,
		page_len
	))

@frappe.whitelist()
def get_currency_details(currency_code, from_treasury, to_treasury=None):
	"""Get all details for a currency in the specified treasuries"""
	# Get source account and its details
	from_account = frappe.db.get_value(
		"Account",
		{
			"custom_teller_treasury": from_treasury,
			"custom_currency_code": currency_code,
			"is_group": 0,
			"disabled": 0,
			"account_type": ["in", ["Cash", "Bank"]]
		},
		["name", "account_currency"],
		as_dict=True
	)
	
	if not from_account:
		frappe.throw(f"No account found for currency {currency_code} in treasury {from_treasury}")
	
	# Get currency name
	currency_name = frappe.db.get_value(
		"Currency",
		{"custom_currency_code": currency_code},
		"name"
	)
	
	result = {
		"currency_name": currency_name or currency_code,
		"from_account": from_account.name,
		"from_balance": get_balance_on(account=from_account.name)
	}
	
	# If destination treasury is specified, get its account too
	if to_treasury:
		to_account = frappe.db.get_value(
			"Account",
			{
				"custom_teller_treasury": to_treasury,
				"account_currency": from_account.account_currency,
				"is_group": 0,
				"disabled": 0,
				"account_type": ["in", ["Cash", "Bank"]]
			},
			"name"
		)
		
		if to_account:
			result.update({
				"to_account": to_account,
				"to_balance": get_balance_on(account=to_account)
			})
	
	return result

@frappe.whitelist()
def get_account_by_currency(treasury, currency):
	"""Get the account in the specified treasury for a given currency"""
	account = frappe.db.get_value("Account",
		{
			"custom_teller_treasury": treasury,
			"account_currency": currency,
			"is_group": 0,
			"disabled": 0,
			"account_type": ["in", ["Cash", "Bank"]]
		},
		"name"
	)
	
	if account:
		balance = get_balance_on(account=account)
		return {
			"account": account,
			"balance": balance
		}
	return None
