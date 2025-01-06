import frappe
from frappe.model.document import Document
from frappe.utils import flt
from frappe import _

class Requestinterbank(Document):
    def on_submit(self):
        self.create_queue()
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
            frappe.msgprint(f" Do you want to cancel")
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

    @frappe.whitelist(allow_guest=True)
    def create_booking(self):
        currency_table = self.items
        if not currency_table:
            frappe.throw("There No booking. Please Add Table for Booking")
            
        else: 
            # frappe.msgprint("Hello(1)???")
            for row in currency_table:
                 currency = row.currency
                 purpose = self.type
                 requested_qty = row.qty
                 print("currency and purpose",purpose,currency)
                 avaliable_ib = avaliable_ib_qty(currency, purpose)
                 interbank_balance = avaliable_ib[0].avaliable_qty
                 print("ib qty     is ==============",avaliable_ib[0].avaliable_qty)
            if row.qty > interbank_balance:
                print(" interbank_balance Nnonon=====",interbank_balance)
                print(" row.qtyrerer======",row.qty)
                # Get interbanks by first creation
                document = frappe.new_doc("Booking Interbank")
                
                document.customer = self.customer
                document.type = self.type
                document.date = self.date
                document.time = self.time
                document.user = self.user
                document.branch = self.branch
                interbanks = get_interbank(currency=currency, purpose=purpose)
                for interbank in interbanks:
                    ib_name = interbank.get("name")
                    ib_qty = interbank.get("qty")
                    ib_rate = interbank.get("rate")
                    ib_booking_qty = interbank.get("booking_qty")
                    ib_available_qty = interbank.get("qty") - interbank.get("booking_qty") 
                    append_qty = min(ib_available_qty, requested_qty)
                    requested_qty -= append_qty
                    document.append("booked_currency", {
                                      "currency_code": row.currency_code,
                                      "currency": row.currency,
                                      "rate": ib_rate,
                                      "qty": append_qty,
                                      "interbank_reference": ib_name,
                                      "request_reference":self.name,
                                      "booking_qty": append_qty
                                  })
                document.insert(ignore_permissions=True)
                self.update_interbank_details(document.booked_currency, currency_table)
                return document
                 #################################
                 #################################
            if row.qty <= interbank_balance:
              document = frappe.new_doc("Booking Interbank")
              # frappe.msgprint("yayay")
              document.customer = self.customer
              document.type = self.type
              document.date = self.date
              document.time = self.time
              document.user = self.user
              document.branch = self.branch
              for row in currency_table:
                  if row.status != 'Reserved':
                      requested_qty = row.qty
                      currency = row.currency
                      purpose = self.type
                      # frappe.msgprint(f"Processing Currency: {currency}, Qty Requested: {requested_qty}")
                      data = avaliable_ib_qty(currency=currency, purpose=purpose)
          #             print("data++++++++",data)
                      for record in data:
                          ib_name = record.get("name")
                          ib_curr_code = record.get("currency_code")
                          ib_curr = record.get("currency")
                          ib_qty = record.get("qty")
                          ib_rate = record.get("rate")
                          ib_booking_qty = record.get("booking_qty")

                          if ib_qty <= 0:
                              continue

                          available_qty = ib_qty - ib_booking_qty
                          # frappe.msgprint(f"IB avalisblr Qty {available_qty} for {ib_curr} in {ib_name}")

                          if currency == ib_curr and ib_rate > 0:
                              # Determine the quantity to book
                              append_qty = min(available_qty, requested_qty)
                              requested_qty -= append_qty
                              # frappe.msgprint(f"booked Qty: {ib_curr} ,in {ib_name} you append {append_qty}")
                              # Append booking details to the document
                              document.append("booked_currency", {
                                  "currency_code": ib_curr_code,
                                  "currency": ib_curr,
                                  "rate": ib_rate,
                                  "qty": append_qty,
                                  "interbank_reference": ib_name,
                                  "request_reference":self.name,
                                  "booking_qty": append_qty
                              })
                              self.status = 'Finish'
                              if requested_qty <= 0:
                                  break
              document.insert(ignore_permissions=True)
              # frappe.msgprint("Booking Interbank document created successfully.")
              # Update InterBank Details and Parent Status
              self.update_interbank_details(document.booked_currency, currency_table)
    def create_queue(self):
        table = self.items
        queue_table = [{"queue_qty": row.queue_qty, "currency_code": row.currency_code, "currency": row.currency} 
                       for row in table if row.queue_qty > 0]
        try:
          if len(queue_table)> 0:
              
              queue_doc= frappe.new_doc("Queue Request")
              queue_doc.status = 'Queue'
              queue_doc.type = self.type
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
        print("fetchhhhhhhhhhhh",booking_table, currency_table)
        for row in booking_table:
            interbank_name = row.interbank_reference
            currency = row.currency
            booking_amount = row.booking_qty

            # frappe.msgprint(f"Booking Qty: {booking_amount} for Currency: {currency} in {interbank_name}")

            if interbank_name:
                found_interbank = True
                # ignore_permissions=True,
                # Fetch interbank details filtered by parent and currency
                interbank_details = frappe.db.get_list(
                    "InterBank Details",
                    fields=["name", "booking_qty", "qty", "currency", "parent"],
                    filters={"parent": interbank_name, "currency": currency},
                    ignore_permissions=True
                )

                for detail in interbank_details:
                    interbank_doc = frappe.get_doc("InterBank", interbank_name)
                    detail_doc = frappe.get_doc("InterBank Details", detail.name)
                    print("detail ======>",detail)
                    
                    ########################
                    print("detail_doc ======>",detail_doc)
                    print("booking_amount ======>",booking_amount)
                    print("booking_qty ======>",detail_doc.get("booking_qty"))
                    ########################
                    qt_booked = detail_doc.get("booking_qty") + booking_amount
                    detail_doc.db_set("booking_qty", qt_booked,update_modified=True)
                    print("booking_qty 22 ======>",detail_doc.get("booking_qty"))
                    if detail_doc.qty == detail_doc.booking_qty:
                        detail_doc.db_set("status", "Closed",update_modified=True)
                        print("====> then Closed ",detail_doc.parent,detail_doc.status,detail_doc.booking_qty)
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
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
        ORDER BY ibd.creation ASC
    """
    return frappe.db.sql(sql, (currency, purpose), as_dict=True)

@frappe.whitelist(allow_guest=True)
def get_all_avaliale_currency(type):
    """Server-side function that is triggered when the user clicks 'Yes'."""
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
    ibd.qty - SUM(ibd.booking_qty) AS available_qty
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
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
GROUP BY 
    ib.name, 
    ib.status,
    ibd.currency,
    ib.transaction,
    ibd.currency_code, 
    ibd.qty, 
    ibd.booking_qty,
    ibd.rate,
    ibd.creation
Order by ibd.creation ASC;    
 """
    data = frappe.db.sql(sql,(type, ),as_dict=True)
    return data
















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

