# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt
import frappe
from frappe.model.document import Document
from frappe import _
import json
from teller.teller.doctype.request_interbank.request_interbank import Requestinterbank
from frappe.utils.background_jobs import enqueue

class InterBank(Document):
    
    def validate(self):
        if self.type == 'Holiday':
          if self.to_date < self.from_date:
            frappe.throw(f" To Date field Should be Greater than From Date")
    
    def on_submit(self):
        if not self.interbank:
            frappe.throw("Table is Empty")
        for row in self.interbank:
            if not row.rate or row.rate == 0:
                frappe.throw(f" Row {row.idx}# can't be rate {row.rate}")
        self.status = 'Deal'
        self.save()
        table = self.interbank
        for row in table:
          currency = row.currency
          purpose  = self.transaction
          ib_type = self.type
          print ("Data  ==========>",currency,purpose)
          if self.type == 'Daily':
              self.close_queue(currency, purpose, ib_type)
    
    def close_queue(self, currency, purpose, ib_type):
          # frappe.msgprint("Get Queue...",purpose)
          sql = """
          select 
          qrd.name AS name,
          qr.name AS parent,
          qr.creation,qr.branch,
          qrd.currency_code,
          qr.transaction,
          qrd.booked_qty,
          qrd.currency,
          qrd.qty,qr.type,
          (qrd.qty - qrd.booked_qty) AS balance,
          qrd.request_interbank
          from `tabQueue Request` qr
          left join `tabQueue Request Details` qrd  ON qr.name = qrd.parent 
              where qr.status = 'Queue'
              AND  qrd.currency = %s
              AND  qrd.status = 'Queue'
              AND  qr.transaction = %s
               AND  qr.type = %s
              ORDER BY qr.creation ASC
                      """
          queue_table = frappe.db.sql(sql,(currency, purpose, ib_type), as_dict=True)
          if not queue_table:
              return 
          document = frappe.new_doc("Booking Interbank")
          document.customer = self.customer
          document.type = self.transaction
          document.date = self.date
          document.user = self.user
          currency_table = self.interbank
          for row in currency_table:
              currency = row.currency
              purpose = self.transaction
              for queue in queue_table:
                # Queue fields 
                queue_balance = queue.get("balance")
                document.branch = queue.get("branch")
                if row.qty > queue_balance:
                  append_qty = queue_balance 
                  document.append("booked_currency", {
                                    "currency_code": queue.get("currency_code"),
                                    "currency": queue.get("currency"),
                                    "rate": row.rate,
                                    "qty": append_qty,
                                    "booking_qty": append_qty,
                                    "request_reference":queue.get("request_interbank"),
                                    "interbank_reference":self.name
                                })
                  self.update_queue(append_qty,queue_table)
                if row.qty == queue_balance:
                  append_qty = queue_balance 
                  document.append("booked_currency", {
                                    "currency_code": queue.get("currency_code"),
                                    "currency": queue.get("currency"),
                                    "rate": row.rate,
                                    "qty": append_qty,
                                    "booking_qty": append_qty,
                                    "request_reference":queue.get("request_interbank"),
                                    "interbank_reference":self.name
                                })
                  self.update_queue(append_qty,queue_table)
                  # document.insert(ignore_permissions=True)
                if row.qty < queue_balance:
                    append_qty = row.qty
                    document.append("booked_currency", {
                                    "currency_code": queue.get("currency_code"),
                                    "currency": queue.get("currency"),
                                    "rate": row.rate,
                                    "qty": append_qty,
                                    "booking_qty": append_qty,
                                    "request_reference":queue.get("request_interbank"),
                                    "interbank_reference":self.name
                                })
                    self.update_queue(append_qty,queue_table)
                        # document.insert(ignore_permissions=True)
                # document.insert(ignore_permissions=True)
                
          frappe.msgprint(f"Queue Request Closed successfully Against {self.name}.")        
    def update_queue(self,append_qty,queue_table):
        currency_table = self.interbank
        for q in currency_table:
            queue_name = q.get("name")
            currency = q.get("currency")
            ib_qty = q.get("qty")
            queue_details = queue_table
            # queue_details = frappe.get_all(
            #         "Queue Request Details",
            #         fields=["name", "parent","status", "qty", "currency","booked_qty"],
            #         filters={"currency": currency, "status":"Queue", "parenttype":"Queue Request"},
            #     )
            print(f"queue_details {queue_details}")
            for row in queue_details:
              queue_parent = row.get("booked_qty")
              queue_qty = row.get("qty")
              queue_booking_qty = row.get("booked_qty")
              if queue_qty == ib_qty:                
                detail_doc = frappe.get_doc("Queue Request Details", row.name)
                q_total = append_qty + queue_booking_qty
                detail_doc.db_set("booked_qty", q_total)
                detail_doc.db_set("status", "Closed")
          
              if queue_qty < ib_qty:                
                detail_doc = frappe.get_doc("Queue Request Details", row.name)
                q_total = append_qty + queue_booking_qty
                detail_doc.db_set("booked_qty", q_total)
                frappe.msgprint(f"{queue_parent} queue_qty {queue_qty}< queue_booking_qty{ib_qty} tot {q_total}")
              else:
                  detail_doc = frappe.get_doc("Queue Request Details", row.name)
                  q_total = append_qty + queue_booking_qty
                  detail_doc.db_set("booked_qty", q_total)
                  detail_doc.db_set("status", "Closed")

            ib_details = frappe.get_all(
                    "InterBank Details",
                    fields=["name", "status", "qty", "currency", "parent"],
                    filters={"parent": self.name, "currency": currency},
                )
            for detail in ib_details:
                ib_detail_doc = frappe.get_doc("InterBank Details", detail.name)
                booking_qty = ib_detail_doc.get("booking_qty")
                # i_total =booking_qty + queue_qty
                i_total =booking_qty + append_qty
                ib_detail_doc.db_set("booking_qty", i_total)
                # req_interbank = Requestinterbank.calculate_precent()
                ib_doc = ib_detail_doc.get("parent")
                calc=Requestinterbank.calculate_precent(self, ib_doc)
                for item in currency_table:
                    if item.qty == booking_qty:
                        ib_detail_doc.db_set("status", "Closed")
                        calc=Requestinterbank.calculate_precent(self, ib_doc)
                    else:
                        calc=Requestinterbank.calculate_precent(self, ib_doc)    
                
                # req_interbank.calculate_precent(self, ib_doc)
    @frappe.whitelist()    
    def interbank_update_status(self):
          current_interbank = frappe.get_doc("InterBank", self.name)
          current_interbank.ignore_validate_update_after_submit = True
          current_interbank.db_set('status', 'Closed')
          current_interbank.save()
          
    # @frappe.whitelist()
    # def fetch_data(self):
    #     # Your logic to fetch data
    #     sql = """
    # 	   SELECT
    #         account,
    #         SUM(credit_in_account_currency) AS sum_currency_sale,
    #         SUM(debit_in_account_currency) AS sum_currency_purchase,
    #         account_currency,
    #         SUM(credit) AS sum_egy_sale,
    #         SUM(debit) AS sum_egy_purchase,
    #         posting_date
    #     FROM
    #         `tabGL Entry`
    #     WHERE
    #         account IN (SELECT name FROM `tabAccount` WHERE account_type = 'Cash')

    # 	"""

    #     sr = frappe.db.sql(sql, as_dict=True)
    #     fetched_data = sr  # Replace with actual fetched data
    #     return fetched_data

    @frappe.whitelist()
    def get_currency(self):
        query = """
          SELECT
              cu.custom_currency_code,ac.account_currency, 
        SUM(gl.debit_in_account_currency) - SUM(gl.credit_in_account_currency) AS balance
            FROM `tabGL Entry` AS gl
            right JOIN `tabAccount` AS ac
            ON ac.name = gl.account
            INNER JOIN `tabCurrency` AS cu
            ON cu.name = ac.account_currency
            WHERE ac.custom_is_treasury = 1
            AND ac.account_currency != 'EGP'
            GROUP BY ac.custom_currency_code; 
        """
        data = frappe.db.sql(query, as_dict=True)
        for record in data:
            if self.type == 'Daily':
                self.append(
                    "interbank",
                    {
                        "currency_code": record["custom_currency_code"],
                        "currency": record["account_currency"],
                        "qty": record["balance"],
                    },
                )
            if self.type == 'Holiday':
                self.append(
                  "interbank",
                  {
                      "currency_code": record["custom_currency_code"],
                      "currency": record["account_currency"],
                      "qty": 0,
                  },
              )

        return self
