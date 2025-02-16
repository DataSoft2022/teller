// Copyright (c) 2025, Ahmed Reda  and contributors
// For license information, please see license.txt

frappe.ui.form.on("Close Shift For Branch", {
  setup(frm) {
    // Hide fields initially
    frm.toggle_display(['start_date', 'serial'], false);

    // Set query for open_shift to only show active shifts that haven't been closed
    frm.set_query("open_shift", function() {
      return {
        query: "teller.teller_customization.doctype.close_shift_for_branch.close_shift_for_branch.get_unclosed_shifts"
      };
    });

    frappe.call({
      method:
        "teller.teller_customization.doctype.close_shift_for_branch.close_shift_for_branch.get_active_shift",
      callback: function (r) {
        console.log(r.message);
        frm.set_value("open_shift", r.message);
      },
    });
  },
  open_shift: function(frm) {
    if (frm.doc.open_shift) {
      frappe.call({
        method: "teller.teller_customization.doctype.close_shift_for_branch.close_shift_for_branch.get_shift_details",
        args: {
          "shift": frm.doc.open_shift
        },
        callback: function(r) {
          if (r.message) {
            // Show start_date field when open_shift is selected
            frm.toggle_display('start_date', true);
            
            // Set the values from open shift
            frm.set_value('start_date', r.message.start_date);
            frm.set_value('shift_employee', r.message.current_user);
            frm.set_value('branch', r.message.branch);
            
            // Trigger validation which will fetch invoices
            frm.save();
          }
        }
      });
    } else {
      // Hide and clear fields when open_shift is cleared
      frm.toggle_display('start_date', false);
      frm.set_value('start_date', '');
      frm.set_value('shift_employee', '');
      frm.set_value('branch', '');
    }
  },
  serial: (frm) => {
    frappe.call({
      doc: frm.doc,
      method: "call_from_class",
      callback: (r) => {
        console.log(r.message);
      },
    });
  },
  get_all_invoices(frm) {
    if (!frm.doc.open_shift) {
      frappe.throw(__("Please select an Open Shift first"));
      return;
    }

    // Check if the shift is already closed
    frappe.db.get_value("Open Shift for Branch", frm.doc.open_shift, "shift_status", (r) => {
      if (r && r.shift_status !== "Active") {
        frappe.throw(__("This shift is already closed. Cannot fetch invoices."));
        return;
      }

      console.log("Current open shift:", frm.doc.open_shift);

      // Call both methods directly
      frappe.call({
        method: "teller.teller_customization.doctype.close_shift_for_branch.close_shift_for_branch.get_purchase_invoices",
        args: {
          current_open_shift: frm.doc.open_shift
        },
        callback: function(r) {
          if (!r.exc) {  // Only process if no exception
            console.log("Purchase response:", r);
            if (r.message) {
              console.log("Purchase transactions:", r.message);
              frm.clear_table("purchase_close_table");
              let total_purchases = 0;

              r.message.forEach(trans => {
                console.log("Processing purchase transaction:", trans);
                frm.add_child("purchase_close_table", {
                  reference: trans.name,
                  posting_date: trans.posting_date,
                  client: trans.buyer,
                  receipt_number: trans.purchase_receipt_number,
                  movement_no: trans.movement_number,
                  currency_code: trans.currency_name,  // Use currency_name instead of currency_code
                  total: trans.quantity,
                  total_amount: trans.quantity,
                  total_egy: trans.egy_amount
                });
                total_purchases += flt(trans.egy_amount);
              });

              console.log("Total purchases:", total_purchases);
              frm.refresh_field("purchase_close_table");
              frm.set_value("total_purchase", `EGP ${format_currency(total_purchases)}`);
            } else {
              console.log("No purchase transactions found");
            }
          }
        },
        error: function(r) {
          // Handle any errors gracefully
          console.error("Error fetching purchase transactions:", r);
          frappe.msgprint({
            title: __("Error"),
            indicator: "red",
            message: __("Failed to fetch purchase transactions. Please try again.")
          });
        }
      });

      frappe.call({
        method: "teller.teller_customization.doctype.close_shift_for_branch.close_shift_for_branch.get_sales_invoice",
        args: {
          current_open_shift: frm.doc.open_shift
        },
        callback: function(r) {
          if (!r.exc) {  // Only process if no exception
            if (r.message) {
              frm.clear_table("sales_invoice");
              let total_sales = 0;

              r.message.forEach(invoice => {
                if (!invoice.is_returned) {
                  invoice.teller_invoice_details.forEach(detail => {
                    // Get currency name from the currency code
                    frappe.db.get_value("Currency", {"custom_currency_code": detail.currency_code}, "name", (result) => {
                      if (result && result.name) {
                        frm.add_child("sales_invoice", {
                          invoice: invoice.name,
                          posting_date: invoice.posting_date,
                          client: invoice.client,
                          receipt_no: invoice.receipt_number,
                          movement_no: invoice.movement_number,
                          currency_code: result.name,  // Use the actual currency name
                          total: detail.quantity,
                          total_amount: detail.quantity,
                          total_egy: detail.egy_amount
                        });
                        total_sales += flt(detail.egy_amount);
                        frm.refresh_field("sales_invoice");
                        frm.set_value("total_sales", `EGP ${format_currency(total_sales)}`);
                      }
                    });
                  });
                }
              });
            }
          }
        },
        error: function(r) {
          // Handle any errors gracefully
          console.error("Error fetching sales transactions:", r);
          frappe.msgprint({
            title: __("Error"),
            indicator: "red",
            message: __("Failed to fetch sales transactions. Please try again.")
          });
        }
      });
    });
  },
  refresh: function(frm) {
    // Add refresh handlers
  },
  validate: function(frm) {
    // Additional validation if needed
  }
});

// sql = """

// SELECT 
//     currency_code,
//     COALESCE(sum_purchase, 0) - COALESCE(sum_invoice, 0) AS balance
// FROM (
//     -- Sum from Teller Purchase
//     SELECT 
//         tpc.currency_code, 
//         SUM(tpc.total_amount) AS sum_purchase,
//         NULL AS sum_invoice
//     FROM `tabTeller Purchase` tp
//     LEFT JOIN `tabTeller Purchase Child` tpc ON tp.name = tpc.parent
//     WHERE tp.shift = 'Open Shift Branch_0007'
//     GROUP BY tpc.currency_code

//     UNION 

//     -- Sum from Teller Invoice
//     SELECT 
//         tid.currency_code, 
//         NULL AS sum_purchase,
//         SUM(tid.total_amount) AS sum_invoice
//     FROM `tabTeller Invoice` ti
//     LEFT JOIN `tabTeller Invoice Details` tid ON ti.name = tid.parent
//     WHERE ti.shift = 'Open Shift Branch_0007'
//     GROUP BY tid.currency_code
// ) combined
// GROUP BY currency_code;
// """