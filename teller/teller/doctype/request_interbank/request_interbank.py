import frappe
from frappe.model.document import Document
from frappe.utils import flt
from frappe import _
from frappe import whitelist
class Requestinterbank(Document):
    def on_submit(self):
        if not self.items:
            frappe.throw("Table is Empty")
        for row in self.items:
            if not row.qty or row.qty == 0:
                frappe.throw(f" Row {row.idx}# can't be rate {row.qty}")
        # self.create_queue()
        self.create_booking()
        
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
            # frappe.msgprint(f" Do you want to cancel")
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
                print(f"Currency {currency} Total {total_ib} ")
                ib_balance_qty = ib_qty - ib_booking_qty
                if requested_qty <= total_ib:
                  if ib_balance_qty > 0:
                    if requested_qty <= ib_balance_qty:
                      # Determine how much can be booked
                      append_qty = min(ib_balance_qty, requested_qty)
                      requested_qty -= append_qty
                      total_ib -= append_qty
                      # frappe.msgprint(f"\n\n\n!! {append_qty}")    
                      # frappe.msgprint(f"\n\n\n@@ {append_qty}")
                      bookings.append({
                          "currency_code": currency_code,
                          "currency": currency,
                          "rate": ib_rate,
                          "qty": append_qty,
                          "interbank_reference": ib_name,
                          "request_reference": self.name,
                          "booking_qty": append_qty
                      })
                      # frappe.msgprint(f"Booked {append_qty} of {currency} from interbank {ib_name}.")

                if total_ib < requested_qty:
                  if ib_balance_qty > 0:

                    append_qty = min(ib_balance_qty, requested_qty)
                    requested_qty -= append_qty
                    total_ib -= append_qty
                    print(f"\n\n\n\n => Currency {currency} Append {append_qty} from {ib_name}")
                    # frappe.throw("Good")
                    bookings.append({
                          "currency_code": currency_code,
                          "currency": currency,
                          "rate": ib_rate,
                          "qty": append_qty,
                          "interbank_reference": ib_name,
                          "request_reference": self.name,
                          "booking_qty": append_qty
                      })
                  else:
                    if requested_qty > 0:
                      if currency not in queued_qty:
                          queued_qty[currency] = 0
                      queued_qty[currency] += requested_qty
                      frappe.msprint(f"make Queue....")  
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
                # frappe.msgprint(f"Total IB {total_ib}  requested qty {requested_qty}.")
                requested_qty = process_interbank_booking(total_ib, currency, purpose, requested_qty, document)
            else:
                # frappe.msgprint(f"Holiday ")
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
        # frappe.msgprint("Create Queue Function ...")
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
              # frappe.msgprint(f"Queue Request is Created {queue_doc.name}") 

          else:
              return     
        except Exception:
             frappe.throw("Failed ")                

    def update_interbank_details(self, booking_table, currency_table):
        result = []
        found_interbank = False
        # print("fetchhhhhhhhhhhh",booking_table, currency_table)
        for row in booking_table:
            interbank_name = row.interbank_reference
            currency = row.currency
            booking_amount = row.booking_qty

            # frappe.msgprint(f"Booking Qty: {booking_amount} for Currency: {currency} in {interbank_name}")

            if interbank_name:
                found_interbank = True
                # ignore_permissions=True,
                # Fetch interbank details filtered by parent and currency
                interbank_details = frappe.db.get_all(
                    "InterBank Details",
                    fields=["name", "booking_qty", "qty", "currency", "parent"],
                    filters={"parent": interbank_name, "currency": currency},
                    ignore_permissions=True
                )

                for detail in interbank_details:
                    interbank_doc = frappe.get_doc("InterBank", interbank_name)
                    detail_doc = frappe.get_doc("InterBank Details", detail.name)
                    # print("detail ======>",detail)
                    
                    ########################
                    # print("detail_doc ======>",detail_doc)
                    # print("booking_amount ======>",booking_amount)
                    # print("booking_qty ======>",detail_doc.get("booking_qty"))
                    ########################
                    qt_booked = detail_doc.get("booking_qty") + booking_amount
                    detail_doc.db_set("booking_qty", qt_booked,update_modified=True)
                    # print("booking_qty 22 ======>",detail_doc.get("booking_qty"))
                    if detail_doc.qty == detail_doc.booking_qty:
                        detail_doc.db_set("status", "Closed",update_modified=True)
                        # print("====> then Closed ",detail_doc.parent,detail_doc.status,detail_doc.booking_qty)
                        # Mark items in the currency table as "Reserved"
                        for item in currency_table:
                            if item.currency == currency:
                                item.db_set("status", "Reserved")
                    else:
                        interbank_doc = frappe.get_doc("InterBank", interbank_name)
                        interbank_doc.db_set("status", "Deal")
                        for item in currency_table:
                            if item.currency == currency:
                                print("yessssssssssssssssssssssssssssssssssssss",interbank_name)
        if not found_interbank:
            frappe.msgprint("No valid InterBank records were found.")
        else:
            frappe.msgprint("InterBank details updated successfully.")



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












