// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Teller Purchase", {
  category_of_buyer(frm) {
    if (frm.doc.category_of_buyer === "Interbank") {
      // frappe.msgprint(`mmmmmmmmmmm`);
      // frm.set_value("company_name", "");
      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Customer",
          // name: "Bank al-ahly",
          name: "البنك الاهلي",
        },
        callback: function (response) {
          console.log("response", response.message);
          frm.set_value("company_name", response.message.name);
          frm.set_value("company_address",response.message.custom_comany_address1);
          frm.set_value("start_registration_date",response.message.custom_start_registration_date);
          frm.set_value("end_registration_date",response.message.custom_end_registration_date);
          frm.set_value("company_legal_form", response.message.custom_legal_form);
          frm.set_value("company_activity", response.message.custom_company_activity);
          
        },
      });
    }
  },
  custom_special_price2(frm) {
    var d = new frappe.ui.Dialog({
      title: "Booked Special Price",
      fields: [
        {
          label: "Special price document",
          fieldname: "name",
          fieldtype: "Link",
          options: "Special price document",
          get_query: function() {
     
            return {
                filters: [
                    ['custom_interbank_type', '=', 'Buying'],
     
                ]
            };
        }
        },
      ],
      size: "small", // small, large, extra-large
      primary_action_label: "Submit",
      primary_action: async function (values) {
        console.log(values.name);
        let doc = await frappe.db.get_doc(
          "Special price document",
          values.name
        );
        console.log(doc.booked_currency);
        let book_table = doc.booked_currency;
        for (let item of book_table) {
          console.log(item.currency);
          let child = frm.add_child("transactions");
          child.currency = item.currency;
          child.currency_code = item.custom_currency_code;
          child.rate = item.rate;
          // frm.doc.transactions.forEach((row) => {
          //   frappe.model.set_value(cdt, cdn, "currency", item.currency);
          // });
        }
        frm.refresh_field("transactions");
        d.hide();
      },
    });
    d.show();
  },
  // validation on national id and registration date
  validate: function (frm) {
    // validate individual client national id
    // if (
    //   (frm.doc.category_of_buyer == "Egyptian" ||
    //     frm.doc.category_of_buyer == "Foreigner") &&
    //   frm.doc.national_id
    // ) {
      if (
        frm.doc.category_of_buyer == "Egyptian" &&
        frm.doc.national_id
      ) {
      // frm.set_value("card_type","Passport")
      // frm.refresh_field("card_type");
      validateNationalId(frm, frm.doc.national_id);
      // validateNationalId(frm, frm.doc.fetch_national_id);
    }

    // validate commissar national id

    if (
      (frm.doc.category_of_buyer == "Company" ||
        frm.doc.category_of_buyer == "Interbank") &&
      frm.doc.commissar &&
      frm.doc.com_national_id
    ) {
      validateNationalId(frm, frm.doc.com_national_id);
    }
    if (
      (frm.doc.category_of_buyer == "Company" ||
        frm.doc.category_of_buyer == "Interbank") &&
      frm.doc.buyer
    ) {
      validateRegistrationDate(
        frm,
        frm.doc.start_registration_date,
        frm.doc.end_registration_date
      );
      validateRegistrationDateExpiration(frm, frm.doc.end_registration_date);
    }
  },
  // filters accounts with cash ,is group False and account currency not EGY
  // setup: function (frm) {
  //   frm.fields_dict["transactions"].grid.get_field("paid_from").get_query =
  //     function () {
  //       var account_types = ["Cash"];
  //       return {
  //         filters: {
  //           account_type: ["in", account_types],
  //           account_currency: ["!=", "EGP"],
  //           is_group: 0,
  //         },
  //       };
  //     };

  //   // set query to show only codes that belongs to session user

  //   frm.fields_dict["transactions"].grid.get_field("currency_code").get_query =
  //     function () {
  //       let session = frappe.session.logged_in_user;
  //       return {
  //         filters: {
  //           user: session,
  //         },
  //       };
  //     };
  // },

  refresh(frm) {
    // Automatically refresh the form after duplication
    // if (frm.doc.__islocal) {
    //   frm.reload_doc();
    // }

    // set the focus on the fetch_national_id field when the doctype is refreshed
    setTimeout(function () {
      frm.get_field("fetch_national_id").$input.focus();
    }, 100);

    // save and submit and print the invoice on shortcut
    frappe.ui.keys.on("alt+s", function (e) {
      console.log("shift + s was pressed");

      e.preventDefault();

      if (frm.doc.docstatus === 0) {
        frm
          .save()
          .then(() => {
            console.log("Form saved");

            // Manually submit the form without showing confirmation
            frappe.call({
              method: "frappe.client.submit",
              args: {
                doc: frm.doc,
              },
              callback: function (response) {
                if (!response.exc) {
                  console.log("Form submitted");
                  frm.print_doc();
                  console.log("Form printed");
                } else {
                  console.error("Error submitting:", response.exc);
                }
              },
            });
          })
          .catch((error) => console.error("Error:", error));
      }

      //   // if (frm.doc.docstatus === 0) {
      //   //   frm
      //   //     .save()
      //   //     .then(() => {
      //   //       console.log("Form saved");
      //   //       return frm.savesubmit();
      //   //     })
      //   //     .then(() => {
      //   //       console.log("Form submitted");
      //   //       frm.print_doc();
      //   //       console.log("Form printed");
      //   //     })
      //   //     .catch((error) => console.error("Error:", error));
      //   // }

      //   ///////////////////
    });
    // frm.fields_dict["buyer"].df.onchange = function () {
    //   check_and_set_customer(frm);
    // };

    //   frm.fields_dict.buyer.$input.on('focusout', function() {
    //     let customer_name = frm.doc.buyer;

    //     if (customer_name) {
    //         frappe.db.get_value('Customer', customer_name, 'name', (r) => {
    //             if (!r || !r.name) {
    //                 // If customer does not exist, set the value in another field
    //                 frm.set_value('customer_name', customer_name);
    //                 frm.set_value('buyer', '');
    //                 frappe.msgprint(`Customer "${customer_name}" does not exist. The name has been moved to another field.`);
    //             }
    //         });
    //     }
    // });

    // $("input[data-fieldname='buyer']").css("background-color", "#FFD700"); // Example color: Gold

    // let $inputField = $("input[data-fieldname='buyer']");

    // // Apply background color, width, and height
    // $inputField.css({
    //   "background-color": "#E0F7FA", // Light Cyan background for better visibility
    //   width: "300px", // Adjust width as needed
    //   height: "40px", // Adjust height as needed
    // });

    // $inputField.css({
    //   border: "1px solid #007BFF", // Blue border for better visibility
    //   padding: "5px", // Padding for better spacing
    //   "font-size": "16px", // Font size for better readability
    // });
    //add ledger button in refresh To Purchase invoice
    frm.events.show_general_ledger(frm);
    set_branch_and_shift(frm);
    // filter customers based on  customer category
    frm.set_query("buyer", function (doc) {
      return {
        filters: {
          custom_type: doc.category_of_buyer,
        },
      };
    });

    // fetch agy account

    loginUser = frappe.session.logged_in_user;
    frappe
      .call({
        method: "frappe.client.get",
        args: {
          doctype: "User",
          name: loginUser,
        },
      })
      .then((r) => {
        if (r.message) {
          console.log("the session egyptian account", r.message.egy_account);
          let user_account = r.message.egy_account;
          if (user_account) {
            frm.set_value("egy", user_account);
            frm.set_value("egy_account", user_account);

            console.log(
              "the session egyptian account after set is ",
              user_account
            );
          } else {
            frappe.throw("there is no egy account linked to this user");
          }
        } else {
          frappe.throw("Error while getting user");
        }
      });
  },

  // add ledger report button on submit doctype
  show_general_ledger: function (frm) {
    if (frm.doc.docstatus > 0) {
      frm.add_custom_button(
        __("Ledger"),
        function () {
          frappe.route_options = {
            voucher_no: frm.doc.name,
            from_date: frm.doc.date,
            to_date: moment(frm.doc.modified).format("YYYY-MM-DD"),
            company: frm.doc.company,
            group_by: "",
            show_cancelled_entries: frm.doc.docstatus === 2,
          };
          frappe.set_route("query-report", "General Ledger");
        },
        "fa fa-table"
      );
    }

    // filters commissar based on company name
    frm.set_query("commissar", function (doc) {
      return {
        query:
          "teller.teller_customization.doctype.teller_purchase.teller_purchase.filters_commissars_by_company",
        filters: {
          link_doctype: "Customer",
          link_name: doc.buyer,
        },
      };
    });
    //
  },

  fetch_national_id(frm) {
    if (frm.doc.fetch_national_id) {
      if (
        frm.doc.category_of_buyer == "Egyptian" &&
        frm.doc.card_type == "National ID"
      ) {
        // validateNationalId(frm, frm.doc.fetch_national_id);
        let nationalId = frm.doc.fetch_national_id;

        frappe.call({
          method:
            "teller.teller_customization.doctype.teller_invoice.teller_invoice.check_client_exists",
          args: {
            doctype_name: nationalId,
          },
          callback: function (r) {
            if (r.message) {
              console.log(r.message, "exists");
              frm.set_value("buyer", nationalId).then(() => {
                frm.refresh_field("buyer");
              });
            } else {
              frm.set_value("buyer", "").then(() => {
                frm.refresh_field("buyer");
                if (validateNationalId(frm, nationalId)) {
                  frm.set_value("national_id", nationalId);
                } else {
                  frm.set_value("national_id", "");
                }
              });

              //
            }
          },
        });
      } else if (frm.doc.category_of_buyer == "Company") {
        // validateNationalId(frm, frm.doc.fetch_national_id);
        let commiricalNo = frm.doc.fetch_national_id;

        frappe.call({
          method:
            "teller.teller_customization.doctype.teller_invoice.teller_invoice.check_client_exists",
          args: {
            doctype_name: commiricalNo,
          },
          callback: function (r) {
            if (r.message) {
              console.log(r.message, "exists");
              frm.set_value("buyer", commiricalNo).then(() => {
                frm.refresh_field("buyer");
              });
            } else {
              frm.set_value("buyer", "").then(() => {
                frm.set_value("company_commercial_no", commiricalNo);
              });
            }
          },
        });
      }
      // fetch or create client with passport number
      else if (
        (frm.doc.category_of_buyer == "Egyptian" ||
          frm.doc.category_of_buyer == "Foreigner") &&
        frm.doc.card_type == "Passport"
      ) {

        // frappe.msgprint("from passport");
        let passportNumber = frm.doc.fetch_national_id;

        frappe.call({
          method:
            "teller.teller_customization.doctype.teller_invoice.teller_invoice.check_client_exists",
          args: {
            doctype_name: passportNumber,
          },
          callback: function (r) {
            if (r.message) {
              console.log(r.message, "exists");
              frm.set_value("buyer", passportNumber).then(() => {
                frm.refresh_field("buyer");
              });
            } else {
              frm.set_value("buyer", "").then(() => {
                frm.refresh_field("buyer");
                if (validateNationalId(frm, passportNumber)) {
                  frm.set_value("passport_number", passportNumber);
                } else {
                  frm.set_value("passport_number", "");
                }
              });

              //
            }
          },
        });
      }
    } else {
      frm.set_value("buyer", "");
      // frm.set_value("fetch_national_id", "");
      frm.set_value("national_id", "");
    }
  },

  // get customer information if exists
  buyer: function (frm) {
    ///////////////////

    ///////////////////////////////
    // get the information for Egyptian
    if (
      frm.doc.category_of_buyer == "Egyptian" ||
      frm.doc.category_of_buyer == "Foreigner"
    ) {
      if (frm.doc.buyer) {
        //test add
        var customerName = frm.doc.buyer;

        //////////////

        frappe.call({
          method: "frappe.client.get",
          args: {
            doctype: "Customer",
            name: frm.doc.buyer,
          },
          callback: function (r) {
            // set the fields with r.message.fieldname
            frm.set_value("buyer_name", r.message.customer_name);
            frm.set_value("buyer_nationality", r.message.nationality);
            frm.set_value("buyer_phone", r.message.phone);
            frm.set_value("buyer_job_title", r.message.job_title);
            frm.set_value("buyer_date_of_birth", r.message.date_of_birth);
            frm.set_value("buyer_card_type", r.message.card_type);
            frm.set_value("buyer_work_for", r.message.work_for);
            frm.set_value("buyer_issue_date", r.message.issue_date);
            frm.set_value("buyer_address", r.message.address);
            frm.set_value("buyer_place_of_birth", r.message.place_of_birth);
            frm.set_value("buyer_gender", r.message.gender);
            frm.set_value("buyer_expired", r.message.expired);
            frm.set_value("buyer_national_id", r.message.national_id);
            frm.set_value("buyer_passport_number", r.message.passport_number);
            frm.set_value("buyer_military_number", r.message.military_number);
            frm.set_value("buyer_mobile_number", r.message.mobile_number);
            frm.set_value("buyer_national_id_copy", r.message.national_id_copy);
            frm.set_value("buyer_company_name", r.message.company_name);
            frm.set_value("buyer_company_address", r.message.company_address);
            frm.set_value("buyer_company_commercial_no", r.message.company_commercial_no);
            frm.set_value("buyer_company_start_date", r.message.start_registration_date);
            frm.set_value("buyer_company_end_date", r.message.end_registration_date);
            frm.set_value("buyer_company_legal_form", r.message.company_legal_form);
            frm.set_value("buyer_company_activity", r.message.company_activity);
          },
        });
      } else {
        // clear the fields
        frm.set_value("buyer_name", "");
        frm.set_value("buyer_nationality", "");
        frm.set_value("buyer_phone", "");
        frm.set_value("buyer_job_title", "");
        frm.set_value("buyer_date_of_birth", "");
        frm.set_value("buyer_card_type", "");
        frm.set_value("buyer_work_for", "");
        frm.set_value("buyer_issue_date", "");
        frm.set_value("buyer_address", "");
        frm.set_value("buyer_place_of_birth", "");
        frm.set_value("buyer_gender", "");
        frm.set_value("buyer_expired", "");
        frm.set_value("buyer_national_id", "");
        frm.set_value("buyer_passport_number", "");
        frm.set_value("buyer_military_number", "");
        frm.set_value("buyer_mobile_number", "");
        frm.set_value("buyer_national_id_copy", "");
        frm.set_value("buyer_company_name", "");
        frm.set_value("buyer_company_address", "");
        frm.set_value("buyer_company_commercial_no", "");
        frm.set_value("buyer_company_start_date", "");
        frm.set_value("buyer_company_end_date", "");
        frm.set_value("buyer_company_legal_form", "");
        frm.set_value("buyer_company_activity", "");
      }
    } // get the information for company
    else if (
      frm.doc.category_of_buyer == "Company" ||
      frm.doc.category_of_buyer == "Interbank"
    ) {
      if (frm.doc.buyer) {
        frappe.call({
          method: "frappe.client.get",
          args: {
            doctype: "Customer",
            name: frm.doc.buyer,
          },
          callback: function (r) {
            // set the fields with r.message.fieldname
            frm.set_value("buyer_name", r.message.customer_name);
            frm.set_value("buyer_nationality", r.message.nationality);
            frm.set_value("buyer_phone", r.message.phone);
            frm.set_value("buyer_job_title", r.message.job_title);
            frm.set_value("buyer_date_of_birth", r.message.date_of_birth);
            frm.set_value("buyer_card_type", r.message.card_type);
            frm.set_value("buyer_work_for", r.message.work_for);
            frm.set_value("buyer_issue_date", r.message.issue_date);
            frm.set_value("buyer_address", r.message.address);
            frm.set_value("buyer_place_of_birth", r.message.place_of_birth);
            frm.set_value("buyer_gender", r.message.gender);
            frm.set_value("buyer_expired", r.message.expired);
            frm.set_value("buyer_national_id", r.message.national_id);
            frm.set_value("buyer_passport_number", r.message.passport_number);
            frm.set_value("buyer_military_number", r.message.military_number);
            frm.set_value("buyer_mobile_number", r.message.mobile_number);
            frm.set_value("buyer_national_id_copy", r.message.national_id_copy);
            frm.set_value("buyer_company_name", r.message.company_name);
            frm.set_value("buyer_company_address", r.message.company_address);
            frm.set_value("buyer_company_commercial_no", r.message.company_commercial_no);
            frm.set_value("buyer_company_start_date", r.message.start_registration_date);
            frm.set_value("buyer_company_end_date", r.message.end_registration_date);
            frm.set_value("buyer_company_legal_form", r.message.company_legal_form);
            frm.set_value("buyer_company_activity", r.message.company_activity);
          },
        });
      } else {
        // clear the fields
        frm.set_value("buyer_name", "");
        frm.set_value("buyer_nationality", "");
        frm.set_value("buyer_phone", "");
        frm.set_value("buyer_job_title", "");
        frm.set_value("buyer_date_of_birth", "");
        frm.set_value("buyer_card_type", "");
        frm.set_value("buyer_work_for", "");
        frm.set_value("buyer_issue_date", "");
        frm.set_value("buyer_address", "");
        frm.set_value("buyer_place_of_birth", "");
        frm.set_value("buyer_gender", "");
        frm.set_value("buyer_expired", "");
        frm.set_value("buyer_national_id", "");
        frm.set_value("buyer_passport_number", "");
        frm.set_value("buyer_military_number", "");
        frm.set_value("buyer_mobile_number", "");
        frm.set_value("buyer_national_id_copy", "");
        frm.set_value("buyer_company_name", "");
        frm.set_value("buyer_company_address", "");
        frm.set_value("buyer_company_commercial_no", "");
        frm.set_value("buyer_company_start_date", "");
        frm.set_value("buyer_company_end_date", "");
        frm.set_value("buyer_company_legal_form", "");
        frm.set_value("buyer_company_activity", "");
      }
    }

    // Set contact query filters
    frm.set_query("purchase_commissar", function() {
      return {
        query: "frappe.contacts.doctype.contact.contact.contact_query",
        filters: {
          link_doctype: "Customer",
          link_name: frm.doc.buyer
        }
      };
    });
  },

  // category_of_buyer(frm) {
  //   if (frm.doc.category_of_buyer == "InterBank") {
  //     frappe.msgprint("hiiii");

  //     frappe.call({
  //       method: "frappe.client.get",
  //       args: {
  //         doctype: "Customer",
  //         name: "Alahly",
  //       },
  //       callback: function (r) {
  //         if (!r.exc) {
  //           console.log(r.message);
  //         } else {
  //           console.log("error in fetchng interbank");
  //         }
  //       },
  //     });
  //   }
  // },

  // add comissar to invoice

  commissar: function (frm) {
    if (
      frm.doc.category_of_buyer == "Company" ||
      (frm.doc.category_of_buyer == "Interbank" && frm.doc.buyer)
    ) {
      if (frm.doc.commissar) {
        var commissarNAme = frm.doc.commissar;
        var companyName = frm.doc.buyer;
        var fullCommissarName = commissarNAme;

        //test add

        frappe.call({
          method: "frappe.client.get",
          args: {
            doctype: "Contact",
            name: fullCommissarName,
          },
          callback: function (r) {
            // set the fields with r.message.fieldname
            frm.set_value("purchase_com_name", r.message.first_name + ' ' + r.message.last_name);
            frm.set_value("purchase_com_national_id", r.message.custom_national_id);
            frm.set_value("purchase_com_address", r.message.address);
            frm.set_value("purchase_com_gender", r.message.gender);
            frm.set_value("purchase_com_phone", r.message.phone);
            frm.set_value("purchase_com_mobile_number", r.message.mobile_no);
            frm.set_value("purchase_com_job_title", r.message.job_title);
          },
        });
      } else {
        // clear the fields
        frm.set_value("purchase_com_name", "");
        frm.set_value("purchase_com_national_id", "");
        frm.set_value("purchase_com_address", "");
        frm.set_value("purchase_com_gender", "");
        frm.set_value("purchase_com_phone", "");
        frm.set_value("purchase_com_mobile_number", "");
        frm.set_value("purchase_com_job_title", "");
      }
    } else {
      __("Please select Company Name Before add Commissar");
    }
  },
  // add customer information if not already present or update existing customer information
  before_save: function (frm) {
    /////test customer history

    ////////

    if (frm.doc.buyer) {
      // Continue with any other buyer-related logic
    }
    if (
      (frm.doc.category_of_buyer == "Egyptian" ||
        frm.doc.category_of_buyer == "Foreigner") &&
      !frm.doc.buyer
    ) {
      frappe.call({
        method: "frappe.client.insert",
        args: {
          doc: {
            doctype: "Customer",
            customer_name: frm.doc.buyer_name,
            gender: frm.doc.buyer_gender,
            custom_card_type: frm.doc.buyer_card_type,
            custom_mobile: frm.doc.buyer_mobile_number ? frm.doc.buyer_mobile_number : "",
            // custom_work_for: frm.doc.work_for,
            custom_address: frm.doc.buyer_address,
            // custom_nationality: frm.doc.nationality,
            // custom_issue_date: frm.doc.issue_date,
            // custom_expired: frm.doc.expired,
            // custom_place_of_birth: frm.doc.place_of_birth,
            custom_date_of_birth: frm.doc.buyer_date_of_birth
              ? frm.doc.buyer_date_of_birth
              : frappe.datetime.get_today(),
            // custom_job_title: frm.doc.job_title,
            custom_type: frm.doc.category_of_buyer,
            custom_national_id:
              frm.doc.buyer_card_type == "National ID" ? frm.doc.buyer_national_id : null,
            custom_passport_number:
              frm.doc.buyer_card_type == "Passport" ? frm.doc.buyer_passport_number : null,
            custom_military_number:
              frm.doc.buyer_card_type == "Military ID"
                ? frm.doc.buyer_military_number
                : null,
          },
        },
        callback: function (r) {
          if (r.message) {
            frm.set_value("buyer", r.message.name);
          } else {
            frappe.throw("Error while creating customer");
          }
        },
      });
    } else if (
      (frm.doc.category_of_buyer == "Egyptian" ||
        frm.doc.category_of_buyer == "Foreigner") &&
      frm.doc.buyer
    ) {
      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Customer",
          filters: {
            name: frm.doc.buyer,
          },
        },
        callback: function (r) {
          if (r.message) {
            console.log("client first time get", r.message);

            /////////////////////////////////
            var existing_client = r.message;

            // Fetch the latest version of the document
            frappe.call({
              method: "frappe.client.get",
              args: {
                doctype: "Customer",
                name: existing_client.name,
              },
              callback: function (response) {
                if (response.message) {
                  var latest_client = response.message;
                  // Update the relevant fields

                  latest_client.customer_name = frm.doc.buyer_name;
                  latest_client.custom_card_type = frm.doc.buyer_card_type;

                  latest_client.custom_work_for = frm.doc.buyer_work_for;

                  latest_client.custom_nationality = frm.doc.buyer_nationality;
                  latest_client.custom_mobile = frm.doc.buyer_mobile_number;
                  latest_client.custom_phone = frm.doc.buyer_phone;
                  latest_client.custom_place_of_birth = frm.doc.buyer_place_of_birth;

                  latest_client.custom_address = frm.doc.buyer_address;
                  latest_client.custom_issue_date = frm.doc.buyer_issue_date;

                  latest_client.custom_job_title = frm.doc.buyer_job_title;
                  latest_client.custom_date_of_birth =
                    frm.doc.buyer_date_of_birth || frappe.datetime.get_today();
                  latest_client.custom_national_id =
                    frm.doc.buyer_card_type == "National ID"
                      ? frm.doc.buyer_national_id
                      : null;
                  latest_client.custom_passport_number =
                    frm.doc.buyer_card_type == "Passport"
                      ? frm.doc.buyer_passport_number
                      : null;
                  latest_client.custom_military_number =
                    frm.doc.buyer_card_type == "Military ID"
                      ? frm.doc.buyer_military_number
                      : null;

                  // Save the updated client document
                  frappe.call({
                    method: "frappe.client.save",
                    args: {
                      doc: latest_client,
                    },
                    callback: function (save_response) {
                      if (save_response.message) {
                        frm.set_value("buyer", save_response.message.name);
                      } else {
                        frappe.throw("Error while updating customer");
                      }
                    },
                  });
                }
              },
            });
          }
        },
      });
    }

    // update company if company is already existing or created it if company not already existing
    else if (
      (frm.doc.category_of_buyer == "Company" ||
        frm.doc.category_of_buyer == "Interbank") &&
      !frm.doc.buyer
    ) {
      frappe.call({
        method: "frappe.client.insert",
        args: {
          doc: {
            doctype: "Customer",
            customer_name: frm.doc.buyer_name,
            custom_start_registration_date: frm.doc.buyer_company_start_date
              ? frm.doc.buyer_company_start_date
              : frappe.datetime.get_today(),

            custom_end_registration_date: frm.doc.buyer_company_end_date
              ? frm.doc.buyer_company_end_date
              : frappe.datetime.get_today(),

            custom_comany_address1: frm.doc.buyer_company_address
              ? frm.doc.buyer_company_address
              : "",

            custom_type: frm.doc.category_of_buyer,
            custom_interbank:
              frm.doc.buyer_company_legal_form && frm.doc.category_of_buyer == "Interbank"
                ? true
                : false,

            custom_commercial_no: frm.doc.buyer_company_commercial_no,

            custom_company_activity: frm.doc.buyer_company_activity
              ? frm.doc.buyer_company_activity
              : "",
            custom_legal_form: frm.doc.buyer_company_legal_form
              ? frm.doc.buyer_company_legal_form
              : "",
            custom_is_expired: frm.doc.buyer_expired,

            //company_commercial_no
          },
        },
        callback: function (r) {
          if (r.message) {
            frm.set_value("buyer", r.message.name);
            console.log("buyer updated successfully", r.message.name);
            handleCommissarCreationOrUpdate(frm);
          } else {
            frappe.throw("Error while creating customer");
          }
        },
      });
    } else if (
      (frm.doc.category_of_buyer == "Company" ||
        frm.doc.category_of_buyer == "Interbank") &&
      frm.doc.buyer
    ) {
      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Customer",
          filters: {
            name: frm.doc.buyer,
          },
        },
        callback: function (r) {
          if (r.message) {
            console.log("response from comapny updated", r.message);

            /////////////////////////////////
            var existing_company = r.message;

            // Fetch the latest version of the document
            frappe.call({
              method: "frappe.client.get",
              args: {
                doctype: "Customer",
                name: existing_company.name,
              },
              callback: function (response) {
                if (response.message) {
                  console.log("company name response", response.message);
                  let latest_company = response.message;
                  // Update the relevant fields
                  latest_company.custom_start_registration_date =
                    frm.doc.buyer_company_start_date;
                  latest_company.custom_end_registration_date =
                    frm.doc.buyer_company_end_date;
                  latest_company.custom_comany_address1 =
                    frm.doc.buyer_company_address || "";
                  latest_company.custom_commercial_no =
                    frm.doc.buyer_company_commercial_no;
                  latest_company.custom_legal_form = frm.doc.buyer_company_legal_form;
                  // latest_company.custom_company_no = frm.doc.company_number;
                  latest_company.custom_company_activity =
                    frm.doc.buyer_company_activity;

                  // latest_company.custom_interbank = true
                  //   ? frm.doc.interbank && frm.doc.client_type == "Interbank"
                  //   : false;

                  // Save the updated client document
                  frappe.call({
                    method: "frappe.client.save",
                    args: {
                      doc: latest_company,
                    },
                    callback: function (save_response) {
                      if (save_response.message) {
                        frm.set_value("buyer", save_response.message.name);
                        handleCommissarCreationOrUpdate(frm);
                      } else {
                        frappe.throw("Error while updating customer");
                      }
                    },
                  });
                }
              },
            });
          }
        },
      });
    }
  },

  // set special purchaase rates
  // special_price: (frm) => {
  //   if (frm.doc.docstatus == 0) {
  //     let total_currency_amount = 0;

  //     frm.doc.transactions.forEach((row) => {
  //       if (row.paid_from && row.currency) {
  //         frappe.call({
  //           method:
  //             "teller.teller_customization.doctype.teller_purchase.teller_purchase.get_currency",
  //           args: {
  //             account: row.paid_from,
  //           },
  //           callback: function (r) {
  //             console.log("all rates", r.message);
  //             let purchase_special_rate = r.message[2];
  //             if (purchase_special_rate) {
  //               row.rate = purchase_special_rate;
  //               console.log("special purchase ", purchase_special_rate);
  //               let currency_total = row.rate * row.usd_amount;
  //               row.total_amount = currency_total;

  //               console.log(
  //                 `the total of ${row.currency} is ${row.total_amount}`
  //               );

  //               total_currency_amount += currency_total;
  //               console.log("from loop: " + total_currency_amount);
  //               frm.refresh_field("transactions");
  //               frm.set_value("total", total_currency_amount);
  //             }
  //           },
  //         });
  //       } else {
  //         console.log("error occure");
  //         // frappe.throw(__("please insert all fields"));
  //         frappe.throw(
  //           __("Special Rate Error Please Insert All Required Fields")
  //         );
  //         return;
  //       }
  //     });
  //     // console.log("from outer loop: " + total_currency_amount);
  //   }
  // },

  egy_account: (frm) => {
    if (frm.doc.egy) {
      frappe.call({
        method:
          "teller.teller_customization.doctype.teller_purchase.teller_purchase.account_to_balance",
        args: {
          paid_to: frm.doc.egy_account,
          // company: frm.doc.company,
        },
        callback: function (r) {
          if (r.message) {
            console.log("the egy balance", r.message);
            let egy_balance = r.message;

            frm.set_value("egy_balance", egy_balance);
          } else {
            console.log("not found");
          }
        },
      });
    }
  },
  total: function (frm) {
    if (frm.doc.buyer && frm.doc.total) {
      // check if the total is exceeded
      isExceededLimit(frm, frm.doc.buyer, frm.doc.total);
    } else {
      frappe.msgprint({
        message:
          '<div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 14px;">Please enter Customer to validate the transaction</div>',
        title: "Missing Data Error",
        indicator: "red",
      });
    }
  },
  purchase_commissar: function(frm) {
    if (frm.doc.purchase_commissar) {
      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Contact",
          name: frm.doc.purchase_commissar
        },
        callback: function(r) {
          if (r.message) {
            // Set contact related fields if needed
            frm.refresh_field("purchase_commissar");
          }
        }
      });
    }
  },
});
// currency transactions table

