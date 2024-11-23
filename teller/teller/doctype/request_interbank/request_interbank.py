import frappe
from frappe.model.document import Document
from frappe.utils import flt

class Requestinterbank(Document):
    @frappe.whitelist()
    def create_booking(self):
        currency_table = self.items

        # Create a new DOCTYPE Booking Interbank
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

                # frappe.msgprint(f"Processing Currency: {currency}, Qty Requested: {requested_qty}")

                if requested_qty:
                    # Fetch interbank details for the specific currency
                    data = get_interbank(currency=currency)
                    
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
                        # frappe.msgprint(f"Available Qty: {available_qty} for {ib_curr} in {ib_name}")

                        if currency == ib_curr and ib_rate > 0:
                            # Determine the quantity to book
                            append_qty = min(available_qty, requested_qty)
                            requested_qty -= append_qty

                            # Append booking details to the document
                            document.append("booked_currency", {
                                "currency_code": ib_curr_code,
                                "currency": ib_curr,
                                "rate": ib_rate,
                                "qty": append_qty,
                                "interbank": ib_name,
                                "booking_qty": append_qty
                            })

                            if requested_qty <= 0:
                                break

        if not document.booked_currency:
            frappe.msgprint("No bookings were created due to insufficient quantities.")
            return

        document.insert()
        frappe.msgprint("Booking Interbank document created successfully.")

        # Update InterBank Details and Parent Status
        self.update_interbank_details(document.booked_currency, currency_table)

    def update_interbank_details(self, booking_table, currency_table):
        result = []
        found_interbank = False

        for row in booking_table:
            interbank_name = row.interbank
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
                    if detail_doc.qty == detail_doc.booking_qty:
                        # interbank_doc.db_set("status", "Closed")
                        print("CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC")
                        # Mark items in the currency table as "Reserved"
                        for item in currency_table:
                            if item.currency == currency:
                                item.db_set("status", "Reserved")
                                print("Reservedddddddddddddddddddddddddddddddddddddd")
                                item.db_set("interbank_reference", interbank_name)
                            else:
                                print("elseeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
                                item.db_set("interbank_reference", interbank_name)
                    else:
                        for item in currency_table:
                            interbank_doc.db_set("status", "Submitted")
                            print("yessssssssssssssssssssssssssssssssssssss")
                            item.db_set("interbank_reference", interbank_name)
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
def get_interbank(currency):
    sql = """
        SELECT 
            ib.name, 
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
        AND ib.status != 'Closed'
        AND ibd.status != 'Closed'
        ORDER BY ibd.creation ASC
    """
    return frappe.db.sql(sql, (currency,), as_dict=True)





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

