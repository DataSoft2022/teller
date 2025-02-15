// frappe.ui.form.on("Update Currency Exchange", {
//   refresh: function (frm) {
//     // Add a custom button to fetch and display currency exchange records
//     frm.add_custom_button(__("Fetch Exchange Rates"), function () {
//       // fetch_exchange_rates(frm);
//       frm.call("set_currency_rates").then((r) => {
//         console.log(r.message);
//       });
//     });

//     // Make the child table editable
//     // frm.fields_dict.exchange_records.grid.only_sortable();
//   },

//   before_submit: function (frm) {
//     // Validate and prepare child table data before saving
//     frm.doc.exchange_records.forEach(function (row) {
//       // Perform any validation or additional logic if needed
//       if (
//         !row.exchange_name ||
//         !row.date ||
//         !row.from_currency ||
//         !row.to_currency ||
//         !row.purchase_exchange_rate
//       ) {
//         frappe.throw(
//           __("Please fill all mandatory fields in the exchange records.")
//         );
//       }
//     });

//     // Update the source doctype with changes from the child table
//     frm.doc.exchange_records.forEach(function (row) {
//       update_source_record(row);
//     });
//   },

//   // before_submit: function (frm) {
//   //   frappe.confirm(
//   //     __('Are you sure you want to submit and update the exchange records?'),
//   //     function() {
//   //       // On confirm, proceed with validation and updating source records
//   //       frm.doc.exchange_records.forEach(function (row) {
//   //         // Perform any validation or additional logic if needed
//   //         if (
//   //           !row.exchange_name ||
//   //           !row.date ||
//   //           !row.from_currency ||
//   //           !row.to_currency ||
//   //           !row.purchase_exchange_rate
//   //         ) {
//   //           frappe.throw(
//   //             __("Please fill all mandatory fields in the exchange records.")
//   //           );
//   //         }
//   //       });

//   //       // Update the source doctype with changes from the child table
//   //       frm.doc.exchange_records.forEach(function (row) {
//   //         update_source_record(row);
//   //       });

//   //       // If everything is valid, allow the form submission to proceed
//   //       frm.save();
//   //     },
//   //     function() {
//   //       // On cancel, do nothing
//   //       frappe.msgprint(__('Submission cancelled.'));
//   //     }
//   //   );
//   // }
// });



// function fetch_exchange_rates(frm) {
//   // Fetch and display records from Currency Exchange doctype
//   frappe.call({
//     method: "frappe.client.get_list",
//     args: {
//       doctype: "Currency Exchange",
//       fields: [
//         "name",
//         "date",
//         "from_currency",
//         "to_currency",
//         "exchange_rate",
//         "custom_selling_exchange_rate",
//       ],
//       limit: 20,
//     },
//     callback: function (response) {
//       if (response.message) {
//         // Clear existing table rows
//         frm.clear_table("exchange_records");

//         // Populate the table with fetched records
//         response.message.forEach(function (data) {
//           let row = frm.add_child("exchange_records");
//           row.exchange_name = data.name;
//           row.date = data.date;
//           row.from_currency = data.from_currency;
//           row.to_currency = data.to_currency;
//           row.purchase_exchange_rate = data.exchange_rate;
//           row.selling_exchange_rate = data.custom_selling_exchange_rate;
//         });

//         // Refresh the form to display the updated table
//         frm.refresh_field("exchange_records");
//       } else {
//         frappe.msgprint(__("No currency exchange records found."));
//       }
//     },
//     error: function (error) {
//       frappe.msgprint(__("Error fetching currency exchange records."));
//       console.error(error);
//     },
//   });
// }

// function update_source_record(row) {
//   // Update the source doctype record with changes from the child table
//   frappe.call({
//     method: "frappe.client.set_value",
//     args: {
//       doctype: "Currency Exchange",
//       name: row.exchange_name,
//       fieldname: {
//         date: row.date,
//         from_currency: row.from_currency,
//         to_currency: row.to_currency,
//         exchange_rate: row.purchase_exchange_rate,
//         custom_selling_exchange_rate: row.selling_exchange_rate,
//       },
//     },
//     callback: function (response) {
//       if (response.message) {
//         frappe.msgprint(__("Currency exchange record updated successfully."));
//       } else {
//         frappe.msgprint(__("Failed to update currency exchange record."));
//       }
//     },
//     error: function (error) {
//       frappe.msgprint(__("Error updating currency exchange record."));
//       console.error(error);
//     },
//   });
// }

// Client-Side Script for the Parent Doctype ("Update Currency Exchange")
frappe.ui.form.on("Update Currency Exchange", {
  refresh: function (frm) {
    // Add a custom button to fetch and display currency exchange records
    frm.add_custom_button(__("Fetch Exchange Rates"), function () {
      frm.call("set_currency_rates").then((r) => {
        console.log(r.message);
      });
    });
  },

  before_submit: function (frm) {
    // loop through the child table
  
    frm.doc.exchange_records.forEach(function (row) {
      // Check if purchase rate or selling rate was changed
      if (row.purchase_flag || row.sell_flag) {
        console.log("the methode is triggered");

        frm
          .call("update_currency", {
            from_currency: row.from_currency,
            purchase_rate: row.purchase_exchange_rate,
            selling_rate: row.selling_exchange_rate,
          })
          .then((r) => {
            console.log("Currency Exchange record created:", r.message);
          });
      }
    });
  },
});

frappe.ui.form.on("Exchange Records", {
  purchase_exchange_rate: function (frm, cdt, cdn) {
    var row = locals[cdt][cdn];
    // Flag to indicate this row has changes
    row.purchase_flag = true;
    frappe.msgprint("Purchase exchange rate changed.");
  },

  selling_exchange_rate: function (frm, cdt, cdn) {
    var row = locals[cdt][cdn];
    // Flag to indicate this row has changes
    row.sell_flag = true;
    frappe.msgprint("Selling exchange rate changed.");
  },
});
