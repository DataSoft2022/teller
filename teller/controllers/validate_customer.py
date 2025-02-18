
from datetime import datetime
import frappe
from teller.send_email import sendmail_customer_expired_registration_date
def validate_registration_date():
  all_customers = frappe.get_all("Customer",filters={"custom_is_expired":0},fields=["name","custom_is_expired","custom_end_registration_date"])
  formatted_date = datetime.now().strftime('%Y-%m-%d')
  for customer in all_customers:
    customer_doc = frappe.get_doc("Customer", customer.name)
    if str(customer_doc.custom_end_registration_date) == formatted_date:         
        customer_doc.db_set("custom_is_expired", 1)
        sendmail_customer_expired_registration_date(customer_doc)
        frappe.msgprint("valiadtion Completed")
        frappe.db.commit()
