import frappe
from frappe.frappeclient import FrappeClient
# from frappe.utils import get_url
from frappe.utils.data import get_link_to_form, get_url
@frappe.whitelist()
def get_branch():
    try:
        conn = "http://192.168.1.16:8010"  
        username = frappe.conf.get("external_site_username", "Administrator")
        password = frappe.conf.get("external_site_password", "123456")
        print(username,password)
        server = FrappeClient(conn, username , password , verify=False)
        
        cairo_docs =[]
        doc_list = server.get_list('Request interbank', fields=['name'])
        for doc in doc_list:
            new_doc = frappe.get_doc({
                "doctype": "Request interbank",
                "name": doc.get("name"),

            })
            new_doc.insert(ignore_permissions=True)

        # cairo = server.insert_many(cairo_docs)

        frappe.log(f"Fetched documents: {len(doc_list)}")
        return doc_list
    except Exception as e:
        frappe.log_error(message=str(e), title="Error in get_branch")
        frappe.throw(f"Failed to fetch data: {e}")