@frappe.whitelist()
def create_special_price_document(self):
    current_doc = frappe.get_doc("InterBank", self.name)
    interbank_list = self.interbank
    list_table = []

    if interbank_list:
        for curr in interbank_list:
            if curr.get("custom_qty") and curr.get("custom_qty") > 0:
                list_table.append(
                    {
                        "currency": curr.get("currency"),
                        "transaction": curr.get("transaction"),
                        "custom_qty": curr.get("custom_qty"),
                        "rate": curr.get("rate"),
                    }
                )

        print("booked_currency :", list_table)

        if list_table:  # Ensure there's data to append
            document = frappe.new_doc("Special price document")
            document.custom_transaction = current_doc.transaction
            document.custom_interbank_refrence = current_doc.name
            print("document.transaction Is :", current_doc.transaction)
            for book in list_table:
                document.append(
                    "booked_currency",
                    {
                        "currency": book.get("currency"),
                        "transaction": book.get("transaction"),
                        "custom_qty": book.get("custom_qty"),
                        "rate": book.get("rate"),
                    },
                )
                for curr in interbank_list:
                    if curr.get("custom_qty"):
                        # if curr.get("remaining")> 0 or curr.get("remaining") < 0:
                        curr.set(
                            "remaining",
                            curr.get("remaining") - curr.get("custom_qty"),
                        )
                        curr.set("custom_qty", 0)
                        if curr.get("remaining") == 0:
                            return "remaining is zero so can not book now "
                            # curr.set("remaining", (curr.get("remaining")- curr.get("custom_qty")*-1))
                            # curr.set("custom_qty", 0)
                            # current_doc.save()
                            frappe.warn("remaining is zero so can not book now ")
                            break

                        # list_table.append(
                        #     {
                        #         "currency": curr.get("currency"),
                        #         "transaction": curr.get("transaction"),
                        #         "custom_qty": 0,
                        #         "rate": curr.get("rate"),
                        #         "remaining":(curr.get("remaining")- curr.get("custom_qty"))
                        #     }
                        # )

            document.insert(ignore_permissions=True)  # Save the document
            frappe.db.commit()  # Commit the transaction

            return _("Special Price Document(s) created successfully!")

    return _("No valid entries to create Special Price Document.")
