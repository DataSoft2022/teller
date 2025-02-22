# Copyright (c) 2025, Ahmed Reda  and contributors
# For license information, please see license.txt

import frappe
from frappe import whitelist, _
from frappe.model.document import Document
from frappe.utils import flt
import json


class CloseShiftForBranch(Document):
	def validate(self):
		if not self.open_shift:
			frappe.throw(_("Please select an Open Shift"))
			
		# Validate that the selected shift is valid
		shift = frappe.get_doc("Open Shift for Branch", self.open_shift)
		if shift.docstatus != 1:
			frappe.throw(_("Selected shift must be submitted"))
			
		if shift.shift_status != "Active":
			frappe.throw(_("Selected shift must be active"))
			
		# Check if shift is already closed
		existing_close = frappe.db.exists("Close Shift For Branch", {
			"open_shift": self.open_shift,
			"docstatus": 1,
			"name": ["!=", self.name]  # Exclude current document
		})
		if existing_close:
			frappe.throw(_("This shift is already closed by {0}").format(existing_close))
			
		self.fetch_and_set_invoices()
		self.fetch_and_set_purchases()
			
		# Calculate currency summary
		self.calculate_currency_summary()

@whitelist()
def get_active_shift():
	"""Get active shift that hasn't been closed yet"""
	active_shifts = frappe.get_all("Open Shift for Branch", 
		filters={
			"shift_status": "Active",
			"docstatus": 1
		},
		fields=["name"]
	)
	
	if not active_shifts:
		frappe.msgprint(_("There are no active shifts available"))
		return None
		
	# Filter out shifts that are already closed
	available_shifts = []
	for shift in active_shifts:
		existing_close = frappe.db.exists("Close Shift For Branch", {
			"open_shift": shift.name,
			"docstatus": 1
		})
		if not existing_close:
			available_shifts.append(shift)
			
	if not available_shifts:
		frappe.msgprint(_("All active shifts are already closed"))
		return None
		
	return available_shifts[0].name if available_shifts else None

@whitelist()
def active_active_user(shift):
	if not shift:
		frappe.throw(_("Please select a shift"))
		
	active_open_shift = frappe.get_doc("Open Shift for Branch", shift)
	if not active_open_shift:
		frappe.throw(_("Invalid shift selected"))
		
	if active_open_shift.docstatus != 1:
		frappe.throw(_("Selected shift must be submitted"))
		
	if active_open_shift.shift_status != "Active":
		frappe.throw(_("Selected shift must be active"))
		
	return active_open_shift

@whitelist()
def call_from_class(self):
	return self.current_user, len(self.sales_table)

@whitelist(allow_guest=True)
def get_sales_invoice(current_open_shift):
	invoices = []
	invoice_names = frappe.db.get_all(
		"Teller Invoice",
		filters={
			"docstatus": 1, 
			"shift": current_open_shift,
			"is_returned": 0  # Only get non-returned invoices
		},
		order_by="name desc",
	)

	for invoice in invoice_names:
		doc = frappe.get_doc("Teller Invoice", invoice)
		invoices.append(doc)

	return invoices

@whitelist()
def get_purchase_invoices(current_open_shift):
	"""Get all purchase transactions for the current shift"""
	try:
		# First check if there are any purchases for this shift
		purchase_count = frappe.db.count('Teller Purchase', 
			{'shift': current_open_shift, 'docstatus': 1, 'is_returned': 0})
			
		if purchase_count == 0:
			return []
			
		# Get all submitted teller purchases for this shift
		purchases = frappe.db.sql("""
			SELECT 
				tp.name,
				tp.posting_date,
				tp.buyer,
				tp.purchase_receipt_number,
				tp.movement_number,
				tpc.quantity,
				tpc.exchange_rate,
				tpc.egy_amount,
				COALESCE(c.name, 'EGP') as currency_name
			FROM `tabTeller Purchase` tp
			INNER JOIN `tabTeller Purchase Child` tpc ON tp.name = tpc.parent
			LEFT JOIN `tabCurrency` c ON c.custom_currency_code = tpc.currency_code
			WHERE tp.docstatus = 1 
			AND tp.shift = %(shift)s
			AND tp.is_returned = 0
			ORDER BY tp.posting_date DESC
		""", {'shift': current_open_shift}, as_dict=1)
		
		# Log summary instead of full data
		frappe.log_error(
			message=f"Found {len(purchases)} purchase transactions for shift {current_open_shift}",
			title="Purchase Transaction Summary"
		)
		
		return purchases
		
	except Exception as e:
		frappe.log_error(
			message=f"Error in get_purchase_invoices: {str(e)}\n{frappe.get_traceback()}",
			title="Purchase Fetch Error"
		)
		return []

