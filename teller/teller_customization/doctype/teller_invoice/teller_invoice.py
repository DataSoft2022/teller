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
)
from frappe import _, utils

from erpnext.accounts.general_ledger import (
    make_reverse_gl_entries,
    make_gl_entries,
)
from frappe.permissions import add_user_permission, remove_user_permission


def get_permission_query_conditions(user=None):
    """Return SQL conditions with user permissions."""
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
        "teller_treasury"
    )
    
    if not active_shift:
        return "1=0"
        
    # Return condition to filter by treasury_code
    return f"`tabTeller Invoice`.treasury_code = '{active_shift}'"

def has_permission(doc, ptype="read", user=None):
    """Permission handler for Teller Invoice"""
    if not user:
        user = frappe.session.user
        
    if "System Manager" in frappe.get_roles(user):
        return True
        
    # Check if user has required roles
    required_roles = ["Teller", "Sales User", "Accounts User"]
    user_roles = frappe.get_roles(user)
    if not any(role in required_roles for role in user_roles):
        frappe.msgprint(_("User does not have any of the required roles: Teller, Sales User, or Accounts User"))
        return False
        
    # Get the employee linked to the current user
    employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
    if not employee:
        frappe.msgprint(_("No employee record found for user {0}. Please create an Employee record and link it to this user.").format(user))
        return False
        
    # For create permission or when doc is None
    if ptype == "create":
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
            frappe.msgprint(_("No active shift found for employee {0}. Please open a shift first.").format(employee))
            return False
            
        return True
        
    # For read/write/submit permissions when doc exists
    if doc and ptype in ["read", "write", "submit"]:
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
            frappe.msgprint(_("No active shift found for employee {0}").format(employee))
            return False
            
        if not doc.treasury_code:
            return True
            
        if doc.treasury_code != active_shift.teller_treasury:
            frappe.msgprint(_("Document treasury ({0}) does not match employee's active shift treasury ({1})").format(
                doc.treasury_code, active_shift.teller_treasury))
            return False
            
        return True
        
    # For read/write/submit permissions when doc is None
    if not doc and ptype in ["read", "write", "submit"]:
        active_shift = frappe.db.exists(
            "Open Shift for Branch",
            {
                "current_user": employee,
                "shift_status": "Active",
                "docstatus": 1
            }
        )
        return bool(active_shift)
        
    return False