frappe.ui.form.on("Teller Purchase Child", {
  paid_from: function (frm, cdt, cdn) {
    var row = locals[cdt][cdn];
    if (row.paid_from) {
      frappe.call({
        method:
          "teller.teller_customization.doctype.teller_purchase.teller_purchase.get_currency",
        args: {
          account: row.paid_from,
        },
        callback: function (r) {
          console.log(r.message);
          console.log(r.message[0]);
          let curr = r.message[0];
          let currency_rate = r.message[1];
          let currencyCode = r.message[3];
          console.log("the currency code is " + currencyCode);

          frappe.model.set_value(cdt, cdn, "currency", curr);
          frappe.model.set_value(cdt, cdn, "rate", currency_rate);
          frappe.model.set_value(cdt, cdn, "code", currencyCode);
          // frm.set_df_property("paid_from", "hidden", 1);

          // Hide paid_from field in the child table row
          // if (row.code) {
          //   frm.fields_dict["transactions"].grid.grid_rows_by_docname[
          //     row.name
          //   ].toggle_display("paid_from", false);
          // } else {
          //   frm.fields_dict[cdt].grid.grid_rows_by_docname[cdn].toggle_display(
          //     "paid_from",
          //     true
          //   );
          // }
        },
      });

      frappe.call({
        method:
          "teller.teller_customization.doctype.teller_purchase.teller_purchase.account_from_balance",
        args: {
          paid_from: row.paid_from,
          // company: frm.doc.company,
        },
        callback: function (r) {
          if (r.message) {
            console.log(r.message);
            let from_balance = r.message;

            frappe.model.set_value(cdt, cdn, "balance", from_balance);
          } else {
            console.log("not found");
          }
        },
      });
    }
  },

  currency_code(frm, cdt, cdn) {
    var row = locals[cdt][cdn];
    console.log("currency_code is " + row.currency_code);

    let current_user = frappe.session.logged_in_user;
    console.log("USer....",current_user)
    frappe.call({
      method:
        "teller.teller_customization.doctype.teller_purchase.teller_purchase.get_list_currency_code",
      args: {
        session_user: current_user,
        code: row.currency_code,
      },
      callback: function (r) {
        if (r.message) {
          console.log(
            "codes.teller_customization.doctype",
            r.message[0]["account"]
          );
          let account = r.message[0]["account"];
          if (account) {
            frappe.model.set_value(cdt, cdn, "paid_from", account);
            // frm.set_value("receipt_number2", account);
          }
        }
      },
    });
  },

  usd_amount: function (frm, cdt, cdn) {
    var row = locals[cdt][cdn];

    if (row.paid_from && row.usd_amount) {
      let total = row.usd_amount * row.rate;

      frappe.model.set_value(cdt, cdn, "total_amount", total);
      frappe.model.set_value(cdt, cdn, "received_amount", total);

      //received_amount

      // Update currency balances

      // frappe.call({
      //   method:
      //     "teller.teller_customization.doctype.teller_purchase.teller_purchase.account_from_balance",
      //   args: {
      //     paid_from: row.paid_from,
      //     // company: frm.doc.company,
      //   },
      //   callback: function (r) {
      //     if (r.message) {
      //       console.log(r.message);
      //       let from_balance = r.message;

      //       frappe.model.set_value(cdt, cdn, "balance", from_balance);
      //     } else {
      //       console.log("not found");
      //     }
      //   },
      // });
    } else {
      frappe.throw("Amount and Account From  are required");
    }
  },
  total_amount: (frm, cdt, cdn) => {
    let total = 0;
    frm.doc.transactions.forEach((item) => {
      total += item.total_amount;
    });
    frm.set_value("total", total);
  },
  transactions_remove: (frm, cdt, cdn) => {
    let total = 0;
    frm.doc.transactions.forEach((item) => {
      total += item.total_amount;
    });
    frm.set_value("total", total);
    console.log(`after remove ${total}`);
  },
});
// function to setup branch and shift
function set_branch_and_shift(frm) {
  // set the branch
  frappe.call({
    method: "frappe.client.get",
    args: {
      doctype: "Branch",
      filters: {
        custom_active: 1,
      },
    },
    callback: function (r) {
      if (!r.exc) {
        let branch = r.message.name;
        frm.set_value("branch_no", branch);
        console.log("the branch is ", branch);
      }
    },
  });
  // Set the the active open shift and current user
  frappe.call({
    method: "frappe.client.get_value",
    args: {
      doctype: "Open Shift for Branch",
      filters: { "shift_status": "Active" },
      fieldname: ["name", "current_user"],
    },
    callback: function (r) {
      if (!r.exc) {
        let shift = r.message.name;
        let current_user = r.message.current_user;

        frm.set_value("shift", shift);
        frm.set_value("teller", current_user);
      }
    },
  });
  // set the current active Printing roll
  frappe.call({
    method: "frappe.client.get_list",
    args: {
      doctype: "Printing Roll",
      filters: {
        active: 1, // Filter to get active Printing Roll
      },
      limit: 1, // Get only one active Printing Roll
      order_by: "creation DESC", // Order by creation date to get the latest active Printing Roll
    },
    callback: (r) => {
      if (!r.exc && r.message && r.message.length > 0) {
        active_roll = r.message[0].name;
        frm.set_value("current_roll", active_roll);
      }
    },
  });
}

