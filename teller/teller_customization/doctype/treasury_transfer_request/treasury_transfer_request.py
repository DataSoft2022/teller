# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import get_link_to_form, nowdate
from erpnext.accounts.utils import get_balance_on

class TreasuryTransferRequest(Document):
    def has_permission(self, permtype="read", doc=None):
        # If we're checking destination treasury, always allow
        if hasattr(self, 'treasury_to') and self.treasury_to:
            return True
            
        # For all other cases, use normal permission system
        return super().has_permission(permtype, doc)
        
    def check_permission(self, permtype, permlevel=None, ptype=None):
        # If we're checking destination treasury, skip permission check
        if hasattr(self, 'treasury_to') and self.treasury_to:
            return
            
        # For all other cases, use normal permission check
        super().check_permission(permtype, permlevel)

    def validate(self):
        self.validate_treasuries()
        self.validate_accounts()
        self.validate_balances()
        
    def validate_treasuries(self):
        """Ensure treasuries are different and valid"""
        if self.treasury_from == self.treasury_to:
            frappe.throw("Source and destination treasuries must be different")
            
        # For source treasury, use normal permission check
        if not frappe.db.exists("Teller Treasury", self.treasury_from):
            frappe.throw(f"Treasury {self.treasury_from} does not exist")
            
        # For destination treasury, use direct SQL to bypass permissions
        to_treasury = frappe.db.sql("""
            SELECT name FROM `tabTeller Treasury` 
            WHERE name = %s LIMIT 1
        """, self.treasury_to)
        
        if not to_treasury:
            frappe.throw(f"Treasury {self.treasury_to} does not exist")
            
    def validate_accounts(self):
        """Validate accounts belong to respective treasuries and match currency"""
        for row in self.currency_transfers:
            # Check source account
            if not frappe.db.exists("Account", {
                "name": row.from_account,
                "custom_teller_treasury": self.treasury_from
            }):
                frappe.throw(f"Account {row.from_account} does not belong to treasury {self.treasury_from}")
                
            # Check destination account
            if not frappe.db.exists("Account", {
                "name": row.to_account,
                "custom_teller_treasury": self.treasury_to
            }):
                frappe.throw(f"Account {row.to_account} does not belong to treasury {self.treasury_to}")
                
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
            if float(balance) < float(row.amount):
                frappe.throw(f"Insufficient balance in account {row.from_account}. Available: {balance}")

    def before_submit(self):
        """Validate before submission"""
        if not self.currency_transfers:
            frappe.throw("Please add at least one currency transfer")

    def on_submit(self):
        """Set status to pending and notify master"""
        # Set status to pending master approval
        self.db_set('status', 'Pending Master Approval')
        
        # Notify master about the request
        self.notify_master()
        
    def notify_master(self):
        """Send notification to the reporting manager of destination treasury employee"""
        # Get employee assigned to destination treasury
        dest_employee = frappe.db.get_value('Employee', 
            {'user_id': frappe.db.get_value('User Permission', 
                {'allow': 'Teller Treasury', 'for_value': self.treasury_to}, 'user')
            }, 
            ['name', 'reports_to', 'employee_name']
        )
        
        if not dest_employee:
            frappe.msgprint(f"No employee found assigned to treasury {self.treasury_to}")
            return
            
        # Get the user ID of the reporting manager
        reports_to_user = frappe.db.get_value('Employee', dest_employee[1], 'user_id')
        
        if not reports_to_user:
            frappe.msgprint(f"No user found for the reporting manager of {dest_employee[2]}")
            return
            
        message = f"""New Treasury Transfer Request {self.name}
From Branch: {self.branch_from} (Treasury: {self.treasury_from})
To Branch: {self.branch_to} (Treasury: {self.treasury_to})
Total Amount: {self.total_amount}
"""

        # Share document with reporting manager
        if not frappe.db.exists("DocShare", {
            "share_doctype": self.doctype,
            "share_name": self.name,
            "user": reports_to_user
        }):
            frappe.db.sql("""
                INSERT INTO `tabDocShare`
                    (name, share_doctype, share_name, user, `read`, `write`, `share`, everyone, owner, creation, modified, modified_by)
                VALUES
                    (%s, %s, %s, %s, 1, 1, 1, 0, %s, NOW(), NOW(), %s)
            """, (
                frappe.generate_hash("", 10),
                self.doctype,
                self.name,
                reports_to_user,
                frappe.session.user,
                frappe.session.user
            ))
            
        # Send notification to reporting manager
        notification = frappe.get_doc({
            "doctype": "Notification Log",
            "subject": f"New Treasury Transfer Request {self.name}",
            "for_user": reports_to_user,
            "type": "Alert",
            "document_type": self.doctype,
            "document_name": self.name,
            "email_content": message
        })
        notification.insert(ignore_permissions=True)

