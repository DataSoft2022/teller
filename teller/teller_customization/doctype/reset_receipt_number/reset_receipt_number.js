// // Copyright (c) 2024, Mohamed AbdElsabour and contributors
// // For license information, please see license.txt

frappe.ui.form.on("Reset Receipt Number", {
  refresh(frm) {
    // let str = "GAZA-Cairo-00002";

    adjustReceiptNumber(frm, "GAZA-Cairo-00002", 6);
  },
  update_receipt: function (frm) {
    if (
      frm.doc.receipt_number &&
      frm.doc.end_receipt_number &&
      frm.doc.reset_number
    ) {
      // update the receiptNumber

      let fixReceipt = frm.doc.reset_number;

      //////////////////////////////////////
      // Search for Teller Sales with the given receipt number
      //   frappe.call({
      //     method: "frappe.client.get_list",
      //     args: {
      //       doctype: "Teller Invoice",

      //       filters: [
      //         ["receipt_number", ">=", frm.doc.receipt_number],
      //         ["receipt_number", "<=", frm.doc.end_receipt_number],
      //       ],

      //       fields: ["name", "receipt_number"],
      //       order_by: "receipt_number asc",
      //     },
      //     callback: function (response) {
      //       let teller_sales = response.message;
      //       if (teller_sales.length > 0) {
      //         // frm.set_value("associated_teller_sales", teller_sales[0].name);
      //         console.log("Teller invoice is", teller_sales);
      //         teller_sales.forEach((sale) => {
      //           let row = frm.add_child("invoice_details", {
      //             invoice_name: sale.name,
      //             receipt_number: sale.receipt_number,
      //             invoice_type: "Sales",
      //           });
      //         });
      //         frm.refresh_field("invoice_details");
      //         updateReceiptNumbers("Teller Invoice", response.message).then(
      //           () => {
      //             frm.refresh();
      //           }
      //         );
      //       }
      //       //   else {
      //       //     frm.set_value("associated_teller_sales", "");
      //       //   }
      //     },
      //   });

      //   // Search for Teller Purchase with the given receipt number
      //   frappe.call({
      //     method: "frappe.client.get_list",
      //     args: {
      //       doctype: "Teller Purchase",

      //       filters: [
      //         ["receipt_number", ">=", frm.doc.receipt_number],
      //         ["receipt_number", "<=", frm.doc.end_receipt_number],
      //       ],

      //       order_by: "receipt_number asc",
      //       fields: ["name", "receipt_number"],
      //     },
      //     callback: function (response) {
      //       let teller_purchase = response.message;
      //       if (teller_purchase.length > 0) {
      //         console.log("Teller Purchase is", teller_purchase);
      //         teller_purchase.forEach((purchase) => {
      //           let row = frm.add_child("invoice_details", {
      //             invoice_name: purchase.name,
      //             receipt_number: purchase.receipt_number,
      //             invoice_type: "Purchase",
      //           });
      //         });
      //         frm.refresh_field("invoice_details");
      //         updateReceiptNumbers("Teller Purchase", response.message).then(
      //           () => {
      //             frm.refresh();
      //           }
      //         );
      //       }
      //       //   else {
      //       //     frm.set_value("associated_teller_purchase", "");
      //       //   }
      //     },
      //   });
      frm.clear_table("invoice_details");

      showUpdateInvoiceReceipt(frm, "Teller Invoice", fixReceipt, "Sales");
      showUpdateInvoiceReceipt(frm, "Teller Purchase", fixReceipt, "Purchase");
      frappe.msgprint(
        __("Submit the Fix Receipt to apply changes to the invoices")
      );
    } else {
      frappe.msgprint(
        __(
          "Please select Start receipt number and end receipt number and reset number to show updated invoices"
        )
      );
      console.log("there no invoices with this receipt number");
    }
  },
  get_invoice: function (frm) {
    if (frm.doc.receipt_number && frm.doc.end_receipt_number) {
      frm.clear_table("invoice_details");
      getInvoices(frm, "Teller Invoice", "sale");
      getInvoices(frm, "Teller Purchase", "Purchase");
    } else {
      frappe.msgprint(
        __(
          "Please select Start receipt number and end receipt number to retrieve invoices"
        )
      );
    }
  },
  before_submit: function (frm) {
    if (
      frm.doc.receipt_number &&
      frm.doc.end_receipt_number &&
      frm.doc.reset_number
    ) {
      let fixReceipt = frm.doc.reset_number;
      frm.clear_table("invoice_details");

      updateInvoiceReceipt(frm, "Teller Invoice", fixReceipt, "Sales");
      updateInvoiceReceipt(frm, "Teller Purchase", fixReceipt, "Purchase");
      frappe.msgprint("Invoices updated successfully");
    } else {
      frappe.throw("there no invoices with this receipt number");
      console.log("there no invoices with this receipt number");
    }
  },
});

function adjustReceiptNumber(frm, receiptNumber, fixReceipt) {
  // Match the last segment of digits after the last hyphen
  let receiptNumberMatch = receiptNumber.match(/(\d+)$/);

  if (receiptNumberMatch) {
    let receiptNumberDigit = parseInt(receiptNumberMatch[1]);
    receiptNumberDigit += fixReceipt;

    // Format the incremented number to pad with zeros if necessary
    let newReceiptNumberPart = receiptNumberDigit
      .toString()
      .padStart(receiptNumberMatch[1].length, "0");

    // Split the original receipt number string by hyphens
    let splitString = receiptNumber.split("-");

    // Replace the last part with the new receipt number part
    splitString[splitString.length - 1] = newReceiptNumberPart;

    // Join the parts back together to form the updated receipt number
    let newReceiptNumber = splitString.join("-");

    console.log("Updated receipt number:", newReceiptNumber);
    return newReceiptNumber;
  }

  // Return the original if pattern doesn't match
  return receiptNumber;
}

