import frappe
from frappe import _
@frappe.whitelist(allow_guest=True)
def sendmail(interbank_doc):
  interbank_name = interbank_doc.get("name")
  interbank_doc = frappe.get_doc("InterBank", interbank_name)
  interbank_details = frappe.db.get_all(
                    "InterBank Details",
                    fields=["currency","status","name", "booking_qty", "qty", "parent"],
                    filters={"parent": interbank_name},
                    ignore_permissions=True
                )
  message =f""
  email =["ahmedabukhatwa1@gmail.com"]
  for detail in interbank_details:
      new_val = detail.get("booking_qty")
      currency  = detail.get("currency")
      str_value = str(new_val) 
      if '%' in str_value:
          percentage = float(str_value.replace('%', '')) 
      else:
          percentage = float(str_value)
      if percentage > 80:
          allow_notify = frappe.db.get_singles_value("Teller Setting", "allow_interbank_notification")
      if allow_notify == "ON":
          notify = frappe.db.get_singles_value("Teller Setting", "notification_percentage")
          print(f"notify: {notify} | percentage: {percentage} | currency: {currency}")   
          message += _(f"Interbank Currency {currency} value is {percentage}%\n")
  if message:
      print(f"messege........{message}")
      frappe.sendmail(
        sender=None,
        recipients=email,
        subject=_("Interbank Notification"),
        message=message)
      return message
          