// create or update commissar
function handleCommissarCreationOrUpdate(frm) {
  if (
    (frm.doc.category_of_buyer == "Company" ||
      frm.doc.category_of_buyer == "Interbank") &&
    frm.doc.buyer &&
    !frm.doc.commissar
  ) {
    if (!frm.doc.buyer) {
      frappe.msgprint(__("Please select Company first."));
      return;
    }

    var newContact = frappe.model.get_new_doc("Contact");
    newContact.links = [
      {
        link_doctype: "Customer",
        link_name: frm.doc.buyer,
      },
    ];

    // Set the necessary fields
    newContact.first_name = frm.doc.purchase_com_name;
    newContact.custom_com_gender = frm.doc.purchase_com_gender;

    newContact.custom_com_address = frm.doc.purchase_com_address;
    newContact.custom_com_phone = frm.doc.purchase_com_phone;
    newContact.custom_national_id = frm.doc.purchase_com_national_id;
    newContact.custom_job_title = frm.doc.purchase_com_job_title;
    newContact.custom_mobile_number = frm.doc.purchase_com_mobile_number;

    frappe.call({
      method: "frappe.client.insert",
      args: {
        doc: newContact,
      },
      callback: function (r) {
        if (r.message) {
          frappe.show_alert({
            message: __("Commissar added successfully"),
            indicator: "green",
          });
          frm.set_value("commissar", r.message.name);
        }
      },
    });
  } else if (
    (frm.doc.category_of_buyer === "Company" ||
      frm.doc.category_of_buyer === "Interbank") &&
    frm.doc.buyer &&
    frm.doc.commissar
  ) {
    frappe.call({
      method: "frappe.client.get",
      args: {
        doctype: "Contact",
        name: frm.doc.commissar,
      },
      callback: function (r) {
        if (r.message) {
          let existing_contact = r.message;

          // Update the relevant fields
          existing_contact.first_name = frm.doc.purchase_com_name;
          existing_contact.custom_com_gender = frm.doc.purchase_com_gender;
          existing_contact.custom_national_id = frm.doc.purchase_com_national_id;
          existing_contact.custom_com_address = frm.doc.purchase_com_address || "";
          existing_contact.custom_com_phone = frm.doc.purchase_com_phone;
          existing_contact.custom_job_title = frm.doc.purchase_com_job_title;
          existing_contact.custom_mobile_number = frm.doc.purchase_com_mobile_number;

          frappe.call({
            method: "frappe.client.save",
            args: {
              doc: existing_contact,
            },
            callback: function (save_response) {
              if (save_response.message) {
                frappe.show_alert({
                  message: __("Commissar updated successfully"),
                  indicator: "green",
                });
                frm.set_value("commissar", save_response.message.name);
              } else {
                frappe.throw(__("Error while updating Commissar"));
              }
            },
            error: function () {
              frappe.throw(__("Error while updating Commissar"));
            },
          });
        } else {
          frappe.throw(__("Commissar not found"));
        }
      },
      error: function () {
        frappe.throw(__("Error while fetching Commissar details"));
      },
    });
  }
}

