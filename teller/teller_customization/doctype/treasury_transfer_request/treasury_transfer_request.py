# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, get_datetime, now, get_link_to_form
from erpnext.accounts.utils import get_balance_on

class TreasuryTransferRequest(Document):
    def has_permission(self, permtype="read", doc=None):
        # If we're checking destination treasury, always allow
        if hasattr(self, 'treasury_to') and self.treasury_to:
            # Get the user's assigned treasuries
            user_treasuries = frappe.db.get_all(
                "User Permission",
                filters={
                    "user": frappe.session.user,
                    "allow": "Teller Treasury"
                },
                pluck="for_value"
            )
            
            # Allow if user has permission for either source or destination treasury
            if self.treasury_to in user_treasuries or self.treasury_from in user_treasuries:
                return True
            
        # For all other cases, use normal permission system
        return super().has_permission(permtype, doc)
        
    def check_permission(self, permtype, permlevel=None, ptype=None):
        # If we're checking destination treasury, skip permission check
        if hasattr(self, 'treasury_to') and self.treasury_to:
            # Get the user's assigned treasuries
            user_treasuries = frappe.db.get_all(
                "User Permission",
                filters={
                    "user": frappe.session.user,
                    "allow": "Teller Treasury"
                },
                pluck="for_value"
            )
            
            # Skip permission check if user has permission for either source or destination treasury
            if self.treasury_to in user_treasuries or self.treasury_from in user_treasuries:
                return
            
        # For all other cases, use normal permission check
        super().check_permission(permtype, permlevel)

    def validate(self):
        """Validate the document before saving"""
        self.validate_treasuries()
        self.validate_accounts()
        self.validate_balances()
        self.calculate_total()
        
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
        """Validate that all accounts belong to the correct treasuries and have the same currency"""
        if not self.currency_transfers:
            frappe.throw("No currency transfers specified")
            
        # Get EGP accounts for both treasuries for special handling
        source_egy_account = frappe.db.get_value("Teller Treasury", self.treasury_from, "egy_account")
        dest_egy_account = frappe.db.get_value("Teller Treasury", self.treasury_to, "egy_account")
        
        for row in self.currency_transfers:
            # Check source account - special handling for EGP account
            if row.from_account == source_egy_account:
                # This is the special EGP account, already verified
                pass
            elif not frappe.db.exists("Account", {
                "name": row.from_account,
                "custom_teller_treasury": self.treasury_from
            }):
                frappe.throw(f"Account {row.from_account} does not belong to treasury {self.treasury_from}")
                
            # Check destination account - special handling for EGP account
            if row.to_account == dest_egy_account:
                # This is the special EGP account, already verified
                pass
            elif not frappe.db.exists("Account", {
                "name": row.to_account,
                "custom_teller_treasury": self.treasury_to
            }):
                frappe.throw(f"Account {row.to_account} does not belong to treasury {self.treasury_to}")
                
            # Ensure accounts have same currency
            from_currency = frappe.db.get_value("Account", row.from_account, "account_currency")
            to_currency = frappe.db.get_value("Account", row.to_account, "account_currency")
            
            if from_currency != to_currency:
                frappe.throw(f"Currency mismatch between accounts: {row.from_account} ({from_currency}) and {row.to_account} ({to_currency})")
                
            # Ensure amount is positive
            if not row.amount or flt(row.amount) <= 0:
                frappe.throw(f"Amount must be greater than zero for currency {row.currency_display}")
            
    def validate_balances(self):
        """Check if source accounts have sufficient balance"""
        for row in self.currency_transfers:
            if not row.amount:
                continue
                
            balance = get_balance_on(account=row.from_account)
            if float(balance) < float(row.amount):
                frappe.throw(f"Insufficient balance in account {row.from_account}. Available: {balance}")
                
    def calculate_total(self):
        """Calculate the total amount of all currency transfers"""
        total = 0
        for row in self.currency_transfers:
            if row.amount:
                total += float(row.amount)
        
        self.total_amount = total

    def before_submit(self):
        """Validate before submission"""
        if not self.currency_transfers:
            frappe.throw("Please add at least one currency transfer")

    def on_submit(self):
        """When document is submitted, update status and notify relevant parties"""
        # Determine relationship type based on treasury roles
        self.determine_relationship_type()
        
        # Set initial status based on relationship type
        if self.relationship_type == "Manager to Teller":
            # Manager to Teller: Skip manager approval, go directly to recipient approval
            self.db_set('status', 'Pending Recipient Approval')
            self.notify_recipient()
        else:
            # Teller to Teller or Teller to Manager: Require manager approval first
            self.db_set('status', 'Pending Manager Approval')
            self.notify_manager()
            
    def determine_relationship_type(self):
        """Determine the relationship type based on the source and destination treasuries"""
        try:
            # Get source treasury employee role
            source_employee_id = frappe.db.get_value('Teller Treasury', self.treasury_from, 'employee')
            source_role = "Teller"  # Default role
            
            if source_employee_id:
                source_employee = frappe.get_doc('Employee', source_employee_id)
                # Check if source employee is a manager (has reports)
                has_reports = frappe.db.exists('Employee', {'reports_to': source_employee.name})
                if has_reports:
                    source_role = "Manager"
            
            # Get destination treasury employee role
            dest_employee_id = frappe.db.get_value('Teller Treasury', self.treasury_to, 'employee')
            dest_role = "Teller"  # Default role
            
            if dest_employee_id:
                dest_employee = frappe.get_doc('Employee', dest_employee_id)
                # Check if destination employee is a manager (has reports)
                has_reports = frappe.db.exists('Employee', {'reports_to': dest_employee.name})
                if has_reports:
                    dest_role = "Manager"
            
            # Set relationship type
            if source_role == "Manager" and dest_role == "Teller":
                relationship_type = "Manager to Teller"
            elif source_role == "Teller" and dest_role == "Manager":
                relationship_type = "Teller to Manager"
            else:
                relationship_type = "Teller to Teller"
                
            # Save relationship type
            self.db_set('relationship_type', relationship_type)
            
        except Exception as e:
            frappe.log_error(f"Error determining relationship type: {str(e)}", "Treasury Transfer Request Error")
            # Default to Teller to Teller if there's an error
            self.db_set('relationship_type', "Teller to Teller")

    def notify_manager(self):
        """Send notification to the reporting manager of destination treasury employee"""
        # Skip notification if already approved
        if self.status == 'Approved':
            return
            
        # Get employee assigned to destination treasury
        dest_employee = frappe.db.get_value('Employee', 
            {'user_id': frappe.db.get_value('User Permission', 
                {'allow': 'Teller Treasury', 'for_value': self.treasury_to}, 'user')
            }, 
            ['name', 'reports_to', 'employee_name'], as_dict=True
        )
        
        if not dest_employee:
            frappe.msgprint(f"No employee found assigned to treasury {self.treasury_to}")
            return
            
        # Get the user ID of the reporting manager
        reports_to_user = frappe.db.get_value('Employee', dest_employee.reports_to, 'user_id') if dest_employee.reports_to else None
        
        if not reports_to_user:
            frappe.msgprint(f"No user found for the reporting manager of {dest_employee.employee_name}")
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
            frappe.share.add(
                self.doctype, 
                self.name, 
                reports_to_user, 
                read=1, 
                write=1, 
                share=1
            )
            
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

    def notify_recipient(self):
        """Send notification to the recipient of the transfer"""
        try:
            # Get employee assigned to destination treasury
            dest_employee = self.get_treasury_employee(self.treasury_to)
            
            if not dest_employee:
                frappe.msgprint(f"No employee found assigned to treasury {self.treasury_to}")
                return
                
            recipient_user = dest_employee.user_id
            
            if not recipient_user:
                frappe.msgprint(f"No user found for the employee of {self.treasury_to}")
                return
                
            # Prepare message based on relationship type
            if self.relationship_type == "Manager to Teller":
                message = f"""Your manager has sent you a Treasury Transfer Request {self.name}.
From Branch: {self.branch_from} (Treasury: {self.treasury_from})
To Branch: {self.branch_to} (Treasury: {self.treasury_to})
Total Amount: {self.total_amount}

Please review and accept or reject this transfer.
"""
            else:
                # This is a Teller to Teller transfer that has been approved by the manager
                manager_name = frappe.db.get_value("User", self.master_approval, "full_name") if self.master_approval else "Your manager"
                message = f"""A Treasury Transfer Request {self.name} has been approved by {manager_name} and is waiting for your acceptance.
From Branch: {self.branch_from} (Treasury: {self.treasury_from})
To Branch: {self.branch_to} (Treasury: {self.treasury_to})
Total Amount: {self.total_amount}

Please review and accept or reject this transfer.
"""
            
            # Share document with recipient
            if not frappe.db.exists("DocShare", {
                "share_doctype": self.doctype,
                "share_name": self.name,
                "user": recipient_user
            }):
                frappe.share.add(
                    self.doctype, 
                    self.name, 
                    recipient_user, 
                    read=1, 
                    write=1, 
                    share=1
                )
                
            # Send notification to recipient
            notification = frappe.get_doc({
                "doctype": "Notification Log",
                "subject": f"Treasury Transfer Request {self.name} Awaiting Your Approval",
                "for_user": recipient_user,
                "type": "Alert",
                "document_type": self.doctype,
                "document_name": self.name,
                "email_content": message
            })
            notification.insert(ignore_permissions=True)
            
        except Exception as e:
            frappe.log_error(f"Error notifying recipient for {self.name}: {str(e)}", "Treasury Transfer Notification Error")

    def get_treasury_employee(self, treasury):
        """Get the employee assigned to the given treasury"""
        user_id = frappe.db.get_value("User Permission", {
            "allow": "Teller Treasury",
            "for_value": treasury
        }, "user")
        
        if user_id:
            return frappe.get_doc("Employee", {
                "user_id": user_id
            })
        
        return None

