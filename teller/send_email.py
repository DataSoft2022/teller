import frappe
from frappe import _
@frappe.whitelist(allow_guest=True)
def sendmail(new_val):
  str_value = str(new_val) 
  if '%' in str_value:
      percentage = float(str_value.replace('%', '')) 
  else:
      percentage = float(str_value,email)
  percentage = float(str_value.replace('%', ''))
  allow_notify = frappe.db.get_singles_value("Teller Setting", "allow_interbank_notification")
  if allow_notify == "ON":
    notify = frappe.db.get_singles_value("Teller Setting", "notification_percentage")
    print(f"n\n\n\n notify{notify} precent ib {percentage}")
    print(f"n\n\n\n notify{type(notify)} precent ib {type(percentage)}")
    email =["ahmedabukhatwa1@gmail.com"]
    if percentage:
      frappe.sendmail(
        sender=None,
        recipients=email,
        subject=_("Interbank Notification"),
        message=_("Interbank has Greter than 80%"))
      frappe.msgprint(f"Email has Sent")
  