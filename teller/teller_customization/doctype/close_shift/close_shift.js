// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Close Shift", {
  setup(frm) {
    frappe.call({
      method:
        "teller.teller_customization.doctype.close_shift.close_shift.get_active_shift",
      callback: function (r) {
        console.log(r.message);
        frm.set_value("open_shift", r.message);
      },
    });

    frappe.call({
      method:
        "teller.teller_customization.doctype.close_shift.close_shift.active_active_user",
      callback: function (r) {
        console.log(r.message["name"]);
        frm.set_value("current_user", r.message["name"]);
      },
    });
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

  get_invoices: function (frm) {
    console.log(frm.doc.name);

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
  },

  get_purchase: (frm) => {
    let total = 0;
    // console.log("from purchase");
    frappe.call({
      method:
        "teller.teller_customization.doctype.close_shift.close_shift.get_purchase_invoices",
      args: {
        current_open_shift: frm.doc.open_shift,
      },
      callback: (r) => {
        if (r.message) {
          console.log(r.message);
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
