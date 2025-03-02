from erpnext.selling.doctype.customer.customer import Customer
from datetime import datetime
import frappe

class CustomCustomer(Customer):
    def validate(self):
        if self.custom_end_registration_date:
            today = datetime.now().date()
            end_date = datetime.strptime(str(self.custom_end_registration_date), '%Y-%m-%d').date()
            
            if end_date < today:
                frappe.msgprint("Registration Date has Expired")
                self.custom_is_expired = 1
            else:
                self.custom_is_expired = 0

      
    # return super().validate()