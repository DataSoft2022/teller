# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt
import frappe
from frappe import _
import json
from frappe.model.mapper import get_mapped_doc
from frappe.utils import get_url_to_form

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
from frappe.utils import nowdate
from erpnext.accounts.utils import (
    get_account_currency,
    get_balance_on,
    get_fiscal_year,
)
from frappe import _, utils

from erpnext.accounts.general_ledger import (
    make_reverse_gl_entries,
    make_gl_entries,
)
from frappe.permissions import add_user_permission, remove_user_permission


def get_permission_query_conditions(user=None):
    """Return SQL conditions with user permissions."""
    try:
        if not user:
            user = frappe.session.user
            
        # Allow full access for Administrator and System Manager
        if user == "Administrator" or "System Manager" in frappe.get_roles(user):
            return ""
            
        # Get the employee linked to the current user
        employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
        if not employee:
            return "1=0"
            
        # For read operations, allow access to all invoices from user's shifts
        return f"""
            (`tabTeller Invoice`.owner = '{user}'
            OR EXISTS (
                SELECT name 
                FROM `tabOpen Shift for Branch` 
                WHERE current_user = '{employee}'
                AND name = `tabTeller Invoice`.shift
            ))
        """
        
    except Exception as e:
        frappe.log_error(
            message=f"Permission query error: {str(e)}",
            title="Query Error"
        )
        return "1=0"

def has_permission(doc, ptype="read", user=None):
    """Permission handler for Teller Invoice"""
    try:
        if not user:
            user = frappe.session.user
            
        # Allow full access for Administrator and System Manager
        if user == "Administrator" or "System Manager" in frappe.get_roles(user):
            return True
            
        # Get the employee linked to the current user
        employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
        if not employee:
            return False
            
        # For create permission, only check if user has active shift
        if ptype == "create":
            active_shift = frappe.db.exists(
                "Open Shift for Branch",
                {
                    "current_user": employee,
                    "shift_status": "Active",
                    "docstatus": 1
                }
            )
            return bool(active_shift)
            
        # For read/write operations on existing documents
        if doc.docstatus == 0:  # Draft
            # Allow access to drafts created by the user
            return doc.owner == user
        else:  # Submitted/Cancelled
            # Allow access to documents from any of the user's shifts
            return frappe.db.exists(
                "Open Shift for Branch",
                {
                    "current_user": employee,
                    "name": doc.shift
                }
            )
            
    except Exception as e:
        frappe.log_error(
            message=f"Permission check error: {str(e)}\nTraceback: {frappe.get_traceback()}",
            title="Permission Error"
        )
        return False


def get_permission_query_conditions_for_account(user=None):
    """Return SQL conditions with user permissions for Account."""
    if not user:
        user = frappe.session.user
        
    if frappe.session.user == "Administrator" or "System Manager" in frappe.get_roles(user):
        return ""
        
    # Get the EGY account assigned to the user
    egy_account = frappe.db.get_value("User", user, "egy_account")
    
    # Get accounts from currency codes assigned to user
    currency_accounts = frappe.db.sql("""
        SELECT account FROM `tabCurrency Code`
        WHERE user = %s
    """, user, as_dict=1)
    
    account_list = [egy_account] if egy_account else []
    account_list.extend([d.account for d in currency_accounts if d.account])
    
    if not account_list:
        return "1=0"
        
    return f"""(`tabAccount`.name in ({','.join(['%s']*len(account_list))}))""" % tuple(account_list)

def has_permission_for_account(doc, ptype, user):
    """Permission handler for Account doctype"""
    if not user:
        user = frappe.session.user
        
    if user == "Administrator" or "System Manager" in frappe.get_roles(user):
        return True
        
    # Check if account is user's EGY account
    egy_account = frappe.db.get_value("User", user, "egy_account")
    if egy_account and doc.name == egy_account:
        return True
        
    # Check if account is in user's currency codes
    return frappe.db.exists("Currency Code", {
        "user": user,
        "account": doc.name
    })


