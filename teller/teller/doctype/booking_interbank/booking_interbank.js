frappe.ui.form.on("Booking Interbank", {
  refresh(frm) {
    frm.events.add_custom_buttons(frm);
  },

  add_custom_buttons: function (frm) {
    if (frm.doc.docstatus === 0) {
      frm.add_custom_button(
        __("InterBank"),
        function () {
          if (!frm.doc.customer) {
            frappe.throw({
              title: __("Mandatory"),
              message: __("Please select a customer"),
            });
          }
          erpnext.utils.map_current_doc({
            method: "teller.teller.doctype.special_price_document.special_price_document.make_interbank",
            source_doctype: "InterBank",
            target: frm,
            setters: {
              customer: frm.doc.customer,
            },
            get_query_filters: {
              docstatus: 1,
              company: frm.doc.company,
            },
          });
        },
        __("Get Currency From")
      );
    }
  },
  after_save(frm){
    console.log("dddd")
    frm.call("update_interbank_details")
  }
});
