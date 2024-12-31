import frappe
from frappe.model.document import Document
from frappe.utils import flt
from frappe import _
from prompt_toolkit.widgets import (
    Box,
    Button,
    CheckboxList,
    Dialog,
    Label,
    ProgressBar,
    RadioList,
    TextArea,
    ValidationToolbar,
)
class Requestinterbank(Document):
    def on_submit(self):

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
                frappe.msgprint(f"Interbank {record.interbank_reference} qty: {item.booking_qty - record['booking_qty']} and updated booking quantity.")
        frappe.db.commit()

    @frappe.whitelist()
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
                        
                          

                      


                      # for record in data:
                      #     print("======>",record)
                  
                      #     ib_avaliable_qty = record.get(f"{record}")        
                      #     frappe.throw(f"Hello(2){ib_avaliable_qty} ???")
                 #################################
                 #################################
                 if row.qty <= interbank_balance:
                    
                    frappe.msgprint(f"Hello(3){row.qty} , first interbank balance {interbank_balance} ???")
                    document = frappe.new_doc("Booking Interbank")
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
                                frappe.msgprint(f"IB avalisblr Qty {available_qty} for {ib_curr} in {ib_name}")

                                if currency == ib_curr and ib_rate > 0:
                                    # Determine the quantity to book
                                    append_qty = min(available_qty, requested_qty)
                                    requested_qty -= append_qty
                                    frappe.msgprint(f"booked Qty: {ib_curr} ,in {ib_name} you append {append_qty}")
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
                    frappe.msgprint("Booking Interbank document created successfully.")
                    # Update InterBank Details and Parent Status
                    self.update_interbank_details(document.booked_currency, currency_table)
                 

    def update_interbank_details(self, booking_table, currency_table):
        result = []
        found_interbank = False
        print("fetchhhhhhhhhhhh",booking_table, currency_table)
        for row in booking_table:
            interbank_name = row.interbank_reference
            currency = row.currency
            booking_amount = row.booking_qty

            frappe.msgprint(f"Booking Qty: {booking_amount} for Currency: {currency} in {interbank_name}")

            if interbank_name:
                found_interbank = True

                # Fetch interbank details filtered by parent and currency
                interbank_details = frappe.get_list(
                    "InterBank Details",
                    fields=["name", "booking_qty", "qty", "currency", "parent"],
                    filters={"parent": interbank_name, "currency": currency},
                )

                for detail in interbank_details:
                    detail_doc = frappe.get_doc("InterBank Details", detail.name)
                    detail_doc.booking_qty = flt(detail_doc.booking_qty) + flt(booking_amount)
                    detail_doc.db_set("booking_qty", detail_doc.booking_qty)

                    interbank_doc = frappe.get_doc("InterBank", interbank_name)
                    print("detail_doc.qty == detail_doc.booking_qty", detail_doc.qty, detail_doc.booking_qty)
                    if detail_doc.qty == detail_doc.booking_qty:
                        interbank_doc.db_set("status", "Closed")
                        print("CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC")
                        # Mark items in the currency table as "Reserved"
                        for item in currency_table:
                            if item.currency == currency:
                                item.db_set("status", "Reserved")
                                print("Reservedddddddddddddddddddddddddddddddddddddd")
                            item.db_set("interbank_reference", interbank_name)
                            # else:
                            #     print("elseeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
                            #     item.db_set("interbank_reference", interbank_name)
                            #     print("interbank_name interbank_name interbank_name",interbank_name)
                    else:
                        interbank_doc.db_set("status", "Deal")
                        for item in currency_table:
                            if item.currency == currency:
                                print("yessssssssssssssssssssssssssssssssssssss",interbank_name)
                                item.db_set("interbank_reference", interbank_name)
                                print("Set interbank_reference for:", item.currency)
                    interbank_doc.save()

                    result.append({
                        "name": detail_doc.name,
                        "booking_qty": detail_doc.booking_qty,
                        "qty": detail_doc.qty,
                        "currency": detail_doc.currency,
                        "parent": detail_doc.parent,
                    })

        if not found_interbank:
            frappe.msgprint("No valid InterBank records were found.")
        else:
            frappe.msgprint("InterBank details updated successfully.")

        return result

@frappe.whitelist()
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
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
        ORDER BY ibd.creation ASC
        LIMIT 1;


      """
    return frappe.db.sql(sql,(currency, purpose ),as_dict=True)

# ----- if q for request < qty of IB ----
@frappe.whitelist()
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
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
        ORDER BY ibd.creation ASC
        LIMIT 1; """ 
    return frappe.db.sql(sql,(currency, purpose ),as_dict=True)

@frappe.whitelist()
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

@frappe.whitelist()
def handle_yes_action(self):
    """Server-side function that is triggered when the user clicks 'Yes'."""
    # Implement logic here that should happen when the user clicks "Yes"
    frappe.msgprint("You clicked 'Yes'. Creating an InterBank record...")


















import frappe
from frappe.desk.notifications import delete_notification_count_for, get_filters_for
import json
@frappe.whitelist()
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

