import frappe

def account_has_permission(doc, ptype, user):
    if "Teller" in frappe.get_roles(user):
        if ptype in ("read", "select"):
            return True
    return False

def customer_has_permission(doc, ptype, user):
    if "Teller" in frappe.get_roles(user):
        if ptype in ("read", "select"):
            return True
    return False 