// get the allowed amount from Teller settings
async function fetchAllowedAmount() {
  return frappe.db.get_single_value(
    "Teller Setting",
    "purchase_allowed_amount"
  );
}

// fetch the duration of days for the limit
async function fetchLimitDuration() {
  return frappe.db.get_single_value("Teller Setting", "purchase_duration");
}

// get the customer Total Invoices Amount
async function getCustomerTotalAmount(clientName, duration) {
  let limiDuration = await fetchLimitDuration();
  return new Promise((resolve, reject) => {
    frappe.call({
      method:
        "teller.teller_customization.doctype.teller_purchase.teller_purchase.get_customer_total_amount",
      args: {
        client_name: clientName,
        duration: limiDuration,
      },
      callback: function (r) {
        if (r.message) {
          resolve(r.message);
        } else {
          reject("No response message");
        }
      },
    });
  });
}

//  check if the if the current invioce or customer total invoices  exceeds the limit

async function isExceededLimit(frm, clientName, invoiceTotal) {
  let allowedAmount = await fetchAllowedAmount();
  console.log("the allowed amount is", allowedAmount);

  let customerTotal = await getCustomerTotalAmount(clientName);
  console.log("the customer total is", customerTotal);

  let limiDuration = await fetchLimitDuration();
  console.log("the limit duration", limiDuration);

  if (allowedAmount && limiDuration && customerTotal) {
    if (invoiceTotal > allowedAmount && customerTotal > allowedAmount) {
      let message = `
            <div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 14px;">
              The Total Amount of the Current Invoice  And  Customer Total  ${customerTotal} Withen ${limiDuration} Days EGP are Exceed Limit  ${allowedAmount} EGP 
            </div>`;

      frappe.msgprint({
        message: message,
        title: "Limitations Exceeded",
        indicator: "red",
      });
      frm.set_value("exceed", true);
    } else if (invoiceTotal > allowedAmount) {
      let message = `
        <div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 14px;">
          The Total Amount of the Current Invoice  is Exceed Limit ${allowedAmount} EGP 
        </div>`;

      frappe.msgprint({
        message: message,
        title: "Limitations Exceeded",
        indicator: "red",
      });
      frm.set_value("exceed", true);
    } else if (customerTotal > allowedAmount) {
      let message = `
        <div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 14px;">
           Customer Total   ${customerTotal} EGP Withen ${limiDuration} Days  are Exceed Limit ${allowedAmount} EGP 
        </div>`;

      frappe.msgprint({
        message: message,
        title: "Limitations Exceeded",
        indicator: "red",
      });
      frm.set_value("exceed", true);
    } else {
      frm.set_value("exceed", false);
    }
  } else {
    frappe.throw(
      "Please provide in settings allowing for limit  and the duration"
    );
  }
}