class TellerInvoice(Document):
    def before_insert(self):
        """Set initial values before insert"""
        try:
            # Log start with minimal info
            frappe.log_error(
                message=f"Starting before_insert for user {frappe.session.user}",
                title="Teller Invoice Init"
            )
            
            # Get the employee linked to the current user
            employee = frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name')
            if not employee:
                frappe.throw(_("No employee found for user {0}").format(frappe.session.user))
            
            # Get active shift
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
            
            # Log shift info
            frappe.log_error(
                message=f"Active shift found: {active_shift}",
                title="Teller Invoice Shift"
            )
            
            if not active_shift:
                frappe.throw(_("No active shift found"))
            
            # Set basic fields
            self.treasury_code = active_shift.get('treasury_permission')
            self.shift = active_shift.get('name')
            self.teller = frappe.session.user
            
            # Set company
            self.company = frappe.defaults.get_user_default("company")
            if not self.company:
                self.company = frappe.get_cached_value('Global Defaults', None, 'default_company')
            if not self.company:
                frappe.throw(_("Please set default company in Global Defaults"))
            
            # Set branch details if treasury exists
            if self.treasury_code:
                treasury = frappe.get_doc("Teller Treasury", self.treasury_code)
                if treasury and treasury.branch:
                    self.branch_no = treasury.branch
                    self.branch_name = frappe.db.get_value("Branch", treasury.branch, "custom_branch_no")
            
            # Log completion with key fields only
            frappe.log_error(
                message=f"Completed before_insert. Key fields: treasury={self.treasury_code}, shift={self.shift}, branch={self.branch_no}",
                title="Teller Invoice Complete"
            )
            
        except Exception as e:
            frappe.log_error(
                message=f"Error in before_insert: {str(e)}\n{frappe.get_traceback()}",
                title="Teller Invoice Error"
            )
            frappe.throw(_("Error during initialization: {0}").format(str(e)))

    def validate(self):
        """Validate document"""
        try:
            # First validate user permissions for accounts
            self.has_account_permissions()
            
            # Log start with key info
            frappe.log_error(
                message=f"Starting validate for invoice with treasury={self.treasury_code}",
                title="Teller Invoice Validate"
            )
            
            # Customer validation
            if not self.client:
                frappe.throw(_("Customer is required"))
                
            # Validate customer exists and is active
            customer = frappe.db.get_value("Customer", self.client, 
                ["disabled", "custom_is_exceed"], as_dict=1)
                
            if not customer:
                frappe.throw(_("Selected customer {0} does not exist").format(self.client))
                
            if customer.disabled:
                frappe.throw(_("Selected customer {0} is disabled").format(self.client))
                
            if customer.custom_is_exceed and not self.exceed:
                frappe.throw(_("Customer {0} has exceeded their limit. Please check the 'Exceed' checkbox to proceed.").format(self.client))
            
            # Basic validations
            if not self.treasury_code:
                frappe.throw(_("Treasury code is required"))
            
            if not self.teller_invoice_details:
                frappe.throw(_("At least one currency transaction is required"))
            
            if len(self.teller_invoice_details) > 3:
                frappe.throw(_("Cannot process more than three currencies"))
            
            # Validate shift and transactions
            self.validate_active_shift()
            self.validate_currency_transactions()
            self.calculate_totals()
            
            # Always generate receipt number in validate if not a submitted document
            if self.docstatus == 0:  # Only for draft documents
                frappe.log_error(
                    message=f"Starting receipt number generation for branch: {self.branch_no}",
                    title="Receipt Number Debug"
                )
                
                # Get the employee linked to the current user
                employee = frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name')
                if not employee:
                    frappe.throw(_("No employee found for user {0}").format(frappe.session.user))
                
                # Log search criteria
                frappe.log_error(
                    message=f"Searching for active shift with:\nEmployee: {employee}\nTreasury Code: {self.treasury_code}\nUser: {frappe.session.user}",
                    title="Active Shift Search Criteria"
                )
                
                # Get all active shifts for debugging
                all_active_shifts = frappe.get_all("Open Shift for Branch",
                    filters={
                        "docstatus": 1,
                        "shift_status": "Active"
                    },
                    fields=["name", "current_user", "treasury_permission", "printing_roll"]
                )
                
                frappe.log_error(
                    message=f"All active shifts found: {all_active_shifts}",
                    title="All Active Shifts"
                )
                
                # Get the active shift and its printing roll
                active_shift = frappe.get_value("Open Shift for Branch", 
                    {
                        "current_user": employee,
                        "treasury_permission": self.treasury_code,
                        "docstatus": 1,
                        "shift_status": "Active"
                    }, 
                    ["name", "printing_roll"])
                
                frappe.log_error(
                    message=f"Found active shift: {active_shift}",
                    title="Receipt Number Debug"
                )
                
                if not active_shift or not active_shift[1]:
                    frappe.throw(_("No active shift found with a printing roll configured. Please ask your supervisor to configure a printing roll."))
                    
                printing_roll = frappe.get_doc("Printing Roll", active_shift[1])
                
                frappe.log_error(
                    message=f"Found printing roll: {printing_roll.name}, Last number: {printing_roll.last_printed_number}, Start: {printing_roll.start_count}, End: {printing_roll.end_count}",
                    title="Receipt Number Debug"
                )
                
                if not printing_roll.active:
                    frappe.throw("Selected printing roll is not active")
                    
                if printing_roll.last_printed_number >= printing_roll.end_count:
                    frappe.throw("Printing roll has reached its end count. Please configure a new roll.")
                    
                # Calculate next number
                next_number = (printing_roll.last_printed_number or printing_roll.start_count) + 1
                
                # Format the receipt number based on add_zeros
                if printing_roll.add_zeros:
                    # If add_zeros is set, pad the number with zeros
                    formatted_number = f"{printing_roll.starting_letters}{str(next_number).zfill(printing_roll.add_zeros)}"
                else:
                    # If no add_zeros, just concatenate the number
                    formatted_number = f"{printing_roll.starting_letters}{next_number}"
                
                frappe.log_error(
                    message=f"Generated receipt number: {formatted_number}, Next number: {next_number}",
                    title="Receipt Number Debug"
                )
                
                # Update both receipt number and current roll
                self.receipt_number = formatted_number
                self.current_roll = printing_roll.name
                
                # Update the printing roll's last number and show_number
                frappe.db.set_value("Printing Roll", printing_roll.name, {
                    "last_printed_number": next_number,
                    "show_number": len(str(next_number))
                })
                
                frappe.db.commit()
            
            frappe.log_error(
                message="Completed validate successfully",
                title="Teller Invoice Validated"
            )
            
        except Exception as e:
            frappe.log_error(
                message=f"Error in validate: {str(e)}\n{frappe.get_traceback()}",
                title="Teller Invoice Validation Error"
            )
            frappe.throw(_("Validation error: {0}").format(str(e)))

    def before_save(self):
        """Handle operations before saving"""
        try:
            frappe.log_error("Starting before_save", "Teller Invoice Debug")
            
            if self.client:
                self.set_customer_invoices()
            
            frappe.log_error("Completed before_save", "Teller Invoice Debug")
            
        except Exception as e:
            frappe.log_error(f"Error in before_save: {str(e)}\n{frappe.get_traceback()}", "Teller Invoice Error")
            frappe.throw(_("Error before saving: {0}").format(str(e)))

    def set_move_number(self):
        """Set movement number based on the receipt number's sequence"""
        try:
            if not self.receipt_number:
                frappe.throw(_("Receipt number must be generated before setting movement number"))
                
            # Extract the numeric part from receipt number
            # For example, if receipt_number is "LOT0070", we want to get "70"
            import re
            numeric_part = re.search(r'\d+$', self.receipt_number)
            if not numeric_part:
                frappe.throw(_("Could not extract number from receipt number: {0}").format(self.receipt_number))
                
            receipt_number = int(numeric_part.group())  # Convert to integer
            
            # Set the movement number using branch number and receipt number
            self.movement_number = f"{self.branch_no}-{receipt_number}"
            
            frappe.log_error(
                message=f"Generated movement number: {self.movement_number} from receipt number: {self.receipt_number}",
                title="Movement Number Debug"
            )
            
        except Exception as e:
            frappe.log_error(
                message=f"Error generating movement number: {str(e)}\n{frappe.get_traceback()}",
                title="Movement Number Error"
            )
            frappe.throw(_("Error generating movement number: {0}").format(str(e)))

    def before_submit(self):
        """Handle document submission"""
        try:
            # Check amount and update customer info
            self.check_allow_amount()
            
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
            self.receipt_number = formatted_number
            
            # Update printing roll's last number
            # We'll only save this after successful submission in on_submit
            self.next_receipt_number = next_number
            
        except Exception as e:
            frappe.log_error(
                message=f"Error in before_submit: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Submit Error"
            )
            frappe.throw(_("Error during submission: {0}").format(str(e)))

    def check_allow_amount(self):
        """Update customer with additional information when exceed limit is reached"""
        if self.exceed == 1:
            customer = frappe.get_doc("Customer", self.client)
            customer.custom_is_exceed = True
            
            # Update customer information based on client type
            if self.client_type in ["Egyptian", "Foreigner"]:
                # Update individual customer details
                if self.gender:
                    customer.custom_gender = self.gender
                if self.nationality:
                    customer.custom_nationality = self.nationality
                if self.mobile_number:
                    customer.custom_mobile_number = self.mobile_number
                if self.work_for:
                    customer.custom_work_for = self.work_for
                if self.phone:
                    customer.custom_phone = self.phone
                if self.job_title:
                    customer.custom_job_title = self.job_title
                if self.address:
                    customer.custom_address = self.address
                if self.place_of_birth:
                    customer.custom_place_of_birth = self.place_of_birth
                if self.date_of_birth:
                    customer.custom_date_of_birth = self.date_of_birth
                    
            elif self.client_type in ["Company", "Interbank"]:
                # Update company details
                if self.company_activity:
                    customer.custom_company_activity = self.company_activity
                if self.comoany_address:
                    customer.custom_company_address = self.comoany_address
                if self.company_legal_form:
                    customer.custom_company_legal_form = self.company_legal_form
                if self.start_registration_date:
                    customer.custom_start_registration_date = self.start_registration_date
                if self.end_registration_date:
                    customer.custom_end_registration_date = self.end_registration_date
                    
                # Update commissar details if provided
                if self.com_name:
                    customer.custom_commissar_name = self.com_name
                if self.com_national_id:
                    customer.custom_commissar_national_id = self.com_national_id
                if self.com_gender:
                    customer.custom_commissar_gender = self.com_gender
                if self.com_address:
                    customer.custom_commissar_address = self.com_address
                if self.com_phone:
                    customer.custom_commissar_phone = self.com_phone
                if self.com_mobile_number:
                    customer.custom_commissar_mobile = self.com_mobile_number
                if self.com_job_title:
                    customer.custom_commissar_job_title = self.com_job_title
            
            try:
                customer.save(ignore_permissions=True)
                frappe.db.commit()
            except Exception as e:
                frappe.log_error(
                    message=f"Error updating customer information: {str(e)}\nTraceback: {frappe.get_traceback()}",
                    title="Customer Update Error"
                )
                frappe.throw(_("Error updating customer information: {0}").format(str(e)))

    @frappe.whitelist()
    def customer_total_amount(self):
        if self.client:
            data = frappe.db.sql(
                """SELECT sum(ti.total) as Total FROM `tabTeller Invoice` as ti WHERE ti.client=%s GROUP BY ti.client
        """,
                self.client,
                as_dict=True,
            )
            res = data[0]["Total"]
            return res

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
            
            # Commit the transaction
            frappe.db.commit()
            
        except Exception as e:
            frappe.db.rollback()
            frappe.log_error(
                message=f"Error in on_submit: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Submit Error"
            )
            frappe.throw(_("Error during submission: {0}").format(str(e)))

    def update_status(self):
        inv_table = self.teller_invoice_details
        for row in inv_table:
            booking_ib =row.booking_interbank
            if booking_ib:
              currency = row.currency_code
              booked_details = frappe.get_all("Booked Currency",
                  filters={"parent":booking_ib,"currency":currency},fields=["name","status"])
              for item in booked_details:
                  print("\n\n\n\n item",item)
                  row_name = item.name
                  currency_book = frappe.get_doc("Booked Currency",row_name)
                  currency_book.db_set("status","Billed")
              booked_details = frappe.get_all("Booked Currency",
                  filters={"parent":booking_ib},fields=["name","status","parent"])
              # all_booked = False
              print("\n\n\n\n booked_details ..",booked_details)
              all_billed = True
              all_not_billed = True
              for booked in booked_details:
                  if booked.status != "Billed":
                      all_billed = False
                  if booked.status != "Not Billed":
                      all_not_billed = False  
              book_doc = frappe.get_doc("Booking Interbank", booked.parent) 
              if all_billed:
                  book_doc.db_set("status", "Billed")  
              elif all_not_billed:
                  book_doc.db_set("status", "Not Billed")  
              else:
                  book_doc.db_set("status", "Partial Billed")            
                  

    def delete_gl_entries(self):
        """Safely delete GL entries for this document"""
        try:
            # Delete existing GL entries
            frappe.db.sql("""
                DELETE FROM `tabGL Entry`
                WHERE voucher_type = %s AND voucher_no = %s
            """, (self.doctype, self.name))
            
            frappe.db.commit()
            
        except Exception as e:
            frappe.log_error(
                message=f"Error deleting GL entries: {str(e)}\n{frappe.get_traceback()}",
                title="GL Entry Deletion Error"
            )
            frappe.throw(_("Error deleting GL entries: {0}").format(str(e)))

    def on_cancel(self):
        try:
            # First delete existing GL entries
            self.delete_gl_entries()
            
            # Then create reverse GL entries if needed
            self.make_gl_entries(cancel=True)
            
            self.update_status()
            
        except Exception as e:
            frappe.log_error(
                message=f"Error cancelling document: {str(e)}\n{frappe.get_traceback()}",
                title="Cancellation Error"
            )
            frappe.throw(_("Error during cancellation: {0}").format(str(e)))

    def set_cost(self):
        cost = frappe.db.get_value("Branch", {"custom_active": 1}, "branch")
        self.cost_center = cost

    def set_closing_date(self):

        shift_closing = frappe.db.get_value("OPen Shift", {"active": 1}, "end_date")
        self.closing_date = shift_closing

    def set_customer_invoices(self):
        """Set customer invoice history"""
        try:
            frappe.log_error(
                message=f"Setting Customer Invoices:\nClient: {self.client}",
                title="Teller Invoice Debug"
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
                "Teller Invoice",
                fields=["name", "client", "total", "closing_date"],
                filters={
                    "docstatus": 1,
                    "client": self.client,
                    "closing_date": ["between", [post_duration, today]],
                }
            )
            
            frappe.log_error(
                message=f"Found Invoices: {invoices}",
                title="Teller Invoice Debug"
            )
            
            # Clear existing history
            self.set("customer_history", [])
            
            # Add invoices to history
            for invoice in invoices:
                try:
                    self.append(
                        "customer_history",
                        {
                            "invoice": invoice.name,
                            "amount": invoice.total,
                            "posting_date": invoice.closing_date,
                        }
                    )
                except Exception as e:
                    frappe.log_error(
                        message=f"Error appending invoice {invoice.name}: {str(e)}",
                        title="Teller Invoice Error"
                    )
                
        except Exception as e:
            frappe.log_error(
                message=f"Error in set_customer_invoices: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Teller Invoice Error"
            )
            frappe.throw(_("Error setting customer history: {0}").format(str(e)))

    # get duration from teller settings
    @staticmethod
    def get_duration():
        duration = frappe.db.get_single_value(
            "Teller Setting",
            "duration",
        )
        return duration

    def after_insert(self):
        # Add user permission when a new invoice is created
        if self.teller and self.treasury_code:
            try:
                # Create user permission for the treasury code instead of the specific invoice
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
        # We don't need to remove the treasury permission when deleting an invoice
        pass

    def set_treasury_details(self):
        # Get the employee linked to the current user
        employee = frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name')
        if not employee:
            frappe.throw(_("No employee found for user {0}").format(frappe.session.user))
        
        # Get active shift for current employee
        active_shift = frappe.db.get_value(
            "Open Shift for Branch",
            {
                "current_user": employee,
                "shift_status": "Active",
                "docstatus": 1
            },
            "treasury_permission"
        )
        
        if active_shift:
            treasury = frappe.get_doc("Teller Treasury", active_shift)
            if treasury:
                self.treasury_code = treasury.name
                self.branch_no = treasury.branch
                self.branch_name = frappe.db.get_value("Branch", treasury.branch, "custom_branch_no")

    def validate_active_shift(self):
        """Validate user has active shift"""
        try:
            employee = frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name')
            if not employee:
                frappe.throw(_("No employee record found for current user"))
            
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
            frappe.log_error(f"Error validating active shift: {str(e)}")
            frappe.throw(_("Error validating shift: {0}").format(str(e)))

    def validate_currency_transactions(self):
        """Validate currency transactions"""
        try:
            if not self.teller_invoice_details:
                frappe.throw(_("At least one currency transaction is required"))
            
            for idx, row in enumerate(self.teller_invoice_details, 1):
                # Skip validation for empty rows
                if not any([row.get(f) for f in ['account', 'quantity', 'exchange_rate']]):
                    continue
                
                # Validate account
                if not row.account:
                    frappe.throw(_("Account is required in row {0}").format(idx))
                
                # Verify account exists
                try:
                    account = frappe.get_doc("Account", row.account)
                    current_balance = get_balance_on(account=row.account)
                    row.balance_after = flt(current_balance) + flt(row.get('quantity', 0))
                    
                    if row.balance_after < 0:
                        frappe.throw(_("Insufficient balance in account {0} in row {1}").format(
                            row.account, idx
                        ))
                except Exception as acc_error:
                    frappe.log_error(
                        message=f"Account validation error: {str(acc_error)}\nAccount: {row.account}",
                        title=f"Account Error Row {idx}"
                    )
                    frappe.throw(_("Invalid account {0} in row {1}").format(row.account, idx))
                
                # Validate other required fields
                if not row.get('quantity'):
                    frappe.throw(_("Quantity is required in row {0}").format(idx))
                
                if not row.get('exchange_rate'):
                    frappe.throw(_("Exchange rate is required in row {0}").format(idx))
                
                # Set amount equal to quantity (original currency amount)
                row.amount = flt(row.get('quantity', 0))
                # Calculate EGY amount (quantity * exchange_rate)
                row.egy_amount = flt(row.get('quantity', 0)) * flt(row.get('exchange_rate', 0))
                
        except Exception as e:
            frappe.log_error(
                message=f"Validation error: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="Teller Invoice Validation Error"
            )
            raise

    def calculate_totals(self):
        """Calculate total amounts"""
        try:
            self.total = 0
            self.total_amount = 0
            self.total_egy = 0
            
            for row in self.teller_invoice_details:
                if row.egy_amount:
                    self.total += flt(row.egy_amount)
                    self.total_egy += flt(row.egy_amount)
                if row.amount:
                    self.total_amount += flt(row.amount)
                
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
            
            gl_entries = []
            
            for row in self.teller_invoice_details:
                if not row.amount:
                    continue
                
                # Get account currencies
                account = frappe.get_doc("Account", row.account)
                egy_account = frappe.get_doc("Account", self.egy)
                
                # For sales transactions:
                # 1. Debit EGY account (receiving EGY)
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
                    "remarks": f"Currency sale: Received {row.egy_amount} EGY against {row.quantity} {row.currency_code}"
                })
                
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
                    "exchange_rate": flt(row.exchange_rate),
                    "against": self.egy,
                    "against_voucher_type": self.doctype,
                    "against_voucher": self.name,
                    "voucher_type": self.doctype,
                    "voucher_no": self.name,
                    "company": company,
                    "fiscal_year": fiscal_year,
                    "is_opening": "No",
                    "remarks": f"Currency sale: Given {row.quantity} {row.currency_code}"
                })
                
                # Insert GL entries directly
                debit_entry.insert(ignore_permissions=True)
                credit_entry.insert(ignore_permissions=True)
            
            frappe.db.commit()
            
        except Exception as e:
            frappe.db.rollback()
            frappe.log_error(
                message=f"Error in make_gl_entries: {str(e)}\nTraceback: {frappe.get_traceback()}",
                title="GL Entry Creation Error"
            )
            frappe.throw(_("Error creating GL entries: {0}").format(str(e)))

    def has_account_permissions(self):
        """Check if user has permissions for all accounts in the document"""
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
        
        if treasury_permission != active_shift.treasury_permission:
            frappe.throw(_("Treasury permission mismatch with active shift"))
        
        # Check permissions for each account in invoice details
        for row in self.get("teller_invoice_details", []):
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
            allowed_fields = ['is_returned', 'egy']
            
            # For system managers/administrators, allow a few more fields
            if frappe.session.user == "Administrator" or "System Manager" in frappe.get_roles():
                allowed_fields.extend(['workflow_state', 'status'])
            
            # Check if any non-allowed fields were changed
            for field in changed_fields:
                if field not in allowed_fields:
                    # Special handling for egy_balance
                    if field == 'egy_balance':
                        self.db_set('egy_balance', self.get_doc_before_save().egy_balance)
                    else:
                        frappe.throw(
                            _("Not allowed to change {0} after submission").format(field),
                            title=_("Cannot Modify")
                        )

    def on_update_after_submit(self):
        """Handle updates after submit"""
        # Prevent egy_balance from being changed directly
        doc_before_save = self.get_doc_before_save()
        if doc_before_save and self.egy_balance != doc_before_save.egy_balance:
            self.db_set('egy_balance', doc_before_save.egy_balance)


