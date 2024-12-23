// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt
frappe.ui.form.on("InterBank", {
  send_mail: function (frm) {
    frm.set_value('status', 'On Sent');
    frm.save(); // Save the form to persist the change
  },
});
// frappe.ui.form.on("InterBank", {
//   onload: function (frm, cdt, cdn) {
//     frm.fields_dict["interbank"].grid.wrapper.on("change", function (e) {
//       update_row_colors(frm, cdt, cdn);
//     });
//   },

//   refresh: function (frm, cdt, cdn) {
//     update_row_colors(frm, cdt, cdn);
//   },
// });
// frappe.ui.form.on("InterBank", {
//   refresh: function (frm) {
//     // Ensure that the interbank table has at least one row
//     if (frm.fields_dict["interbank"].grid.grid_rows[0]) {
//       var tab = frm.fields_dict["interbank"].grid.grid_rows;
//       for (let row of tab) {
//         var amount = row.doc.amount;
//         var curr = row.doc.currency;
//         console.log("amount", amount);
//         if (amount < 0) {
//           // Add a CSS class to set the background color to red
//           $(row.row).css("color", "red");
//           frappe.msgprint(`Clear Amount  <span style="color: red;"> ${amount} </span>For <span style="color: red;"> Currency ${curr} </span>`)
//         } else {
//           $(row.row).css("color", "black");
//         }
//       }
//     }
//   },
// });

// function update_row_colors(frm, cdt, cdn) {
//   var d = locals[cdt][cdn];
//   frm.fields_dict["interbank"].grid.grid_rows.forEach((row) => {
//     console.log("amount", d.amount);
//     const rate = d.rate; // Replace 'rate' with the actual field name for the rate
//     if (rate < 0) {
//       row.wrapper.css("background-color", "#FF000A");
//     } else {
//       row.wrapper.css("background-color", ""); // Reset if rate >= 0
//     }
//   });
// }

// frappe.ui.form.on("InterBank", {
//   refresh: function (frm) {
//     // Check the field `is_save_disabled` to determine the state on refresh
//     if (frm.doc.custom_is_save_disabled) {
//       cur_frm.disable_save();
//     } else {
//       cur_frm.enable_save();
//     }

//     frm.add_custom_button(
//       __("Stop InterBank"),
//       function () {
//         // Disable the save button
//         cur_frm.disable_save();
//         // Update the field to persist the state
//         frm.set_value("custom_is_save_disabled", 1);
//         frm.save(); // Save the form to store the state
//       },
//       __("Setting")
//     );

//     frm.add_custom_button(
//       __("Start InterBank"),
//       function () {
//         // Enable the save button
//         cur_frm.enable_save();
//         // Update the field to persist the state
//         frm.set_value("custom_is_save_disabled", 0);
//         frm.save(); // Save the form to store the state
//       },
//       __("Setting")
//     );
//     frm.add_custom_button(
//       __("Go to  Special booking"),
//       function () {
//         frappe.set_route('List', 'Special price document');
//       },
//       __("Setting")
//     );
//   },
// });

frappe.ui.form.on("InterBank", {
  refresh: function (frm) {
    if (frm.doc.interbank.length == 0){

        console.log(frm.doc.type)
        frm.add_custom_button(__("Fetch your currency"), function () {
          if(frm.doc.type === 'Daily'){
            frm.save().then(function () {
                frm.call({
                  method:"get_currency",
                  args:{
                    self: frm.doc
                  },
                  callback:function(response){
                    console.log("fetch currency 2:",response.message)
                    let data = response.message;
                    // let table = frm.doc.interbank;
                    data.forEach(row => {
                      let child = frm.add_child('interbank');  
                      child.currency_code = row.custom_currency_code;  
                      child.currency = row.account_currency; 
                      child.qty = row.balance; 
                  });
                    // for(let row of data){
                    //   let child = frm.add_child('interbank',{
      
                    //   })
      
                    // }
                    frm.refresh_field("interbank");
                  }
                })
            })
          }
          if(frm.doc.type === 'Holiday'){
            console.log("HO",frm.doc.type)
              frm.save().then(function () {
                frm.call({
                  method:"get_currency",
                  args:{
                    self: frm.doc
                  },
                  callback:function(response){
                    console.log("fetch currency 3:",response.message)
                    let data = response.message;
                    // let table = frm.doc.interbank;
                    // table = []
                    data.forEach(row => {
                      let child = frm.add_child('interbank');  
                      child.currency_code = row.custom_currency_code;  
                      child.currency = row.account_currency; 
                      child.qty = ''; 
                  });
                    // for(let row of data){
                    //   let child = frm.add_child('interbank',{
      
                    //   })
      
                    // }
                    frm.refresh_field("interbank");
                  }
                })
              }
              )
              
          
        
          }
        });
      


    }

  },
});
// frappe.ui.form.on("InterBank", {
//   refresh: function (frm) {
//     frm.add_custom_button(__("Book Special Price"), function () {
//       frappe.warn(
//         "Are you sure you want to proceed?",
//         "Booking Special Price?",