function getInvoices(frm, doc, type) {
  frappe.call({
    method: "frappe.client.get_list",
    args: {
      doctype: doc,

      filters: [
        ["receipt_number", ">=", frm.doc.receipt_number],
        ["receipt_number", "<=", frm.doc.end_receipt_number],
      ],

      fields: ["name", "receipt_number"],
      order_by: "receipt_number asc",
    },
    callback: function (response) {
      let invoices = response.message;
      if (invoices && invoices.length > 0) {
        // frm.set_value("associated_teller_sales", teller_sales[0].name);
        console.log(doc, invoices);
        invoices.forEach((invoice) => {
          let row = frm.add_child("invoice_details", {
            invoice_name: invoice.name,
            receipt_number: invoice.receipt_number,
            invoice_type: type,
          });
        });
        frm.refresh_field("invoice_details");
      } else {
        console.log(`No invoices found for ${doc}`);
      }
    },
  });
}

function updateInvoiceReceipt(frm, doct, fixReceipt, type) {
  frappe.call({
    method: "frappe.client.get_list",
    args: {
      doctype: doct,
      filters: [
        ["receipt_number", ">=", frm.doc.receipt_number],
        ["receipt_number", "<=", frm.doc.end_receipt_number],
      ],
      fields: ["name", "receipt_number"],
      order_by: "receipt_number asc",
    },
    callback: function (response) {
      let invoices = response.message;
      if (invoices.length > 0) {
        updateReceiptNumbers(frm, doct, invoices, fixReceipt, type).then(
          (r) => {
            console.log("After updateReceiptNumbers", r);
            frm.refresh_field("invoice_details");
            frm.refresh();
          }
        );

        updatePrintingRoll(frm, fixReceipt);
      }
    },
  });
}

function showUpdateInvoiceReceipt(frm, doct, fixReceipt, type) {
  frappe.call({
    method: "frappe.client.get_list",
    args: {
      doctype: doct,
      filters: [
        ["receipt_number", ">=", frm.doc.receipt_number],
        ["receipt_number", "<=", frm.doc.end_receipt_number],
      ],
      fields: ["name", "receipt_number"],
      order_by: "receipt_number asc",
    },
    callback: function (response) {
      let invoices = response.message;
      if (invoices.length > 0) {
        showUpdateReceiptNumbers(frm, doct, invoices, fixReceipt, type);
      }
    },
  });
}

function updateReceiptNumbers(frm, doctype, results, fixReceipt, type) {
  let promises = [];
  results.forEach((doc) => {
    let adjustedReceiptNumber = adjustReceiptNumber(
      frm,
      doc.receipt_number,
      fixReceipt
    );
    let promise = frappe.db
      .set_value(doctype, doc.name, "receipt_number", adjustedReceiptNumber)
      .then(() => {
        let row = frm.add_child("invoice_details", {
          invoice_name: doc.name,
          receipt_number: doc.receipt_number,
          updated_receipt: adjustedReceiptNumber,
          invoice_type: type,
        });
        frm.refresh_field("invoice_details");
      });
    promises.push(promise);
  });
  return Promise.all(promises);
}

// funcrion to update printing roll
function updatePrintingRoll(frm, restNumber) {
  frappe
    .call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Printing Roll",
        filters: { active: 1 },
        fields: [
          "name",
          "last_printed_number",
          "starting_letters",
          "start_count",
          "end_count",
          "show_number",
          "add_zeros",
        ],
        order_by: "creation desc",
        limit: 1,
      },
    })
    .then((r) => {
      if (!r.message || r.message.length === 0) {
        frappe.throw(
          _("No active printing roll available. Please create one.")
        );
      } else {
        let activeRoll = r.message[0];
        console.log(
          "The last printed number is",
          activeRoll.last_printed_number
        );

        // Assuming restNumber is the new value you want to set for last_printed_number
        let newLastPrintedNumber = activeRoll.last_printed_number + restNumber;

        // Update the last printed number
        frappe.call({
          method: "frappe.client.set_value",
          args: {
            doctype: "Printing Roll",
            name: activeRoll.name,
            fieldname: "last_printed_number",
            value: newLastPrintedNumber,
          },
          callback: function (response) {
            if (response && response.message) {
              // frappe.msgprint("Last printed number updated successfully.");
              console.log("Last printed number updated successfully");
            }
          },
        });
      }
    });
}

function showUpdateReceiptNumbers(frm, doctype, results, fixReceipt, type) {
  let promises = [];
  results.forEach((doc) => {
    let adjustedReceiptNumber = adjustReceiptNumber(
      frm,
      doc.receipt_number,
      fixReceipt
    );

    let row = frm.add_child("invoice_details", {
      invoice_name: doc.name,
      receipt_number: doc.receipt_number,
      updated_receipt: adjustedReceiptNumber,
      invoice_type: type,
    });
    frm.refresh_field("invoice_details");
  });
}