# get currency and exchange rate associated with each account
@frappe.whitelist(allow_guest=True)
def get_currency(account):
    account_doc = frappe.get_doc("Account", account)
    currency = account_doc.account_currency
    currency_code = account_doc.custom_currency_code

    selling_rate = frappe.db.get_value(
        "Currency Exchange", 
        {"from_currency": currency}, 
        "custom_selling_exchange_rate"
    )
    special_selling_rate = frappe.db.get_value(
        "Currency Exchange", 
        {"from_currency": currency}, 
        "custom_special_selling"
    )
    
    return {
        "currency_code": currency_code,
        "currency": currency, 
        "selling_rate": selling_rate, 
        "special_selling_rate": special_selling_rate
    }


@frappe.whitelist()
def account_from_balance(paid_from):
    try:
        balance = get_balance_on(
            account=paid_from,
            # company=company,
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
            # company=company,
        )
        return balance
    except Exception as e:
        error_message = f"Error fetching account balance: {str(e)}"
        frappe.log_error(error_message)
        return _(
            "Error: Unable to fetch account balance."
        )  # Return a descriptive error message


@frappe.whitelist(allow_guest=True)
def get_printing_roll():
    active_roll = frappe.db.get_list(
        "Printing Roll", {"active": 1}, ["name", "last_printed_number"]
    )
    if active_roll:
        return active_roll[0]["name"], active_roll[0]["last_printed_number"]
    else:
        return None, None