// validate the national id

function validateNationalId(frm, nationalId) {
  // if (!/^\d{14}$/.test(nationalId)) {
  //   frappe.msgprint(
  //     __("National ID must be exactly 14 digits and contain only numbers.")
  //   );
  //   frappe.validated = false;
  // }
  return /^[0-9]{14}$/.test(nationalId); // Example: Assuming national ID is a 14-digit number
}
// validate end registration date is must be after start registration
function validateRegistrationDate(frm, start, end) {
  if (start && end && start > end) {
    frappe.msgprint(__("Registration Date cannot be after Expiration Date."));
    frappe.validated = false;
  }
}
// validate if the registration date is expired
function validateRegistrationDateExpiration(frm, end) {
  if (end) {
    // Get today's date using Frappe's date utility
    const today = frappe.datetime.get_today();

    // Convert dates to Date objects for comparison
    const endDate = new Date(end);
    const todayDate = new Date(today);

    // Compare the dates
    if (endDate < todayDate) {
      frm.set_value("is_expired", true);
    }
  }
}

// function check_and_set_customer(frm) {
//   let customer_name = frm.doc.buyer;
//   if (customer_name) {
//     frappe.call({
//       method: "frappe.client.get",
//       args: {
//         doctype: "Customer",
//         name: customer_name,
//       },
//       callback: function (r) {
//         if (!r.message) {
//           // Customer does not exist, set the name in another field
//           frm.set_value("customer_name", customer_name);
//         }
//       },
//     });
//   }
// }
//////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////Get Item From////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
frappe.ui.form.on("Teller Purchase",{
    special_price(frm){
        if (!frm.doc.category_of_buyer || frm.doc.category_of_buyer !== 'Interbank'){
          frappe.throw({
            title:__("Mandatory"),
            message:__(" Mandatory to Select a Category of Buyer as Interbank")
          })
        }else{
          cur_frm.clear_table("transactions");
        }
        if (!frm.doc.buyer){
          frappe.throw({
            title:__("Mandatory"),
            message:__(" Mandatory to Select a Buyer ")
          })
        }
        new frappe.ui.form.MultiSelectDialog({
          doctype:"Booking Interbank",
          target:cur_frm,
          setters: {
            transaction: 'Purchasing',
            branch: null,
            customer: 'البنك الاهلي',
        },
        // allow_child_item_selection: 1,
        child_columns: ["currency","qty","rate"],
        child_fieldname:"booked_currency",
        columns: ["name", "transaction", "status","date"],
        action(selections,args) {
          // console.log("children",args.filtered_children);
          // console.log("selections",selections);
        
            selections.forEach(function(booking_ib){
              console.log("ib",booking_ib)
              if (booking_ib){
                  frappe.call({
                    method:"frappe.client.get",
                    args:{
                      "doctype":"Booking Interbank",
                        filters:{
                          "name":booking_ib,
                          "status": ["in", ["Partial Billed", "Not Billed"]]
                        }
                    },callback:function(response){
                        if(response){
                          // response
                          console.log("Response",response.message)
                          response.message.booked_currency.forEach(function(item){
                            var bo_items = args.filtered_children;
                            if (item.status === "Not Billed") {
                              if(bo_items.length){
                            
                                bo_items.forEach(function(bo_item){
                                  if(bo_item == item.name){
                                    console.log("iiiiiii",item)
                                    // frappe.msgprint("Booking Interbank1 => Selected")
                                      var child = frm.add_child("transactions");
                                      child.code = item.currency_code;
                                      child.currency_code = item.currency;
                                      child.usd_amount = item.qty;
                                      child.rate = item.rate;
                                      child.total_amount = item.qty * item.rate;
                                      child.booking_interbank = booking_ib;
                                      get_account(frm, child);
                            
                                  }
                                })
                              }else{
                                console.log("tab from select booking",item)

                                // frappe.msgprint("Booking Interbank2 => Selected")
                                var child = frm.add_child("transactions");
                                child.code = item.currency_code;
                                get_account(frm, child);
                                child.booking_interbank = booking_ib;
                                child.currency_code = item.currency;
                                child.total_amount = item.qty * item.rate;
                                child.usd_amount = item.qty;
                                child.rate = item.rate;
                              }
                              
                            }
                          })
                          frm.refresh_field("transactions");
                            cur_dialog.hide();
                            let total = 0;
              
                            frm.doc.transactions.forEach((item) => {
                        //       // frm.db.set_valu
                              total += item.total_amount;
                            });
                            frm.set_value("total", total);
                            frm.refresh_field("total");

                    console.log("before save total is :",total)

                        }
                      }
                    
                  })            
              }
            })
        }
        })
      
    
    }
})
///////////////////////////////Function get account by User\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
///////////////////////////////Function get account by User\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

