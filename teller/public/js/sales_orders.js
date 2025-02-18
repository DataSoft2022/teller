frappe.ui.form.on('Sales Order', {
    refresh: function(frm) {
        frm.add_custom_button(__('Set To Inter Bank'), function() {
            // Prompt the user for the new rate
            const newRate = prompt("Enter the new rate for items:");

            if (newRate !== null && !isNaN(newRate)) {
                // Loop through each item in the Sales Order
                frm.doc.items.forEach(function(item) {

                    console.log(item)
                    console.log(item.rate)
                    // Set the new rate for each item
                    item.rate = parseFloat(newRate);
                    item.amount=item.qty*item.rate
                    console.log(item.rate)
                    console.log( item.amount)
                    var all_total=0
                    all_total+=item.amount
                 frm.doc.total=all_total


                });
                frm.refresh_fields();
            } else {
                frappe.msgprint("Invalid rate. Please enter a valid number.");
            }
        }, __("Inter Bank"));


    },


});


// frappe.ui.form.on('Sales Order', {
//     refresh: function(frm) {
//         frm.add_custom_button(__('Set To Inter Bank'), async function() {
//
//             for (const item of frm.doc.items) {
//                 try {
//
//                     const item_price_rate = await frappe.model.get_value("Item Price", {
//                         item_code: item.item_code,
//                         price_list: frm.doc.selling_price_list,
//                     }, "custom_inter_bank_rate");
//
//                     if (item_price_rate && item_price_rate.custom_inter_bank_rate) {
//                         item.rate = item_price_rate.custom_inter_bank_rate;
//                     } else {
//                         frappe.msgprint("Custom inter bank rate not found for item: " + item.item_name);
//                     }
//                 } catch (error) {
//                     console.error('Error fetching Item Price:', error);
//                     frappe.msgprint('An error occurred while fetching Item Price. Please try again.');
//                 }
//             }
//
//             frm.refresh_fields();
//         }, __("Inter Bank"));
//     }
// });