@frappe.whitelist(allow_guest=True)
def get_current_shift():
    branch = frappe.db.get_value("Branch", {"custom_active": 1}, "branch")
    return branch


# get allowed amounts from Teller settings doctype
@frappe.whitelist(allow_guest=True)
def get_allowed_amount():
    allowed_amount = frappe.db.get_single_value("Teller Setting", "allowed_amount")
    return allowed_amount


# @frappe.whitelist(allow_guest=True)
# def get_customer_total_amount(client_name):

#     data = frappe.db.sql(
#         """SELECT sum(ti.total) as Total FROM `tabTeller Invoice` as ti WHERE ti.docstatus=1 and ti.client=%s GROUP BY ti.client
# """,
#         client_name,
#         as_dict=True,
#     )
#     res = 0
#     if data:
#         res = data[0]["Total"]
#         return res
#     else:
#         res = -1

#     return res


# test customer total with durations
@frappe.whitelist(allow_guest=True)
def get_customer_total_amount(client_name, duration):
    try:
        # Convert duration to an integer
        duration = int(duration)

        # Calculate the date range based on the duration parameter
        end_date = frappe.utils.nowdate()
        start_date = frappe.utils.add_days(end_date, -duration)

        # SQL query to get the total amount from Teller Purchase within the date range
        query = """
        SELECT COALESCE(SUM(ti.total), 0) as Total 
        FROM `tabTeller Invoice` as ti 
        WHERE ti.docstatus=1 AND ti.client=%s 
        AND ti.closing_date BETWEEN %s AND %s 
        GROUP BY ti.client
        """

        # Execute the query with the client_name and date range as parameters
        data = frappe.db.sql(query, (client_name, start_date, end_date), as_dict=True)

        # Check if data exists and retrieve the total
        res = data[0]["Total"] if data else 0

        # Return the total amount if it's greater than 0, otherwise return -1
        return res if res > 0 else -1

    except Exception as e:
        # Log the exception and return -1 to indicate an error
        frappe.log_error(f"Error fetching customer total amount: {str(e)}")
        return -1