//         // label: __("Yes"),
//         function () {
//           frm.call("create_special_price_document").then((r) => {
//             if (r && r.message) {
//               frappe.msgprint(
//                 __("Special price document created: ") + r.message
//               );
//               console.log("done", r.message);
//               cur_frm.save();
//             }
//           });
//         },
//         // label: __("No"),
//         "Continue",
//         true
//       );
//     });
//   },
// });
// frappe.ui.form.on("InterBank", {
// 	refresh(frm,cdt,cdn) {
//         var d = locals[cdt][cdn];
//         frm.fields_dict['interbank'].grid.get_field('currency').get_query = function(doc, cdt, cdn) {
//             // return {
//             //     filters: [
//             //         ['Currency', 'custom_currency_code', '=', d.custom_currency_code]
//             //     ]
//             // };
//             fr
//         };
// 	},
// });
// frappe.ui.form.on("InterBank", {
//   refresh: function (frm, cdt, cdn) {
//     frm.set_query("currency", "InterBank Details", function (doc, cdt, cdn) {
//       return {
//         filters: ["name", "!=", "EGP"],
//       };
//     });
//   },
// });
// frappe.ui.form.on("InterBank Details", {
//   custom_qty(frm, cdt, cdn) {
//     var d = locals[cdt][cdn];
//     console.log(d.remaining);
//     // if (d.remaining === 0) {
//     //   frappe.msgprint(" Remaining iz zero ");
//     // }
//     // frappe.model.set_value(
//     //   cdt,
//     //   cdn,
//     //   "remaining",
//     //   d.amount - d.rate * d.custom_qty
//     // );
//   },
//   rate(frm, cdt, cdn) {
//     var d = locals[cdt][cdn];
//     console.log("Dede", d.remaining);
//     frappe.model.set_value(
//       cdt,
//       cdn,
//       "remaining",
//       d.amount - d.rate * d.custom_qty
//     );
//     // if (d.remaining ===0){frappe.warn("Remaining is 0")}
//     // else{
//     //   return
//     // }
    
//   },
// });
// frappe.ui.form.on("InterBank", "refresh", function (frm) {
//   frm.fields_dict["InterBank Details"].grid.get_field("currency").get_query =
//     function (doc, cdt, cdn) {
//       var child = locals[cdt][cdn];
//       console.log(child);
//       return {
//         filters: [["name", "!=", "EGP"]],
//       };
//     };
// });
frappe.ui.form.on("InterBank", {
  refresh: function (frm) {
    frm.fields_dict["interbank"].grid.get_field("currency").get_query =
      function (doc, cdt, cdn) {
        return {
          filters: {
            name: ["!=", "EGP"],
          },
        };
      };
  },
});

frappe.ui.form.on("InterBank Details", {
  currency_code(frm, cdt, cdn) {
    var row = locals[cdt][cdn];
    // console.log("Row data:", row);

    // Fetch Currency records based on custom_currency_code
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
});
frappe.ui.form.on("InterBank", {
  refresh(frm) {
    // Loop through all rows in the child table 'interbank_details'
    frm.doc.interbank.forEach(function(d) {
      // Calculate the amount for each row
      let amount = d.rate * d.qty;
      // Set the value of the 'amount' field in the child table row
      frappe.model.set_value(d.doctype, d.name, "amount", amount);
      if(d.booking_qty === d.qty){
        frappe.model.set_value(d.doctype, d.name, "status", "Closed");
      }
      if(d.amount !== "Open"){
        // frm.set_value("status","Closed")
        // wo = frappe.get_doc("InterBank", frm.doc.name)
        // wo.ignore_validate_update_after_submit = True
        // wo.db_set('docstatus', 0)
      }
    });
    if(frm.doc.interbank.length>0){
      let allClosed = frm.doc.interbank.every(d =>  d.status === "Closed" && d.qty === d.booking_qty);
      console.log("All statuses are Closed:", allClosed);
      if(allClosed){
        frm.call("interbank_update_status").then((r) => {
          console.log("process");
          if (r && r.message) {
            console.log("done", r.message);
  
          }
        });

      }
    }


    // Refresh the field to reflect changes
    frm.refresh_field("interbank_details");
  }
});