@frappe.whitelist()
def approve_request(request_name, user):
    """Approve the transfer request and create treasury transfer"""
    doc = frappe.get_doc("Treasury Transfer Request", request_name)
    
    if doc.docstatus != 1:
        frappe.throw("Request must be submitted before it can be approved")
    
    if doc.status != "Pending Master Approval":
        frappe.throw("This request cannot be approved because it is not pending approval. Current status: " + doc.status)
        
    # Update status and master approval using db_set
    doc.db_set('status', 'Approved')
    doc.db_set('master_approval', user)
    
    # Create treasury transfer
    transfer = frappe.get_doc({
        "doctype": "Treasury Transfer",
        "from_treasury": doc.treasury_from,
        "to_treasury": doc.treasury_to,
        "currency_transfers": doc.currency_transfers
    })
    transfer.insert()
    transfer.submit()
    
    # Notify branches
    notify_branches(doc, "approved", transfer.name)
    
    return transfer.name

@frappe.whitelist()
def reject_request(request_name, user, reason=None):
    """Reject the transfer request"""
    doc = frappe.get_doc("Treasury Transfer Request", request_name)
    
    if doc.docstatus != 1:
        frappe.throw("Request must be submitted before it can be rejected")
    
    if doc.status != "Pending Master Approval":
        frappe.throw("This request cannot be rejected because it is not pending approval. Current status: " + doc.status)
        
    # Update status and master approval using db_set
    doc.db_set('status', 'Rejected')
    doc.db_set('master_approval', user)
    
    # Notify branches
    notify_branches(doc, "rejected", reason=reason)

def notify_branches(doc, action, transfer_name=None, reason=None):
    """Notify both branches about the request status"""
    message = f"""Treasury Transfer Request {doc.name} has been {action}.
From Branch: {doc.branch_from} (Treasury: {doc.treasury_from})
To Branch: {doc.branch_to} (Treasury: {doc.treasury_to})
Total Amount: {doc.total_amount}
"""
    if transfer_name:
        message += f"\nTransfer document created: {get_link_to_form('Treasury Transfer', transfer_name)}"
    if reason:
        message += f"\nReason: {reason}"
        
    # Get branch users (you'll need to implement logic to get users for each branch)
    branch_users = get_branch_users([doc.branch_from, doc.branch_to])
    
    for user in branch_users:
        notification = frappe.get_doc({
            "doctype": "Notification Log",
            "subject": f"Treasury Transfer Request {doc.name} {action}",
            "for_user": user,
            "type": "Alert",
            "document_type": doc.doctype,
            "document_name": doc.name,
            "email_content": message
        })
        notification.insert(ignore_permissions=True)

def get_branch_users(branches):
    """Get users associated with the branches through Employee records"""
    return frappe.get_all(
        "User",
        filters={
            "enabled": 1,
            "name": ["in", 
                frappe.get_all(
                    "Employee",
                    filters={
                        "branch": ["in", branches],
                        "status": "Active"
                    },
                    pluck="user_id"
                )
            ]
        },
        pluck="name"
    )

@frappe.whitelist()
def get_destination_account(treasury, currency):
    """Get destination account details bypassing permissions"""
    account = frappe.db.sql("""
        SELECT name, account_currency
        FROM `tabAccount`
        WHERE custom_teller_treasury = %s
        AND account_currency = %s
        AND is_group = 0
        AND disabled = 0
        AND account_type IN ('Cash', 'Bank')
        LIMIT 1
    """, (treasury, currency), as_dict=1)
    
    if not account:
        frappe.throw(f"No matching account found in treasury {treasury} for currency {currency}")
        
    return account[0] 