import frappe
from frappe.desk.notifications import delete_notification_count_for, get_filters_for
import json
@frappe.whitelist(allow_guest=True)
@frappe.read_only()
def get_open_count(doctype: str, name: str, items=None):
    """Get count for internal and external links for given transactions.

    :param doctype: Reference DocType
    :param name: Reference Name
    :param items: Optional list of transactions (json/dict)
    """
    if frappe.flags.in_migrate or frappe.flags.in_install:
        return {"count": []}

    doc = frappe.get_doc(doctype, name)
    doc.check_permission()
    meta = doc.meta
    links = meta.get_dashboard_data()
    print("Linkkkkkkkkkkkk",links)
    # Compile all items in a list
    if items is None:
        items = []
        for group in links.transactions:
            items.extend(group.get("items"))
    elif not isinstance(items, list):
        try:
            items = json.loads(items)  # Safely parse items if it is not a list
        except (TypeError, json.JSONDecodeError):
            items = []  # Default to an empty list if parsing fails

    out = {
        "external_links_found": [],
        "internal_links_found": [],
    }

    for d in items:
        internal_link_for_doctype = links.get("internal_links", {}).get(d) or links.get(
            "internal_and_external_links", {}
        ).get(d)
        if internal_link_for_doctype:
            internal_links_data_for_d = get_internal_links(doc, internal_link_for_doctype, d)
            if internal_links_data_for_d["count"]:
                out["internal_links_found"].append(internal_links_data_for_d)
            else:
                try:
                    external_links_data_for_d = get_external_links(d, name, links)
                    out["external_links_found"].append(external_links_data_for_d)
                except Exception:
                    out["external_links_found"].append({"doctype": d, "open_count": 0, "count": 0})
        else:
            external_links_data_for_d = get_external_links(d, name, links)
            out["external_links_found"].append(external_links_data_for_d)

    out = {
        "count": out,
    }

    if not meta.custom:
        module = frappe.get_meta_module(doctype)
        if hasattr(module, "get_timeline_data"):
            out["timeline_data"] = module.get_timeline_data(doctype, name)

    return out



def get_internal_links(doc, link, link_doctype):
	names = []
	data = {"doctype": link_doctype}

	if isinstance(link, str):
		# get internal links in parent document
		value = doc.get(link)
		if value and value not in names:
			names.append(value)
	elif isinstance(link, list):
		# get internal links in child documents
		table_fieldname, link_fieldname = link
		for row in doc.get(table_fieldname) or []:
			value = row.get(link_fieldname)
			if value and value not in names:
				names.append(value)

	data["open_count"] = 0
	data["count"] = len(names)
	data["names"] = names

	return data


def get_external_links(doctype, name, links):
	filters = get_filters_for(doctype)
	fieldname = links.get("non_standard_fieldnames", {}).get(doctype, links.get("fieldname"))
	data = {"doctype": doctype}

	if filters:
		# get the fieldname for the current document
		# we only need open documents related to the current document
		filters[fieldname] = name
		total = len(
			frappe.get_all(
				doctype, fields="name", filters=filters, limit=100, distinct=True, ignore_ifnull=True
			)
		)
		data["open_count"] = total
	else:
		data["open_count"] = 0

	total = len(
		frappe.get_all(
			doctype, fields="name", filters={fieldname: name}, limit=100, distinct=True, ignore_ifnull=True
		)
	)
	data["count"] = total

	return data

