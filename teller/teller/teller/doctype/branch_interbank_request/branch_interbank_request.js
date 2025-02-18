// Copyright (c) 2025, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Branch Interbank Request", {
  transaction(frm) {
    var transaction = frm.doc.transaction;
    console.log(transaction)

    // Clear the branch_request_details table
    frappe.model.clear_table(frm.doc, "branch_request_details");

    // Ensure the branch_request_details table is empty before proceeding
    if (frm.doc.branch_request_details.length === 0) {
        setTimeout(() => {
            frm.call({
                method: "get_all_avaliale_currency",
                args: { transaction },
                callback: function (r) {
                    if (r && r.message && Array.isArray(r.message)) {
                        console.log(r.message)
                        const data = r.message.filter(row => row && Object.values(row).some(value => value !== null));
                        
                        if (data.length > 0) {
                            data.forEach(row => {
                                console.log("row y king",row)
                                const child = frm.add_child("branch_request_details");
                                child.currency_code = row.currency_code;
                                child.currency = row.currency;
                                child.interbank_balance = row.qty;
                                child.rate = row.rate;
                                child.remaining = row.remaining;
                            });
                            frm.refresh_field("branch_request_details");
                        } else {
                          cur_frm.set_value('branch_request_details', []);
                            frappe.msgprint(__("No available interbank quantities found."));
                        }
                    } else {
                        frappe.msgprint(__("No data returned from the server."));
                    }
                },
                error: function () {
                    frappe.msgprint(__("Error fetching available quantities. Please try again."));
                },
            });
        }, 250); // Delay for smoother user experience
    }
  }

  
});
frappe.ui.form.on('Branch Request Details', {
    currency_code(frm, cdt, cdn) {
    var row = locals[cdt][cdn];
    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Currency",
        fields: ["name", "custom_currency_code"],
        filters: [["custom_currency_code", "=", row.currency_code]],
      },
      callback: function (response) {
        let currencies = response.message || [];
        // console.log("Fetched currencies:", currencies);

        // Assuming you need to update something based on these currencies
        if (currencies.length > 0) {
          // Update the form field with the first currency's details as an example
          let currency = currencies[0]; // Take the first matched currency
          // console.log("Selected currency:", currency);

          // Example: Update a field in the current row
          frappe.model.set_value(cdt, cdn, "currency", currency.name);

          // Optionally, you can set additional fields if needed
          // frappe.model.set_value(cdt, cdn, "another_field", currency.another_field);
        } else {
          console.log("No matching currencies found.");
        }
      },
    });
  },

})
//////////////////////////////////////fetch user and Customer///////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////
frappe.ui.form.on('Branch Interbank Request', {
	refresh(frm) {
		// your code here
			// your code here
		
		cur_frm.set_value('customer','البنك الاهلي');
    	let currentUser = frappe.session.logged_in_user;
    // 	let user = frappe.user_info().email;
			cur_frm.set_value('user',currentUser);
	}
})