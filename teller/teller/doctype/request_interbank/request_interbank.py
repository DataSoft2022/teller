import frappe
from frappe.model.document import Document
from frappe.utils import flt
from frappe import _
from frappe import whitelist
from teller.send_email import sendmail
from frappe.utils import now_datetime, add_to_date
import json
   
class Requestinterbank(Document):
    SESSION_KEY = "request_interbank_session"
    

    def on_submit(self):
        if not self.items:
            frappe.throw("Table is Empty")
        for row in self.items:
            if not row.qty or row.qty == 0:
                frappe.throw(f" Row {row.idx}# can't be rate {row.qty}")
        # self.create_queue()
        self.create_booking()
        frappe.db.set_value("Request Interbank Session", {"status": "Open","user":self.user}, "session_status", "Closed")

        
    def on_cancel(self):
        
        request_reference = self.name

        # Fetch linked Booking Interbank records
        booking_interbank_records = frappe.db.sql(
            """
            SELECT bi.name, bc.booking_qty, bc.currency,bc.interbank_reference 
            FROM `tabBooking Interbank` bi 
            LEFT JOIN `tabBooked Currency` bc ON bc.parent = bi.name 
            WHERE bc.request_reference = %s
            """,
            (request_reference,),
            as_dict=True
        )

        deleted_interbanks = []

        for record in booking_interbank_records:
            # Delete Booking Interbank record
            # frappe.delete_doc('Booking Interbank', record['name'], force=1)
            booking_interbank_doc = frappe.get_doc("Booking Interbank",record['name'])
            booking_interbank_doc.db_set("status","Cancelled")

            # frappe.msgprint(f"record issssssssssssssssssss {record['name']}")
            # Adjust quantities for the corresponding interbank reference
            booked__table = booking_interbank_doc.booked_currency
            for ib in booked__table:
                ib_name = ib.interbank_reference
                interbank_doc = frappe.get_doc("InterBank",ib_name)
                tb_interbank = interbank_doc.interbank
            #     print(f"inter {ib}")
                for item in tb_interbank:
                     if record['interbank_reference'] == ib_name:
                        if item.currency == record['currency']:
                            interbank_doc.db_set("status","Deal")
                            item.booking_qty -= record['booking_qty']
                            item.db_set("booking_qty", item.booking_qty)
                # frappe.msgprint(f"Interbank {record.interbank_reference} qty: {item.booking_qty - record['booking_qty']} and updated booking quantity.")
        # frappe.db.commit()

    def create_booking(self):
        currency_table = self.items
        if not currency_table:
            frappe.throw("There No booking. Please Add Table for Booking")
            # Helper function to handle interbank logic for booking
        #1........
        def process_interbank_booking_holiday(currency, purpose, requested_qty, document):
            interbanks = get_interbank_holiday(currency=currency, purpose=purpose)
            bookings = []
            idx = 0  
            while idx < len(interbanks):
                interbank =interbanks[idx]
                ib_name = interbank.get("name")
                ib_qty = interbank.get("qty")
                ib_currency= interbank.get("currency")
                currency_code = interbank.get("currency_code")
                ib_rate = interbank.get("rate")
                ib_booking_qty = interbank.get("booking_qty")

                # #(1)# caluclate  (ib_balance_qty) 
                # ib_balance_qty = ib_qty - ib_booking_qty
                # if ib_balance_qty > 0 and ib_remain > 0:
                #     if ib_balance_qty >= ib_remain:
                #         append_qty = ib_remain 
                #         ib_remain = 0 
                #     else:
                #         append_qty = ib_balance_qty 
                #         ib_remain -= append_qty  

                # Append the booking to the bookings list
                bookings.append({
                    "currency_code": currency_code,
                    "currency": currency,
                    "rate": ib_rate,
                    "qty": requested_qty,
                    "interbank_reference": ib_name,
                    "request_reference": self.name,
                    "booking_qty": requested_qty
                })
                print(f"Booked {requested_qty} of {currency} from interbank {ib_name}.")

                # If there's remaining quantity, add it to the queue
                # if ib_remain > 0:
                #     if currency not in queued_qty:
                #         queued_qty[currency] = 0  # Initialize if the currency is not yet in the dictionary
                #     queued_qty[currency] = ib_remain  # Update the remaining quantity for this currency

                
                idx += 1     
            for booking in bookings:
                print("bookingsssssssss",len(bookings))
                print("bookingsssssssss",bookings)
                document.append("booked_currency", booking)       
            return requested_qty

  
        #2 ...............
        # def process_interbank_booking(currency, purpose, requested_qty, document):
        #     interbanks = get_interbank(currency=currency, purpose=purpose)    
        #     ib_remain = requested_qty
        #     total_ib = sum([interbank.get("qty") - interbank.get("booking_qty") for interbank in interbanks])  
        #     bookings = []
        #     queued_qty = {}
        #     if self.type =='Daily':
        #        # Condition One: If requested quantity is greater than total available interbank quantity
        #       if requested_qty > total_ib:
        #           for interbank in interbanks:
        #               ib_balance_qty = interbank.get("qty") - interbank.get("booking_qty")
        #               if ib_balance_qty > 0:
        #                   if currency not in queued_qty:
        #                       queued_qty[currency] = 0  # Initialize if the currency is not yet in the dictionary
        #                   # Add the amount greater than ib_balance_qty to the queue
        #                   excess_qty = max(0, requested_qty - total_ib)
        #                   queued_qty[currency] += excess_qty
        #           return float(queued_qty.get(currency, 0))
        #       #(2)LOOP 
        #       idx = 0  # Initial index for the while loop
        #       total_ib = 0
        #       while idx < len(interbanks) and ib_remain >0 :
        #           interbank =interbanks[idx]
        #           ib_name = interbank.get("name")
        #           ib_qty = interbank.get("qty")
        #           ib_currency= interbank.get("currency")
        #           currency_code = interbank.get("currency_code")
        #           ib_rate = interbank.get("rate")
        #           ib_booking_qty = interbank.get("booking_qty")

        #           print("\n\n\n=========>",interbank)

        #           #(1)# caluclate  (ib_balance_qty) 
        #           ib_balance_qty = ib_qty - ib_booking_qty
        #           if ib_balance_qty > 0 and ib_remain > 0:
        #               if ib_balance_qty >= ib_remain:
        #                   append_qty = ib_remain 
        #                   ib_remain = 0 
        #               else:
        #                   append_qty = ib_balance_qty 
        #                   ib_remain -= append_qty  

        #               # Append the booking to the bookings list
        #               bookings.append({
        #                   "currency_code": currency_code,
        #                   "currency": currency,
        #                   "rate": ib_rate,
        #                   "qty": append_qty,
        #                   "interbank_reference": ib_name,
        #                   "request_reference": self.name,
        #                   "booking_qty": append_qty
        #               })
        #               print(f"Booked {append_qty} of {currency} from interbank {ib_name}.")

        #           # If there's remaining quantity, add it to the queue
        #           if ib_remain > 0:
        #               if currency not in queued_qty:
        #                   queued_qty[currency] = 0  # Initialize if the currency is not yet in the dictionary
        #               queued_qty[currency] = ib_remain  # Update the remaining quantity for this currency
                  
                  
        #           idx += 1     
        #       for booking in bookings:
        #           document.append("booked_currency", booking)   
        #       print("\n\n\nqueeeeeeeeeee ",queued_qty)     
        #       return float(queued_qty.get(currency, 0))
        # def process_interbank_booking(currency, purpose, requested_qty, document):
        #     interbanks = get_interbank(currency=currency, purpose=purpose)
        #     bookings = []
        #     queued_qty = {}

        #     if self.type == 'Daily':
        #         # Check if requested qty exceeds total available interbank quantity
        #         total_ib = sum([interbank.get("qty") - interbank.get("booking_qty") for interbank in interbanks])
                # print("\n\n\n\nTTT",total_ib)
                # for interbank in interbanks:
                #     ib_balance_qty = interbank.get("qty") - interbank.get("booking_qty")
                #     print("\n\n ib_balance_qty",ib_balance_qty)
                #     if ib_balance_qty > 0:
                #       if requested_qty > ib_balance_qty:
                #         # Determine how much can be booked
                #         append_qty = min(ib_balance_qty, requested_qty)
                #         requested_qty -= append_qty
                #         print("\n\n G",append_qty)
                #     if ib_balance_qty == 0 and requested_qty > 0:
                #         print("\n\n\n you should make Queue ...") 
          #####/////////////////////////////////////////////////////////////////////////////#####
                # if requested_qty > total_ib:
                #     for interbank in interbanks:
                #         ib_balance_qty = interbank.get("qty") - interbank.get("booking_qty")
                #         if ib_balance_qty > 0:
                #             if currency not in queued_qty:
                #                 queued_qty[currency] = 0
                #             excess_qty = max(0, requested_qty - total_ib)
                #             queued_qty[currency] += excess_qty
                #     return float(queued_qty.get(currency, 0))

                # Loop through interbanks to book the requested quantity
        def process_interbank_booking(total_ib, currency, purpose, requested_qty, document):
            interbanks = get_interbank(currency=currency, purpose=purpose)
            bookings = []
            queued_qty = {}
            idx = 0
            while idx < len(interbanks) and requested_qty > 0:
                interbank = interbanks[idx]
                # print(f"interbank :",interbank)
                ib_name = interbank.get("name")
                ib_qty = interbank.get("qty")
                ib_currency = interbank.get("currency")
                currency_code = interbank.get("currency_code")
                ib_rate = interbank.get("rate")
                ib_booking_qty = interbank.get("booking_qty")    
                # Calculate the available balance in the interbank
                    # (f"Currency {currency} Total {total_ib} ")
                ib_balance_qty = ib_qty - ib_booking_qty

                if ib_balance_qty > requested_qty:
                    print(f"\n\n\n  {requested_qty} < {ib_balance_qty}")    
                    # if float(requested_qty) > float(ib_balance_qty):
                    #   # Determine how much can be booked
                    append_qty = min(ib_balance_qty, requested_qty)
                    requested_qty -= append_qty
                    total_ib -= append_qty

                    bookings.append({
                        "currency_code": currency_code,
                        "currency": currency,
                        "rate": ib_rate,
                        "qty": append_qty,
                        "interbank_reference": ib_name,
                        "request_reference": self.name,
                        "booking_qty": append_qty
                    })
                    #   frappe.msgprint(f"Booked {append_qty} of {currency} from interbank {ib_name}.")
                    # if float(requested_qty) > float(ib_balance_qty):
                    #     append_qty = min(ib_balance_qty, requested_qty)
                    #     requested_qty -= append_qty
                    #     total_ib -= append_qty
                    #     bookings.append({
                    #         "currency_code": currency_code,
                    #         "currency": currency,
                    #         "rate": ib_rate,
                    #         "qty": append_qty,
                    #         "interbank_reference": ib_name,
                    #         "request_reference": self.name,
                    #         "booking_qty": append_qty
                    #     })  
                if ib_balance_qty == requested_qty:
                    print(f"\n\n\n  {requested_qty}={ib_balance_qty}")
                  # if ib_balance_qty > 0:
                    append_qty = min(ib_balance_qty, requested_qty)
                    requested_qty -= append_qty
                    total_ib -= append_qty
                  #   print(f"\n\n\n\n => Currency {currency} Append {append_qty} from {ib_name}")
                  #   # frappe.throw("Good")
                    bookings.append({
                          "currency_code": currency_code,
                          "currency": currency,
                          "rate": ib_rate,
                          "qty": append_qty,
                          "interbank_reference": ib_name,
                          "request_reference": self.name,
                          "booking_qty": append_qty
                      })
                  # else:
                  #   if requested_qty > 0:
                  #     if currency not in queued_qty:
                  #         queued_qty[currency] = 0
                  #     queued_qty[currency] += requested_qty
                  #     frappe.msprint(f"make Queue....")  
                if ib_balance_qty < requested_qty:
                    append_qty = min(ib_balance_qty, requested_qty)
                    requested_qty -= append_qty
                    total_ib -= append_qty
                    bookings.append({
                          "currency_code": currency_code,
                          "currency": currency,
                          "rate": ib_rate,
                          "qty": append_qty,
                          "interbank_reference": ib_name,
                          "request_reference": self.name,
                          "booking_qty": append_qty
                    })
                    # frappe.throw(f" {requested_qty} > {ib_balance_qty}")
                            
                idx += 1
            # Append bookings to the document3
            for booking in bookings:
                document.append("booked_currency", booking)

            return float(queued_qty.get(currency, 0))
        # Main booking logic
        # Create and insert the document
        document = frappe.new_doc("Booking Interbank")
        document.customer = self.customer
        document.transaction = self.transaction
        document.date = self.date
        document.time = self.time
        document.user = self.user
        document.branch = self.branch         
        for row in currency_table:
            requested_qty = row.qty
            if requested_qty > row.interbank_balance and self.type =='Daily':
                frappe.throw(f"Row {row.idx}: Requested Qty exceeds Interbank balance.")
            
            currency = row.currency
            purpose = self.transaction
            print(f"Currency: {currency}, Purpose: {purpose}, Requested Qty: {requested_qty}")
        
            # (1) Get available interbank quantity and total for the current currency/purpose
            available = avaliable_ib_qty(currency, purpose)
            available_ib = available[0].avaliable_qty if available else 0
            total = get_total(currency, purpose)
            # print("Total length ====>", len(total))

            total_ib = 0
            if isinstance(total, list) and total:
                total_ib = total[0].total
                # print(f"Total interbank quantity: {total_ib} type is {type(total_ib)}, requested Qty {requested_qty} ,{type(requested_qty)}")
            
            # (2) Validate if total_ib < requested_qty
            if self.type =='Daily':
                requested_qty = process_interbank_booking(total_ib, currency, purpose, requested_qty, document)
            else:
                requested_qty = process_interbank_booking_holiday(currency, purpose, requested_qty, document)
        document.insert(ignore_permissions=True)
        frappe.msgprint("Document inserted successfully.")
        
        # Update interbank details after successful booking
        self.update_interbank_details(document.booked_currency, currency_table)
        allow_queue = frappe.db.get_single_value("Teller Setting","allow_queue_interbank")
        print("\n\n\nallow_queue",allow_queue)
        if allow_queue == "ON":
            self.create_queue()
        return document

    def create_queue(self):
        table = self.items
        queue_table = [{"queue_qty": row.queue_qty, "currency_code": row.currency_code, "currency": row.currency} 
                       for row in table if row.queue_qty > 0]
        try:
          if len(queue_table)> 0:
              
              queue_doc= frappe.new_doc("Queue Request")
              queue_doc.status = 'Queue'
              queue_doc.transaction = self.transaction
              queue_doc.date = self.date
              queue_doc.time = self.time
              queue_doc.user = self.user
              queue_doc.branch = self.branch
              queue_doc.customer = self.customer
              for q in queue_table:
                  queue_doc.append("items",{
                      "currency_code":q.get("currency_code"),
                      "currency":q.get("currency"),
                      "qty":q.get("queue_qty"),
                      "status":"Queue",
                      "request_interbank":self.name
                  })
                  
              queue_doc.insert(ignore_permissions=True)  
              frappe.msgprint(f"Queue Request is Created {queue_doc.name}") 

          else:
              return     
        except Exception:
             frappe.throw("Failed ")                
  
    def update_interbank_details(self, booking_table, currency_table):
        result = []
        found_interbank = False
        for row in booking_table:
            interbank_name = row.interbank_reference
            currency = row.currency
            booking_amount = row.booking_qty

            if interbank_name:
                found_interbank = True
                # ignore_permissions=True,
                # Fetch interbank details filtered by parent and currency
                interbank_doc = frappe.get_doc("InterBank", interbank_name)
                interbank_details = frappe.db.get_all(
                    "InterBank Details",
                    fields=["currency","status","name", "booking_qty", "qty", "parent"],
                    filters={"parent": interbank_name, "currency": currency},
                    ignore_permissions=True
                )
                ###############################
                
                for detail in interbank_details:
                    detail_doc = frappe.get_doc("InterBank Details", detail.name)
                    qt_booked = detail_doc.get("booking_qty") + booking_amount
                    detail_doc.db_set("booking_qty", qt_booked)
                    sendmail(interbank_doc)

                    if detail_doc.qty == detail_doc.booking_qty:
                        detail_doc.db_set("status", "Closed",update_modified=True)
                        self.calculate_precent(interbank_name)
                        for item in currency_table:
                            if item.currency == currency:
                                item.db_set("status", "Reserved")
                        sendmail(interbank_doc)        
                    else:
                        interbank_doc.db_set("status", "Deal")
                        self.calculate_precent(interbank_name)
                        sendmail(interbank_doc)
        if not found_interbank:
            frappe.msgprint("No valid InterBank records were found.")
        else:
            frappe.msgprint("InterBank details updated successfully.")
    def calculate_precent(self, interbank_name):
        ib_type = frappe.get_doc("InterBank",interbank_name)
        if ib_type.get("type") == 'Daily':
            total_percentage = 0
            child = frappe.db.get_all(
                        "InterBank Details",
                        fields=["currency","status","name", "booking_qty", "qty", "parent"],
                        filters={"parent": interbank_name},
                        ignore_permissions=True
                    )
            count = len(child)
            for detail in child:
                detail_doc = frappe.get_doc("InterBank Details", detail.name)
                percentage = detail_doc.get("booking_qty") / detail_doc.get("qty")*100
                total_percentage +=percentage
                percentage_with_sign = f"{percentage}%"
                detail_doc.db_set("booking_precentage", percentage_with_sign)
            print(f" total percentage{total_percentage} ")
            print(f" length {count} ")    

            interbank_doc =frappe.get_doc("InterBank",interbank_name)
            interbank_doc.db_set("booking_precentage",f"{total_percentage/count}%")
  

