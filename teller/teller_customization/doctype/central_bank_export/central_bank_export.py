import frappe
from frappe.model.document import Document
from frappe.utils import today, get_datetime_str, now, get_datetime

class CentralBankExport(Document):
    def validate(self):
        self.validate_duplicate_transactions()
        if self.docstatus == 1:
            self.status = 'Exported'
    
    def validate_duplicate_transactions(self):
        """Check if any transaction is already exported"""
        for row in self.transactions:
            # Check if this transaction exists in any other submitted export
            existing = frappe.db.sql("""
                SELECT DISTINCT cbe.name 
                FROM `tabCentral Bank Export` cbe
                INNER JOIN `tabCentral Bank Export Detail` cbed 
                ON cbe.name = cbed.parent
                WHERE cbe.docstatus = 1 
                AND cbe.name != %s
                AND cbed.reference_doctype = %s
                AND cbed.reference_name = %s
                LIMIT 1
            """, (self.name or "New", row.reference_doctype, row.reference_name))
            
            if existing:
                frappe.throw(f'Transaction {row.reference_name} is already exported in {existing[0][0]}')

    def on_submit(self):
        self.status = 'Exported'
        self.export_date = today()
        self.generate_export_file()

    def generate_export_file(self):
        """Generate export file in the required format"""
        lines = []
        company_central_bank_number = frappe.db.get_single_value('Teller Setting', 'company_central_bank_number')
        if not company_central_bank_number:
            frappe.throw("Please set Company Central Bank Number in Teller Setting")
        
        current_datetime = get_datetime(now())
        date_str = current_datetime.strftime('%Y%m%d')
        time_str = current_datetime.strftime('%H%M%S')
        
        for row in self.transactions:
            # Format numbers with required precision, using absolute values
            quantity = f"{abs(row.quantity):.4f}"
            amount = f"{abs(row.amount):.4f}"
            
            # Create line in required format:
            # Date,time,company_central_bank_number,1,1,central_bank_number,currency_code,quantity,total_amount_egp,0
            line = f"{date_str},{time_str},{company_central_bank_number},1,1,{row.central_bank_number},{row.currency_code},{quantity},{amount},0"
            lines.append(line)
        
        # Create and attach the export file
        file_name = f"central_bank_export_{self.name}.txt"
        content = "\n".join(lines)
        
        # Delete existing attached files for this document
        existing_files = frappe.get_all(
            "File",
            filters={
                "attached_to_doctype": self.doctype,
                "attached_to_name": self.name
            }
        )
        for file in existing_files:
            frappe.delete_doc("File", file.name)
        
        # Create new file attachment
        _file = frappe.get_doc({
            "doctype": "File",
            "file_name": file_name,
            "attached_to_doctype": self.doctype,
            "attached_to_name": self.name,
            "content": content,
            "is_private": 1
        })
        _file.save()
        
        # Set the file URL in the document
        self.db_set('attached_file', _file.file_url)
        frappe.db.commit()

@frappe.whitelist()
def get_unexported_transactions(from_date=None, to_date=None):
    """Get transactions that haven't been exported yet"""
    conditions = []
    values = {}
    
    if from_date:
        conditions.append("posting_date >= %(from_date)s")
        values["from_date"] = from_date
    
    if to_date:
        conditions.append("posting_date <= %(to_date)s")
        values["to_date"] = to_date
    
    where_clause = " AND ".join(conditions) if conditions else "1=1"
    
    # Get central bank numbers from Teller Setting
    teller_setting = frappe.get_doc('Teller Setting')
    
    # Get purchase transactions
    purchase_query = """
        SELECT 
            'Purchase' as transaction_type,
            'Teller Purchase' as reference_doctype,
            tp.name as reference_name,
            tp.posting_date,
            tp.category_of_buyer as client_type,
            tpc.quantity,
            tpc.egy_amount as amount,
            tpc.currency_code
        FROM `tabTeller Purchase` tp
        JOIN `tabTeller Purchase Child` tpc ON tp.name = tpc.parent
        WHERE tp.docstatus = 1 
        AND {where_clause}
        AND NOT EXISTS (
            SELECT 1 FROM `tabCentral Bank Export Detail` cbd
            JOIN `tabCentral Bank Export` cb ON cbd.parent = cb.name
            WHERE cb.docstatus = 1
            AND cbd.reference_doctype = 'Teller Purchase'
            AND cbd.reference_name = tp.name
        )
    """.format(where_clause=where_clause)
    
    # Get sales transactions
    sales_query = """
        SELECT 
            'Sale' as transaction_type,
            'Teller Invoice' as reference_doctype,
            ti.name as reference_name,
            ti.posting_date,
            ti.client_type,
            tid.quantity,
            tid.egy_amount as amount,
            tid.currency_code
        FROM `tabTeller Invoice` ti
        JOIN `tabTeller Invoice Details` tid ON ti.name = tid.parent
        WHERE ti.docstatus = 1 
        AND {where_clause}
        AND NOT EXISTS (
            SELECT 1 FROM `tabCentral Bank Export Detail` cbd
            JOIN `tabCentral Bank Export` cb ON cbd.parent = cb.name
            WHERE cb.docstatus = 1
            AND cbd.reference_doctype = 'Teller Invoice'
            AND cbd.reference_name = ti.name
        )
    """.format(where_clause=where_clause)
    
    purchase_transactions = frappe.db.sql(purchase_query, values=values, as_dict=1)
    sales_transactions = frappe.db.sql(sales_query, values=values, as_dict=1)
    
    # Add central bank numbers based on client type
    for trans in purchase_transactions:
        if trans.client_type == 'Egyptian':
            trans.central_bank_number = teller_setting.purchase_egyptian_number
        elif trans.client_type == 'Foreigner':
            trans.central_bank_number = teller_setting.purchase_foreigner_number
        elif trans.client_type == 'Company':
            trans.central_bank_number = teller_setting.purchase_company_number
        elif trans.client_type == 'Interbank':
            trans.central_bank_number = teller_setting.purchase_interbank_number
            
    for trans in sales_transactions:
        if trans.client_type == 'Egyptian':
            trans.central_bank_number = teller_setting.sales_egyptian_number
        elif trans.client_type == 'Foreigner':
            trans.central_bank_number = teller_setting.sales_foreigner_number
        elif trans.client_type == 'Company':
            trans.central_bank_number = teller_setting.sales_company_number
        elif trans.client_type == 'Interbank':
            trans.central_bank_number = teller_setting.sales_interbank_number
    
    return purchase_transactions + sales_transactions 