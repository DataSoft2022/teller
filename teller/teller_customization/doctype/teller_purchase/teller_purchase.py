# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt

import frappe
import json
from frappe.utils import get_url_to_form 
from frappe.model.mapper import get_mapped_doc
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
from frappe import get_doc
from frappe.model.document import Document
from frappe.utils import nowdate, nowtime
from erpnext.accounts.utils import (
    cancel_exchange_gain_loss_journal,
    get_account_currency,
    get_balance_on,
    get_outstanding_invoices,
    get_party_types_from_account_type,
    get_fiscal_year,
)
from frappe import _, utils
from erpnext.accounts.general_ledger import (
    make_gl_entries,
    make_reverse_gl_entries,
    process_gl_map,
    make_entry,
)
from frappe.utils import nowdate, now
from erpnext.accounts.general_ledger import make_entry
import frappe.utils


class TellerPurchase(Document):
    def before_insert(self):
        """Set initial values and validate user permissions"""
        try:
            # Set teller from current user
            if not self.teller:
                self.teller = frappe.session.user
                
            # Get branch and shift info
            self.set_branch_and_shift()
            
            # Set treasury details
            self.set_treasury_details()
            
            # Set movement number
            self.set_move_number()
            
        except Exception as e:
            frappe.log_error(
                message=f"Error in before_insert: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Insert Error"
            )
            frappe.throw(_("Error during document creation: {0}").format(str(e)))

    def validate(self):
        """Validate document"""
        try:
            # First validate user permissions for accounts
            self.has_account_permissions()
            
            # Log start with key info
            frappe.log_error(
                message=f"Starting validate for purchase with treasury={self.treasury_code}",
                title="Teller Purchase Validate"
            )
            
            # Buyer validation
            if not self.buyer:
                frappe.throw(_("Buyer is required"))
                
            # Validate buyer exists and is active
            customer = frappe.db.get_value("Customer", self.buyer, 
                ["disabled", "custom_is_exceed"], as_dict=1)
                
            if not customer:
                frappe.throw(_("Selected buyer {0} does not exist").format(self.buyer))
                
            if customer.disabled:
                frappe.throw(_("Selected buyer {0} is disabled").format(self.buyer))
                
            if customer.custom_is_exceed and not self.exceed:
                frappe.throw(_("Buyer {0} has exceeded their limit. Please check the 'Exceed' checkbox to proceed.").format(self.buyer))
            
            # Basic validations
            if not self.treasury_code:
                frappe.throw(_("Treasury code is required"))
            
            if not self.purchase_transactions:
                frappe.throw(_("At least one currency transaction is required"))
            
            if len(self.purchase_transactions) > 3:
                frappe.throw(_("Cannot process more than three currencies"))
            
            # Validate shift and transactions
            self.validate_active_shift()
            self.validate_currency_transactions()
            self.calculate_totals()
            
        except Exception as e:
            frappe.log_error(
                message=f"Validation error: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Teller Purchase Validation Error"
            )
            frappe.throw(_("Validation error: {0}").format(str(e)))

    def before_save(self):
        """Handle operations before saving"""
        try:
            # Set customer invoices if buyer exists
            if self.buyer:
                self.set_customer_invoices()
            
            # Ensure branch details are preserved
            if not self.branch_name and self.branch_no:
                self.branch_name = frappe.db.get_value("Branch", self.branch_no, "custom_branch_no")
            
        except Exception as e:
            frappe.log_error(
                message=f"Error in before_save: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Save Error"
            )
            frappe.throw(_("Error before saving: {0}").format(str(e)))

    def on_submit(self):
        """Create GL entries when document is submitted"""
        try:
            # Create GL entries
            self.make_gl_entries()
            
            # Update printing roll with new number only after successful GL entries
            if hasattr(self, 'next_receipt_number'):
                printing_roll = frappe.get_doc("Printing Roll", self.current_roll)
                printing_roll.last_printed_number = self.next_receipt_number
                printing_roll.save()
            
            # Don't commit here - let Frappe handle the transaction
            
        except Exception as e:
            frappe.db.rollback()
            frappe.log_error(
                message=f"Error in on_submit: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Submit Error"
            )
            frappe.throw(_("Error during submission: {0}").format(str(e)))

    def set_customer_invoices(self):
        """Set customer invoice history"""
        try:
            frappe.log_error(
                message=f"Setting Customer Invoices:\nBuyer: {self.buyer}",
                title="Teller Purchase Debug"
            )
            
            duration = self.get_duration()
            if not duration:
                frappe.msgprint(_("Please setup Duration in Teller Settings"))
                return
            
            duration = int(duration)
            today = nowdate()
            post_duration = add_days(today, -duration)
            
            # Get relevant invoices
            invoices = frappe.get_all(
                "Teller Purchase",
                fields=["name", "buyer", "total", "closing_date"],
                filters={
                    "docstatus": 1,
                    "buyer": self.buyer,
                    "closing_date": ["between", [post_duration, today]],
                }
            )
            
            frappe.log_error(
                message=f"Found Invoices: {invoices}",
                title="Teller Purchase Debug"
            )
            
            # Clear existing history
            self.set("purchase_history", [])
            
            # Add invoices to history
            for invoice in invoices:
                try:
                    self.append(
                        "purchase_history",
                        {
                            "invoice": invoice.name,
                            "amount": invoice.total,
                            "posting_date": invoice.closing_date,
                        }
                    )
                except Exception as e:
                    frappe.log_error(
                        message=f"Error appending invoice {invoice.name}: {str(e)}",
                        title="Teller Purchase Error"
                    )
                
        except Exception as e:
            frappe.log_error(
                message=f"Error in set_customer_invoices: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Teller Purchase Error"
            )
            frappe.throw(_("Error setting customer history: {0}").format(str(e)))

    def validate_currency_transactions(self):
        """Validate currency transactions"""
        try:
            for row in self.purchase_transactions:
                # Validate required fields
                if not row.account:
                    frappe.throw(_("Account is required for all transactions"))
                    
                if not row.quantity:
                    frappe.throw(_("Quantity is required for all transactions"))
                    
                if not row.exchange_rate:
                    frappe.throw(_("Exchange rate is required for all transactions"))
                
                # Get account details
                account = frappe.get_doc("Account", row.account)
                
                # Validate account currency
                if account.account_currency == "EGP":
                    frappe.throw(_("Cannot use EGP account for currency transactions"))
                
                # Calculate EGY amount (quantity * exchange_rate)
                row.egy_amount = flt(row.get('quantity', 0)) * flt(row.get('exchange_rate', 0))
                
        except Exception as e:
            frappe.log_error(
                message=f"Validation error: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Teller Purchase Validation Error"
            )
            raise

    def calculate_totals(self):
        """Calculate total amounts"""
        try:
            self.total = 0
            
            for row in self.purchase_transactions:
                if row.egy_amount:
                    self.total += flt(row.egy_amount)
                
        except Exception as e:
            frappe.log_error(
                message=f"Error calculating totals: {str(e)}\n{frappe.get_traceback()}",
                title="Total Calculation Error"
            )
            frappe.throw(_("Error calculating totals: {0}").format(str(e)))

    def make_gl_entries(self, cancel=False):
        """Create GL Entries for currency transactions"""
        try:
            # Validate EGY account exists
            if not self.egy:
                frappe.throw(_("EGY Account is required for GL entries"))
            
            # Get company from defaults
            company = self.company
            if not company:
                company = frappe.defaults.get_user_default("company") or \
                         frappe.get_cached_value('Global Defaults', None, 'default_company')
            
            if not company:
                frappe.throw(_("Please set default company in Global Defaults"))
            
            posting_date = getattr(self, 'posting_date', None) or getattr(self, 'date', None) or nowdate()
            fiscal_year = get_fiscal_year(posting_date, company=company)[0]
            
            for row in self.purchase_transactions:
                if not row.egy_amount:
                    continue
                if not row.account:
                    frappe.throw(_("You must enter all required fields in row {0}").format(row.idx))
                
                # Get account currencies
                account = frappe.get_doc("Account", row.account)
                egy_account = frappe.get_doc("Account", self.egy)
                
                # For purchase transactions:
                # 1. Debit EGY account (paying EGY)
                debit_entry = frappe.get_doc({
                    "doctype": "GL Entry",
                    "posting_date": posting_date,
                    "account": self.egy,
                    "debit": flt(row.egy_amount) if not cancel else 0,
                    "credit": 0 if not cancel else flt(row.egy_amount),
                    "account_currency": egy_account.account_currency,
                    "debit_in_account_currency": flt(row.egy_amount) if not cancel else 0,
                    "credit_in_account_currency": 0 if not cancel else flt(row.egy_amount),
                    "against": row.account,
                    "against_voucher_type": self.doctype,
                    "against_voucher": self.name,
                    "voucher_type": self.doctype,
                    "voucher_no": self.name,
                    "company": company,
                    "fiscal_year": fiscal_year,
                    "is_opening": "No",
                    "remarks": f"Currency purchase: Paid {row.egy_amount} EGY for {row.quantity} {row.currency_code}"
                })
                debit_entry.insert(ignore_permissions=True).submit()

                # 2. Credit currency account (giving foreign currency)
                credit_entry = frappe.get_doc({
                    "doctype": "GL Entry",
                    "posting_date": posting_date,
                    "account": row.account,
                    "debit": 0 if not cancel else flt(row.egy_amount),
                    "credit": flt(row.egy_amount) if not cancel else 0,
                    "account_currency": account.account_currency,
                    "debit_in_account_currency": 0 if not cancel else flt(row.quantity),
                    "credit_in_account_currency": flt(row.quantity) if not cancel else 0,
                    "against": self.egy,
                    "against_voucher_type": self.doctype,
                    "against_voucher": self.name,
                    "voucher_type": self.doctype,
                    "voucher_no": self.name,
                    "company": company,
                    "fiscal_year": fiscal_year,
                    "is_opening": "No",
                    "remarks": f"Currency purchase: Received {row.quantity} {row.currency_code} for {row.egy_amount} EGY"
                })
                credit_entry.insert(ignore_permissions=True).submit()

                if debit_entry and credit_entry:
                    frappe.msgprint(
                        _("Teller Purchase created successfully with Total {0}").format(
                            self.total
                        )
                    )
                
        except Exception as e:
            frappe.log_error(
                message=f"Error creating GL entries: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="GL Entry Error"
            )
            frappe.throw(_("Error creating GL entries: {0}").format(str(e)))

    def on_cancel(self):
        """Handle document cancellation"""
        try:
            self.ignore_linked_doctypes = (
                "GL Entry",
                "Stock Ledger Entry",
                "Payment Ledger Entry",
                "Repost Payment Ledger",
                "Repost Payment Ledger Items",
                "Repost Accounting Ledger",
                "Repost Accounting Ledger Items",
                "Unreconcile Payment",
                "Unreconcile Payment Entries",
            )

            # Reverse GL Entries
            make_reverse_gl_entries(voucher_type=self.doctype, voucher_no=self.name)

            # Optionally, add custom logic or user notifications
            frappe.msgprint(_("Teller Purchase document canceled successfully."))

        except Exception as e:
            frappe.log_error(
                message=f"Error during cancellation: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Cancel Error"
            )
            frappe.throw(_("An error occurred during cancellation: {0}").format(str(e)))

    def set_move_number(self):
        # Fetch the last submitted Teller Purchase
        last_invoice = frappe.db.get("Teller Purchase", {"docstatus": 1})

        # Check if the last_invoice exists and has the expected field
        if last_invoice is not None and "movement_number" in last_invoice:
            # Get the last movement number and increment it
            last_move = last_invoice["movement_number"]
            try:
                last_move_num = int(last_move.split("-")[1])
            except (IndexError, ValueError):
                frappe.throw(
                    _("Invalid format for movement number in the last invoice.")
                )

            last_move_num += 1
            move = f"{self.branch_no}-{last_move_num}"
        else:
            # If no last invoice, start the movement number from 1
            move = f"{self.branch_no}-1"

        # Set the new movement number
        self.movement_number = move

        # Commit the changes to the database
        frappe.db.commit()

    # get duration from teller settings
    @staticmethod
    def get_duration():
        duration = frappe.db.get_single_value(
            "Teller Setting",
            "purchase_duration",
        )
        return duration

    def after_insert(self):
        # Add user permission when a new purchase is created
        if self.teller and self.treasury_code:
            try:
                # Create user permission for the treasury code instead of the specific purchase
                existing_permission = frappe.db.exists(
                    "User Permission",
                    {
                        "user": self.teller,
                        "allow": "Teller Treasury",
                        "for_value": self.treasury_code
                    }
                )
                
                if not existing_permission:
                    frappe.get_doc({
                        "doctype": "User Permission",
                        "user": self.teller,
                        "allow": "Teller Treasury",
                        "for_value": self.treasury_code,
                        "apply_to_all_doctypes": 1
                    }).insert(ignore_permissions=True)
            except Exception as e:
                frappe.log_error(f"Error adding user permission: {str(e)}")

    def on_trash(self):
        # We don't need to remove the treasury permission when deleting a purchase
        pass

    def before_submit(self):
        """Handle document submission"""
        try:
            # Set movement number
            self.set_move_number()
            
            # Get and validate printing roll
            if not self.current_roll:
                frappe.throw(_("Please select a printing roll"))
                
            printing_roll = frappe.get_doc("Printing Roll", self.current_roll)
            if not printing_roll.active:
                frappe.throw(_("Selected printing roll is not active"))
                
            if printing_roll.last_printed_number >= printing_roll.end_count:
                frappe.throw(_("Printing roll has reached its end count. Please configure a new roll."))
                
            # Generate receipt number
            next_number = (printing_roll.last_printed_number or printing_roll.start_count) + 1
            
            # Format receipt number
            if printing_roll.add_zeros:
                formatted_number = f"{printing_roll.starting_letters}{str(next_number).zfill(printing_roll.add_zeros)}"
            else:
                formatted_number = f"{printing_roll.starting_letters}{next_number}"
            
            # Set receipt number
            self.purchase_receipt_number = formatted_number
            
            # Update printing roll's last number immediately
            printing_roll.db_set('last_printed_number', next_number)
            
            frappe.db.commit()
            
        except Exception as e:
            frappe.db.rollback()
            frappe.log_error(
                message=f"Error in before_submit: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Submit Error"
            )
            frappe.throw(_("Error during submission: {0}").format(str(e)))

    def update_buyer_history(self):
        history = {
            "buyer_name": self.buyer_name,
            "buyer_card_type": self.buyer_card_type,
            "buyer_national_id": self.buyer_national_id if self.buyer_card_type == "National ID" else None,
            "buyer_passport_number": self.buyer_passport_number if self.buyer_card_type == "Passport" else None,
            "buyer_military_number": self.buyer_military_number if self.buyer_card_type == "Military Card" else None,
            "buyer_phone": self.buyer_phone,
            "buyer_mobile_number": self.buyer_mobile_number,
            "buyer_work_for": self.buyer_work_for,
            "buyer_address": self.buyer_address,
            "buyer_nationality": self.buyer_nationality,
            "buyer_issue_date": self.buyer_issue_date,
            "buyer_expired": self.buyer_expired,
            "buyer_place_of_birth": self.buyer_place_of_birth,
            "buyer_date_of_birth": self.buyer_date_of_birth,
            "buyer_job_title": self.buyer_job_title,
            "buyer_gender": self.buyer_gender
        }
        self.append("purchase_history", history)

    def update_company_history(self):
        history = {
            "buyer_company_name": self.buyer_company_name,
            "buyer_company_commercial_no": self.buyer_company_commercial_no,
            "buyer_company_start_date": self.buyer_company_start_date,
            "buyer_company_end_date": self.buyer_company_end_date,
            "buyer_company_address": self.buyer_company_address,
            "buyer_company_legal_form": self.buyer_company_legal_form,
            "buyer_company_activity": self.buyer_company_activity,
            "is_expired1": self.is_expired1,
            "interbank": self.interbank
        }
        self.append("purchase_history", history)

    def update_egy_balance(self):
        if self.egy_balance and self.egy_account:
            account = frappe.get_doc("Account", self.egy_account)
            account.account_balance = self.egy_balance
            account.save()

    def set_treasury_details(self):
        """Set treasury details from employee's active shift"""
        try:
            # Get the employee linked to the current user
            employee = frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name')
            if not employee:
                frappe.throw(_("No employee found for user {0}. Please link an Employee record to this user.").format(frappe.session.user))
            
            # Get active shift for current employee
            active_shift = frappe.get_all(
                "Open Shift for Branch",
                filters={
                    "current_user": employee,
                    "shift_status": "Active",
                    "docstatus": 1
                },
                fields=["name", "current_user", "treasury_permission"],
                order_by="creation desc",
                limit=1
            )
            
            if not active_shift:
                frappe.throw(_("No active shift found. Please ask your supervisor to open a shift for you."))
                
            shift = active_shift[0]
            
            # Get Teller Treasury details
            treasury = frappe.get_doc("Teller Treasury", shift.treasury_permission)
            if not treasury:
                frappe.throw(_("Teller Treasury not found"))
                
            # Set treasury code
            self.treasury_code = treasury.name
            self.shift = shift.name
            
            # Set EGY account from user
            egy_account = frappe.db.get_value('User', frappe.session.user, 'egy_account')
            if egy_account:
                self.egy = egy_account
            else:
                frappe.throw(_("EGY Account not set for user {0}. Please set it in User settings.").format(frappe.session.user))
            
        except Exception as e:
            frappe.log_error(
                message=f"Error setting treasury details: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Treasury Setup Error"
            )
            frappe.throw(_("Error setting treasury details: {0}").format(str(e)))

    def set_branch_and_shift(self):
        """Set branch and shift details from employee's active shift"""
        try:
            # Get the employee linked to the current user
            employee = frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name')
            if not employee:
                frappe.throw(_("No employee found for user {0}. Please link an Employee record to this user.").format(frappe.session.user))
            
            # Get active shift for current employee
            active_shift = frappe.get_all(
                "Open Shift for Branch",
                filters={
                    "current_user": employee,
                    "shift_status": "Active",
                    "docstatus": 1
                },
                fields=["name", "treasury_permission", "printing_roll"],
                order_by="creation desc",
                limit=1
            )
            
            if not active_shift:
                frappe.throw(_("No active shift found. Please ask your supervisor to open a shift for you."))
                
            shift = active_shift[0]
            
            # Set shift and teller info
            self.shift = shift.name
            self.teller = frappe.session.user
            
            # Get Teller Treasury details
            treasury = frappe.get_doc("Teller Treasury", shift.treasury_permission)
            if not treasury:
                frappe.throw(_("Teller Treasury not found"))
                
            # Set treasury code and branch details
            self.treasury_code = treasury.name
            if treasury.branch:
                self.branch_no = treasury.branch
                self.branch_name = frappe.db.get_value("Branch", treasury.branch, "custom_branch_no")
            
            # Handle printing roll
            if shift.printing_roll:
                printing_roll = frappe.get_doc("Printing Roll", shift.printing_roll)
                if not printing_roll.active:
                    frappe.throw(_("Selected printing roll is not active"))
                    
                if printing_roll.last_printed_number >= printing_roll.end_count:
                    frappe.throw(_("Printing roll has reached its end count. Please configure a new roll."))
                    
                # Set current_roll as string instead of list
                self.current_roll = printing_roll.name
            
        except Exception as e:
            frappe.log_error(
                message=f"Error setting branch and shift: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Branch and Shift Error"
            )
            raise

    def has_account_permissions(self):
        """Check if user has permissions for all accounts in the document"""
        try:
            user = frappe.session.user
            
            # Get the employee linked to the current user
            employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
            if not employee:
                frappe.throw(_("No employee found for user {0}").format(user))
            
            # Get active shift for current employee
            active_shift = frappe.db.get_value(
                "Open Shift for Branch",
                {
                    "current_user": employee,
                    "shift_status": "Active",
                    "docstatus": 1
                },
                ["name", "treasury_permission"],
                as_dict=1
            )
            
            if not active_shift:
                frappe.throw(_("No active shift found"))
            
            # Get user's permitted treasury
            treasury_permission = frappe.db.get_value('User Permission', 
                {'user': user, 'allow': 'Teller Treasury'}, 
                'for_value'
            )
            
            if not treasury_permission:
                frappe.throw(_("No treasury permission found for user"))
            
            if treasury_permission != active_shift.get('treasury_permission'):
                frappe.throw(_("Treasury permission mismatch with active shift"))
            
            # Check permissions for each account in purchase transactions
            for row in self.get("purchase_transactions", []):
                if row.account:
                    account = frappe.get_doc("Account", row.account)
                    if account.custom_teller_treasury != treasury_permission:
                        frappe.throw(_("Account {0} is not linked to your treasury").format(row.account))
            
            # Check EGY account permission if set
            if self.egy:
                # First check if it's the user's egy_account
                user_egy_account = frappe.db.get_value("User", user, "egy_account")
                if self.egy != user_egy_account:
                    # Only check treasury permission if it's not the user's egy_account
                    egy_account = frappe.get_doc("Account", self.egy)
                    if egy_account.custom_teller_treasury != treasury_permission:
                        frappe.throw(_("EGY Account {0} is not linked to your treasury").format(self.egy))
            
            return True
            
        except Exception as e:
            frappe.log_error(
                message=f"Error checking account permissions: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Account Permission Error"
            )
            raise

    def validate_active_shift(self):
        """Validate user has active shift"""
        try:
            # Get the employee linked to the current user
            employee = frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name')
            if not employee:
                frappe.throw(_("No employee record found for current user"))
            
            # Get active shift for current employee
            active_shift = frappe.db.get_value(
                "Open Shift for Branch",
                {
                    "current_user": employee,
                    "shift_status": "Active",
                    "docstatus": 1
                },
                ["name", "treasury_permission"],
                as_dict=1
            )
            
            if not active_shift:
                frappe.throw(_("No active shift found. Please open a shift first."))
            
            if active_shift.get('treasury_permission') != self.treasury_code:
                frappe.throw(_("Treasury code mismatch with active shift"))
            
        except Exception as e:
            frappe.log_error(
                message=f"Error validating active shift: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Shift Validation Error"
            )
            raise

    def get_modified_fields(self):
        """Get list of fields that were modified"""
        modified_fields = []
        doc_before_save = self.get_doc_before_save()
        if not doc_before_save:
            return modified_fields
            
        # System fields that should be ignored in modification check
        ignored_fields = {
            'modified', 'modified_by', 'creation', 'owner', 
            'idx', 'naming_series', 'docstatus', 'name',
            'amended_from', 'amendment_date', '_user_tags', 
            '_comments', '_assign', '_liked_by', '__islocal',
            '__unsaved', '__run_link_triggers', '__onload'
        }
        
        for key in self.as_dict():
            if (key not in ignored_fields and 
                doc_before_save.get(key) != self.get(key)):
                modified_fields.append(key)
            
        return modified_fields

    def validate_update_after_submit(self):
        """Custom validation for updates after submission"""
        if self.docstatus == 1:
            # Get the list of changed fields
            changed_fields = self.get_modified_fields()
            
            if not changed_fields:
                return
                
            # Only allow specific fields to be updated after submit
            allowed_fields = [
                'is_returned', 
                'egy',
                'purchase_receipt_number',
                'movement_number',
                'date',
                'closing_date',
                'posting_date',
                'branch_name',
                'branch_no',
                # Allow child table updates
                'purchase_transactions',
                # Buyer-related fields that can be updated
                'buyer_name',
                'buyer_date_of_birth',
                'buyer_nationality',
                'buyer_mobile_number',
                'buyer_work_for',
                'buyer_phone',
                'buyer_place_of_birth',
                'buyer_job_title',
                'buyer_address',
                'buyer_expired',
                'buyer_issue_date',
                'buyer_gender',
                # Company-related fields
                'buyer_company_name',
                'buyer_company_activity',
                'buyer_company_commercial_no',
                'buyer_company_start_date',
                'buyer_company_end_date',
                'buyer_company_address',
                'buyer_company_legal_form',
                'is_expired1',
                'interbank'
            ]
            
            # For system managers/administrators, allow a few more fields
            if frappe.session.user == "Administrator" or "System Manager" in frappe.get_roles():
                allowed_fields.extend(['workflow_state', 'status'])
            
            # Check if any non-allowed fields were changed
            for field in changed_fields:
                if field not in allowed_fields:
                    # Special handling for egy_balance
                    if field == 'egy_balance':
                        self.db_set('egy_balance', self.get_doc_before_save().egy_balance, update_modified=False)
                    # Special handling for treasury_code and shift
                    elif field in ['treasury_code', 'shift']:
                        doc_before_save = self.get_doc_before_save()
                        if doc_before_save:
                            self.db_set(field, doc_before_save.get(field))
                    else:
                        # Special handling for child table changes
                        if field == 'purchase_transactions' and self.is_returned:
                            # Allow changes to purchase_transactions if this is a return
                            continue
                        frappe.throw(
                            _("Not allowed to change {0} after submission").format(field),
                            title=_("Cannot Modify")
                        )

    def on_update_after_submit(self):
        """Handle updates after submit"""
        try:
            # Prevent egy_balance from being changed directly
            doc_before_save = self.get_doc_before_save()
            if doc_before_save and self.egy_balance != doc_before_save.egy_balance:
                self.db_set('egy_balance', doc_before_save.egy_balance)
            
            # Ensure branch details are preserved
            if not self.branch_name and self.branch_no:
                branch_name = frappe.db.get_value("Branch", self.branch_no, "custom_branch_no")
                if branch_name:
                    self.db_set('branch_name', branch_name)
                
        except Exception as e:
            frappe.log_error(
                message=f"Error in on_update_after_submit: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Update Error"
            )
            frappe.throw(_("Error during update: {0}").format(str(e)))


