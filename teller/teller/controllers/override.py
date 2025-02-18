from erpnext.selling.doctype.customer.customer import Customer
from datetime import datetime
import frappe
class CustomCustomer(Customer):
  def validate(self):
      formatted_date = datetime.now().strftime('%Y-%m-%d')
      if self.custom_end_registration_date == formatted_date:   
          frappe.msgprint("Date is Expired")
          self.custom_is_expired = 1

      
    # return super().validate()