@frappe.whitelist()
def create_queue_request(currency, purpose):
    sql = """
        select 
            ri.name,ri.type,
            ri.status,
            rid.currency, 
            rid.curency_code, 
            rid.qty, rid.avaliable_qty, 
            (rid.qty - rid.avaliable_qty) AS queue_qty,
            rid.creation
        from 
            `tabRequest interbank` ri 
        left join 
            `tabInterbank Request Details` rid 
        ON rid.parent = ri.name 
            where ri.status = 'In Queue'
        AND  rid.currency = %s
        AND  ri.type = %s
        ORDER BY rid.creation ASC

          """
    ri = frappe.db.sql(sql,(currency , purpose), as_dict=True)
    return ri

@frappe.whitelist(allow_guest=True)
def sendmail():
    pass
#     email_args = {
#       "recipients": "ahmedabukhatwa@gmail.com",
#       "sender": "elbank-alahly@datasofteg.com",
#       "subject":"subject",
#       "message": f"hello",
#       "now": True,
#       # "attachments": [
#       #   frappe.attach_print(
#       #     self.reference_doctype,
#       #     self.reference_name,
#       #     file_name=self.reference_name,
#       #     print_format=self.print_format,
#       #   )
#       # ],
#     }
#     enqueue(method=frappe.sendmail, queue="short", timeout=300, is_async=True, **email_args)
# #     # frappe.sendmail(
# #     # 	recipients=frappe.db.get_value("User", ref_doc.owner, "email") or ref_doc.owner,
# #     # 	subject=subject,
# #     # 	message=message,
# #     # 	reference_doctype=ref_doc.doctype,
# #     # 	reference_name=ref_doc.name,
# #     # )