@frappe.whitelist(allow_guest=True)
def avaliable_qty(currency, purpose):
    sql = """
        SELECT 
            ib.name, 
            ib.status,
            ibd.currency,
            ib.transaction,
            ibd.currency_code, 
            sum(ibd.qty), 
            sum(ibd.booking_qty),
            ibd.rate,
            ibd.creation,
            sum(ibd.qty) -  sum(ibd.booking_qty) as avaliable_qty
        FROM 
            `tabInterBank` ib 
        LEFT JOIN 
            `tabInterBank Details` ibd 
        ON 
            ibd.parent = ib.name
        WHERE 
            ibd.currency = %s
        AND ib.docstatus = 1
        AND ib.transaction = %s
        AND ib.status = 'Deal'
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
        ORDER BY ibd.creation ASC
        LIMIT 1;


      """
    return frappe.db.sql(sql,(currency, purpose ),as_dict=True)

# ----- if q for request < qty of IB ----
@frappe.whitelist(allow_guest=True)
def avaliable_ib_qty(currency, purpose):
    sql = """
      SELECT 
            ib.name, 
            ib.status,
            ibd.currency,
            ib.transaction,
            ibd.currency_code, 
            ibd.qty, 
            ibd.booking_qty,
            ibd.rate,
            ibd.creation,
            ibd.qty -  sum(ibd.booking_qty) as avaliable_qty
        FROM 
            `tabInterBank` ib 
        LEFT JOIN 
            `tabInterBank Details` ibd 
        ON 
            ibd.parent = ib.name
        WHERE 
            ibd.currency = %s
        AND ib.docstatus = 1
        AND ib.transaction = %s
        AND ib.status = 'Deal'
        AND ib.type = 'Daily'
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
        ORDER BY ibd.creation ASC
        LIMIT 1; """ 
    return frappe.db.sql(sql,(currency, purpose ),as_dict=True)