######################@################################


# @frappe.whitelist(allow_guest=True)
# def get_customer_invoices(client_name, invoice_name):
#     today = nowdate()
#     post_duration = add_days(today, -6)
#     invoices = frappe.db.get_list(
#         "Teller Invoice",
#         fields=["name", "client", "total", "date"],
#         filters={
#             "docstatus": 1,
#             "client": client_name,
#             "date": ["between", [post_duration, today]],
#         },
#     )
#     if not invoices:
#         frappe.msgprint("No invoices")
#     else:
#         current_doc = frappe.get_doc("Teller Invoice", invoice_name)
#         for invoice in invoices:
#             current_doc.append(
#                 "customer_history",
#                 {
#                     "invoice": invoice["name"],
#                     "amount": invoice["total"],
#                     "posting_date": invoice["date"],
#                 },
#             )
#         current_doc.save()
#         frappe.db.commit()

#     return "Success"


# @frappe.whitelist()
# def get_contacts_by_link(doctype, txt, searchfield, start, page_len, filters):
#     link_doctype = filters.get("link_doctype")
#     link_name = filters.get("link_name")

#     return frappe.db.sql(
#         """
#         SELECT
#             name, first_name, last_name
#         FROM
#             `tabContact`
#         WHERE
#             EXISTS (
#                 SELECT
#                     *
#                 FROM
#                     `tabDynamic Link`
#                 WHERE
#                     parent = `tabContact`.name
#                     AND link_doctype = %s
#                     AND link_name = %s
#             )
#         AND
#             (`tabContact`.first_name LIKE %s OR `tabContact`.last_name LIKE %s  OR `tabContact`.custom_national_id LIKE %s)
#         LIMIT %s, %s
#     """,
#         (link_doctype, link_name, "%" + txt + "%", "%" + txt + "%", start, page_len),
#     )


