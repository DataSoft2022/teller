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

                        # Mark items in the currency table as "Reserved"
                        for item in currency_table:
                            if item.currency == currency:
                                item.db_set("status", "Reserved")
                    else:
                        interbank_doc.db_set("status", "Submitted")

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