@frappe.whitelist()
def approve_request(request_name, user):
    """Approve the transfer request and create treasury transfer"""
    if not request_name:
        frappe.throw("Request name is required")
        
    try:
        # Get the request document
        doc = frappe.get_doc("Treasury Transfer Request", request_name)
        
        # Validate that the request is in a valid state for approval
        if doc.status not in ["Pending Manager Approval"]:
            frappe.throw(f"Cannot approve request in {doc.status} status")
            
        # Validate accounts and balances again
        doc.validate_accounts()
        doc.validate_balances()
        
        # Set manager approval
        doc.db_set('master_approval', user)
        
        # Check if this is a Teller to Manager transfer
        if doc.relationship_type == "Teller to Manager":
            # For Teller to Manager, complete the transfer immediately
            create_treasury_transfer(doc)
        else:
            # For Teller to Teller, change status to Pending Recipient Approval
            doc.db_set('status', 'Pending Recipient Approval')
            doc.notify_recipient()
            frappe.msgprint("Request approved and sent to recipient for acceptance")
            
    except Exception as e:
        frappe.db.rollback()
        error_msg = str(e)
        frappe.log_error(f"Error approving Treasury Transfer Request {request_name}: {error_msg}", "Treasury Transfer Request Approval Error")
        frappe.throw(f"Error approving request: {error_msg}")

