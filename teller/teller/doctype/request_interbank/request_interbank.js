// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt
frappe.ui.form.on('Request interbank', {
  // setup: function (frm) {
  //   deplicated = cur_frm.is_dirty();
  //   n = cur_frm.is_new();
  //    console.log(typeof(deplicated));
  //    if (deplicated === true){
  //      console.log('frm is',deplicated)
  //    } 
  //    if (n === 1){
  //     console.log('frm is',n)
  //   } 
  // },
  refresh: function (frm,cdt, cdn) {
    let table = frm.doc.items;
    table.forEach(element => {
      console.log("Triggered(1) for row:",element.currency)
      setTimeout(() => {
        let row = locals[cdt][cdn];
        console.log("Triggered(2) for row:", row.name, "Currency:", row.currency);
  
        // Make the server call
        frm.call({
            method: "avaliable_ib_qty",
            args: {
                currency: element.currency,
                purpose:frm.doc.transaction,
            },
            callback: function (r) {
                if (r && r.message) {
                    console.log("Server Response:", r.message);
  
                    // Use setTimeout to delay the UI update slightly
              
                        // frappe.model.set_value(cdt, cdn, "avaliable_qty", r.message[0].avaliable_qty || 0);
                        
                        // console.log("Updated available quantity:", r.message[0].avaliable_qty);
                
                } else {
                    frappe.msgprint(__(`No available interbank quantity for ${row.currency}`));
                }
            },
            error: function () {
                frappe.msgprint(__("Error fetching available quantity. Please try again."));
            },
        });
      }, 250); // Delay by 100 milliseconds
      
    });
    // let row = locals[cdt][cdn];
    // console.log(row)
    // tabel = row.items
    // console.log("Triggered for row:", row.name, "Currency:", row.currency);
    // deplicated = cur_frm.is_dirty();
    // n = cur_frm.is_new();
    //  console.log(typeof(deplicated));
    //  if (deplicated === true){
    //    console.log('frm is',deplicated)
    //  } 
    //  if (n === 1){
    //   console.log('frm is',n)
    // } 
      // Add a custom button



// frappe client
// frappe client
// frappe client
// frappe client
// frappe client
// frappe client
// frappe client





      // frm.add_custom_button("Frappe Client", function () {
      //     frappe.call({
      //         method: "teller.get_branch_req_ib.get_branch",
      //         callback: function (r) {
      //             if (r && r.message) {
      //                 // Display fetched data
      //                 frappe.msgprint(__("Frappe Client Response: " , JSON.stringify(r.message)));
      //                 console.log("Response:", r.message);
      //             } else {
      //                 frappe.msgprint(__("No data fetched"));
      //             }
      //         }
      //     });
      // });
  }
});

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
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                  /////////////////////////////////////////////////////
                                  // this button create booking make Booing interbank //
                                  ////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// frappe.ui.form.on("Request interbank", {
//   refresh: function (frm) {
//     frm.add_custom_button('create booking',function(){
//       frm.events.create_booking(frm);
//     })
//       // let table = frm.doc.items;
    
//       // for (let row in table){
//       //   console.log("qty",row.qty)
//       //   if(row.qty > avaliable_qty){
//       //     frm.call({
//       //       method: "avaliable_qty",
//       //       currency: row.currency,
//       //       purpose:frm.doc.purpose,
//       //       callback: function (r) {
//       //           if (r && r.message) {
//       //               frappe.msgprint(__("Avaliable Qty is: " + r.message));
//       //               console.log("msg",r.message)
    
//       //           } else {
//       //               frappe.msgprint(__("Booking Not Created"));
//       //           }
//       //       }
//       //     });
//       //   }
//       // }
//       // frm.events.create_booking(frm);
//   },
//   create_booking: function (frm) {
//       // if (frm.doc.docstatus === 1) {
//           frm.call({
//               method: "create_booking",
//               doc: frm.doc,
//               callback: function (r) {
//                   if (r && r.message) {
//                       frappe.msgprint(__("Booking is Created: " + r.message));
//                       console.log("msg",r.message)

