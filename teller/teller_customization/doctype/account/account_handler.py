import frappe
from frappe.permissions import add_user_permission, remove_user_permission

@frappe.whitelist()
def on_update(doc, method):
    """Handle updates to Account document"""
    try:
        if doc.custom_teller_treasury:
            # Get the treasury
            treasury = frappe.get_doc("Teller Treasury", doc.custom_teller_treasury)
            
            # Handle currency code
            if doc.custom_currency_code:
                # Check for existing currency code
                existing_code = frappe.db.exists("Currency Code", {
                    "account": doc.name,
                    "code": doc.custom_currency_code
                })
                
                if existing_code:
                    # Update existing
                    currency_code = frappe.get_doc("Currency Code", existing_code)
                    currency_code.treasury = treasury.name
                    currency_code.save()
                else:
                    # Create new
                    frappe.get_doc({
                        "doctype": "Currency Code",
                        "account": doc.name,
                        "code": doc.custom_currency_code,
                        "currency": doc.account_currency,
                        "treasury": treasury.name
                    }).insert(ignore_permissions=True)
            
        else:
            # If treasury is removed, remove all user permissions for this account
            frappe.db.delete("User Permission", {
                "allow": "Account",
                "for_value": doc.name
            })
            
    except Exception as e:
        frappe.log_error(
            f"Error in account on_update: {str(e)}\n{frappe.get_traceback()}",
            "Account Handler Error"
        ) 