def create_treasury_transfer(doc):
    """Create and submit a treasury transfer document"""
    # Validate there are valid transfers with positive amounts
    valid_transfers = [row for row in doc.currency_transfers if row.amount and float(row.amount) > 0]
    if not valid_transfers:
        frappe.throw("No valid currency transfers found with positive amounts")
        
    # Create the treasury transfer
    transfer = frappe.get_doc({
        "doctype": "Treasury Transfer",
        "from_treasury": doc.treasury_from,
        "to_treasury": doc.treasury_to,
        "currency_transfers": [
            {
                "currency_code": row.currency_code,
                "currency_display": row.currency_display,
                "from_account": row.from_account,
                "to_account": row.to_account,
                "amount": row.amount
            } for row in valid_transfers
        ]
    })
    # Bypass permission checks when creating the transfer
    transfer.flags.ignore_permissions = True
    transfer.insert()
    # Also ignore permissions for submission
    transfer.flags.ignore_permissions = True
    transfer.submit()
    
    # Update request status
    doc.db_set('status', 'Approved')
    
    # Notify branches
    notify_branches(doc, "approved", transfer.name)
    
    frappe.msgprint(f"Request approved and Treasury Transfer {transfer.name} created")
    return transfer.name

@frappe.whitelist()
def reject_request(request_name, user, reason=None):
    """Reject the transfer request"""
    if not request_name:
        frappe.throw("Request name is required")
        
    try:
        doc = frappe.get_doc("Treasury Transfer Request", request_name)
        
        if doc.docstatus != 1:
            frappe.throw("Request must be submitted before it can be rejected")
        
        if doc.status == "Approved":
            frappe.throw("This request is already approved and cannot be rejected")
            
        if doc.status != "Pending Manager Approval":
            frappe.throw("This request cannot be rejected because it is not pending approval. Current status: " + doc.status)
            
        # Always require a reason for rejection
        if not reason:
            frappe.throw("A reason is required when rejecting a transfer request")
            
        # Update status and manager approval using db_set
        doc.db_set('status', 'Rejected')
        doc.db_set('master_approval', user)
        
        # Store the rejection reason if provided
        if reason:
            doc.db_set('rejection_reason', reason)
        
        # Notify branches
        try:
            notify_branches(doc, "rejected", reason=reason)
        except Exception as e:
            frappe.log_error(f"Failed to notify branches for rejected request {request_name}: {str(e)}", "Treasury Transfer Notification Error")
            # Don't throw here, as the rejection was already processed
        
        # Log the successful rejection
        frappe.log_error(f"Treasury Transfer Request {request_name} rejected successfully by {user}. Reason: {reason or 'Not provided'}", "Treasury Transfer Rejection")
        
        return True
    except Exception as e:
        frappe.db.rollback()
        error_msg = str(e)
        frappe.log_error(f"Error rejecting Treasury Transfer Request {request_name}: {error_msg}", "Treasury Transfer Request Rejection Error")
        frappe.throw(f"Error rejecting request: {error_msg}")

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
        
    try:
        # Get specific users who should be notified based on the action
        users_to_notify = []
        
        # For recipient approval/rejection, only notify the source treasury employee and managers
        if action == "approved by recipient" or action == "rejected by recipient":
            # Get source treasury employee
            source_employee = frappe.db.get_value('Employee', 
                {'user_id': frappe.db.get_value('Teller Treasury', doc.treasury_from, 'employee')}, 
                'user_id')
            if source_employee:
                users_to_notify.append(source_employee)
                
            # Get source employee's manager
            source_manager = frappe.db.get_value('Employee', 
                {'user_id': source_employee}, 
                'reports_to')
            if source_manager:
                manager_user = frappe.db.get_value('Employee', source_manager, 'user_id')
                if manager_user:
                    users_to_notify.append(manager_user)
        
        # For manager approval/rejection, only notify the source and destination treasury employees
        elif action == "approved by manager" or action == "rejected by manager":
            # Get source treasury employee
            source_employee = frappe.db.get_value('Employee', 
                {'user_id': frappe.db.get_value('Teller Treasury', doc.treasury_from, 'employee')}, 
                'user_id')
            if source_employee:
                users_to_notify.append(source_employee)
                
            # Get destination treasury employee
            dest_employee = frappe.db.get_value('Employee', 
                {'user_id': frappe.db.get_value('Teller Treasury', doc.treasury_to, 'employee')}, 
                'user_id')
            if dest_employee:
                users_to_notify.append(dest_employee)
        
        # For other actions (like initial submission), notify both treasury employees
        else:
            # Get source and destination treasury employees
            source_employee = frappe.db.get_value('Employee', 
                {'user_id': frappe.db.get_value('Teller Treasury', doc.treasury_from, 'employee')}, 
                'user_id')
            dest_employee = frappe.db.get_value('Employee', 
                {'user_id': frappe.db.get_value('Teller Treasury', doc.treasury_to, 'employee')}, 
                'user_id')
                
            if source_employee:
                users_to_notify.append(source_employee)
            if dest_employee:
                users_to_notify.append(dest_employee)
        
        # Remove duplicates and None values
        users_to_notify = list(filter(None, set(users_to_notify)))
        
        for user in users_to_notify:
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
            
            # Also share the document with users if not already shared
            if not frappe.db.exists("DocShare", {
                "share_doctype": doc.doctype,
                "share_name": doc.name,
                "user": user
            }):
                frappe.share.add(
                    doc.doctype, 
                    doc.name, 
                    user, 
                    read=1, 
                    write=0, 
                    share=0
                )
    except Exception as e:
        frappe.log_error(f"Error notifying users for {doc.name}: {str(e)}", "Treasury Transfer Notification Error")