//                   } else {
//                       frappe.msgprint(__("Booking Not Created"));
//                   }
//               }
//           });
//       // }
//   }
// });
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////// (1) Get Avaliable Qty for currency Trigger is QTY///////////////////////////
////////////////// (1) Get Avaliable Qty for currency Trigger is QTY///////////////////////////
////////////////// (1) Get Avaliable Qty for currency Trigger is QTY///////////////////////////
frappe.ui.form.on("Interbank Request Details", {
  currency_code(frm, cdt, cdn) {
    console.log("KING FOR EVER1")
  
    // if (row.qty < row.avaliable_qty ||row.qty == row.avaliable_qty  ){
      setTimeout(() => {
        let row = locals[cdt][cdn];
        // console.log("Triggered(3) for row:", row.name, "Currency:", row.currency);
  
        // Make the server call
        frm.call({
            method: "avaliable_ib_qty",
            args: {
                currency: row.currency,
                purpose:frm.doc.transaction,
            },
            callback: function (r) {
                if (r && r.message) {
                    console.log("Server Response (avaliable_ib_qty):", r.message);
  
                    // Use setTimeout to delay the UI update slightly
                    frappe.model.set_value(cdt,cdn,'interbank_balance',r.message[0].qty)
                        // frappe.model.set_value(cdt, cdn, "avaliable_qty", r.message[0].avaliable_qty || 0);
                        
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
    // }

  },
  qty(frm,cdt,cdn){
    console.log("KING FOR EVER2")
    let row = locals[cdt][cdn];
    console.log("KING FOR EVER3")
    if(frm.doc.type =='Daily'){
        if(row.qty > row.interbank_balance || row.qty === 0){
          console.log("Type is",frm.doc.type)
          frappe.model.set_value(cdt,cdn,"qty",0)
          frappe.throw("Qty is Greater than Interbank Balance")
        }
  
    }

      setTimeout(() => {
        let row = locals[cdt][cdn];
        // Make the server call
        if(frm.doc.type =='Daily'){
          frm.call({
              method: "avaliable_qty",
              args: {
                  currency: row.currency,
                  purpose:frm.doc.transaction,
              },
              callback: function (r) {
                  if (r && r.message) {
                    console.log(" for all interbank available quantity:", r.message[0],row.qty );
                      // console.log("Server Response (avaliable_ib_qty):", r.message);
          
                      let avaliable = r.message[0].avaliable_qty;
                      if (avaliable && frm.doc.type === 'Daily'){
    //(1)                    
    //////////////////////////if there ara avalibe interbank get total avaliable qty for (currency,transaction)
                        if(row.qty > avaliable){
                        
                            frappe.db.get_single_value("Teller Setting","allow_queue_interbank").then((value) => {
                              console.log("allow_queue",value)
                                  if(value === 'ON'){

                          // frappe.confirm(`You Exceeded InterBank Balance ${row.interbank_balance} ${row.currency} .Do you want to Add Queue ${row.qty - avaliable} ${row.currency} ?`,
                            // () => {
    //(2)                          
    ///////////////////////// if there are more Q > A ////////////////////////////////////////////////
                              // frappe.model.set_value(cdt,cdn,'qty',avaliable)
                              frappe.model.set_value(cdt,cdn,'queue_qty',row.qty - avaliable)
                                console.log("queue_qty",row.qty - row.interbank_balance)
                                // action to perform if Yes is selected
                            // }, () => {
                              // frappe.model.set_value(cdt,cdn,'qty',row.interbank_balance)
                                // action to perform if No is selected
                            // })
                                  }
                            })
                        
                        }
    //(3)
    ///////////////////////// if there are more Q > A ////////////////////////////////////////////////

                          if(row.qty < avaliable){
                            // frm.call('avaliable_ib_qty').then((r)=>{
                            //   // r.response
                            //   console.log("Avaliabe for the first interbank : ",r.response)
                            // })
                            frm.call({
                              method: "avaliable_ib_qty",
                              args: {
                                  currency: row.currency,
                                  purpose:frm.doc.transaction,
                              },
                              callback: function (response) {
                                frappe.model.set_value(cdt,cdn,'interbank_balance',response.message[0].qty)
                                frappe.model.set_value(cdt,cdn,'interbank_balance',response.message[0].qty)
                                if(row.qty > row.interbank_balance){
                                  frappe.confirm(`you exceed the first interbank,You want to Continue`,
                                    ()=>{
                                      
                                      },
                                  ()=>{
                                    frappe.model.set_value(cdt,cdn,'qty',row.interbank_balance)
                                  })
                                }
                                frappe.model.set_value(cdt,cdn,'interbank_balance',response.message[0].qty)
                                console.log("Avaliabe for the first interbank : ",response.message[0].avaliable_qty)
                              }

                            })

                            
                          }
                      }else{
                        frappe.throw(__(`No Available InterBank ,for Opening Deal ${row.currency} Currency `));
                      }

              
                      // Use setTimeout to delay the UI update slightly
                      
                          // frappe.model.set_value(cdt, cdn, "avaliable_qty", r.message[0].avaliable_qty || 0);              
                  
                  } else {
                      frappe.msgprint(__(`No Available InterBank ,for Opening Deal ${row.currency} Currency `));
                  }
              },
              error: function () {
                  frappe.msgprint(__("Error fetching available quantity. Please try again."));
              },
          });
        }
      }, 250); // Delay by 100 milliseconds
      
      // if(row.avaliable_qty > 0){
      //   frappe.model.set_value(cdt, cdn, "remaining_qty", row.avaliable_qty - row.qty);
      // }
      // if(row.qty > row.avaliable_qty){
      //   frm.set_value('status','In Queue')
      //   // frappe.model.set_value(cdt, cdn, "qty", 0);
      //   // frappe.throw(__("Qty is greater than your avaliable"))
      //   cur_frm.refresh_fields('items');
      // }
      // if (row.qty > row.avaliable_qty ||row.qty == row.avaliable_qty  ){

      // }
    
  }
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
/////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////
frappe.ui.form.on('Request interbank', {
  transaction(frm) {
        var transaction = frm.doc.transaction;
        var type = frm.doc.type;
        // Clear the items table
        frappe.model.clear_table(frm.doc, "items");

        // Ensure the items table is empty before proceeding
        if (frm.doc.items.length === 0) {
            setTimeout(() => {
                frm.call({
                    method: "get_all_avaliale_currency",
                    args: { transaction,type },
                    callback: function (r) {
                        if (r && r.message && Array.isArray(r.message)) {
                            const data = r.message.filter(row => row && Object.values(row).some(value => value !== null));
                            
                            if (data.length > 0) {
                                data.forEach(row => {
                                    console.log("row y king",row)
                                    const child = frm.add_child("items");
                                    child.currency_code = row.currency_code;
                                    child.currency = row.currency;
                                    child.interbank_balance = row.qty;
                                    child.rate = row.rate;
                                    child.remaining = row.remaining;
                                });
                                frm.refresh_field("items");
                            } else {
                              cur_frm.set_value('items', []);
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
////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////Return Request Interbank ///////////////////////////
frappe.ui.form.on('Request interbank', {
  refresh:function(frm){
    if (frm.doc.docstatus === 1){
      frm.add_custom_button(__('Return Request'),function(){
        frm.call({
          method:"return_request",
          args: {
            doc: frm.doc,
          
        },
          callback:function(response){
          console.log("return request",response.message)
  
        }});
      })
    }
  
  }

})
//////////////////////////////////////fetch user and Customer///////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////
frappe.ui.form.on('Request interbank', {
	refresh(frm) {
		// your code here
			// your code here
		
		cur_frm.set_value('customer','البنك الاهلي');
    	let currentUser = frappe.session.logged_in_user;
    // 	let user = frappe.user_info().email;
			cur_frm.set_value('user',currentUser);
	}
})

//////////fetch cur depend on code in childtable Request interbank Details////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////


frappe.ui.form.on('Interbank Request Details', {
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
});
//// session fir user 
// frappe.ui.form.on("Request interbank", {
//   onload: function(frm) {
//     frm.save().then(()=>{
//             // Get the current time and set the session expiration time (10 seconds)
//       const current_time2 = new Date().toISOString().replace("T"," ").replace("Z"," ");
//       const current_time = new Date().toISOString();
//       console.log("url",window.location.href)
//       // const endtime = new Date(current_time.getTime() + 10000); 
//       frappe.call({
//         method: "teller.teller.doctype.request_interbank.request_interbank.open_session",
//         args: {
//           user: frappe.session.user,
//           current_time: current_time,
//           current_time2: current_time2,
//           url: window.location.href
//         },
//         callback: function(r) {
//           if (r.message) {
//             console.log(r.message)
//             // If access is denied, show message and redirect user after 10 seconds
//             frappe.msgprint(__(r.message));

//             // // Redirect user after 10 seconds
//             // setTimeout(() => {
//             //   window.location.href = "/app/request-interbank/view/list";  // Redirect to home after 10 seconds
//             // }, 50000); // 10 seconds in milliseconds
//           }
//         }
//       });
//     //  setInterval(function() {
//       // frappe.call({
//       //     method: "teller.teller.doctype.request_interbank.request_interbank.check_session_status",
//       //     args: {
//       //         user: frappe.session.user,
//       //         url :window.location.href,
            
//       //     },
//       //     callback: function(response) {
//       //         if (response.message === "Session Closed") {
//       //             console.log("Session closed automatically.");
//       //             frappe.msgprint("Your session has expired.");
//       //             frm.reload_doc();  // Refresh form to prevent further actions
//       //         }
//       //     }
//       // });
//       // }, 100000);
//       // if (!frm.doc.docstatus ===1){
        
//       // }
//       window.onpopstate = function(event) {
//         // closeSession();
//         frappe.throw(`please complete Request Interbank ${frm.doc.name}`)
//         event.preventDefault()
//       }
      
//     })

//   },

// onhide: function(frm) {
//   console.log("User left the form. Closing session...");
//   closeSession();
// }
//   });

//   // Function to close session manually
// function closeSession() {
//     frappe.call({
//         method: "teller.teller.doctype.request_interbank.request_interbank.close_session_on_exit",
//         args: {
//             user: frappe.session.user
//         },
//         callback: function(response) {
//             console.log("Session closed successfully.");
//         }
//     });
// }
// frappe.ui.form.on("Request interbank", {
// onload: function(frm) {
//   // Close session when user leaves the page
//   frappe.call({
//     method: "teller.teller.doctype.request_interbank.request_interbank.validate_session",
//     args: {
//       user: frm.doc.user
//     }
//   });
// }
// });
