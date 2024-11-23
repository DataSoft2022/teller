from frappe import _

def get_data():
	return {
		"fieldname": "request_interbank",
		"non_standard_fieldnames": {"InterBank": "request_interbank_reference"},
		"transactions": [{"label": _("Link of Interbank"), "items": ["InterBank"]}],
	}