class TellerInvoice(Document):
    def before_insert(self):
        """Set initial values before insert"""
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
            ["name", "teller_treasury"]
        )
        
        if not active_shift:
            frappe.throw(_("No active shift found. Please ask your supervisor to open a shift for you."))
            
        # Set company from defaults if not set
        if not self.company:
            self.company = frappe.defaults.get_user_default("Company")
            if not self.company:
                frappe.throw(_("Please set default company in Global Defaults"))
                
        # Set treasury code from active shift
        self.treasury_code = active_shift.teller_treasury
        self.shift = active_shift.name
        self.teller = frappe.session.user
        
    def validate(self):
        """Validate document"""
        if len(self.get("teller_invoice_details")) > 3:
            frappe.throw("Can not Buy more than three currency")

        self.validate_active_shift()
        self.validate_currency_transactions()
        self.calculate_totals()

    def before_save(self):
        self.set_customer_invoices()

    def get_printing_roll(self):
        active_roll = frappe.db.get_all(
            "Printing Roll",
            filters={"active": 1},
            fields=[
                "name",
                "last_printed_number",
                "starting_letters",
                "start_count",
                "end_count",
                "show_number",
                "add_zeros",
            ],
            order_by="creation desc",
            limit=1,
        )
        if not active_roll:
            frappe.throw(_("No active  printing roll available please create one"))

        roll_name = active_roll[0]["name"]
        last_number = active_roll[0]["last_printed_number"]
        start_letter = active_roll[0]["starting_letters"]
        start_count = active_roll[0]["start_count"]
        end_count = active_roll[0]["end_count"]
        show_number = active_roll[0]["show_number"]

        # show_number_int = int(count_show_number)  #
        last_number_str = str(last_number)
        last_number_str_len = len(last_number_str)
        # diff_cells = show_number_int - last_number_str_len
        zeros_number = active_roll[0]["add_zeros"]
        sales_invoice_count = frappe.db.count(
            "Teller Invoice", filters={"docstatus": 1}
        )
        sales_purchase_count = frappe.db.count(
            "Teller Purchase", filters={"docstatus": 1}
        )

        if last_number == 0:
            last_number = start_count

        elif start_count < end_count and last_number < end_count:
            last_number += 1

        else:
            _(
                f"printing Roll With name {roll_name} Is completly Full,Please create a new active roll"
            )

        # last_number_str = str(last_number).zfill(diff_cells + len(str(last_number)))
        last_number_str = str(last_number).zfill(zeros_number)
        receipt_number = f"{start_letter}-{self.branch_no}-{last_number_str}"
        # handle receipt number without dash
        receipt_number2 = f"{start_letter}{self.branch_no}{last_number_str}"

        self.receipt_number = receipt_number
        self.receipt_number2 = receipt_number2
        self.current_roll = start_count

        # show_number = len(last_number_str)

        frappe.db.set_value(
            "Printing Roll", roll_name, "last_printed_number", last_number
        )
        frappe.db.set_value(
            "Printing Roll", roll_name, "show_number", last_number_str_len
        )
        frappe.db.commit()
        # frappe.msgprint(f"show number is {last_number_str_len} ")

    def set_move_number(self):
        # Fetch the last submitted Teller Invo
        last_invoice = frappe.db.get("Teller Invoice", {"docstatus": 1})
        if last_invoice:
          
        # Check if the last_invoice exists and has the expected field
          if last_invoice is not None and "movement_number" in last_invoice:
              # Get the last movement number and increment it
              last_move = last_invoice["movement_number"]
              if last_move:
                print("\n\nlast inv",last_move)
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

    def before_submit(self):
        self.check_allow_amount()
        self.get_printing_roll()
        self.set_move_number()

    def check_allow_amount(self):
        if self.exceed == 1:
            # frappe.throw("Please check allow amount")
            customer = frappe.get_doc("Customer", self.client)
            customer.custom_is_exceed = True
            customer.save(ignore_permissions=True)

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
        self.make_gl_entries()

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
                  

    def on_cancel(self):
        self.make_gl_entries(cancel=True)

    def set_cost(self):
        cost = frappe.db.get_value("Branch", {"custom_active": 1}, "branch")
        self.cost_center = cost

    def set_closing_date(self):

        shift_closing = frappe.db.get_value("OPen Shift", {"active": 1}, "end_date")
        self.closing_date = shift_closing

    def set_customer_invoices(self):
        duration = self.get_duration()
        duration = int(duration)
        if duration:
            today = nowdate()
            post_duration = add_days(today, -duration)
            invoices = frappe.db.get_list(
                "Teller Invoice",
                fields=["name", "client", "total", "closing_date"],
                filters={
                    "docstatus": 1,
                    "client": self.client,
                    "closing_date": ["between", [post_duration, today]],
                },
            )
            if not invoices:
                pass
                # frappe.msgprint("No invoices")
            else:
                # Clear existing customer history to avoid duplicates
                self.set("customer_history", [])
                for invoice in invoices:
                    self.append(
                        "customer_history",
                        {
                            "invoice": invoice["name"],
                            "amount": invoice["total"],
                            "posting_date": invoice["closing_date"],
                        },
                    )
        else:
            frappe.msgprint("Please Setup Duration in Teller Settings")

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
                # Create the user permission with ignore_permissions=True
                frappe.get_doc({
                    "doctype": "User Permission",
                    "user": self.teller,
                    "allow": "Teller Invoice",
                    "for_value": self.name,
                    "apply_to_all_doctypes": 1
                }).insert(ignore_permissions=True)
            except Exception as e:
                frappe.log_error(f"Error adding user permission: {str(e)}")

    def on_trash(self):
        # Remove user permission when invoice is deleted
        if self.teller:
            try:
                # Delete the user permission with ignore_permissions=True
                name = frappe.db.get_value(
                    "User Permission",
                    {
                        "user": self.teller,
                        "allow": "Teller Invoice",
                        "for_value": self.name
                    }
                )
                if name:
                    frappe.delete_doc("User Permission", name, ignore_permissions=True)
            except Exception as e:
                frappe.log_error(f"Error removing user permission: {str(e)}")

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
            "teller_treasury"
        )
        
        if active_shift:
            treasury = frappe.get_doc("Teller Treasury", active_shift)
            if treasury:
                self.treasury_code = treasury.name
                self.branch_no = treasury.branch
                self.branch_name = frappe.db.get_value("Branch", treasury.branch, "custom_branch_no")

    def validate_active_shift(self):
        """Ensure user has an active shift"""
        # Get the employee linked to the current user
        employee = frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name')
        if not employee:
            frappe.throw(_("No employee found for user {0}").format(frappe.session.user))
            
        active_shift = frappe.db.get_value("Open Shift for Branch", 
            filters={
                "current_user": employee,
                "shift_status": "Active",
                "docstatus": 1
            },
            fieldname="teller_treasury"
        )
        
        if not active_shift:
            frappe.throw("No active shift found. Please open a shift first.")
            
        self.teller_treasury = active_shift
        
    def validate_currency_transactions(self):
        """Validate currency transactions"""
        if not self.teller_invoice_details:
            frappe.throw("At least one currency transaction is required")
            
        for row in self.teller_invoice_details:
            # Validate account belongs to treasury
            account = frappe.get_doc("Account", row.account)
            if account.custom_teller_treasury != self.teller_treasury:
                frappe.throw(f"Account {row.account} is not assigned to your treasury")
                
            # Calculate amounts - amount in original currency, egy_amount in EGY
            row.amount = flt(row.quantity)  # Amount in original currency
            row.egy_amount = flt(row.quantity) * flt(row.exchange_rate)  # Amount in EGY
            
            # Check and update balance using get_balance_on
            current_balance = get_balance_on(account=row.account)
            row.balance_after = flt(current_balance) + flt(row.quantity)
            
            if row.balance_after < 0:
                frappe.throw(f"Insufficient balance in account {row.account}")
                
    def calculate_totals(self):
        """Calculate total amounts"""
        self.total_amount = 0  # Initialize in original currencies
        self.total_egy = 0     # Initialize in EGY
        
        for row in self.teller_invoice_details:
            # Add amount in original currency
            self.total_amount += flt(row.amount)
            # Add EGY equivalent amount
            self.total_egy += flt(row.egy_amount)
            
    def make_gl_entries(self, cancel=False):
        """Create GL Entries for currency transactions"""
        gl_entries = []
        
        # Validate EGY account exists
        if not self.egy:
            frappe.throw(_("EGY Account is required for GL entries. Please set the EGY account in the invoice."))
            
        # Use company from the document
        if not self.company:
            frappe.throw(_("Company is required for GL entries"))
            
        # Get cost center
        cost_center = frappe.db.get_value("Company", self.company, "cost_center")
        if not cost_center:
            frappe.throw(_("Please set default cost center in company {0}").format(self.company))
            
        for row in self.teller_invoice_details:
            # Debit currency account (using EGY amount for GL entries)
            debit_entry = frappe._dict({
                "account": row.account,
                "debit": row.egy_amount if not cancel else 0,
                "credit": 0 if not cancel else row.egy_amount,
                "against": "Customer",
                "party_type": "Customer",
                "party": self.client,
                "posting_date": self.posting_date,
                "company": self.company,
                "voucher_type": self.doctype,
                "voucher_no": self.name,
                "cost_center": cost_center,
                "remarks": f"Amount: {row.quantity} {row.currency}"
            })
            gl_entries.append(debit_entry)
            
            # Credit EGY account
            credit_entry = frappe._dict({
                "account": self.egy,
                "debit": 0 if not cancel else row.egy_amount,
                "credit": row.egy_amount if not cancel else 0,
                "against": self.client,
                "party_type": "Customer",
                "party": self.client,
                "posting_date": self.posting_date,
                "company": self.company,
                "voucher_type": self.doctype,
                "voucher_no": self.name,
                "cost_center": cost_center,
                "remarks": f"Against: {row.quantity} {row.currency}"
            })
            gl_entries.append(credit_entry)
            
        if gl_entries:
            make_gl_entries(gl_entries, cancel=cancel)


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
    doc_data = json.loads(doc)
    source_name = doc_data.get("name")  
    source_total =  doc_data.get("total")  
    def update_item(source_doc, target_doc, source_parent):
        target_doc.code = source_doc.code
        target_doc.currency_code = source_doc.currency_code
        target_doc.paid_from = source_doc.paid_from
        target_doc.usd_amount = -source_doc.usd_amount
        target_doc.rate = source_doc.rate
        target_doc.total_amount = -source_doc.total_amount
    # Prepare the mapping dictionary
    # Ensure the source document has a docstatus of 1 ()
    # Map the item details
    # Postprocess the items (if needed)
    # Create a new document by mapping the fields from the source document
    table_maps = {
        "Teller Invoice": {
            "doctype": "Teller Invoice",
            "field_map": {
                "is_returned ": 1,  

            },
            "validation": {
                "docstatus": ["=", 1],  
            },
        },
        "Teller Invoice Details": {
            "doctype": "Teller Invoice Details",  
            "field_map": {
                "code": "code",
                "currency_code": "currency_code",
                "paid_from": "paid_from",
                "usd_amount":"usd_amount",
                "rate":"rate",
                "total_amount":"total_amount"
            },
            "postprocess": update_item,  
        },
    }

  
    target_doc = get_mapped_doc(
        "Teller Invoice",  # Source doctype
        source_name,  # Source document name
        table_maps,  # Field mappings and postprocess functions
    )
    target_doc.is_returned =1

    target_doc.total = -1*(float(source_total))
    target_doc.insert()

    return {
        "message": "Sales Return Created",
        "new_teller_invoice": target_doc.name,  
        "new_teller_invoice_url": get_url_to_form("Teller Invoice", target_doc.name),
        "type": type(source_total)

    }

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
        fields=["name", "current_user", "teller_treasury"],
        order_by="creation desc",
        limit=1
    )
    
    if not active_shift:
        frappe.throw(_("No active shift found. Please ask your supervisor to open a shift for you."))
        
    shift = active_shift[0]
    
    # Get Teller Treasury details
    treasury = frappe.get_doc("Teller Treasury", shift.teller_treasury)
    if not treasury:
        frappe.throw(_("Teller Treasury not found"))
        
    # Get Branch details
    branch = frappe.get_doc("Branch", treasury.branch)
    if not branch:
        frappe.throw(_("Branch not found"))
        
    # Get the treasury code - using teller_number from Teller Treasury
    treasury_code = treasury.name if treasury.name else shift.teller_treasury
        
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
        ["name", "teller_treasury"]
    )
    
    if not active_shift:
        return "1=0"
        
    # Get the treasury's accounts
    treasury = frappe.get_doc("Teller Treasury", active_shift.teller_treasury)
    if not treasury:
        return "1=0"
        
    return """
        `tabAccount`.account_type in ('Bank', 'Cash')
        AND (
            -- Check if account is linked to user's currency codes
            EXISTS (
                SELECT 1 FROM `tabCurrency Code` cc 
                WHERE cc.user = '{user}'
                AND cc.account = `tabAccount`.name
            )
            OR 
            -- Check if account is the EGY account for the user
            EXISTS (
                SELECT 1 FROM `tabUser` u
                WHERE u.name = '{user}'
                AND u.egy_account = `tabAccount`.name
            )
        )
    """.format(user=user)

def has_account_permission(doc, ptype, user):
    if not user:
        user = frappe.session.user
        
    required_roles = ["Teller", "Sales User", "Accounts User"]
    user_roles = frappe.get_roles(user)
    
    # Check if user has required roles
    if not any(role in required_roles for role in user_roles):
        return False
        
    if ptype in ("read", "write"):
        # Get the employee linked to the current user
        employee = frappe.db.get_value('Employee', {'user_id': user}, 'name')
        if not employee:
            return False
            
        # Get active shift for the employee
        active_shift = frappe.db.get_value(
            "Open Shift for Branch",
            {
                "current_user": employee,
                "shift_status": "Active",
                "docstatus": 1
            },
            "teller_treasury"
        )
        
        if not active_shift:
            return False
            
        # Check if the account is linked to any currency codes for this user
        # or if it's the user's EGY account
        has_currency_codes = frappe.db.exists(
            "Currency Code",
            {
                "user": user,
                "account": doc.name
            }
        )
        
        is_egy_account = frappe.db.get_value(
            "User",
            user,
            "egy_account"
        ) == doc.name
        
        return bool(has_currency_codes or is_egy_account)
        
    return False