# get currency and currency rate from each account
@frappe.whitelist()
def get_currency(account):
    currency = frappe.db.get_value("Account", {"name": account}, "account_currency")
    currency_rate = frappe.db.get_value(
        "Currency Exchange", {"from_currency": currency}, "exchange_rate"
    )
    currency_code = frappe.db.get_value(
        "Account", {"name": account}, "custom_currency_code"
    )

    special_purchase_rate = frappe.db.get_value(
        "Currency Exchange", {"from_currency": currency}, "custom_special_purchasing"
    )
    return currency, currency_rate, special_purchase_rate, currency_code


# Get the  Balance from the source account
@frappe.whitelist()
def account_from_balance(paid_from):
    try:
        balance = get_balance_on(
            account=paid_from,
        )
        return balance
    except Exception as e:
        error_message = f"Error fetching account balance: {str(e)}"
        frappe.log_error(error_message)
        return _("Error: Unable to fetch account balance.")


@frappe.whitelist()
def account_to_balance(paid_to):
    try:
        balance = get_balance_on(
            account=paid_to,
        )
        return balance
    except Exception as e:
        error_message = f"Error fetching account balance: {str(e)}"
        frappe.log_error(error_message)
        return _("Error: Unable to fetch account balance.")


@frappe.whitelist()
def filters_commissars_by_company(doctype, txt, searchfield, start, page_len, filters):
    link_doctype = filters.get("link_doctype")
    link_name = filters.get("link_name")

    # Update the SQL query to include phone number search
    return frappe.db.sql(
        """
        SELECT
            name, first_name, last_name
        FROM
            `tabContact`
        WHERE
            EXISTS (
                SELECT
                    *
                FROM
                    `tabDynamic Link`
                WHERE
                    parent = `tabContact`.name
                    AND link_doctype = %s
                    AND link_name = %s
            )
        AND
            (`tabContact`.first_name LIKE %s 
            OR `tabContact`.last_name LIKE %s
            OR `tabContact`.custom_national_id LIKE %s)
        LIMIT %s, %s
    """,
        (
            link_doctype,
            link_name,
            "%" + txt + "%",
            "%" + txt + "%",
            "%" + txt + "%",
            start,
            page_len,
        ),
    )


