# Copyright (c) 2025, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _

class TreasuryAssignmentTool(Document):
    def validate(self):
        if not self.user or not self.teller_treasury or not self.branch:
            frappe.throw(_("User, Branch, and Teller Treasury are required fields"))
            
        # Validate that the selected treasury belongs to the selected branch
        treasury = frappe.get_doc("Teller Treasury", self.teller_treasury)
        if treasury.branch != self.branch:
            frappe.throw(_("Selected Teller Treasury does not belong to the selected Branch"))
            
    def on_submit(self):
        self.assign_treasury_and_accounts()
        
    def assign_treasury_and_accounts(self):
        try:
            # Get all accounts for the branch
            branch_accounts = frappe.get_all("Account", 
                filters={
                    "parent_account": ["like", f"%{self.branch}%"],
                    "is_group": 0,
                    "account_type": ["in", ["Bank", "Cash"]]
                },
                fields=["name"]
            )
            
            if not branch_accounts:
                frappe.throw(_("No eligible accounts found for branch {0}").format(self.branch))
            
            # Update custom_teller_treasury field for each account
            for account in branch_accounts:
                frappe.db.set_value("Account", account.name, "custom_teller_treasury", self.teller_treasury)
            
            # Create user permission for treasury
            if not frappe.db.exists("User Permission", {
                "user": self.user,
                "allow": "Teller Treasury",
                "for_value": self.teller_treasury
            }):
                frappe.get_doc({
                    "doctype": "User Permission",
                    "user": self.user,
                    "allow": "Teller Treasury",
                    "for_value": self.teller_treasury,
                    "apply_to_all_doctypes": 1
                }).insert(ignore_permissions=True)
            
            # Create user permissions for accounts
            for account in branch_accounts:
                if not frappe.db.exists("User Permission", {
                    "user": self.user,
                    "allow": "Account",
                    "for_value": account.name
                }):
                    frappe.get_doc({
                        "doctype": "User Permission",
                        "user": self.user,
                        "allow": "Account",
                        "for_value": account.name,
                        "apply_to_all_doctypes": 1
                    }).insert(ignore_permissions=True)
            
            frappe.db.commit()
            
        except Exception as e:
            frappe.db.rollback()
            frappe.log_error(f"Treasury Assignment Error: {str(e)}\n{frappe.get_traceback()}")
            frappe.throw(_("Error assigning treasury and accounts: {0}").format(str(e)))
            
    def on_cancel(self):
        self.remove_treasury_and_accounts()
        
    def remove_treasury_and_accounts(self):
        try:
            # Get all accounts for the branch
            branch_accounts = frappe.get_all("Account", 
                filters={
                    "parent_account": ["like", f"%{self.branch}%"],
                    "is_group": 0,
                    "custom_teller_treasury": self.teller_treasury
                },
                fields=["name"]
            )
            
            # Remove custom_teller_treasury from accounts
            for account in branch_accounts:
                frappe.db.set_value("Account", account.name, "custom_teller_treasury", None)
            
            # Remove user permissions for treasury
            frappe.db.delete("User Permission", {
                "user": self.user,
                "allow": "Teller Treasury",
                "for_value": self.teller_treasury
            })
            
            # Remove user permissions for accounts
            for account in branch_accounts:
                frappe.db.delete("User Permission", {
                    "user": self.user,
                    "allow": "Account",
                    "for_value": account.name
                })
            
            frappe.db.commit()
            
        except Exception as e:
            frappe.db.rollback()
            frappe.log_error(f"Treasury Unassignment Error: {str(e)}\n{frappe.get_traceback()}")
            frappe.throw(_("Error removing treasury and account assignments: {0}").format(str(e)))

