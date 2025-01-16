# Copyright (c) 2024, Mohamed AbdElsabour and contributors
# For license information, please see license.txt
import frappe
from frappe.model.document import Document
from frappe import _
import json


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
          queue_type = self.type
          print ("Data  ==========>",currency,purpose)
          if self.type == 'Daily':
              self.close_queue(currency, purpose, queue_type)


        # currency_table = self.interbank
        # for row in currency_table:
  


    # @frappe.whitelist()
    # def on_submit(self):
    #     currency_table = self.interbank
    #     if not self.interbank:
    #         frappe.throw("Put interbank table.")
    #     for row in currency_table:
    #         if not row.rate or row.rate == 0:
    #             frappe.throw(f"Put Rate for currency {row.currency}.")
    #     document = frappe.new_doc("Booking Interbank")
    #     document.customer = self.customer
    #     document.type = self.transaction
    #     # if self.type ==
    #     # if self.time:
    #     #     document.time
    #     if self.date:
    #         document.date  

    #     document.user = self.user
    #     document.branch = self.branch
    #     for row in currency_table:
    #       requested_qty = row.qty
    #       currency = row.currency
    #       purpose = self.transaction
    #       data = create_queue_request(currency, purpose)
    #       if data:
    #         for record in data:
    #             ir_name = record.get("name")
    #             ir_curr_code = record.get("currency_code")
    #             ir_curr = record.get("currency")
    #             ir_qty = record.get("qty")
    #             ir_queue_qty = record.get("queue_qty")
    #             ir_rate = record.get("rate")
    #             if ir_queue_qty <= 0:
    #                 continue
    #             document.append("booked_currency", {
    #                               "currency_code": ir_curr_code,
    #                               "currency": ir_curr,
    #                               "rate": ir_rate,
    #                               "qty": ir_queue_qty,
    #                               "interbank_reference": ir_name,
    #                               "request_reference":self.name,
    #                               "booking_qty": ir_queue_qty
    #                           })

    #       document.insert(ignore_permissions=True)
    #       frappe.msgprint("Booking Interbank document created successfully.")
    #     else:
    #         return
        
    def close_queue(self, currency, purpose, queue_type):
          frappe.msgprint("Get Queue...",purpose)
          sql = """
          select 
          qr.name,qr.creation,qr.branch,
          qrd.currency_code,
          qr.transaction,
          qrd.currency,qrd.qty,qr.type,
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
          queue = frappe.db.sql(sql,(currency, purpose, queue_type), as_dict=True)
          if not queue:
              return 
          print ("Queue after submit interbank  ***==========>",queue)
          document = frappe.new_doc("Booking Interbank")
          document.customer = self.customer
          document.type = self.transaction
          document.date = self.date
          document.user = self.user
          currency_table = self.interbank
          for row in currency_table:
              currency = row.currency
              purpose = self.transaction
              for r in queue:
                document.branch = r.get("branch")
                print ("\n\n Tow of queue**************",r)
                print ("**************",purpose , r.get("transaction"))
                print ("**************",queue_type , r.get("type"))
                print ("**************",currency , r.get("currency"))
                if r.get("currency") == currency and queue_type == r.get("type") and purpose == r.get("transaction"):
                    available_balance = r.get("qty")
                    if row.qty >= available_balance:    
                      print("Row is=======",r)
                      print("r.get currency ", r.get("currency"))
                      document.append("booked_currency", {
                                        "currency_code": r.get("currency_code"),
                                        "currency": r.get("currency"),
                                        "rate": row.rate,
                                        "qty": r.get("qty"),
                                        "booking_qty": r.get("qty"),
                                        "request_reference":r.get("request_interbank"),
                                        "interbank_reference":self.name
                                    })
                      new_available_balance = available_balance - row.qty
                      # Assuming there’s a field or method to update the queue balance
                      # self.update_queue_balance(r.get("name"), new_available_balance)

                      document.insert(ignore_permissions=True)
                      self.update_queue(document.booked_currency,queue)
                    else:
                        c =r.get("currency")
                        continue
                        # return frappe.throw(f"may {c}{currency}  Qty Queue greater than Interbank")
                else:
                    c =r.get("currency")
                    continue
                    # return frappe.throw(f"may currency{c}{currency} or transaction not matched")
          frappe.msgprint(f"Queue... Closed successfully Against {self.name}.")        
    def update_queue(self,booking_table,queue):
        for q in queue:
            queue_name = q.get("name")
            currency = q.get("currency")
            queue_qty = q.get("qty")
            queue_details = frappe.get_all(
                    "Queue Request Details",
                    fields=["name", "status", "qty", "currency", "parent"],
                    filters={"parent": queue_name, "currency": currency, "status":"Queue"},
                )
            for row in queue_details:
              detail_doc = frappe.get_doc("Queue Request Details", row.name)
              detail_doc.db_set("status", "Closed")
            ib_details = frappe.get_all(
                    "InterBank Details",
                    fields=["name", "status", "qty", "currency", "parent"],
                    filters={"parent": self.name, "currency": currency},
                )
            for row in ib_details:
                ib_detail_doc = frappe.get_doc("InterBank Details", row.name)
                ib_detail_doc.db_set("booking_qty", queue_qty)
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
        # self = json.loads(self)
        # doc = frappe.get_doc("InterBank", self.get("name"))
        # doc = self.name
        # return doc.name
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
        # self.insert()
        # doc.save()  
        # frappe.db.commit()
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