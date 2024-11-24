// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt
// frappe.ui.form.on("Request Interbank", {
//   before_cancel: function (frm) {
//     console.log("heeeee trashhhhhhhhhhhhhh")
//       // frm.events.remove_booking(frm);
//   },
//   remove_booking: function (frm) {
//       frm.call({
//           method: "on_trash",
//           request_reference: frm.doc.name,
//           callback: function (r) {
//               if (r && r.message) {
//                   frappe.msgprint(__("Bookings Deleted: " + r.message));
//                   console.log("Deleted Bookings:", r.message);
//               } else {
//                   frappe.msgprint(__("No Bookings Found for Deletion."));
//               }
//           }
//       });
//   }
// });


// frappe.ui.form.on("Request interbank", {
//   refresh: function (frm) {
//     const method = "get_open_count";
//     frm.call({
//       type: "GET",
//       method: method,
//       args: {
//         doctype: frm.doctype,
//         name: frm.docname,
//         items: null, // Pass `null` or an array if no specific items are required
//       },
//       callback: function (r) {
//         if (r.message) {
//           // Update heatmap if timeline data exists
//           if (r.message.timeline_data) {
//             frm.dashboard.update_heatmap(r.message.timeline_data);
//           }

//           // Update badges with count data
//           if (r.message.count) {
//             frm.dashboard.update_badges(r.message.count);
//           }

//           // Store dashboard data
//           frm.dashboard_data = r.message;

//           // Trigger dashboard update
//           frm.trigger("dashboard_update");
//         } else {
//           frappe.msgprint(__("No data received from server."));
//         }
//       },
//       error: function (err) {
//         frappe.msgprint(__("Failed to fetch data. Please try again."));
//         console.error(err);
//       },
//     });
//   },
// });

frappe.ui.form.on("Request interbank", {
  on_submit: function (frm) {
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

frappe.ui.form.on("Interbank Request Details", {
  curency_code(frm, cdt, cdn) {
    setTimeout(() => {
      let row = locals[cdt][cdn];
      console.log("Triggered for row:", row.name, "Currency:", row.currency);

      // Make the server call
      frm.call({
          method: "avaliable_qty",
          args: {
              currency: row.currency,
          },
          callback: function (r) {
              if (r && r.message) {
                  console.log("Server Response:", r.message);

                  // Use setTimeout to delay the UI update slightly
            
                      frappe.model.set_value(cdt, cdn, "avaliable_qty", r.message[0].avaliable_qty || 0);
                      console.log("Updated available quantity:", r.message[0].avaliable_qty);
              
              } else {
                  frappe.msgprint(__(`No available interbank quantity for ${row.currency}`));
              }
          },
          error: function () {
              frappe.msgprint(__("Error fetching available quantity. Please try again."));
          },
      });
    }, 250); // Delay by 100 milliseconds
  },
});

frappe.ui.form.on('Interbank Request Details', {
	curency_code(frm, cdt, cdn) {
    var row = locals[cdt][cdn];
    // console.log("Row data:", row);

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