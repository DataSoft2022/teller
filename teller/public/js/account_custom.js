// frappe.ui.form.on("Account", {
//   refresh: function (frm) {
//     // Check if the 'teller' field is true
//     if (frm.doc.custom_is_teller) {
//       frm.meta.title_field = "custom_currency_code";
//       frm.meta.show_title_field_in_link = 1;
//       frappe.msgprint(frm.meta.title_field, frm.meta.show_title_field_in_link);
//     } else {
//       frm.meta.title_field = "account_name";
//       frm.meta.show_title_field_in_link = 1;

//       frappe.msgprint(frm.meta.title_field, frm.meta.show_title_field_in_link);
//     }

//     frm.save();
//   },
// });

// frappe.ui.form.on("Account", {
//   refresh: function (frm) {
//     if (frm.doc.custom_is_teller) {
//       frm.set_df_property("title_field", "default", "custom_currency_code");
//       frm.set_df_property("show_title_field_in_link", "default", true);
//       //   frappe.msgprint("Title field set to: custom_currency_code");
//       //   frappe.msgprint("link field set to: custom_currency_code");
//       frappe.msgprint(frm.meta.title_field, frm.meta.show_title_field_in_link);
//     } else {
//       frm.set_df_property("title_field", "default", "account_name");
//       frm.set_df_property("show_title_field_in_link", "default", true);
//       //   frappe.msgprint("Title field set to: account_name");
//       frappe.msgprint(frm.meta.title_field, frm.meta.show_title_field_in_link);
//     }

//     frm.save();

//     // Check if the 'custom_is_teller' field is true
//   },
// });

// frappe.ui.form.on("Account", {
//   refresh: function (frm) {
//     // Check if the 'custom_is_teller' field is true
//     if (frm.doc.custom_is_teller) {
//       frm.set_title_field("custom_currency_code");
//       frm.set_df_property("custom_currency_code", "hidden", 0);
//       frm.set_df_property("account_name", "hidden", 1);
//     } else {
//       frm.set_title_field("account_name");
//       frm.set_df_property("custom_currency_code", "hidden", 1);
//       frm.set_df_property("account_name", "hidden", 0);
//     }
//   },
// });