function get_account (frm, child){

  if (child.code) {
    console.log("Code entered222222:", child);
  
  //   // Step 1: Fetch User Permissions for Accounts
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "User Permission",
            filters: {
              // user: 'andrew@datasofteg.com',
                user: frappe.session.user, // Filter by the current user
                allow: "Account" // Ensure permissions are for the Account doctype
            },
            fields: ["for_value"]
        },
        callback: function(permissionResponse) {
            console.log("User Permission (response):", permissionResponse);
  
            if (permissionResponse.message && permissionResponse.message.length > 0) {
              console.log("for_value:", permissionResponse.message);
                let userAccounts = permissionResponse.message.map(record => record.for_value);
                console.log("Accounts from User Permission (userAccounts):", userAccounts);
  
                // Step 2: Check each user-permitted account for matching custom_currency_code
                frappe.call({
                    method: "frappe.client.get_list",
                    args: {
                        doctype: "Account",
                        filters: {
                            parent_account: ["in", userAccounts], // Accounts must be under the parent_account from User Permission
                            custom_currency_code: child.code // Match custom_currency_code with the entered code
                        },
                        fields: ["name", "custom_currency_code", "parent_account"]
                    },
                    callback: function(accountResponse) {
                        console.log("Account fetch response:", accountResponse);
  
                        if (accountResponse.message && accountResponse.message.length > 0) {
                            let matchingAccount = accountResponse.message; // Use the first match
                            console.log("Matching Account Found:", matchingAccount);
                            for (let cur of matchingAccount){
                              if (cur.custom_currency_code === child.code){
                                console.log("ssss",cur.name)
                                frappe.model.set_value(child.doctype, child.name, "paid_from", cur.name);
    
                              }
                            }
    
                            // Set the account name in the paid_from field
                        } else {
                            console.log(`No matching Account found for code: ${child.code}`);
                            frappe.msgprint(`No matching Account found for code: ${child.code}`);
                            frappe.model.set_value(child.doctype, child.name, "paid_from", null); // Clear the field
                        }
                    }
                });
            } else {
                console.log("No User Permissions found for Accounts.");
                frappe.msgprint("No User Permissions found for Accounts.");
                frappe.model.set_value(child.doctype, child.name, "paid_from", null); // Clear the field
            }
        }
    });
  } else {
    console.log("Code field is empty. No action taken.");
  }
  
}

