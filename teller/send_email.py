import frappe
from frappe import _
@frappe.whitelist(allow_guest=True)
def sendmail(interbank_doc):
  interbank_name = interbank_doc.get("name")
  interbank_doc = frappe.get_doc("InterBank", interbank_name)
  interbank_details = frappe.db.get_all(
                    "InterBank Details",
                    fields=["currency","status","name", "booking_precentage", "qty", "parent"],
                    filters={"parent": interbank_name},
                    ignore_permissions=True
                )
  message =f""
  email =[]
  # x = interbank_doc.mail
  x = ["ahmedabukhatwa1@gmail.com","andrewdatasoft@gmail.com"]
  email.append(x)
  e = frappe.db.get_singles_value("Teller Setting", "notification_percentage")
  o = frappe.db.get_singles_value("Teller Setting", "close_interbank")
  for detail in interbank_details:            
      new_val = detail.get("booking_precentage")
      currency  = detail.get("currency")
      str_value = str(new_val) 

      if new_val is not None and new_val != '':
        if '%' in str_value:
            percentage = float(str_value.replace('%', '')) 
        else:
            percentage = float(str_value)

        if percentage >= e and percentage != o:
            allow_notify = frappe.db.get_singles_value("Teller Setting", "allow_interbank_notification")
            if allow_notify == "ON":
                notify = frappe.db.get_singles_value("Teller Setting", "notification_percentage")
                # print(f"notify: {notify} | percentage: {percentage} | currency: {currency}")   
                message += _(f"Interbank {interbank_name} Currency {currency} value is {percentage}%\n")
        if percentage == o:
            allow_notify = frappe.db.get_singles_value("Teller Setting", "allow_interbank_notification")
            if allow_notify == "ON":
                notify = frappe.db.get_singles_value("Teller Setting", "notification_percentage")
                # print(f"notify: {notify} | percentage: {percentage} | currency: {currency}")   
                message += _(f"Interbank {interbank_name} Currency {currency} value is {percentage}%\n")        
      else:
          percentage = 0
          # print(f"\n\eeeeeeel{percentage}")
  if message:
      # print(f"\n\npercentage22........{percentage}")
      print(f"messege22{email}........{message}")
      frappe.sendmail(
        sender=None,
        recipients=email,
        subject=_("Interbank Notification"),
        message=message)
      return message
      #     enqueue(method=frappe.sendmail, queue="short", timeout=300, is_async=True, **email_args)
    