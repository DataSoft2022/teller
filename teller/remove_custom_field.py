import frappe

def remove_custom_field():
    """Remove the custom_type_of_payments field from Account doctype"""
    try:
        # Get the custom field if it exists
        if frappe.db.exists("Custom Field", {"dt": "Account", "fieldname": "custom_type_of_payments"}):
            custom_field = frappe.get_doc("Custom Field", {"dt": "Account", "fieldname": "custom_type_of_payments"})
            custom_field.delete()
            frappe.db.commit()
            print("Successfully removed custom_type_of_payments field")
        else:
            print("Field does not exist")
    except Exception as e:
        print(f"Error removing field: {str(e)}")

if __name__ == "__main__":
    remove_custom_field() 