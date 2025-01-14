// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt
/////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////Fetch Currency/////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////
function fetch (frm){
  if (frm.doc.interbank.length == 0){
          frm.call("get_currency").then((r) => {
            console.log(r.message);
            frm.refresh_field("interbank");
          });
  }
}
frappe.ui.form.on("InterBank", {
  refresh: function (frm) {
         
        console.log(frm.doc.type)
        frm.add_custom_button(__("Fetch your currency"), function () {
          if (frm.doc.__islocal &&frm.doc.docstatus == 0 ){
                console.log("__islocal")
                fetch(frm);

          }else{
            if (frm.doc.docstatus == 0){
              console.log("not __islocal")
              fetch(frm);
            }
      
          }
      
        });
      




  },
  // validate(frm){
  //   if (frm.doc.interbank.length == []){
  //     console.log("be fore save lenght table is",frm.doc.interbank.length)
  //     frappe.throw("Table is Empty")
  //     cur_frm.disable_save();

  //   }
  // },
  
});
/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////
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
///////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////// Remaining Calculation /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////
frappe.ui.form.on("InterBank", {
  refresh(frm){
          let table = frm.doc.interbank;
          for (let row of table) {
            row.remaining =  row.qty - row.booking_qty
            console.log("zzzz3",row.remaining)
            if (row.amount && row.booking_qty) {
              row.remaining =  row.qty - row.booking_qty
            }else{return}
          }
          frm.refresh_field("interbank");
  }
})
frappe.ui.form.on("InterBank Details", {
  qty(frm, cdt, cdn) {
    var d = locals[cdt][cdn];
    if (d.remaining === undefined || isNaN(d.remaining)) {
      d.remaining = 0;
        //   frappe.msgprint(" Remaining iz zero ");
    }
    frappe.model.set_value(
      cdt,
      cdn,
      "remaining",
      d.qty - d.booking_qty
    );
  },
  rate(frm, cdt, cdn) {
    var d = locals[cdt][cdn];
    if (d.remaining === undefined || isNaN(d.remaining)) {
      d.remaining = 0;
      //   frappe.msgprint(" Remaining iz zero ");
    }
  
    frappe.model.set_value(
      cdt,
      cdn,
      "remaining",
      d.qty - d.booking_qty
    );
    // if (d.remaining ===0){frappe.warn("Remaining is 0")}
    // else{
    //   return
    // }
    
  },
});
///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////
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

///////////////////////////////////////////////////////////////////////////////////////////////
// frappe.ui.form.on("InterBank", {
//   refresh(frm) {
//     // Loop through all rows in the child table 'interbank_details'
//     frm.doc.interbank.forEach(function(d) {
//       // Calculate the amount for each row
//       let amount = d.rate * d.qty;
//       // Set the value of the 'amount' field in the child table row
//       frappe.model.set_value(d.doctype, d.name, "amount", amount);
//       if(d.booking_qty === d.qty){
//         frappe.model.set_value(d.doctype, d.name, "status", "Closed");
//       }
//       if(d.amount !== "Open"){
//         // frm.set_value("status","Closed")
//         // wo = frappe.get_doc("InterBank", frm.doc.name)
//         // wo.ignore_validate_update_after_submit = True
//         // wo.db_set('docstatus', 0)
//       }
//     });
//     if(frm.doc.interbank.length>0){
//       let allClosed = frm.doc.interbank.every(d =>  d.status === "Closed" && d.qty === d.booking_qty);
//       console.log("All statuses are Closed:", allClosed);
//       if(allClosed){
//         frm.call("interbank_update_status").then((r) => {
//           console.log("process");
//           if (r && r.message) {
//             console.log("done", r.message);
  
//           }
//         });

//       }
//     }


//     // Refresh the field to reflect changes
//     frm.refresh_field("interbank_details");
//   }
// });

//////////////////////////////////InterBank Details Color nigtive///////////////

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
/////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////btn stop and resume///////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////
frappe.ui.form.on("InterBank", {
  refresh: function (frm) {
    if (frm.doc.docstatus == 1){
      let mood = frm.doc.status === "Deal" ? "Stop" : "Start";
      frm.add_custom_button(
        __(mood),
        function () {
          if (frm.doc.status === "Deal") {
            // Update the form to reflect the "Paused" state
            frappe.call({
              method: "frappe.client.set_value",
              args: {
                doctype: "InterBank",
                name: frm.doc.name,
                fieldname: "status",
                value: "Paused",
              },
              callback: function (r) {
                // r.message will contain the response from the server
                console.log(__('Updated: ') + r.message.value);
                cur_frm.refresh_field("status")
                cur_frm.reload_doc();
              },
            });
          } else if (frm.doc.status === "Paused") {
            // Update the form to reflect the "Deal" state
            frappe.call({
              method: "frappe.client.set_value",
              args: {
                doctype: "InterBank",
                name: frm.doc.name,
                fieldname: "status",
                value: "Deal",
              },
              callback: function (r) {
                // r.message will contain the response from the server
                console.log(__('Updated: ') + r.message.value);
                cur_frm.refresh_field("status")
                cur_frm.reload_doc();
              },
            });
          }
        }
      );
    }
  
  },
});

/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////// Cosed Status /////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////
frappe.ui.form.on("InterBank", {
  refresh: function (frm) {
    if(frm.doc.docstatus == 1){
      let all_closed = true;
      frm.doc.interbank.forEach((row)=>{
        if(row.status !== 'Closed'){
          all_closed = false;
          console.log("Not all Closed")
        }
  
      })
      if(all_closed && frm.doc.status !== "Closed"){
        frappe.call({
          method: "frappe.client.set_value",
          args: {
            doctype: "InterBank",
            name: frm.doc.name,
            fieldname: "status",
            value: "Closed",
          },
          freeze: true,
          callback: (r) => {
            console.log(" all Closed")
            // frappe.msgprint(__("Successfully Set Status"));
          },
        });
        // frm.set_value("status","Closed")
        // frm.save();
      }
    }
  
  }
});
/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////// Booking Precentage /////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////
frappe.ui.form.on("InterBank", {
  refresh(frm) {
    let total_percentage = 0;
    var table = frm .doc.interbank;
    table.forEach((item)=>{
      var percentage = item.booking_qty / item.qty
      console.log("Precentage :",percentage)
      frappe.model.set_value(item.doctype,item.name,"booking_precentage",percentage*100)
      total_percentage += percentage;
    })
    let average_percentage = table.length ? total_percentage / table.length : 0;
    console.log("average_percentage",average_percentage,total_percentage,table.length)

    // Set the average percentage to the parent field
    frm.set_value("booking_precentage", average_percentage );
  }});