@frappe.whitelist(allow_guest=True)
def get_interbank(currency, purpose):
    sql = """
        SELECT 
            ib.name, 
             ib.type, 
            ib.transaction,
            ib.status,
            ibd.currency,
            ibd.currency_code, 
            ibd.qty, 
            ibd.booking_qty,
            ibd.rate,
            ibd.creation
        FROM 
            `tabInterBank` ib 
        LEFT JOIN 
            `tabInterBank Details` ibd 
        ON 
            ibd.parent = ib.name
        WHERE 
            ibd.currency = %s
        AND ib.docstatus = 1
        AND ib.transaction = %s
        AND ib.type = 'Daily'
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
        ORDER BY ibd.creation ASC
    """
    return frappe.db.sql(sql, (currency, purpose), as_dict=True)
@frappe.whitelist(allow_guest=True)
def get_interbank_holiday(currency, purpose):
    sql = """
        SELECT 
            ib.name, 
             ib.type, 
            ib.transaction,
            ib.status,
            ibd.currency,
            ibd.currency_code, 
            ibd.qty, 
            ibd.booking_qty,
            ibd.rate,
            ibd.creation
        FROM 
            `tabInterBank` ib 
        LEFT JOIN 
            `tabInterBank Details` ibd 
        ON 
            ibd.parent = ib.name
        WHERE 
            ibd.currency = %s
        AND ib.docstatus = 1
        AND ib.transaction = %s
        AND ib.type = 'Holiday'
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
        ORDER BY ibd.creation ASC

      """
    return frappe.db.sql(sql, (currency, purpose), as_dict=True)    