class CloseShiftForBranch(Document):
	def fetch_and_set_invoices(self):
		"""Fetch and set all sales invoices for this shift"""
		try:
			# Clear existing sales invoice entries
			self.sales_invoice = []
			
			# Get all submitted teller invoices for this shift with their details
			invoices = frappe.db.sql("""
				SELECT DISTINCT
					ti.name,
					ti.posting_date,
					ti.client,
					ti.receipt_number,
					ti.movement_number,
					tid.currency_code,
					tid.quantity,
					tid.egy_amount as total_egy
				FROM `tabTeller Invoice` ti
				INNER JOIN `tabTeller Invoice Details` tid ON ti.name = tid.parent
				WHERE ti.docstatus = 1 
				AND ti.shift = %s
				AND ti.is_returned = 0
				ORDER BY ti.posting_date ASC
			""", self.open_shift, as_dict=1)
			
			total_sales = 0
			
			for inv in invoices:
				# Get currency name from currency code
				currency_name = frappe.db.get_value('Currency', {'custom_currency_code': inv.currency_code}, 'name')
				if not currency_name:
					frappe.throw(_(f"Currency not found for code {inv.currency_code}"))
				
				# Add each invoice to the sales_invoice table with proper currency
				self.append("sales_invoice", {
					"invoice": inv.name,
					"posting_date": inv.posting_date,
					"client": inv.client,
					"receipt_no": inv.receipt_number,
					"movement_no": inv.movement_number,
					"currency_code": currency_name,  # Use the currency name
					"total": inv.quantity,  # Original currency amount
					"total_amount": inv.quantity,  # Original currency amount
					"total_egy": flt(inv.total_egy)  # EGY amount
				})
				
				total_sales += flt(inv.total_egy)  # Use EGY amount for total
			
			# Format total_sales with EGP currency indicator
			self.total_sales = f"EGP {frappe.format(total_sales, 'Currency')}"
			
		except Exception as e:
			frappe.log_error(
				message=f"Error fetching sales invoices: {str(e)}\n{frappe.get_traceback()}",
				title="Close Shift Error"
			)
			frappe.throw(_("Error fetching sales invoices: {0}").format(str(e)))

	def fetch_and_set_purchases(self):
		"""Fetch and set all purchase transactions for this shift"""
		try:
			# Clear existing purchase entries
			self.purchase_close_table = []
			
			# Get all submitted teller purchases for this shift with their details
			# Join with Currency table to get the actual currency name
			purchases = frappe.db.sql("""
				SELECT DISTINCT
					tp.name,
					tp.posting_date,
					tp.buyer,
					tp.purchase_receipt_number,
					tp.movement_number,
					tpc.quantity,
					tpc.egy_amount as total_egy,
					COALESCE(c.name, 'EGP') as currency_name
				FROM `tabTeller Purchase` tp
				INNER JOIN `tabTeller Purchase Child` tpc ON tp.name = tpc.parent
				LEFT JOIN `tabCurrency` c ON c.custom_currency_code = tpc.currency_code
				WHERE tp.docstatus = 1 
				AND tp.shift = %s
				AND tp.is_returned = 0
				ORDER BY tp.posting_date ASC
			""", self.open_shift, as_dict=1)
			
			total_purchases = 0
			
			for purchase in purchases:
				if not purchase.currency_name:
					frappe.throw(_("Currency not found for transaction {0}").format(purchase.name))
				
				# Add each purchase to the purchase_close_table with proper currency
				self.append("purchase_close_table", {
					"reference": purchase.name,
					"posting_date": purchase.posting_date,
					"client": purchase.buyer,
					"receipt_number": purchase.purchase_receipt_number,
					"movement_no": purchase.movement_number,
					"currency_code": purchase.currency_name,  # Use the currency name from the join
					"total": purchase.quantity,  # Original currency amount
					"total_amount": purchase.quantity,  # Original currency amount
					"total_egy": flt(purchase.total_egy)  # EGY amount
				})
				
				total_purchases += flt(purchase.total_egy)  # Use EGY amount for total
			
			# Format total_purchases with EGP currency indicator
			self.total_purchase = f"EGP {frappe.format(total_purchases, 'Currency')}"
			
		except Exception as e:
			frappe.log_error(
				message=f"Error fetching purchase transactions: {str(e)}\n{frappe.get_traceback()}",
				title="Close Shift Error"
			)
			frappe.throw(_("Error fetching purchase transactions: {0}").format(str(e)))

	def on_submit(self):
		"""Handle shift closure on submit"""
		try:
			if not self.open_shift:
				frappe.throw(_("Please select an Open Shift"))
			
			# Set end_date to current time on submission
			self.end_date = frappe.utils.now()
			self.db_set('end_date', self.end_date)
			
			# Import the function directly from the module
			from teller.teller_customization.doctype.open_shift_for_branch.open_shift_for_branch import update_shift_end_date
			
			# Update the open shift's end date and status
			update_shift_end_date(self.open_shift, self.end_date)
			
		except Exception as e:
			frappe.log_error(
				message=f"Error during shift closure: {str(e)}\n{frappe.get_traceback()}",
				title="Close Shift Error"
			)
			frappe.throw(_("Error closing shift: {0}").format(str(e)))

	@whitelist()
	def calculate_currency_summary(self):
		"""Calculate currency summary for all accounts used in transactions during the shift"""
		try:
			currency_summary = []
			
			# Get the shift details
			shift = frappe.get_doc("Open Shift for Branch", self.open_shift)
			if not shift:
				frappe.throw(_("Invalid shift selected"))
				
			# Get all currencies and accounts used in sales (Teller Invoice)
			sales_currencies = frappe.db.sql("""
				SELECT DISTINCT 
					tid.currency_code,
					tid.account,
					c.name as currency_name
				FROM `tabTeller Invoice Details` tid
				INNER JOIN `tabTeller Invoice` ti ON ti.name = tid.parent
				LEFT JOIN `tabCurrency` c ON c.custom_currency_code = tid.currency_code
				WHERE ti.shift = %s 
				AND ti.docstatus = 1
				AND ti.is_returned = 0
			""", self.open_shift, as_dict=1)
			
			# Get all currencies and accounts used in purchases (Teller Purchase)
			purchase_currencies = frappe.db.sql("""
				SELECT DISTINCT 
					tpc.currency_code,
					tpc.account,
					c.name as currency_name
				FROM `tabTeller Purchase Child` tpc
				INNER JOIN `tabTeller Purchase` tp ON tp.name = tpc.parent
				LEFT JOIN `tabCurrency` c ON c.custom_currency_code = tpc.currency_code
				WHERE tp.shift = %s 
				AND tp.docstatus = 1
				AND tp.is_returned = 0
			""", self.open_shift, as_dict=1)
			
			# Combine unique currencies and accounts from both sales and purchases
			all_currencies = {}
			for curr in sales_currencies + purchase_currencies:
				key = (curr.currency_code, curr.account)
				if key not in all_currencies:
					all_currencies[key] = {
						'currency_name': curr.currency_name,
						'account': curr.account
					}
			
			# For each currency and account combination, calculate the summary
			for (currency_code, account), data in all_currencies.items():
				currency_name = data['currency_name'] or currency_code  # Fallback to code if name not found
				
				# Get the account's balance at shift start date
				opening_balance = frappe.db.sql("""
					SELECT sum(debit_in_account_currency) - sum(credit_in_account_currency) as balance
					FROM `tabGL Entry`
					WHERE account = %s
					AND posting_date <= %s
					AND is_cancelled = 0
				""", (account, shift.start_date), as_dict=1)[0].balance or 0
				
				# Calculate sold amount (from Teller Invoice)
				sold_amount = frappe.db.sql("""
					SELECT COALESCE(SUM(tid.quantity), 0) as total
					FROM `tabTeller Invoice Details` tid
					INNER JOIN `tabTeller Invoice` ti ON ti.name = tid.parent
					WHERE ti.shift = %s 
					AND ti.docstatus = 1
					AND ti.is_returned = 0
					AND tid.currency_code = %s
					AND tid.account = %s
				""", (self.open_shift, currency_code, account), as_dict=1)[0].total or 0
				
				# Calculate bought amount (from Teller Purchase)
				bought_amount = frappe.db.sql("""
					SELECT COALESCE(SUM(tpc.quantity), 0) as total
					FROM `tabTeller Purchase Child` tpc
					INNER JOIN `tabTeller Purchase` tp ON tp.name = tpc.parent
					WHERE tp.shift = %s 
					AND tp.docstatus = 1
					AND tp.is_returned = 0
					AND tpc.currency_code = %s
					AND tpc.account = %s
				""", (self.open_shift, currency_code, account), as_dict=1)[0].total or 0
				
				# Calculate transferred amount during shift period
				transferred_amount = frappe.db.sql("""
					SELECT COALESCE(SUM(amount), 0) as total
					FROM `tabTreasury Transfer`
					WHERE docstatus = 1
					AND creation BETWEEN %s AND %s
					AND (from_account = %s OR to_account = %s)
				""", (shift.start_date, shift.end_date or frappe.utils.now(), 
					  account, account), as_dict=1)[0].total or 0
				
				# Calculate final balance
				final_balance = flt(opening_balance) - flt(sold_amount) + flt(bought_amount)
				
				# Add to currency summary list
				currency_summary.append({
					"currency": currency_name,
					"currency_code": currency_code,
					"account": account,
					"opening_balance": opening_balance,
					"sold_amount": sold_amount,
					"bought_amount": bought_amount,
					"transferred_amount": transferred_amount,
					"final_balance": final_balance,
					"actual_amount": 0  # This will be filled manually by the user
				})
				
			return currency_summary
			
		except Exception as e:
			frappe.log_error(
				message=f"Error calculating currency summary: {str(e)}\n{frappe.get_traceback()}",
				title="Currency Summary Error"
			)
			frappe.throw(_("Error calculating currency summary: {0}").format(str(e)))

