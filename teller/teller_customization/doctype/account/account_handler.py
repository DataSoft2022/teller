import frappe
from frappe.permissions import add_user_permission

def on_update(doc, method):
    """Handle updates to Account document"""
    if doc.custom_teller_treasury:
        # Get the treasury
        treasury = frappe.get_doc("Teller Treasury", doc.custom_teller_treasury)
        
        # Create currency code if needed
        if not frappe.db.exists("Currency Code", {
            "treasury": treasury.name,
            "account": doc.name
        }):
            frappe.get_doc({
                "doctype": "Currency Code",
                "treasury": treasury.name,
                "account": doc.name,
                "code": doc.custom_currency_code,
                "currency": doc.account_currency
            }).insert(ignore_permissions=True)
        
        # Update permissions for active shifts
        active_shifts = frappe.get_all("Open Shift for Branch",
            filters={
                "teller_treasury": treasury.name,
                "shift_status": "Active",
                "docstatus": 1
            },
            fields=["name", "current_user"]
        )
        
        # For each active shift, add permission for this account
        for shift in active_shifts:
            user = frappe.get_value("Employee", shift.current_user, "user_id")
            if user:
                try:
                    add_user_permission("Account", doc.name, user)
                except Exception as e:
                    frappe.log_error(f"Error adding permission for account {doc.name} to user {user}: {str(e)}") 