import frappe
from frappe.model.document import Document

class BranchInterbankRequest(Document):
    def on_submit(self):
        currency_table = self.branch_request_details
        if not currency_table:
            frappe.throw("Table is empty.")
        
        for row in currency_table:
            if not row.qty or row.qty == 0:
                frappe.throw(f"Row {row.idx} - Currency {row.currency_code} can't have a quantity of {row.qty}.")
            if not row.rate or row.rate == 0:
                frappe.throw(f"Row {row.idx} - Currency {row.currency_code} can't have a rate of {row.rate}.")
        
        # Proceed to create booking after validation
        self.create_booking()

    @frappe.whitelist(allow_guest=True)
    def create_booking(self):
        # Validate that required fields are available before proceeding
        if not self.transaction or not self.date or not self.time or not self.user or not self.branch:
            frappe.throw("Transaction, Date, Time, User, and Branch are required fields to create a booking.")
        
        currency_table = self.branch_request_details
        document = frappe.new_doc("Booking Interbank")
        
        # Assign necessary fields to the new document
        document.transaction = self.transaction
        document.date = self.date
        document.time = self.time
        document.user = self.user
        document.branch = self.branch
        
        for row in currency_table:
            currency_code = row.get("currency_code")
            currency = row.get("currency")
            ib_rate = row.get("rate")
            requested_qty = row.get("qty")
            
            # Append data to booked_currency child table
            document.append('booked_currency', {
                "currency_code": currency_code,
                "currency": currency,
                "rate": ib_rate,
                "qty": requested_qty,
                "booking_qty": requested_qty
            })

            # Debug: print the document's dictionary form to inspect it
            # print("Document as dict: ", document.as_dict()) 
        
        # Save the document and insert it into the database
        document.insert(ignore_permissions=True)
        # Commit changes to the database
        # frappe.db.commit()

        # Display success message with document name (now it will have a name after insert)
        frappe.msgprint(f"Booking Interbank document {document.name} has been created successfully.")
@frappe.whitelist(allow_guest=True)
def get_all_avaliale_currency(transaction):
    """Server-side function that is triggered when the user clicks 'Yes'."""
    sql = """
WITH LatestCurrency AS (
    SELECT 
        ib.name, 
        ib.status,
        ibd.currency,
        ib.transaction,
        ibd.currency_code, 
        ibd.qty, 
        ibd.booking_qty,
        ibd.remaining,
        ibd.rate,
        ibd.creation,
        ibd.qty - ibd.booking_qty AS available_qty,
        ROW_NUMBER() OVER (PARTITION BY ibd.currency ORDER BY ibd.creation ASC) AS row_num
    FROM 
        `tabInterBank` ib 
    LEFT JOIN 
        `tabInterBank Details` ibd 
    ON 
        ibd.parent = ib.name
    WHERE 
        ib.docstatus = 1
        AND ib.transaction = %s
        AND ib.status = 'Deal'
        AND ib.type = 'Daily'
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
    
)
SELECT *
FROM LatestCurrency
WHERE row_num = 1
ORDER BY currency_code,creation ASC;  
 """
    data = frappe.db.sql(sql,(transaction, ),as_dict=True)
    return data
