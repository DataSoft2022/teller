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
  get_all_invoices(frm){
    if (!frm.doc.open_shift){
      frappe.throw("Select Open Shift")
    }
    frappe
    .call({
      method:
        "teller.teller_customization.doctype.close_shift.close_shift.get_sales_invoice",
      args: {
        current_open_shift: frm.doc.open_shift,
      },
    })
    .then((r) => {
      let total = 0;

      if (r.message) {
        frm.clear_table("sales_invoice");
        console.log(r.message);
        let invocies = r.message;
        console.log("S Invoice",invocies)
        // sales_invoice;
        invocies.forEach((invoice) => {
          frm.add_child("sales_invoice", {
            reference: invoice["name"],
            total: invoice["total"],
            client: invoice["client"],
            receipt_number: invoice["receipt_number"],
            // exceed: invoice["exceed"],
          });
          total += invoice["total"];
        });
        frm.refresh_field("sales_invoice");
        frm.set_value("total_sales", total);
      } else {
        frappe.msgprint("no invoices exists");
      }

      // invoices.forEach((invoice) => {
      //   let exists = frm.doc.sales_invoice.some((d) => {
      //     return d.reference === invoice.name;
      //   });
      //   if (!exists) {
      //     frm.add_child("sales_invoice", {
      //       reference: invoice.name,
      //       total: invoice.total,
      //       current_roll: invoice.current_roll,
      //       date: invoice.date,
      //       receipt_number: invoice.receipt_number,
      //     });
      //   }
      //   total += invoice.total;
      //   frm.refresh_field("sales_invoice");
      // });
      // frm.set_value("total_sales", total);
      // }

      //////////////////
    });
    let total = 0;
    // console.log("from purchase");
    frappe.call({
      method:
        "teller.teller_customization.doctype.close_shift_for_branch.close_shift_for_branch.get_purchase_invoices",
      args: {
        current_open_shift: frm.doc.open_shift,
      },
      callback: (r) => {
        if (r.message) {
          console.log("p invoice",r.message);
          frm.clear_table("purchase_close_table");
          let log = console.log;

          const invocies = r.message;

          invocies.forEach((invoice) => {
            frm.add_child("purchase_close_table", {
              reference: invoice["name"],
              invoice_total: invoice["total"],
              client: invoice["buyer"],
              receipt_number: invoice["receipt_number"],
              // exceed: invoice["exceed"],
            });
            total += invoice["total"];
          });
          frm.set_value("total_purchase", total);
        } else {
          frappe.msgprint("no invoices exists");
        }
        // const invocie_names = [];
        // console.log(r.message);
        // let egy_total = 0;
        // let child_total = 0;

        // for (let invocie of invocies) {
        //   invocie_names.push(invocie["name"]);
        //   let exists = frm.doc.purchase_close_table.some((d) => {
        //     return d.reference === invocie.name;
        //   });
        //   if (!exists) {
        //     for (let child of invocie["transactions"]) {
        //       frm.add_child("purchase_close_table", {
        //         reference: invocie["name"],
        //         currency_amount: child["usd_amount"],
        //         currency: child["currency"],
        //         egyptian_price: child["total_amount"],
        //         rate: child["rate"],
        //       });
        //       child_total += child["total_amount"];
        //     }
        //   }

        //   frm.refresh_field("purchase_close_table");
        // }

        // egy_total += child_total;

        // log(egy_total);
        // frm.set_value("total_purchase", egy_total);
        // frm.refresh_field("total_purchase");

        // log("names are", invocie_names);
      },
    });
  },
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