@frappe.whitelist()
def get_destination_account(treasury, currency):
    """Get destination account details bypassing permissions"""
    if not treasury or not currency:
        frappe.throw("Treasury and currency are required parameters")
        
    try:
        # Special handling for EGP currency - check the egy_account field first
        if currency == "EGP":
            egy_account = frappe.db.get_value("Teller Treasury", treasury, "egy_account")
            if egy_account:
                account_details = frappe.db.get_value("Account", 
                                                     egy_account, 
                                                     ["name", "account_currency", "account_type", "account_name"], 
                                                     as_dict=1)
                if account_details:
                    # Get balance using get_balance_on function
                    from erpnext.accounts.utils import get_balance_on
                    account_details["balance"] = frappe.utils.flt(get_balance_on(account=egy_account))
                    account_details["is_egy_account"] = 1
                    return account_details
        
        # First try to get account by exact currency name match
        account = frappe.db.sql("""
            SELECT name, account_currency, account_type, account_name
            FROM `tabAccount`
            WHERE custom_teller_treasury = %s
            AND account_currency = %s
            AND is_group = 0
            AND disabled = 0
            AND account_type IN ('Cash', 'Bank')
            LIMIT 1
        """, (treasury, currency), as_dict=1)
        
        if not account:
            # Try to match by currency code if exact match fails
            currency_code = frappe.db.get_value("Currency", {"name": currency}, "custom_currency_code")
            if currency_code:
                account = frappe.db.sql("""
                    SELECT name, account_currency, account_type, account_name
                    FROM `tabAccount`
                    WHERE custom_teller_treasury = %s
                    AND custom_currency_code = %s
                    AND is_group = 0
                    AND disabled = 0
                    AND account_type IN ('Cash', 'Bank')
                    LIMIT 1
                """, (treasury, currency_code), as_dict=1)
        
        if not account:
            # Log a warning but don't throw an exception
            frappe.log_error(f"No matching account found in treasury {treasury} for currency {currency}", 
                            "Treasury Transfer Warning")
            return {
                "name": "",
                "account_currency": currency,
                "account_type": "",
                "account_name": f"No account found for {currency}",
                "balance": 0,
                "missing": True
            }
            
        # Get balance using get_balance_on function
        from erpnext.accounts.utils import get_balance_on
        account[0]["balance"] = frappe.utils.flt(get_balance_on(account=account[0].name))
        account[0]["is_egy_account"] = 0
            
        return account[0]
    except Exception as e:
        frappe.log_error(f"Error getting destination account for treasury {treasury}, currency {currency}: {str(e)}", 
                        "Treasury Transfer Error")
        return {
            "name": "",
            "account_currency": currency,
            "account_type": "",
            "account_name": f"Error: {str(e)}",
            "balance": 0,
            "error": True
        }

