// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Request interbank", {
  after_save: function (frm) {
      frm.events.create_booking(frm);
  },
  create_booking: function (frm) {
      // if (frm.doc.docstatus === 1) {
          frm.call({
              method: "create_booking",
              doc: frm.doc,
              callback: function (r) {
                  if (r && r.message) {
                      frappe.msgprint(__("Booking is Created: " + r.message));
                      console.log("msg",r.message)

                  } else {
                      frappe.msgprint(__("Booking Not Created"));
                  }
              }
          });
      // }
  }
});
frappe.ui.form.on('Interbank Request Details', {
	curency_code(frm, cdt, cdn) {
    var row = locals[cdt][cdn];
    console.log("Row data:", row);

    // Fetch Currency records based on custom_currency_code
    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Currency",
        fields: ["name", "custom_currency_code"],
        filters: [["custom_currency_code", "=", row.curency_code]],
      },
      callback: function (response) {
        let currencies = response.message || [];
        console.log("Fetched currencies:", currencies);

        // Assuming you need to update something based on these currencies
        if (currencies.length > 0) {
          // Update the form field with the first currency's details as an example
          let currency = currencies[0]; // Take the first matched currency
          console.log("Selected currency:", currency);

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