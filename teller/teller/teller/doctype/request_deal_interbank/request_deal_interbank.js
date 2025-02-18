// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Request Deal interbank", {
	refresh(frm) {
		if (frm.doc.docstatus === 1) {
			frm.add_custom_button(__("Request interbank"), function () {
				frm.call("creat_request_interbank").then((r) => {
          if (r && r.message) {
            frappe.msgprint(
              __("Request interbank created: ") + r.message
            );
            console.log("done", r.message);
            cur_frm.save();
          }
        });
				
				// Set field values for the new document
			
			}, __("Create"));
		}
	},
});
