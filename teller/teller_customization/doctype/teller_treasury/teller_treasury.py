# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import _  # Import _ from frappe directly, not from frappe.utils
from frappe.model.document import Document

class TellerTreasury(Document):
	def validate(self):
		try:
			if self.branch:
				# Get branch name/number
				branch_doc = frappe.get_doc("Branch", self.branch)
				self.branch = branch_doc.name
			self.validate_accounts()
		except Exception as e:
			frappe.log_error(f"TellerTreasury validate error: {str(e)}\n{frappe.get_traceback()}")
			frappe.throw(_("Error validating treasury: {0}").format(str(e)))
		
	def validate_accounts(self):
		"""Ensure accounts belong to correct branch and are of correct type"""
		try:
			if hasattr(self, 'egy_account') and self.egy_account:
				account = frappe.get_doc("Account", self.egy_account)
				if account.account_type not in ['Bank', 'Cash']:
					frappe.throw(_("EGY Account must be of type Bank or Cash"))
				
				# Check if account belongs to correct branch
				# Instead of checking parent_account, check the custom_branch field
				if hasattr(account, 'custom_branch') and account.custom_branch:
					if str(account.custom_branch) != str(self.branch):
						frappe.throw(_("EGY Account must belong to branch {0}").format(self.branch))
				else:
					# If custom_branch is not set, check using the old method as fallback
					branch_accounts = frappe.get_all("Account", 
						filters={
							"parent_account": ["like", f"%{self.branch}%"],
							"is_group": 0
						},
						pluck="name"
					)
					if self.egy_account not in branch_accounts:
						frappe.throw(_("EGY Account must belong to branch {0}").format(self.branch))
		except Exception as e:
			frappe.log_error(f"Error validating accounts: {str(e)}\n{frappe.get_traceback()}")
			frappe.throw(_("Error validating accounts: {0}").format(str(e)))
		
	def on_trash(self):
		"""Clean up when treasury is deleted"""
		# Remove treasury reference from accounts
		frappe.db.sql("""
			UPDATE `tabAccount` 
			SET custom_teller_treasury = NULL 
			WHERE custom_teller_treasury = %s
		""", self.name)