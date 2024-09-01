import frappe
from frappe import whitelist


@whitelist(allow_guest=True)
def test_api():
    return "hello"