# @frappe.whitelist(allow_guest=True)
# def get_customer_total_amount(client_name, duration):
#     duration = int(duration)
#     end_date = frappe.utils.nowdate()
#     start_date = frappe.utils.add_days(end_date, -duration)

#     data = frappe.db.sql(
#         """SELECT sum(ti.total) as Total FROM `tabTeller Purchase` as ti WHERE ti.docstatus=1 and ti.buyer=%s
#         and ti.closing_dateclosing_date between %s AND %s  GROUP BY ti.buyer
# """,
#         client_name,
#         start_date,
#         end_date,
#         as_dict=True,
#     )
#     res = 0
#     if data:
#         res = data[0]["Total"]
#         return res
#     else:
#         res = -1

#     return res


@frappe.whitelist(allow_guest=True)
def get_customer_total_amount(client_name=None, duration=None, buyer_name=None):
    try:
        # Handle both client_name and buyer_name parameters
        name = buyer_name or client_name
        if not name:
            frappe.throw(_("Please provide either client_name or buyer_name"))
            
        if not duration:
            frappe.throw(_("Duration is required"))

        # Convert duration to an integer
        duration = int(duration)

        # Calculate the date range based on the duration parameter
        end_date = frappe.utils.nowdate()
        start_date = frappe.utils.add_days(end_date, -duration)

        # SQL query to get the total amount from Teller Purchase within the date range
        query = """
        SELECT COALESCE(SUM(ti.total), 0) as Total 
        FROM `tabTeller Purchase` as ti 
        WHERE ti.docstatus=1 AND ti.buyer=%s 
        AND ti.closing_date BETWEEN %s AND %s 
        GROUP BY ti.buyer
        """

        # Execute the query with the name and date range as parameters
        data = frappe.db.sql(query, (name, start_date, end_date), as_dict=True)

        # Check if data exists and retrieve the total
        res = data[0]["Total"] if data else 0

        # Return the total amount if it's greater than 0, otherwise return -1
        return res if res > 0 else -1

    except Exception as e:
        # Log the exception and return -1 to indicate an error
        frappe.log_error(f"Error fetching customer total amount: {str(e)}")
        return -1