@frappe.whitelist()
def check_if_user_is_recipient(user, treasury_code):
    """Check if the user has permission for the given treasury code"""
    try:
        # Check if user has permission for the treasury
        user_permissions = frappe.db.get_all(
            "User Permission",
            filters={
                "user": user,
                "allow": "Teller Treasury",
                "for_value": treasury_code
            },
            fields=["for_value"]
        )
        
        return bool(user_permissions)
    except Exception as e:
        frappe.log_error(f"Error checking if user {user} is recipient for treasury {treasury_code}: {str(e)}", 
                        "Treasury Transfer Request Error")
        return False

@frappe.whitelist()
def recipient_approve_request(request_name, user):
    """Recipient approves the transfer request, completing the transfer"""
    if not request_name:
        frappe.throw("Request name is required")
        
    try:
        # Get the request document
        doc = frappe.get_doc("Treasury Transfer Request", request_name)
        
        # Validate that the request is in a valid state for recipient approval
        if doc.status != "Pending Recipient Approval":
            frappe.throw(f"Cannot approve request in {doc.status} status")
        
        # Verify the user is actually a recipient for this treasury
        is_recipient = check_if_user_is_recipient(user, doc.treasury_to)
        if not is_recipient:
            frappe.throw("You do not have permission to approve this transfer request")
            
        # Validate accounts and balances again
        doc.validate_accounts()
        doc.validate_balances()
        
        # Set recipient approval
        doc.db_set('recipient_approval', user)
        doc.db_set('recipient_approval_date', frappe.utils.now())
        
        # Create the treasury transfer
        transfer_name = create_treasury_transfer(doc)
        
        return transfer_name
        
    except Exception as e:
        frappe.db.rollback()
        error_msg = str(e)
        frappe.log_error(f"Error recipient approving Treasury Transfer Request {request_name}: {error_msg}", "Treasury Transfer Request Recipient Approval Error")
        frappe.throw(f"Error approving request: {error_msg}")

