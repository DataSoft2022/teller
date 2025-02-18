
import frappe
from frappe import _
from erpnext.accounts.utils import get_account_balances
from erpnext.accounts.utils import get_balance_on
from frappe.utils import today
@frappe.whitelist()
def get():    
    company = frappe.defaults.get_user_default("Company")
    account = "1100-1600 - Current Assets - AE"
    balances = get_balance_on(account= account, date =today(), company=company)
    print("balance",balances)