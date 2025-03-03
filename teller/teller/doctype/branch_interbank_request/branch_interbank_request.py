import frappe
from frappe.model.document import Document
from teller.teller.doctype.request_interbank.request_interbank import Requestinterbank

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
        booking = self.create_booking()
        
        # Update interbank booking percentages
        if booking:
            self.update_interbank_percentages(currency_table)

    @frappe.whitelist()
    def update_interbank_percentages(self, currency_table=None):
        """Update booking percentages in interbank records"""
        # If currency_table is not provided, use the document's branch_request_details
        if not currency_table:
            currency_table = self.branch_request_details
            
        # If currency_table is a string (JSON), parse it
        if isinstance(currency_table, str):
            import json
            currency_table = json.loads(currency_table)
            
        # Get all active interbank records
        interbank_records = frappe.get_all(
            "InterBank",
            filters={"status": ["in", ["Deal", "Open"]]},
            fields=["name"]
        )
        
        if not interbank_records:
            frappe.msgprint("No active interbank records found.")
            return
        
        updated_records = []
        
        # For each currency in the branch request
        for row in currency_table:
            # Handle both dict and DocType objects
            if isinstance(row, dict):
                currency = row.get("currency")
                qty = row.get("qty")
            else:
                currency = row.currency
                qty = row.qty
            
            # Find matching interbank records with this currency
            for interbank in interbank_records:
                interbank_name = interbank.name
                
                # Get interbank details for this currency
                interbank_details = frappe.get_all(
                    "InterBank Details",
                    fields=["name", "booking_qty", "qty", "currency"],
                    filters={"parent": interbank_name, "currency": currency}
                )
                
                for detail in interbank_details:
                    # Update the booking quantity
                    detail_doc = frappe.get_doc("InterBank Details", detail.name)
                    current_booking_qty = detail_doc.booking_qty or 0
                    new_booking_qty = current_booking_qty + qty
                    
                    # Don't exceed the total quantity
                    if new_booking_qty > detail_doc.qty:
                        new_booking_qty = detail_doc.qty
                    
                    # Update the booking quantity
                    detail_doc.db_set("booking_qty", new_booking_qty)
                    
                    # Calculate and update the percentage
                    req_interbank = Requestinterbank()
                    req_interbank.calculate_precent(interbank_name)
                    
                    updated_records.append(interbank_name)
        
        if updated_records:
            frappe.msgprint(f"Updated booking percentages for interbank records: {', '.join(updated_records)}")
        else:
            frappe.msgprint("No interbank records were updated.")
            
        return {"success": True, "updated_records": updated_records}

    @frappe.whitelist(allow_guest=True)
    def create_booking(self):
        # Validate that required fields are available before proceeding
        if not self.transaction or not self.date or not self.time or not self.user or not self.branch:
            frappe.throw("Transaction, Date, Time, User, and Branch are required fields to create a booking.")
        
        currency_table = self.branch_request_details
        document = frappe.new_doc("Booking Interbank")
        
        # Set default customer for interbank transactions
        document.customer = 'البنك الاهلي'  # Default customer for interbank
        
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
                "booking_qty": requested_qty,
                "request_reference": self.name  # Add reference to this request
            })
        
        # Save the document and insert it into the database
        try:
            document.insert(ignore_permissions=True)
            frappe.msgprint(f"Booking Interbank document {document.name} has been created successfully.")
            
            # Update the status of this request to indicate it's been processed
            self.status = "Billed"
            self.save()
            
            return document
        except Exception as e:
            frappe.msgprint(f"Error creating Booking Interbank: {str(e)}")
            return None

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