////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////
                              //  Filter paid_from //
  //////////////////////////////////////////////////////////////////////////////////////////
  frappe.ui.form.on("Teller Purchase Child", {
    // filter accounts
  
    code: function (frm, cdt, cdn) {
      var row = locals[cdt][cdn];
      console.log(row)
      var code = row.code;
      var curr = row.currency;

          frm.fields_dict["transactions"].grid.get_field("paid_from").get_query =
      function () {


        return {
          filters: {
          
            account_currency: ["!=", "EGP"],
            is_group: 0,
            custom_currency_number: row.code,
          },
        };
      };
    },
    paid_from: function (frm, cdt, cdn) {
      var row = locals[cdt][cdn];
      console.log(row)
      var code = row.code;
      var curr = row.currency;

          frm.fields_dict["transactions"].grid.get_field("paid_from").set_query =
      function () {


        return {
          filters: {
          
            account_currency: ["!=", "EGP"],
            is_group: 0,
            custom_currency_number: row.code,
          },
        };
      };
    },
    
  })

    //////////////////////////////////////////////////////////////////////////////////////////
                              //  Fetch Currency  //
  //////////////////////////////////////////////////////////////////////////////////////////

  frappe.ui.form.on("Teller Purchase Child", {
    code(frm, cdt, cdn) {
      var row = locals[cdt][cdn];
      frappe.call({
        method: "frappe.client.get_list",
        args: {
          doctype: "Currency",
          fields: ["name", "custom_currency_code"],
          filters: [["custom_currency_code", "=", row.code]],
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
            frappe.model.set_value(cdt, cdn, "currency_code", currency.name);
            frappe.model.set_value(cdt, cdn, "currency", currency.name);

            // Optionally, you can set additional fields if needed
            // frappe.model.set_value(cdt, cdn, "another_field", currency.another_field);
          } else {
            console.log("No matching currencies found.");
          }
        },
      });
      ////////////////////////////////Fixing User Permission\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
            
      if (row.code) {
        console.log("Code entered:", row.code);

        // Step 1: Fetch User Permissions for Accounts
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "User Permission",
                filters: {
                    user: frappe.session.user, // Filter by the current user
                    allow: "Account" // Ensure permissions are for the Account doctype
                },
                fields: ["for_value"]
            },
            callback: function(permissionResponse) {
                console.log("User Permission response:", permissionResponse);

                if (permissionResponse.message && permissionResponse.message.length > 0) {
                    let userAccounts = permissionResponse.message.map(record => record.for_value);
                    console.log("Accounts from User Permission:", userAccounts);

                    // Step 2: Check each user-permitted account for matching custom_currency_code
                    frappe.call({
                        method: "frappe.client.get_list",
                        args: {
                            doctype: "Account",
                            filters: {
                                parent_account: ["in", userAccounts], // Accounts must be under the parent_account from User Permission
                                custom_currency_code: row.code // Match custom_currency_code with the entered code
                            },
                            fields: ["name", "custom_currency_code", "parent_account"]
                        },
                        callback: function(accountResponse) {
                            console.log("Account fetch response:", accountResponse);

                            if (accountResponse.message && accountResponse.message.length > 0) {
                                let matchingAccount = accountResponse.message[0]; // Use the first match
                                console.log("Matching Account Found:", matchingAccount);

                                // Set the account name in the paid_from field
                                frappe.model.set_value(cdt, cdn, "paid_from", matchingAccount.name);
                            } else {
                                console.log(`No matching Account found for code: ${row.code}`);
                                frappe.msgprint(`No matching Account found for code: ${row.code}`);
                                frappe.model.set_value(cdt, cdn, "paid_from", null); // Clear the field
                            }
                        }
                    });
                } else {
                    console.log("No User Permissions found for Accounts.");
                    frappe.msgprint("No User Permissions found for Accounts.");
                    frappe.model.set_value(cdt, cdn, "paid_from", null); // Clear the field
                }
            }
        });
    } else {
        console.log("Code field is empty. No action taken.");
    }



    },
  });


