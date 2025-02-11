# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import _  # Import _ from frappe directly, not from frappe.utils
from frappe.model.document import Document
from frappe.permissions import add_user_permission

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
		
	def after_insert(self):
		"""Set up initial permissions for this treasury"""
		self.setup_account_permissions()
		
	def setup_account_permissions(self):
		"""Setup account permissions for this treasury"""
		# Get all currency accounts for this branch
		branch_accounts = frappe.get_all("Account",
			filters={
				"parent_account": ["like", f"%{self.branch}%"],
				"is_group": 0,
				"account_type": ["in", ["Bank", "Cash"]]
			},
			fields=["name"]
		)
		
		# Set treasury on accounts
		for account in branch_accounts:
			frappe.db.set_value("Account", account.name, "custom_teller_treasury", self.name)
		
		# Update permissions for any active shifts
		self.update_active_shift_permissions()
		
		frappe.db.commit()
		
	def update_active_shift_permissions(self):
		"""Update permissions for all active shifts using this treasury"""
		# Get all active shifts for this treasury
		active_shifts = frappe.get_all("Open Shift for Branch",
			filters={
				"teller_treasury": self.name,
				"shift_status": "Active",
				"docstatus": 1
			},
			fields=["name", "current_user"]
		)
		
		# For each active shift, update account permissions
		for shift in active_shifts:
			user = frappe.get_value("Employee", shift.current_user, "user_id")
			if not user:
				continue
				
			# Get all accounts for this treasury
			accounts = frappe.get_all("Account",
				filters={
					"custom_teller_treasury": self.name,
					"account_type": ["in", ["Bank", "Cash"]]
				},
				pluck="name"
			)
			
			# Add permissions for each account
			for account in accounts:
				try:
					add_user_permission("Account", account, user)
				except Exception as e:
					frappe.log_error(f"Error adding permission for account {account} to user {user}: {str(e)}")
				
	def on_trash(self):
		"""Clean up when treasury is deleted"""
		# Remove treasury reference from accounts
		frappe.db.sql("""
			UPDATE `tabAccount` 
			SET custom_teller_treasury = NULL 
			WHERE custom_teller_treasury = %s
		""", self.name)