@whitelist()
def get_shift_details(shift):
	"""Get details from Open Shift for Branch"""
	open_shift = frappe.get_doc("Open Shift for Branch", shift)
	
	# Get employee's branch
	employee = frappe.get_doc("Employee", open_shift.current_user)
	
	return {
		"start_date": open_shift.start_date,
		"current_user": open_shift.current_user,
		"branch": employee.branch
	}

@whitelist()
def get_unclosed_shifts(doctype, txt, searchfield, start, page_len, filters):
	# Find open shifts that don't have a corresponding close shift
	return frappe.db.sql("""
		SELECT os.name, os.start_date, os.current_user
		FROM `tabOpen Shift for Branch` os
		WHERE os.shift_status = 'Active'
		AND os.docstatus = 1
		AND NOT EXISTS (
			SELECT 1 
			FROM `tabClose Shift For Branch` cs 
			WHERE cs.open_shift = os.name
			AND cs.docstatus = 1
		)
		AND (
			os.name LIKE %(txt)s OR
			os.current_user LIKE %(txt)s
		)
		ORDER BY os.start_date DESC
		LIMIT %(start)s, %(page_len)s
	""", {
		'txt': f"%{txt}%",
		'start': start,
		'page_len': page_len
	})

@whitelist()
def calculate_currency_summary(doc):
	"""API endpoint to calculate currency summary"""
	try:
		if isinstance(doc, str):
			doc = json.loads(doc)
		
		# Always create a new temporary document
		temp_doc = frappe.new_doc("Close Shift For Branch")
		temp_doc.update(doc)
		
		# Call the instance method
		return temp_doc.calculate_currency_summary()
		
	except Exception as e:
		frappe.log_error(
			message=f"Error in calculate_currency_summary API: {str(e)}\n{frappe.get_traceback()}",
			title="Currency Summary API Error"
		)
		frappe.throw(_("Error calculating currency summary: {0}").format(str(e)))