frappe.ui.form.on("Teller Purchase",{
  refresh: function(frm) {
    if (frm.doc.docstatus == 1) {
      frm.add_custom_button(__("Return / Credit Note")
      , ()=>{
        frm.call({
          method: "teller.teller_customization.doctype.teller_purchase.teller_purchase.make_purchase_return",
          args:{
            doc:frm.doc,
          },

          callback: (r) => {
          
            if (r) {
              console.log("Respone 22",r.message)
              let name_doc = r.message.new_teller_purchase
              // frappe.msgprint(__("Accounting Entries are reposted"));
              frappe.set_route('Form', "Teller Purchase", name_doc);

            }
          },
        });
      }
      , __("Create"));
    }
  }
})  

// frappe.ui.form.on("Teller Purchase",{
//   refresh: function(frm) {
//     if (frm.doc.docstatus == 1) {
//       frm.add_custom_button(__("Return / Credit Note"), function() {
//           frm.events.make_sales_return(frm);
//         }
//       , __("Create"));
//     }
//   },
//   make_sales_return: function(frm) {
//     // Call the method to create the purchase return
//     frappe.model.open_mapped_doc({
//       method: "teller.teller_customization.doctype.teller_purchase.teller_purchase.make_purchase_return2",
//       frm: frm
//     });
//   }
// });




frappe.ui.form.on("Teller Purchase",{
  category_of_buyer(frm){
if (frm.doc.category_of_buyer == "Foreigner"){
  frm.set_value("card_type","Passport")
  frm.refresh_field("card_type");
}
if (frm.doc.category_of_buyer == "Egyptian"){
  frm.set_value("card_type","National ID")
  frm.refresh_field("card_type");
}
  },
  async fetch_national_id(frm){
    let x =  await frappe.db.get_doc("Customer",cur_frm.doc.fetch_national_id)
    console.log("xxxxxxxxxxx",x.custom_is_expired )
    if(x.custom_is_expired == 1){
      frappe.throw({
        title:__("Buyer Expired"),
        message:__(" Expired Registration Date For Buyer")
      })

    }
  
  },
  validate(frm){
    if(frm.doc.is_expired == 1){
      frappe.throw({
        title:__("Buyer Expired"),
        message:__(" Expired Registration Date For Buyer")
      })
  }
  }
})