@frappe.whitelist(allow_guest=True)
def get_total(currency, purpose):
    sql="""
    SELECT 
            ib.name, 
             ib.type, 
            ib.transaction,
            ib.status,
            ibd.currency,
            ibd.currency_code, 
            sum(ibd.qty) AS total_qty, 
            ibd.booking_qty,
            ibd.rate,
            ibd.creation,
            sum( ibd.booking_qty)As total_booking_qty,
            sum( ibd.qty) - sum( ibd.booking_qty) AS total
            
        FROM 
            `tabInterBank` ib 
        LEFT JOIN 
            `tabInterBank Details` ibd 
        ON 
            ibd.parent = ib.name
        WHERE 
            ibd.currency = %s
        AND ib.docstatus = 1
        AND ib.transaction = %s
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
        ORDER BY ibd.creation ASC"""
    return frappe.db.sql(sql, (currency, purpose), as_dict=True)
#function get avaliable currency balance on click tranaction 
@frappe.whitelist(allow_guest=True)
def get_all_avaliale_currency(transaction,type):
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
        AND ib.type = %s
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
    
)
SELECT *
FROM LatestCurrency
WHERE row_num = 1
ORDER BY currency_code,creation ASC;  
 """
    data = frappe.db.sql(sql,(transaction,type ),as_dict=True)
    return data


@frappe.whitelist(allow_guest=True)
def return_request(doc):  
  request_ib = json.loads(doc)
  req_table = request_ib.get("items")
  return_request = frappe.new_doc("Return Request Interbank")
  return_request.transaction = request_ib.get("transaction")
  return_request.request_reference = request_ib.get("name") 
  return_request.user = request_ib.get("user")
  return_request.branch = request_ib.get("branch") 
  return_request.customer = request_ib.get("customer") 
  return_request.date = request_ib.get("date") 
  return_request.time = request_ib.get("time") 

  for item in req_table:
    return_request.append('items',{
        "currency_code":item.get("currency_code"),
        "currency":item.get("currency"),
        "request_qty":item.get("qty"),
        "status":item.get("status"),
        "interbank_balance":item.get("interbank_balance"),
        "queue_qty":item.get("queue_qty"),
    })
  return_request.insert(ignore_permissions=True)
  return return_request

# import frappe
# from frappe.utils import add_to_date, get_datetime
# from datetime import datetime, timezone
# from threading import Timer

# @frappe.whitelist()
# def open_session(user, current_time, current_time2,url):
#     """Check if a user is already using the session and if it has expired."""
#     obj_time = get_datetime(current_time)
#     end_time = add_to_date(obj_time, seconds=60)  # Session expires after 60 seconds
#     session_ended = False
#     # Check if an active session exists
#     active_sessions = frappe.get_all(
#         "Request Interbank Session",
#         filters={"session_status": "Open"},
#         fields=["name", "timestamp", "user"]
#     )

#     if not active_sessions:
#         session = frappe.get_doc({
#             "doctype": "Request Interbank Session",
#             "user": user,
#             "session_status": "Open",
#             "timestamp": current_time2,
#             "session_expiry": None,  # Expiry time will be set in close_session
#             "url":url
#         })
#         session.insert(ignore_permissions=True)  
#         session_name = session.name
#         frappe.msgprint(f"Created new session: {session_name}")

#         # Schedule session closure after returning session
#         # frappe.enqueue("teller.teller.doctype.request_interbank.request_interbank.close_session", session_name=session_name, end_time=end_time)
#         session_ended = True
#         return session  # Return session immediately

#     return session_ended

# @frappe.whitelist()
# def close_session(session_name, end_time):
#     """Close the session by updating the status and setting session expiry."""
#     try:
#         session = frappe.get_doc("Request Interbank Session", session_name)

#         # Only close if still open
#         if session.session_status == "Open":
#             session_expiry_time = end_time.strftime("%Y-%m-%d %H:%M:%S")
#             session.db_set("session_status", "Closed")
#             session.db_set("session_expiry", session_expiry_time)
#             frappe.msgprint(f"Closed session: {session_name}")

#         return session
#     except Exception as e:
#         frappe.log_error(f"Error closing session {session_name}: {str(e)}", "Session Close Error")

# @frappe.whitelist()
# def validate_session ():
#     active_sessions = frappe.get_all("Request Interbank Session", filters={"status": "Open"}, fields=["name", "timestamp", "user"])
#     if active_sessions:
#         frappe.throw(" there are active_sessions")

# @frappe.whitelist()
# def close_session_on_exit(user):
#     """Close active session when the user leaves the Request Interbank page."""
#     active_sessions = frappe.get_all(
#         "Request Interbank Session",
#         filters={"user": user, "session_status": "Open"},
#         fields=["name"]
#     )

#     for session in active_sessions:
#         session_doc = frappe.get_doc("Request Interbank Session", session["name"])
#         session_doc.db_set("session_status", "Closed")
#         session_doc.db_set("session_expiry", now_datetime())

#     return "Session closed"


# @frappe.whitelist()
# def check_session_status(user, url):
#     """Check if session should be closed (based on last activity and matching URL)."""
#     active_sessions = frappe.get_all(
#         "Request Interbank Session",
#         filters={"user": user, "session_status": "Open", "url": url},  # Ensure URL matches
#         fields=["name", "timestamp"]
#     )

#     if active_sessions:
#         # Get last session timestamp
#         session_doc = frappe.get_doc("Request Interbank Session", active_sessions[0]["name"])
#         time_difference = (now_datetime() - session_doc.timestamp).total_seconds()

#         # If session is inactive for more than 30 seconds, close it
#         if time_difference > 30:
#             close_session_on_exit(user)
#             return "Session Closed"

#     return "Session Active"