@frappe.whitelist()
def recipient_reject_request(request_name, user, reason=None):
    """Recipient rejects the transfer request"""
    if not request_name:
        frappe.throw("Request name is required")
        
    try:
        # Get the request document
        doc = frappe.get_doc("Treasury Transfer Request", request_name)
        
        # Validate that the request is in a valid state for recipient rejection
        if doc.status != "Pending Recipient Approval":
            frappe.throw(f"Cannot reject request in {doc.status} status")
            
        # Verify the user is actually a recipient for this treasury
        is_recipient = check_if_user_is_recipient(user, doc.treasury_to)
        if not is_recipient:
            frappe.throw("You do not have permission to reject this transfer request")
            
        # Update status and rejection reason
        doc.db_set('status', 'Rejected')
        if reason:
            doc.db_set('rejection_reason', reason)
            
        # Set recipient rejection
        doc.db_set('recipient_approval', f"{user} (Rejected)")
        doc.db_set('recipient_approval_date', frappe.utils.now())
        
        # Notify branches
        notify_branches(doc, "rejected by recipient", None, reason)
        
        frappe.msgprint("Request rejected")
        
    except Exception as e:
        frappe.db.rollback()
        error_msg = str(e)
        frappe.log_error(f"Error recipient rejecting Treasury Transfer Request {request_name}: {error_msg}", "Treasury Transfer Request Recipient Rejection Error")
        frappe.throw(f"Error rejecting request: {error_msg}")