@frappe.whitelist()
def get_contacts_by_link(doctype, txt, searchfield, start, page_len, filters):
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


# check if customer is already existing
@frappe.whitelist()
def check_client_exists(doctype_name):
    return frappe.db.exists("Customer", doctype_name)


@frappe.whitelist(allow_guest=True)
def test_api():
    pass


@frappe.whitelist(allow_guest=True)
def test_doc_description():
    doc = frappe.db.describe("Teller Purchase")
    return doc


@frappe.whitelist()
def make_sales_return(doc):
    """
    Convert a submitted Teller Invoice to a return by:
    1. Reversing the quantities and amounts
    2. Creating reverse GL entries
    3. Keeping the same document with updated flags
    """
    try:
        doc_data = json.loads(doc)
        doc_name = doc_data.get("name")
        
        # Get the original document
        teller_invoice = frappe.get_doc("Teller Invoice", doc_name)
        
        if teller_invoice.is_returned:
            frappe.throw(_("This document is already a return"))
            
        if teller_invoice.docstatus != 1:
            frappe.throw(_("Only submitted documents can be returned"))
            
        # Negate quantities and amounts in child table
        for item in teller_invoice.teller_invoice_details:
            item.quantity = -1 * flt(item.quantity)
            item.amount = -1 * flt(item.amount)
            item.egy_amount = -1 * flt(item.egy_amount)
            
        # Update main document fields
        teller_invoice.total = -1 * flt(teller_invoice.total)
        teller_invoice.total_amount = -1 * flt(teller_invoice.total_amount)
        teller_invoice.total_egy = -1 * flt(teller_invoice.total_egy)
        teller_invoice.is_returned = 1
        
        # Save the changes
        teller_invoice.flags.ignore_validate_update_after_submit = True
        teller_invoice.save()
        
        # Reverse GL Entries
        from erpnext.accounts.general_ledger import make_reverse_gl_entries
        make_reverse_gl_entries(voucher_type=teller_invoice.doctype, voucher_no=teller_invoice.name)
        
        frappe.db.commit()
        
        return {
            "message": "Document converted to return successfully",
            "teller_invoice": teller_invoice.name
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(
            message=f"Error in make_sales_return: {str(e)}\nTraceback: {frappe.get_traceback()}",
            title="Return Creation Error"
        )
        frappe.throw(_("Error converting document to return: {0}").format(str(e)))

@frappe.whitelist()
def get_employee_shift_details():
    user = frappe.session.user
    
    # Check if user has required roles
    required_roles = ["Teller", "Sales User", "Accounts User"]
    user_roles = frappe.get_roles(user)
    missing_roles = [role for role in required_roles if role not in user_roles]
    
    if missing_roles:
        frappe.throw(_(
            "You don't have the required roles to create Teller Invoice. Missing roles: {0}"
        ).format(", ".join(missing_roles)))
    
    # First get the employee linked to the current user
    employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
    if not employee:
        frappe.throw(_("No employee found for user {0}. Please link an Employee record to this user.").format(user))
    
    # Get active shift for current employee
    active_shift = frappe.get_all(
        "Open Shift for Branch",
        filters={
            "current_user": employee,  # Using employee ID instead of user ID
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
        
    # Get Branch details
    branch = frappe.get_doc("Branch", treasury.branch)
    if not branch:
        frappe.throw(_("Branch not found"))
        
    # Get the treasury code - using teller_number from Teller Treasury
    treasury_code = treasury.name if treasury.name else shift.treasury_permission
        
    return {
        "shift": shift.name,
        "teller": user,  # Return the user ID for consistency
        "treasury_code": treasury_code,
        "branch": branch.name,
        "branch_name": branch.custom_branch_no
    }

def open_shift_has_permission(doc, ptype, user):
    """Permission handler for Open Shift for Branch"""
    if ptype == "read":
        # Allow read if user is the current_user of the shift
        return user == doc.current_user
    return False

def get_account_permission_query_conditions(user=None):
    if not user:
        user = frappe.session.user
        
    required_roles = ["Teller", "Sales User", "Accounts User"]
    user_roles = frappe.get_roles(user)
    
    # Check if user has required roles
    if not any(role in required_roles for role in user_roles):
        return "1=0"
        
    # Get the employee linked to the current user
    employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
    if not employee:
        return "1=0"
        
    # Get active shift for the employee to find their treasury
    active_shift = frappe.db.get_value(
        "Open Shift for Branch",
        {
            "current_user": employee,
            "shift_status": "Active",
            "docstatus": 1
        },
        ["name", "treasury_permission"]
    )
    
    if not active_shift:
        return "1=0"
        
    # Get the treasury's accounts
    treasury = frappe.get_doc("Teller Treasury", active_shift.treasury_permission)
    if not treasury:
        return "1=0"
        
    return f"""
        `tabAccount`.account_type in ('Bank', 'Cash')
        AND (
            EXISTS (
                SELECT 1 FROM `tabCurrency Code` cc 
                WHERE cc.user = '{user}'
                AND cc.account = `tabAccount`.name
            )
            OR 
            EXISTS (
                SELECT 1 FROM `tabUser` u
                WHERE u.name = '{user}'
                AND u.egy_account = `tabAccount`.name
            )
        )
    """

@frappe.whitelist()
def search_client_by_id(search_id):
    """
    Search for a customer by various identifiers:
    - National ID for Egyptian customers
    - Commercial Number for Companies
    - Passport Number for Foreigners
    Returns dict with customer name and type if found
    """
    if not search_id:
        return None
        
    # Clean the search input
    search_id = search_id.strip()
    
    # Search in Customer doctype
    customer = None
    
    # Try to find by National ID (Egyptian)
    customer = frappe.db.get_value('Customer', 
        {'custom_national_id': search_id, 'custom_type': 'Egyptian'}, 
        ['name', 'custom_type'], as_dict=1
    )
    if customer:
        return customer
        
    # Try to find by Commercial Number (Company)
    customer = frappe.db.get_value('Customer', 
        {'custom_commercial_no': search_id, 'custom_type': 'Company'}, 
        ['name', 'custom_type'], as_dict=1
    )
    if customer:
        return customer
        
    # Try to find by Passport Number (Foreigner)
    customer = frappe.db.get_value('Customer', 
        {'custom_passport_number': search_id, 'custom_type': 'Foreigner'}, 
        ['name', 'custom_type'], as_dict=1
    )
    if customer:
        return customer
        
    return None