@frappe.whitelist()
def check_client_exists(doctype_name):
    return frappe.db.exists("Customer", doctype_name)


@frappe.whitelist(allow_guest=True)
def test_submit():
    doc = frappe.db.get_list("Teller Purchase", ignore_permissions=True)
    return doc


@frappe.whitelist(allow_guest=True)
def get_list_currency_code(session_user, code):
    # session_user=frappe.session.logged_in_use
    codes = frappe.db.get_list(
        "Currency Code",
        fields=["account", "user", "code"],
        filters={"user": session_user, "name": code},
    )

    return codes

@frappe.whitelist()
def make_purchase_return(doc):
    """
    Convert a submitted Teller Purchase to a return by:
    1. Reversing the quantities and amounts
    2. Creating reverse GL entries
    3. Keeping the same document with updated flags
    """
    try:
        doc_data = json.loads(doc)
        doc_name = doc_data.get("name")
        
        # Get the original document
        teller_purchase = frappe.get_doc("Teller Purchase", doc_name)
        
        if teller_purchase.is_returned:
            frappe.throw(_("This document is already a return"))
            
        if teller_purchase.docstatus != 1:
            frappe.throw(_("Only submitted documents can be returned"))
            
        # Negate quantities and amounts in child table
        for item in teller_purchase.purchase_transactions:
            item.quantity = -1 * flt(item.quantity)
            item.amount = -1 * flt(item.amount)  # Also negate the original currency amount
            item.egy_amount = -1 * flt(item.egy_amount)
            
        # Update main document fields
        teller_purchase.total = -1 * flt(teller_purchase.total)
        teller_purchase.is_returned = 1
        
        # Save the changes
        teller_purchase.flags.ignore_validate_update_after_submit = True
        teller_purchase.save()
        
        # Reverse GL Entries
        make_reverse_gl_entries(voucher_type=teller_purchase.doctype, voucher_no=teller_purchase.name)
        
        frappe.db.commit()
        
        return {
            "message": "Document converted to return successfully",
            "teller_purchase": teller_purchase.name
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(
            message=f"Error creating purchase return: {str(e)}\nTraceback: {frappe.get_traceback()}",
            title="Purchase Return Error"
        )
        frappe.throw(_("Error creating purchase return: {0}").format(str(e)))

@frappe.whitelist()
def make_purchase_return2(source_name, target_doc=None):
	from erpnext.controllers.sales_and_purchase_return import make_return_doc

	return make_return_doc("Teller Purchase", source_name, target_doc)

def get_permission_query_conditions(user=None):
    """Return SQL conditions with user permissions."""
    try:
        if not user:
            user = frappe.session.user
            
        if "System Manager" in frappe.get_roles(user):
            return ""
            
        # Get the employee linked to the current user
        employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
        if not employee:
            return "1=0"
            
        # Get active shift for the employee
        active_shift = frappe.db.get_value(
            "Open Shift for Branch",
            {
                "current_user": employee,
                "shift_status": "Active",
                "docstatus": 1
            },
            ["name", "teller_treasury"],
            as_dict=1
        )
        
        if not active_shift:
            return "1=0"
            
        # Return condition to filter by treasury_code
        return f"`tabTeller Purchase`.treasury_code = '{active_shift.get('teller_treasury')}'"
        
    except Exception as e:
        frappe.log_error(f"Error in permission query: {str(e)}\n{frappe.get_traceback()}")
        return "1=0"  # Deny access on error

def has_permission(doc, ptype="read", user=None):
    """Permission handler for Teller Purchase"""
    try:
        if not user:
            user = frappe.session.user
            
        if "System Manager" in frappe.get_roles(user):
            return True
            
        # For new documents
        if not doc or doc.is_new():
            return True
            
        # Get the employee linked to the current user
        employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
        if not employee:
            return False
            
        # Get active shift
        active_shift = frappe.db.get_value(
            "Open Shift for Branch",
            {
                "current_user": employee,
                "shift_status": "Active",
                "docstatus": 1
            },
            ["name", "teller_treasury"],
            as_dict=1
        )
        
        if not active_shift:
            return False
            
        # Allow access if treasury matches
        return doc.treasury_code == active_shift.get('teller_treasury')
        
    except Exception as e:
        frappe.log_error(f"Error checking permissions: {str(e)}\n{frappe.get_traceback()}")
        return False

@frappe.whitelist()
def search_buyer_by_id(search_id):
    """
    Search for a customer by various identifiers:
    - National ID for Egyptian customers
    - Commercial Number for Companies
    - Passport Number for Foreigners
    - Military Number for Military personnel
    Returns customer details if found
    """
    if not search_id:
        return None
        
    # Clean the search input
    search_id = search_id.strip()
    
    # Define fields to fetch
    fields = [
        "name", "customer_name", "custom_type", "custom_is_exceed",
        "custom_phone", "custom_mobile_number", "custom_work_for",
        "custom_address", "custom_national_id", "custom_passport_number",
        "custom_military_number", "custom_nationality", "custom_issue_date",
        "custom_expired", "custom_place_of_birth", "custom_date_of_birth",
        "custom_job_title", "custom_card_type", "custom_commercial_no",
        "custom_start_registration_date", "custom_end_registration_date",
        "custom_legal_form", "custom_company_activity", "custom_is_expired",
        "custom_interbank"
    ]
    
    # Try to find by National ID (Egyptian)
    customer = frappe.db.get_value('Customer',
        {'custom_national_id': search_id, 'custom_type': 'Egyptian'},
        fields, as_dict=1
    )
    
    # Try to find by Commercial Number (Company)
    if not customer:
        customer = frappe.db.get_value('Customer',
            {'custom_commercial_no': search_id, 'custom_type': 'Company'},
            fields, as_dict=1
        )
    
    # Try to find by Passport Number (Foreigner)
    if not customer:
        customer = frappe.db.get_value('Customer',
            {'custom_passport_number': search_id, 'custom_type': 'Foreigner'},
            fields, as_dict=1
        )
    
    # Try to find by Military Number
    if not customer:
        customer = frappe.db.get_value('Customer',
            {'custom_military_number': search_id},
            fields, as_dict=1
        )
    
    if not customer:
        return None
        
    # Prepare response based on customer type
    response = {
        "buyer": customer.name,
        "buyer_name": customer.customer_name,
        "category_of_buyer": customer.custom_type,
        "exceed": customer.custom_is_exceed,
        "buyer_phone": customer.custom_phone,
        "buyer_mobile_number": customer.custom_mobile_number,
        "buyer_work_for": customer.custom_work_for,
        "buyer_address": customer.custom_address,
        # Always include all ID fields, they will be populated based on the match
        "buyer_national_id": customer.custom_national_id,
        "buyer_passport_number": customer.custom_passport_number,
        "buyer_military_number": customer.custom_military_number
    }
    
    # Add type-specific fields
    if customer.custom_type in ["Egyptian", "Foreigner"]:
        response.update({
            "buyer_card_type": customer.custom_card_type,
            "buyer_nationality": customer.custom_nationality,
            "buyer_issue_date": customer.custom_issue_date,
            "buyer_expired": customer.custom_expired,
            "buyer_place_of_birth": customer.custom_place_of_birth,
            "buyer_date_of_birth": customer.custom_date_of_birth,
            "buyer_job_title": customer.custom_job_title
        })
    elif customer.custom_type == "Company":
        response.update({
            "buyer_company_name": customer.customer_name,
            "buyer_company_commercial_no": customer.custom_commercial_no,
            "buyer_company_start_date": customer.custom_start_registration_date,
            "buyer_company_end_date": customer.custom_end_registration_date,
            "buyer_company_address": customer.custom_address,
            "buyer_company_legal_form": customer.custom_legal_form,
            "buyer_company_activity": customer.custom_company_activity,
            "is_expired1": customer.custom_is_expired,
            "interbank": customer.custom_interbank
        })
    
    return response

@frappe.whitelist()
def get_treasury_accounts(doctype, txt, searchfield, start, page_len, filters):
    """Get accounts linked to the specified treasury"""
    try:
        treasury_code = filters.get('treasury_code')
        
        if not treasury_code:
            return []
            
        # Build the query to get accounts linked to the treasury
        # Only get accounts that:
        # 1. Are linked to the treasury via custom_teller_treasury
        # 2. Are not group accounts
        # 3. Have a currency other than EGP
        # 4. Are of type Cash or Bank
        # 5. Match the search text in account code or name
        return frappe.db.sql("""
            SELECT name, account_name, account_currency, custom_currency_code
            FROM `tabAccount` 
            WHERE custom_teller_treasury = %s
            AND is_group = 0
            AND account_currency != 'EGP'
            AND account_type in ('Cash', 'Bank')
            AND (name LIKE %s OR account_name LIKE %s OR custom_currency_code LIKE %s)
            ORDER BY custom_currency_code, account_name
            LIMIT %s, %s
        """, (
            treasury_code,
            f"%{txt}%",
            f"%{txt}%",
            f"%{txt}%",
            start,
            page_len
        ))
    except Exception as e:
        frappe.log_error(
            message=f"Error getting treasury accounts: {str(e)}\nTraceback: {frappe.get_traceback()}",
            title="Treasury Accounts Error"
        )
        return []