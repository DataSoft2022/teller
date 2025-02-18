frappe.ui.form.on("Customer", {
  // validate: function (frm) {
  //   // Check if customer group is Egyptian and if the required fields are filled
  //   if (
  //     frm.doc.custom_type === "Egyptian" &&
  //     !frm.doc.custom_place_of_birth
  //   ) {
  //     frappe.msgprint(__("Place of birth is required for Egyptian customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Egyptian" && !frm.doc.custom_card_type) {
  //     frappe.msgprint(__("Card Type is required for Egyptian customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Egyptian" && !frm.doc.custom_nationality) {
  //     frappe.msgprint(__("Nationality is required for Egyptian customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Egyptian" && !frm.doc.custom_address) {
  //     frappe.msgprint(__("address is required for Egyptian customers"));
  //     frappe.validated = false;
  //   }
  //   if (
  //     frm.doc.custom_type === "Egyptian" &&
  //     !frm.doc.custom_date_of_birth
  //   ) {
  //     frappe.msgprint(__("birth date is required for Egyptian customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Egyptian" && !frm.doc.custom_job_title) {
  //     frappe.msgprint(__("job is required for Egyptian customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Egyptian" && !frm.doc.custom_work_for) {
  //     frappe.msgprint(__("work is required for Egyptian customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Egyptian" && !frm.doc.custom_issue_date) {
  //     frappe.msgprint(__("issue date is required for Egyptian customers"));
  //     frappe.validated = false;
  //   }

  //   if (frm.doc.custom_type === "Egyptian" && !frm.doc.gender) {
  //     frappe.msgprint(__("gender is required for Egyptian customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Egyptian" && !frm.doc.custom_mobile) {
  //     frappe.msgprint(__("mobile is required for Egyptian customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Egyptian" && !frm.doc.custom_phone) {
  //     frappe.msgprint(__("phone is required for Egyptian customers"));
  //     frappe.validated = false;
  //   }

  //   //check if customer group is Foreigner and if the required fields are filled

  //   if (
  //     frm.doc.custom_type === "Foreigner" &&
  //     !frm.doc.custom_place_of_birth
  //   ) {
  //     frappe.msgprint(__("Place of birth is required for Foreigner customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Foreigner" && !frm.doc.custom_card_type) {
  //     frappe.msgprint(__("Card Type is required for Egyptian Foreigner"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Foreigner" && !frm.doc.custom_nationality) {
  //     frappe.msgprint(__("Nationality is required for Foreigner customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Foreigner" && !frm.doc.custom_address) {
  //     frappe.msgprint(__("address is required for Foreigner customers"));
  //     frappe.validated = false;
  //   }
  //   if (
  //     frm.doc.custom_type === "Foreigner" &&
  //     !frm.doc.custom_date_of_birth
  //   ) {
  //     frappe.msgprint(__("birth date is required for Foreigner customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Foreigner" && !frm.doc.custom_job_title) {
  //     frappe.msgprint(__("job is required for Foreigner customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Foreigner" && !frm.doc.custom_work_for) {
  //     frappe.msgprint(__("work is required for Foreigner customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Foreigner" && !frm.doc.custom_issue_date) {
  //     frappe.msgprint(__("issue date is required for Foreigner customers"));
  //     frappe.validated = false;
  //   }

  //   if (frm.doc.custom_type === "Foreigner" && !frm.doc.gender) {
  //     frappe.msgprint(__("gender is required for Foreigner customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Foreigner" && !frm.doc.custom_mobile) {
  //     frappe.msgprint(__("mobile is required for Foreigner customers"));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Foreigner" && !frm.doc.custom_phone) {
  //     frappe.msgprint(__("phone is required for Foreigner customers"));
  //     frappe.validated = false;
  //   }

  //   // check if customer group is Company and if the required fields are filled
  //   if (frm.doc.custom_type === "Company" && !frm.doc.custom_company_no) {
  //     frappe.msgprint(__("Company no is required for company!! "));
  //     frappe.validated = false;
  //   }
  //   if (
  //     frm.doc.custom_type === "Company" &&
  //     !frm.doc.custom_start_registration_date
  //   ) {
  //     frappe.msgprint(__("start reg date  is required for company "));
  //     frappe.validated = false;
  //   }

  //   if (frm.doc.custom_type === "Company" && !frm.doc.custom_commercial_no) {
  //     frappe.msgprint(__("Commerical no is required for company "));
  //     frappe.validated = false;
  //   }
  //   if (
  //     frm.doc.custom_type === "Company" &&
  //     !frm.doc.custom_company_activity
  //   ) {
  //     frappe.msgprint(__("activity  is required for company "));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Company" && !frm.doc.custom_legal_form) {
  //     frappe.msgprint(__("legal form  is required for company "));
  //     frappe.validated = false;
  //   }
  //   if (
  //     frm.doc.custom_type === "Company" &&
  //     !frm.doc.custom_comany_address1
  //   ) {
  //     frappe.msgprint(__("address  is required for company "));
  //     frappe.validated = false;
  //   }
  //   if (
  //     frm.doc.custom_type === "Company" &&
  //     !frm.doc.custom_end_registration_date
  //   ) {
  //     frappe.msgprint(__("end reg date  is required for company "));
  //     frappe.validated = false;
  //   }

  //   // check end date is after start date
  //   if (
  //     (frm.doc.custom_type === "Company" ||
  //       frm.doc.custom_type === "Interbank") &&
  //     frm.doc.custom_end_registration_date &&
  //     frm.doc.custom_start_registration_date &&
  //     frm.doc.custom_start_registration_date >
  //       frm.doc.custom_end_registration_date
  //   ) {
  //     frappe.msgprint(
  //       __(
  //         "end registration date must be after start date reistration for company and Interbank "
  //       )
  //     );
  //     frappe.validated = false;
  //   }

  //   //check if customer group is Interbank and if the required fields are filled
  //   if (frm.doc.custom_type === "Interbank" && !frm.doc.custom_company_no) {
  //     frappe.msgprint(__("Company no is required for Interbank!! "));
  //     frappe.validated = false;
  //   }
  //   if (
  //     frm.doc.custom_type === "Interbank" &&
  //     !frm.doc.custom_start_registration_date
  //   ) {
  //     frappe.msgprint(__("start reg date  is required for Interbank "));
  //     frappe.validated = false;
  //   }

  //   if (
  //     frm.doc.custom_type === "Interbank" &&
  //     !frm.doc.custom_commercial_no
  //   ) {
  //     frappe.msgprint(__("Commerical no is required for Interbank "));
  //     frappe.validated = false;
  //   }
  //   if (
  //     frm.doc.custom_type === "Interbank" &&
  //     !frm.doc.custom_company_activity
  //   ) {
  //     frappe.msgprint(__("activity  is required for company "));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Interbank" && !frm.doc.custom_legal_form) {
  //     frappe.msgprint(__("legal form  is required for Interbank "));
  //     frappe.validated = false;
  //   }
  //   if (
  //     frm.doc.custom_type === "Interbank" &&
  //     !frm.doc.custom_comany_address1
  //   ) {
  //     frappe.msgprint(__("address  is required for Interbank "));
  //     frappe.validated = false;
  //   }
  //   if (
  //     frm.doc.custom_type === "Interbank" &&
  //     !frm.doc.custom_end_registration_date
  //   ) {
  //     frappe.msgprint(__("end reg date  is required for Interbank "));
  //     frappe.validated = false;
  //   }
  //   if (frm.doc.custom_type === "Interbank" && !frm.doc.custom_interbank) {
  //     frappe.msgprint(__("Interbank  is required for Interbank "));
  //     frappe.validated = false;
  //   }
  // },


  //   custom_type: function (frm) {
  //     if (frm.doc.custom_type === "Egyptian") {
  //       frm.set_df_property("place_of_birth", "reqd", 1);
  //     } else {
  //       frm.set_df_property("place_of_birth", "reqd", 0);
  //     }
  //   },
  //   refresh: function (frm) {
  //     if (frm.doc.custom_type === "Egyptian") {
  //       frm.set_df_property("place_of_birth", "reqd", 1);
  //     } else {
  //       frm.set_df_property("place_of_birth", "reqd", 0);
  //     }
  //   },
});
