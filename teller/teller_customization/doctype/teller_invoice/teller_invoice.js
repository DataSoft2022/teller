// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Teller Invoice", {
  client_type(frm) {
    // First clear all ID fields
    frm.set_value('national_id', '');
    frm.set_value('passport_number', '');
    frm.set_value('military_number', '');
    
    // Handle individual section for Egyptian/Foreigner
    if (frm.doc.client_type == "Egyptian" || frm.doc.client_type == "Foreigner") {
      frm.set_df_property('individual_section', 'hidden', 0);
      
      if (frm.doc.client_type == "Egyptian") {
        frm.set_value("card_type", "National ID");
        frm.set_df_property('national_id', 'hidden', 0);
        frm.set_df_property('passport_number', 'hidden', 1);
      } else {
        frm.set_value("card_type", "Passport"); 
        frm.set_df_property('passport_number', 'hidden', 0);
        frm.set_df_property('national_id', 'hidden', 1);
      }
    } else {
      frm.set_df_property('individual_section', 'hidden', 1);
    }
    
    // Handle commissar section visibility
    if (frm.doc.client_type === "Company") {
        // Show/enable commissar section for Company
        frm.set_df_property('commissar_info_section', 'hidden', 0);
        frm.set_df_property('commissar', 'read_only', 0);
        frm.set_df_property('commissar', 'reqd', 0);
        
        // Enable commissar fields
        ['commissar', 'com_name', 'com_national_id', 
         'com_address', 'com_gender', 'com_phone',
         'com_mobile_number', 'com_job_title'].forEach(field => {
            frm.set_df_property(field, 'read_only', 0);
        });
    } else if (frm.doc.client_type === "Interbank") {
        // Show but make read-only for Interbank
        frm.set_df_property('commissar_info_section', 'hidden', 0);
        frm.set_df_property('commissar', 'read_only', 1);
        frm.set_df_property('commissar', 'reqd', 0);
        
        // Make commissar fields read-only
        ['commissar', 'com_name', 'com_national_id', 
         'com_address', 'com_gender', 'com_phone',
         'com_mobile_number', 'com_job_title'].forEach(field => {
            frm.set_df_property(field, 'read_only', 1);
        });
    } else {
        // Hide/disable commissar section for all other types
        frm.set_df_property('commissar_info_section', 'hidden', 1);
        frm.set_df_property('commissar', 'reqd', 0);
        frm.set_df_property('commissar', 'read_only', 1);
        
        // Clear and disable commissar fields
        ['commissar', 'com_name', 'com_national_id', 
         'com_address', 'com_gender', 'com_phone',
         'com_mobile_number', 'com_job_title'].forEach(field => {
            frm.set_value(field, '');
            frm.set_df_property(field, 'read_only', 1);
        });
    }
    
    // Handle Interbank specific settings
    if (frm.doc.client_type === "Interbank") {
        // Clear and disable exceed
        frm.set_value('exceed', 0);
        frm.set_df_property('exceed', 'read_only', 1);
        frm.set_df_property('exceed', 'hidden', 1);
        
        // For Interbank, automatically set the client to "البنك الاهلي"
        frappe.db.get_value('Customer', {customer_name: 'البنك الاهلي'}, 'name')
          .then(r => {
            if (r && r.message && r.message.name) {
              frm.set_value('client', r.message.name);
            } else {
              frappe.msgprint(__('Customer "البنك الاهلي" not found. Please create this customer first.'));
            }
          });
    } else {
        // Enable exceed for non-Interbank
        frm.set_df_property('exceed', 'read_only', 1);
        frm.set_df_property('exceed', 'hidden', 0);
    }
    
    // Clear fields based on type
    clearFieldsBasedOnType(frm);
    
    // Get and set the central bank number based on type
    if (frm.doc.client_type) {
        let field_name;
        switch(frm.doc.client_type) {
            case 'Egyptian':
                field_name = 'egyptian_number';
                break;
            case 'Foreigner':
                field_name = 'foreigner_number';
                break;
            case 'Company':
                field_name = 'company_number';
                break;
            case 'Interbank':
                field_name = 'interbank_number';
                break;
            default:
                field_name = null;
        }
        
        if (field_name) {
            frappe.db.get_single_value('Teller Setting', field_name)
                .then(value => {
                    frm.set_value('central_bank_number', value);
                });
        }
    }

    // Show/hide identification fields based on type
    showIdentificationFields(frm);

    // If there's already a search ID, trigger the search after a short delay
    if (frm.doc.client_search_id) {
        setTimeout(() => {
            frm.trigger('client_search_id');
        }, 100);
    }
  },

  card_type: function(frm) {
    showIdentificationFields(frm);
  },

  refresh(frm) {
    // Set focus on client field only for new documents
    if (frm.is_new()) {
      setTimeout(function () {
        const clientField = frm.get_field("client");
        if (clientField && clientField.$input) {
          clientField.$input.focus();
        }
      }, 100);
    }

    // Keep total field hidden
    frm.toggle_display('total', false);
    frm.set_df_property('total', 'hidden', 1);
    
    // Keep total_egy field hidden
    frm.toggle_display('total_egy', false);
    frm.set_df_property('total_egy', 'hidden', 1);

    // filter clients based on client type
    frm.set_query("client", function (doc) {
      return {
        filters: {
          custom_type: doc.client_type,
        },
      };
    });

    // filters commissar based on company name
    frm.set_query("commissar", function (doc) {
      return {
        query: "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_contacts_by_link",
        filters: {
          link_doctype: "Customer",
          link_name: doc.client,
        }
      };
    });
    
    // Add buttons for submitted documents
    if (frm.doc.docstatus === 1) {
      // Add ledger button
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

      // Add return button if document is not already returned
      if (!frm.doc.is_returned) {
        frm.add_custom_button(__('Return'), function() {
          // Show confirmation dialog
          frappe.confirm(
            __(`Are you sure you want to create a return for this invoice?<br><br>
            This will:<br>
            • Reverse all currency amounts and quantities<br>
            • Create reverse GL entries<br>
            • Mark this invoice as returned<br>
            • Total amount of <strong>${format_currency(Math.abs(frm.doc.total), 'EGP')}</strong> will be reversed<br><br>
            This action cannot be undone.`),
            function() {
              // On 'Yes' - proceed with return
              frappe.call({
                method: 'teller.teller_customization.doctype.teller_invoice.teller_invoice.make_sales_return',
                args: {
                  doc: frm.doc
                },
                callback: function(r) {
                  if (r.message) {
                    frm.reload_doc();
                  }
                }
              });
            },
            function() {
              // On 'No' - do nothing
            }
          );
        });
      }
    }

    set_branch_and_shift(frm);

    // Make invoice info section always expandable
    frm.toggle_display('invoice_info_section', true);
    frm.set_df_property('invoice_info_section', 'collapsible', 1);

    // Show treasury code for saved or submitted documents
    if (frm.doc.docstatus || !frm.doc.__islocal) {
      frm.toggle_display('treasury_code', true);
    }

    // Get treasury details if not set
    if (!frm.doc.treasury_code) {
      frappe.call({
        method: 'frappe.client.get_value',
        args: {
          doctype: 'Employee',
          filters: { user_id: frappe.session.user },
          fieldname: 'name'
        },
        callback: function(r) {
          if (r.message && r.message.name) {
            frappe.call({
              method: 'frappe.client.get_list',
              args: {
                doctype: 'Open Shift for Branch',
                filters: {
                  current_user: r.message.name,
                  shift_status: 'Active',
                  docstatus: 1
                },
                fields: ['name', 'treasury_permission'],
                limit: 1
              },
              callback: function(r) {
                if (r.message && r.message.length > 0) {
                  let shift = r.message[0];
                  frm.set_value('treasury_code', shift.treasury_permission);
                  frm.set_value('shift', shift.name);
                  
                  // Get treasury's EGP account
                  frappe.call({
                    method: 'frappe.client.get',
                    args: {
                      doctype: 'Teller Treasury',
                      name: shift.treasury_permission
                    },
                    callback: function(r) {
                      if (r.message && r.message.egy_account) {
                        frm.set_value('egy', r.message.egy_account);
                      } else {
                        frappe.msgprint(__('EGP Account not set for treasury {0}', [shift.treasury_permission]));
                      }
                    }
                  });
                } else {
                  frappe.msgprint(__('No active shift found'));
                }
              }
            });
          }
        }
      });
    }

    // Hide expired fields by default
    frm.toggle_display("expired", false);
    frm.toggle_display("is_expired1", false);
    
    // Check expiry if data exists
    if (frm.doc.issue_date) {
      validateIdExpiration(frm);
    }
    if (frm.doc.end_registration_date) {
      validateRegistrationDateExpiration(frm, frm.doc.end_registration_date);
    }

    // Make registration date fields read-only after submission
    if (frm.doc.docstatus === 1) {
      frm.set_df_property('start_registration_date', 'read_only', 1);
      frm.set_df_property('end_registration_date', 'read_only', 1);
    }
  },

  issue_date: function(frm) {
    validateIdExpiration(frm);
  },

  special_price: function(frm) {
    if (!frm.doc.client_type || frm.doc.client_type !== 'Interbank') {
        frappe.msgprint({
            title: __('Invalid Category'),
            message: __('Special price is only available for Interbank category'),
            indicator: 'red'
        });
        return;
    }

    new frappe.ui.form.MultiSelectDialog({
        doctype: "Booking Interbank",
        target: frm,
        setters: {
            status: null,
        },
        add_filters_group: 1,
        date_field: "date",
        get_query() {
            return {
                filters: {
                    status: ["in", ["Partial Billed", "Not Billed"]],
                    docstatus: ["in", [0, 1]],
                    transaction: "Selling"
                }
            };
        },
        action(selections, args) {
            if (!selections || selections.length === 0) {
                frappe.msgprint(__("No bookings selected"));
                return;
            }
            
            // Check for existing bookings in the current document
            let existingBookings = new Set(frm.doc.teller_invoice_details.map(detail => detail.booking_interbank).filter(Boolean));
            
            // Process each selected booking
            selections.forEach(function(booking_ib) {
                if (booking_ib) {
                    // Skip if this booking is already used
                    if (existingBookings.has(booking_ib)) {
                        frappe.msgprint(__("Booking {0} has already been added to this invoice", [booking_ib]));
                        return;
                    }

                    frappe.call({
                        method: "frappe.client.get",
                        args: {
                            doctype: "Booking Interbank",
                            name: booking_ib
                        },
                        callback: function(response) {
                            if (response && response.message) {
                                let booking = response.message;
                                
                                if (booking.booked_currency && booking.booked_currency.length > 0) {
                                    let availableItems = booking.booked_currency.filter(item => 
                                        item.status === "Not Billed" || item.status === "Partial Billed"
                                    );
                                    
                                    if (availableItems.length === 0) {
                                        frappe.msgprint(__("No available currencies in booking {0}", [booking_ib]));
                                        return;
                                    }
                                    
                                    availableItems.forEach(function(item) {
                                        let availableQty = 0;
                                        if (item.status === "Not Billed") {
                                            availableQty = item.qty;
                                            addTransactionRow(frm, item, availableQty, booking_ib);
                                        } else if (item.status === "Partial Billed") {
                                            frappe.call({
                                                method: 'frappe.client.get_list',
                                                args: {
                                                    doctype: 'Teller Invoice',
                                                    filters: {
                                                        docstatus: 1,
                                                        'teller_invoice_details.booking_interbank': booking_ib,
                                                        'teller_invoice_details.currency_code': item.currency_code
                                                    },
                                                    fields: ['teller_invoice_details.quantity as billed_qty']
                                                },
                                                callback: function(r) {
                                                    let totalBilled = 0;
                                                    if (r.message) {
                                                        r.message.forEach(doc => {
                                                            totalBilled += flt(doc.billed_qty);
                                                        });
                                                    }
                                                    availableQty = flt(item.qty) - totalBilled;
                                                    
                                                    if (availableQty > 0) {
                                                        addTransactionRow(frm, item, availableQty, booking_ib);
                                                    }
                                                }
                                            });
                                        }
                                    });
                                } else {
                                    frappe.msgprint(__("No booked currencies found in booking {0}", [booking_ib]));
                                }
                            }
                        }
                    });
                }
            });
        }
    });
  },
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
    //
  },

  onload(frm) {
    // setTimeout(function () {
    //   frm.get_field["fetch_national_id"].$input.focus();
    // }, 500);
  },
  // onload_post_render: function (frm) {
  //   // Remove the keydown event when the form is closed
  //   frappe.ui.keys.off("alt+f2");
  // },
  // fetch national id or commerical no

  // Get customer information if exists
  client: function (frm) {
    if (!frm.doc.client) return;
    
    // Set flag to prevent recursive updates
    if (frm._updatingClient) return;
    frm._updatingClient = true;
    
      frappe.db.get_doc('Customer', frm.doc.client)
        .then(customer => {
        if (frm.doc.client_type === "Company" || frm.doc.client_type === "Interbank") {
          // For submitted docs, only update display without triggering form changes
          if (frm.doc.docstatus === 1) {
            // Don't update registration dates for submitted docs
            frm.doc.company_name = customer.customer_name;
            frm.doc.company_activity = customer.custom_company_activity;
            frm.doc.company_commercial_no = customer.custom_commercial_no;
            frm.doc.company_num = customer.custom_company_no;
            frm.doc.comoany_address = customer.custom_comany_address1;
            frm.doc.is_expired1 = customer.custom_is_expired;
            frm.doc.interbank = customer.custom_interbank;
            frm.doc.company_legal_form = customer.custom_legal_form;
            frm.refresh_fields();
          } else {
            // For non-submitted docs, use set_value
          const companyFields = {
            'company_name': customer.customer_name,
            'company_activity': customer.custom_company_activity,
            'company_commercial_no': customer.custom_commercial_no,
            'start_registration_date': customer.custom_start_registration_date,
            'end_registration_date': customer.custom_end_registration_date,
            'company_num': customer.custom_company_no,
            'comoany_address': customer.custom_comany_address1,
            'is_expired1': customer.custom_is_expired,
            'interbank': customer.custom_interbank,
            'company_legal_form': customer.custom_legal_form
          };

            // Only set values for fields that have data and are different
          Object.entries(companyFields).forEach(([field, value]) => {
              if (value && frm.doc[field] !== value && (!frm.doc.docstatus || !['start_registration_date', 'end_registration_date'].includes(field))) {
              frm.set_value(field, value);
            }
        });
    }
        }
        frm._updatingClient = false;
      });
  },

  // add comissar to invoice

  commissar: function (frm) {
    if (
      frm.doc.client_type == "Company" ||
      (frm.doc.client_type == "Interbank" && frm.doc.client)
    ) {
      if (frm.doc.commissar) {
        var commissarNAme = frm.doc.commissar;
        var companyName = frm.doc.client;
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
            frm.set_value("com_national_id", r.message.custom_national_id);
            frm.set_value("com_gender", r.message.custom_com_gender);
            frm.set_value("com_address", r.message.custom_com_address);
            frm.set_value("com_name", r.message.first_name);

            frm.set_value("com_phone", r.message.custom_com_phone);
            frm.set_value("com_job_title", r.message.custom_job_title);
            frm.set_value("com_mobile_number", r.message.custom_mobile_number);
          },
        });
      } else {
        // clear the fields
        frm.set_value("com_national_id", "");
        frm.set_value("com_gender", "");
        frm.set_value("com_address", "");
        frm.set_value("com_name", "");
        frm.set_value("com_phone", "");
        frm.set_value("com_job_title", "");
        frm.set_value("com_mobile_number", "");
      }
    } else {
      __("Please select Company Name Before add Commissar");
    }
  },

  // add customer if not already existing///////////////////
  // not we change trigger for testing
  before_save: function (frm) {
    /////test customer history

    ////////

    if (frm.doc.client) {
      // update_contact_list(frm);
    }
    if (
      (frm.doc.client_type == "Egyptian" ||
        frm.doc.client_type == "Foreigner") &&
      !frm.doc.client   
    ) {
      frappe.call({
        method: "frappe.client.insert",
        args: {
          doc: {
            doctype: "Customer",
            customer_name: frm.doc.customer_name,
            customer_name: frm.doc.customer_name,
            gender: frm.doc.gender ? frm.doc.gender : "Male",
            custom_card_type: frm.doc.card_type,
            custom_mobile: frm.doc.mobile_number ? frm.doc.mobile_number : "",
            // custom_work_for: frm.doc.work_for,
            custom_address: frm.doc.address,
            // custom_nationality: frm.doc.nationality,
            // custom_issue_date: frm.doc.issue_date,
            // custom_expired: frm.doc.expired,
            // custom_place_of_birth: frm.doc.place_of_birth,
            custom_date_of_birth: frm.doc.date_of_birth
              ? frm.doc.date_of_birth
              : frappe.datetime.get_today(),
            // custom_job_title: frm.doc.job_title,
            custom_type: frm.doc.client_type,
            custom_national_id:
              frm.doc.card_type == "National ID" ? frm.doc.national_id : null,
            custom_passport_number:
              frm.doc.card_type == "Passport" ? frm.doc.passport_number : null,
            custom_military_number:
              frm.doc.card_type == "Military ID"
                ? frm.doc.military_number
                : null,
          },
        },
        callback: function (r) {
          if (r.message) {
            frm.set_value("client", r.message.name);
          } else {
            frappe.throw("Error while creating customer");
          }
        },
      });
    } else if (
      (frm.doc.client_type == "Egyptian" ||
        frm.doc.client_type == "Foreigner") &&
      frm.doc.client
    ) {
      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Customer",
          filters: {
            name: frm.doc.client,
          },
        },
        callback: function (r) {
          if (r.message) {
            console.log(r.message);

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

                  latest_client.custom_card_type = frm.doc.card_type;
                  latest_client.custom_work_for = frm.doc.work_for;

                  latest_client.custom_nationality = frm.doc.nationality;
                  latest_client.custom_mobile = frm.doc.mobile_number;
                  latest_client.custom_phone = frm.doc.phone;
                  latest_client.custom_place_of_birth = frm.doc.place_of_birth;

                  latest_client.custom_address = frm.doc.address;
                  latest_client.custom_job_title = frm.doc.job_title;
                  latest_client.custom_date_of_birth =
                    frm.doc.date_of_birth || frappe.datetime.get_today();
                  latest_client.custom_national_id =
                    frm.doc.card_type == "National ID"
                      ? frm.doc.national_id
                      : null;
                  latest_client.custom_passport_number =
                    frm.doc.card_type == "Passport"
                      ? frm.doc.passport_number
                      : null;
                  latest_client.custom_military_number =
                    frm.doc.card_type == "Military ID"
                      ? frm.doc.military_number
                      : null;

                  // Save the updated client document
                  frappe.call({
                    method: "frappe.client.save",
                    args: {
                      doc: latest_client,
                    },
                    callback: function (save_response) {
                      if (save_response.message) {
                        // Set flags to prevent recursive updates
                        frm._preventCommissarUpdate = true;
                        frm._preventCustomerUpdate = true;
                        frm._updatingClient = true;
                        
                        // Update the client reference without triggering the client field's change event
                        frm.doc.client = save_response.message.name;
                        frm.refresh_field("client");
                        
                        // Clear the prevention flags after a short delay
                        setTimeout(() => {
                            frm._preventCommissarUpdate = false;
                            frm._preventCustomerUpdate = false;
                            frm._updatingClient = false;
                            
                            // Only update commissar if needed and flags are cleared
                            if (!frm._commissarBeingUpdated && (frm.doc.com_name || frm.doc.com_national_id)) {
                                handleCommissarCreationOrUpdate(frm).then(() => {
                                    // After commissar update, mark the form as saved
                                    frm.doc.__unsaved = false;
                                    frm.page.clear_indicator();
                                });
                            } else {
                                // If no commissar update needed, mark the form as saved
                                frm.doc.__unsaved = false;
                                frm.page.clear_indicator();
                            }
                        }, 300);
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
      (frm.doc.client_type == "Company" ||
        frm.doc.client_type == "Interbank") &&
      !frm.doc.client
    ) {
      // Skip if we're already updating
      if (frm._updatingCompany) return;
      frm._updatingCompany = true;

      frappe.call({
        method: "frappe.client.insert",
        args: {
          doc: {
            doctype: "Customer",
            customer_name: frm.doc.company_name,
            custom_start_registration_date: frm.doc.start_registration_date
              ? frm.doc.start_registration_date
              : frappe.datetime.get_today(),

            custom_end_registration_date: frm.doc.end_registration_date
              ? frm.doc.end_registration_date
              : frappe.datetime.get_today(),

            custom_comany_address1: frm.doc.comoany_address
              ? frm.doc.comoany_address
              : "",

            custom_company_no: frm.doc.company_num
              ? frm.doc.comoany_address
              : "",

            custom_type: frm.doc.client_type,
            custom_interbank:
              frm.doc.interbank && frm.doc.client_type == "Interbank"
                ? true
                : false,

            custom_commercial_no: frm.doc.company_commercial_no,
            custom_company_activity: frm.doc.company_activity
              ? frm.doc.company_activity
              : "",
            custom_legal_form: frm.doc.company_legal_form
              ? frm.doc.company_legal_form
              : "",
            custom_is_expired: frm.doc.is_expired1,

            //company_commercial_no
          },
        },
        callback: function (r) {
          if (r.message) {
            frm.set_value("client", r.message.name);
            handleCommissarCreationOrUpdate(frm);
          } else {
            frappe.throw("Error while creating customer");
          }
        },
      });
    } else if (
      (frm.doc.client_type == "Company" ||
        frm.doc.client_type == "Interbank") &&
      frm.doc.client
    ) {
      // Skip if we're already updating
      if (frm._updatingCompany) return;
      frm._updatingCompany = true;

      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Customer",
          filters: {
            name: frm.doc.client,
          },
        },
        callback: function (r) {
          if (r.message) {
            var existing_company = r.message;

            frappe.call({
              method: "frappe.client.get",
              args: {
                doctype: "Customer",
                name: existing_company.name,
              },
              callback: function (response) {
                if (response.message) {
                  let latest_company = response.message;
                  
                  // Only update if values are different
                  let hasChanges = false;
                  const fieldsToCheck = {
                    'custom_start_registration_date': 'start_registration_date',
                    'custom_end_registration_date': 'end_registration_date',
                    'custom_comany_address1': 'comoany_address',
                    'custom_commercial_no': 'company_commercial_no',
                    'custom_legal_form': 'company_legal_form',
                    'custom_company_no': 'company_num',
                    'custom_company_activity': 'company_activity'
                  };

                  Object.entries(fieldsToCheck).forEach(([companyField, formField]) => {
                    if (latest_company[companyField] !== frm.doc[formField]) {
                      latest_company[companyField] = frm.doc[formField];
                      hasChanges = true;
                    }
                  });

                  // Only save if there are actual changes
                  if (hasChanges) {
                  frappe.call({
                    method: "frappe.client.save",
                    args: {
                      doc: latest_company,
                    },
                    callback: function (save_response) {
                        frm._updatingCompany = false;
                      if (save_response.message) {
                          // Update client reference without triggering updates
                          frm.doc.client = save_response.message.name;
                          frm.refresh_field("client");
                          
                          // Only update commissar if commissar fields have changed
                          const commissarFields = ['com_name', 'com_national_id', 'com_gender', 
                                                 'com_address', 'com_phone', 'com_job_title', 
                                                 'com_mobile_number'];
                          
                          let commissarChanged = commissarFields.some(field => 
                            frm.doc[field] && frm.doc[field] !== frm.doc.__prev_values?.[field]
                          );
                          
                          if (commissarChanged && !frm._commissarBeingUpdated) {
                        handleCommissarCreationOrUpdate(frm);
                          }
                      }
                    },
                      error: function() {
                        frm._updatingCompany = false;
                      }
                  });
                  } else {
                    frm._updatingCompany = false;
                  }
                }
              },
              error: function() {
                frm._updatingCompany = false;
              }
            });
          }
        },
        error: function() {
          frm._updatingCompany = false;
        }
      });
    }
  },

  /////////////////////////////////////////////

  // set special price
  // special_price: function (frm) {
  //   if (frm.doc.docstatus == 0) {
  //     let total_currency_amount = 0;

  //     frm.doc.teller_invoice_details.forEach((row) => {
  //       if (row.paid_from) {
  //         frappe.call({
  //           method:
  //             "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_currency",
  //           args: {
  //             account: row.paid_from,
  //           },
  //           callback: function (r) {
  //             console.log(r.message[2]);
  //             selling_special_rate = r.message[2];
  //             row.rate = selling_special_rate;
  //             console.log(r.message[2]);
  //             let currency_total = row.rate * row.usd_amount;
  //             row.total_amount = currency_total;

  //             console.log(
  //               `the total of ${row.currency} is ${row.total_amount}`
  //             );

  //             total_currency_amount += currency_total;
  //             console.log("from loop: " + total_currency_amount);
  //             frm.refresh_field("teller_invoice_details");
  //             frm.set_value("total", total_currency_amount);
  //           },
  //         });
  //       }
  //     });
  //     console.log("from outer loop: " + total_currency_amount);
  //   }
  // },

  egy: (frm) => {
    if (frm.doc.egy) {
      frappe.call({
        method:
          "teller.teller_customization.doctype.teller_invoice.teller_invoice.account_to_balance",
        args: {
          paid_to: frm.doc.egy,
          // company: frm.doc.company,
        },
        callback: function (r) {
          if (r.message) {
            console.log(r.message);
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
    if (frm.doc.client && frm.doc.total) {
      // check if the total is exceeded
      isExceededLimit(frm, frm.doc.client, frm.doc.total);
    }
  },
  //validate if national id is valid

  validate: function (frm) {
    // validate individual client national id
    if (
      (frm.doc.client_type == "Egyptian" ||
        frm.doc.client_type == "Foreigner") &&
      frm.doc.national_id
    ) {
      validateNationalId(frm, frm.doc.national_id);
    }

    // validate commissar national id

    if (
      (frm.doc.client_type == "Company" ||
        frm.doc.client_type == "Interbank") &&
      frm.doc.commissar &&
      frm.doc.com_national_id
    ) {
      validateNationalId(frm, frm.doc.com_national_id);
    }

    if (
      (frm.doc.client_type == "Company" ||
        frm.doc.client_type == "Interbank") &&
      frm.doc.client
    ) {
      validateRegistrationDate(
        frm,
        frm.doc.start_registration_date,
        frm.doc.end_registration_date
      );
      validateRegistrationDateExpiration(frm, frm.doc.end_registration_date);
    }
  },

  contact: function(frm) {
    if (frm.doc.contact) {
      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Contact",
          name: frm.doc.contact
        },
        callback: function(r) {
          if (r.message) {
            // Set contact related fields if needed
            frm.refresh_field("contact");
          }
        }
      });
    }
  },

  client_search_id: function(frm) {
    if (!frm.doc.client_type || !frm.doc.client_search_id) return;
    
    frappe.call({
        method: 'teller.teller_customization.doctype.teller_invoice.teller_invoice.search_client_by_id',
        args: {
            search_id: frm.doc.client_search_id,
            client_type: frm.doc.client_type
        },
        callback: function(r) {
            if (r.message) {
                const result = r.message;
                
                if (result.not_found) {
                    // Handle case when customer is not found
                    if (frm.doc.client_type === 'Egyptian') {
                        frm.set_value('national_id', result.national_id);
                        frm.set_value('card_type', 'National ID');
                    } else if (frm.doc.client_type === 'Foreigner') {
                        frm.set_value('passport_number', result.passport_number);
                        frm.set_value('card_type', 'Passport');
                    } else if (frm.doc.client_type === 'Company' || frm.doc.client_type === 'Interbank') {
                        frm.set_value('company_commercial_no', result.custom_commercial_no);
                    }
                    // Clear the client field since no customer was found
                    frm.set_value('client', '');
                } else {
                    // Customer found - set the client and populate fields
                    if (frm.doc.docstatus === 1) {
                        frm.doc.client = result.name;
                    } else {
                        frm.set_value('client', result.name);
                    }
                    
                    frappe.db.get_doc('Customer', result.name)
                        .then(customer_doc => {
                            if (customer_doc.custom_type === 'Company' || customer_doc.custom_type === 'Interbank') {
                                frm.set_value('company_name', customer_doc.customer_name);
                                frm.set_value('company_activity', customer_doc.custom_company_activity);
                                frm.set_value('company_commercial_no', customer_doc.custom_commercial_no);
                                frm.set_value('company_num', customer_doc.custom_company_no);
                                frm.set_value('comoany_address', customer_doc.custom_comany_address1);
                                frm.set_value('is_expired1', customer_doc.custom_is_expired);
                                frm.set_value('interbank', customer_doc.custom_interbank);
                                frm.set_value('company_legal_form', customer_doc.custom_legal_form);
                            } else {
                                // For individual customers (Egyptian or Foreigner)
                                if (customer_doc.custom_type === 'Egyptian') {
                                    frm.set_value('card_type', 'National ID');
                                    frm.set_value('national_id', customer_doc.custom_national_id);
                                } else if (customer_doc.custom_type === 'Foreigner') {
                                    frm.set_value('card_type', 'Passport');
                                    frm.set_value('passport_number', customer_doc.custom_passport_number);
                                }
                                frm.set_value('customer_name', customer_doc.customer_name);
                                frm.set_value('nationality', customer_doc.custom_nationality);
                                frm.set_value('mobile_number', customer_doc.custom_mobile);
                                frm.set_value('work_for', customer_doc.custom_work_for);
                                frm.set_value('phone', customer_doc.custom_phone);
                                frm.set_value('job_title', customer_doc.custom_job_title);
                                frm.set_value('address', customer_doc.custom_address);
                                frm.set_value('place_of_birth', customer_doc.custom_place_of_birth);
                            }
                        });
                }
            }
        }
    });
  },

  setup: function(frm) {
    // Get user's egy_account and set it only for new documents
    if (frm.is_new()) {
      frappe.call({
        method: "frappe.client.get_value",
        args: {
          doctype: "User",
          filters: { name: frappe.session.user },
          fieldname: "egy_account"
        },
        callback: function(r) {
          if (r.message && r.message.egy_account) {
            frm.set_value('egy', r.message.egy_account);
            // After setting egy account, fetch its balance
            frappe.call({
              method: "teller.teller_customization.doctype.teller_invoice.teller_invoice.account_to_balance",
              args: {
                paid_to: r.message.egy_account
              },
              callback: function(r) {
                if (r.message) {
                  frm.set_value('egy_balance', r.message);
                  frm.refresh_field('egy_balance');
                }
              }
            });
          }
        }
      });
    }

    // Filter accounts in child table to only show accounts linked to user's treasury
    frm.fields_dict["teller_invoice_details"].grid.get_field("account").get_query = function(doc) {
      return {
        query: "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_treasury_accounts",
        filters: {
          treasury_code: doc.treasury_code
        }
      };
    };

    // Set query for currency_code field in child table
    frm.fields_dict["teller_invoice_details"].grid.get_field("currency_code").get_query = function(doc) {
      return {
        query: "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_treasury_currencies",
        filters: {
          treasury_code: doc.treasury_code
        }
      };
    };

    // Make treasury_code and shift read-only after submission
    if (frm.doc.docstatus === 1) {
      frm.set_df_property('treasury_code', 'read_only', 1);
      frm.set_df_property('shift', 'read_only', 1);
    }

    // Rest of your existing setup code...
  },
});

//  teller_invoice_details currency table
frappe.ui.form.on("Teller Invoice Details", {
  // filter accounts

  code: function (frm, cdt, cdn) {
    setTimeout(function () {
      var acc_currency;
      var row = locals[cdt][cdn];
      if (row.paid_from) {
         frappe.call({
          method:
            "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_currency",
          args: {
            account: row.paid_from,
          },
          callback:  function (r) {
            console.log("Currency tablexx: ",r.message);
            // let currencyCode = r.message["currency_code"];
            // let currency = r.message["currency"];
            let currency_rate = r.message["selling_rate"];
            console.log("xxxxxxx",currency_rate)
            // let special_selling_rate = r.message["special_selling_rate"];
            // console.log("currencyCode : ",currencyCode);
            // console.log("currency : ",currency);
            // console.log("currency_rate : ",currency_rate);
            // console.log("special_selling_rate : ",special_selling_rate);
            // console.log("the currency code is " + currencyCode);
  
            // frappe.model.set_value(cdt, cdn, "currency", curr);
            frappe.model.set_value(cdt, cdn, "rate", currency_rate);
            // frappe.model.set_value(cdt, cdn , "code", currencyCode);
          },
        });
  
        frappe.call({
          method:
            "teller.teller_customization.doctype.teller_invoice.teller_invoice.account_from_balance",
          args: {
            paid_from: row.paid_from,
          },
          callback: function (r) {
            if (r.message) {
              console.log("the teller balance is", r.message);
              let from_balance = r.message;
              let formatted_balance = format_currency(from_balance, acc_currency);
              console.log(typeof formatted_balance);
  
              frappe.model.set_value(cdt, cdn, "balance", formatted_balance);
            } else {
              console.log("not found");
            }
          },
        });
      }
    },1000)

  },

  usd_amount: async function (frm, cdt, cdn) {
    var row = locals[cdt][cdn];

    if (row.paid_from && row.usd_amount) {
      let total = row.usd_amount * row.rate;

      frappe.model.set_value(cdt, cdn, "total_amount", total);
      // set received amount
      frappe.model.set_value(cdt, cdn, "received_amount", total);

      // let currency = row.currency; // Fetch the stored currency
      // let formatted_usd_amount = format_currency(row.usd_amount, currency);
      // frappe.model.set_value(cdt, cdn, "usd_amount", formatted_usd_amount);
    }
    // else {
    //   frappe.throw("You must enter all required fields.");
    // }
  },

  total_amount: function (frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let total = 0;
    let currency_total = 0;
    if (row.total_amount) {
      frm.doc.teller_invoice_details.forEach((item) => {
        total += item.total_amount;
      });
      frm.set_value("total", total);
    }
  },
  teller_invoice_details_remove: function (frm) {
    let total = 0;
    frm.doc.teller_invoice_details.forEach((item) => {
      total += item.total_amount;
    });
    frm.set_value("total", total);
  },
  // currency_code(frm, cdt, cdn) {
  //   let row = locals[cdt][cdn];
  //   let sessionUser = frappe.session.logged_in_user;
  //   console.log("User....",sessionUser)
  //   console.log("field is triger");
  //   frappe.call({
  //     method:
  //       "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_current_user_currency_codes",
  //     args: {
  //       current_user: sessionUser,
  //       code: row.currency_code,
  //     },
  //     callback: function (r) {
  //       if (!r.exc) {
  //         // console.log(r.message[0]["account"]);
  //         let userAccount = r.message[0].account;
  //         console.log("the user account is", userAccount);
  //         frappe.model.set_value(cdt, cdn, "paid_from", userAccount);
  //       }
  //     },
  //   });
  // },
});
function set_branch_and_shift(frm) {
  // Only fetch and set treasury details for new documents
  if (frm.is_new()) {
    frappe.call({
      method: "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_employee_shift_details",
      callback: function(r) {
        if (r.message) {
          let shift_details = r.message;
          
          // Set shift and teller info
          frm.set_value("shift", shift_details.shift);
          frm.set_value("teller", shift_details.teller);
          frm.set_value("treasury_code", shift_details.treasury_code);
          frm.set_value("branch_name", shift_details.branch_name);
          frm.set_value("branch_no", shift_details.branch);
          
          // Show the treasury code field since we have shift details
          frm.toggle_display('treasury_code', true);
          
          // Refresh the fields
          frm.refresh_fields([
            "shift",
            "teller",
            "treasury_code",
            "branch_name",
            "branch_no"
          ]);
        } else {
          frappe.msgprint({
            title: __('Warning'),
            indicator: 'red',
            message: __('No active shift found for current user. Please open a shift first.')
          });
          
          // Hide treasury code if no shift details
          frm.toggle_display('treasury_code', false);
          
          // Optionally disable form
          frm.disable_save();
        }
      }
    });
  }
}

//  add contact list to company
// function update_contact_list(frm) {
//     if (frm.doc.client) {
//         frappe.call({
//             method: "frappe.client.get_list",
//             args: {
//                 doctype: "Contact",
//                 filters: {
//                     "link_doctype": "Customer",
//                     "link_name": frm.doc.client
//                 },
//                 fields: ["name", "first_name", "last_name"]
//             },
//             callback: function(r) {
//                 if (r.message && r.message.length) {
//                     frm.set_value("contact", r.message[0].name);
//                 } else {
//                     frm.set_value("contact", "");
//                 }
//             }
//         });
//     } else {
//         frm.set_value("contact", "");
//     }
// }

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

// get the allowed amount from Teller settings
async function fetchAllowedAmount() {
  return frappe.db.get_single_value("Teller Setting", "allowed_amount");
}
// get the customer Total Invoices Amount
async function getCustomerTotalAmount(clientName) {
  let limiDuration = await fetchLimitDuration();

  return new Promise((resolve, reject) => {
    frappe.call({
      method:
        "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_customer_total_amount",
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

// fetch the duration of the limit
async function fetchLimitDuration() {
  return frappe.db.get_single_value("Teller Setting", "duration");
}

// create or update commissar for company

function handleCommissarCreationOrUpdate(frm) {
  return new Promise((resolve, reject) => {
    if (frm._commissarBeingUpdated || frm._preventCommissarUpdate) {
      resolve();
      return;
    }

    const commissarFields = ['com_name', 'com_national_id', 'com_gender', 
                           'com_address', 'com_phone', 'com_job_title', 
                           'com_mobile_number'];
    
    let commissarChanged = commissarFields.some(field => 
      frm.doc[field] && frm.doc[field] !== frm.doc.__prev_values?.[field]
    );

    if (!commissarChanged) {
      resolve();
      return;
    }
    
    if ((frm.doc.client_type === "Company" || frm.doc.client_type === "Interbank") && 
        frm.doc.client && !frm.doc.commissar) {
        
        if (!frm.doc.client) {
            resolve();
            return;
        }

        var newContact = frappe.model.get_new_doc("Contact");
        newContact.links = [{
            link_doctype: "Customer",
            link_name: frm.doc.client,
        }];

        newContact.first_name = frm.doc.com_name;
        newContact.custom_com_gender = frm.doc.com_gender;
        newContact.custom_com_address = frm.doc.com_address;
        newContact.custom_com_phone = frm.doc.com_phone;
        newContact.custom_national_id = frm.doc.com_national_id;
        newContact.custom_job_title = frm.doc.com_job_title;
        newContact.custom_mobile_number = frm.doc.com_mobile_number;

        frm._commissarBeingUpdated = true;
        frappe.call({
            method: "frappe.client.insert",
            args: {
                doc: newContact,
            },
            callback: function (r) {
                frm._commissarBeingUpdated = false;
                if (r.message) {
                    frm._preventCommissarUpdate = true;
                    frm.set_value("commissar", r.message.name);
                    frm._preventCommissarUpdate = false;
                    resolve();
                } else {
                    reject();
                }
            },
            error: function() {
                frm._commissarBeingUpdated = false;
                reject();
            }
        });
    } else if ((frm.doc.client_type === "Company" || frm.doc.client_type === "Interbank") && 
               frm.doc.client && frm.doc.commissar) {
        
        frm._commissarBeingUpdated = true;
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Contact",
                name: frm.doc.commissar,
            },
            callback: function (r) {
                if (r.message) {
                    let existing_contact = r.message;
                    existing_contact.first_name = frm.doc.com_name;
                    existing_contact.custom_com_gender = frm.doc.com_gender;
                    existing_contact.custom_national_id = frm.doc.com_national_id;
                    existing_contact.custom_com_address = frm.doc.com_address || "";
                    existing_contact.custom_com_phone = frm.doc.com_phone;
                    existing_contact.custom_job_title = frm.doc.com_job_title;
                    existing_contact.custom_mobile_number = frm.doc.com_mobile_number;

                    frappe.call({
                        method: "frappe.client.save",
                        args: {
                            doc: existing_contact,
                        },
                        callback: function (save_response) {
                            frm._commissarBeingUpdated = false;
                            if (save_response.message) {
                                frm._preventCommissarUpdate = true;
                                frm.set_value("commissar", save_response.message.name);
                                frm._preventCommissarUpdate = false;
                                resolve();
                            } else {
                                reject();
                            }
                        },
                        error: function () {
                            frm._commissarBeingUpdated = false;
                            reject();
                        },
                    });
                }
            },
            error: function () {
                frm._commissarBeingUpdated = false;
                reject();
            },
        });
    } else {
        resolve();
    }
  });
}

// validate the national id

function validateNationalId(frm, nationalId) {
  // if (!/^\d{14}$/.test(nationalId)) {
  //   frappe.msgprint(
  //     __("National ID must be exactly 14 digits and contain only numbers.")
  //   );
  //   frappe.validated = false;
  // }
  return /^[0-9]{14}$/.test(nationalId);
}

function validateRegistrationDate(frm, start, end) {
  if (start && end && start > end) {
    frappe.msgprint(__("Registration Date cannot be after Expiration Date."));
    frappe.validated = false;
  }
}

function validateRegistrationDateExpiration(frm, end) {
  if (end) {
    // Get today's date using Frappe's date utility
    const today = frappe.datetime.get_today();

    // Convert dates to Date objects for comparison
    const endDate = new Date(end);
    const todayDate = new Date(today);

    // Compare the dates
    if (endDate < todayDate) {
      frm.set_value("is_expired1", true);
      // Show the is_expired1 field
      frm.toggle_display("is_expired1", true);
    } else {
      frm.toggle_display("is_expired1", false);
    }
  }
}

// Add function to validate ID expiry
function validateIdExpiration(frm) {
  if (frm.doc.issue_date) {
    const today = frappe.datetime.get_today();
    const issueDate = new Date(frm.doc.issue_date);
    const todayDate = new Date(today);
    
    // For Egyptian IDs - typically valid for 7 years
    let expiryDate = new Date(issueDate);
    if (frm.doc.card_type === "National ID") {
      expiryDate.setFullYear(expiryDate.getFullYear() + 7);
    }
    // For passports - typically valid for 5 years
    else if (frm.doc.card_type === "Passport") {
      expiryDate.setFullYear(expiryDate.getFullYear() + 5);
    }
    
    if (expiryDate < todayDate) {
      frm.set_value("expired", true);
      frm.toggle_display("expired", true);
    } else {
      frm.toggle_display("expired", false);
    }
  }
}

//////////////////////////////////////Ahmed Reda //////////////////////////////////////////
//////////////////////////////////////Ahmed Reda //////////////////////////////////////////
//////////////////////////////////////Ahmed Reda //////////////////////////////////////////

////////////////////////////test====/////////////////////////////////////////////////////////
frappe.ui.form.on('Teller Invoice', {});

  //////////////////////////////////////////////////////////////////////////////////////////
                              //  Filter paid_from //
  //////////////////////////////////////////////////////////////////////////////////////////
  frappe.ui.form.on("Teller Invoice Details", {
    // filter accounts
  
    code: function (frm, cdt, cdn) {
      var row = locals[cdt][cdn];
      console.log(row)
      var code = row.code;
      var curr = row.currency;

          frm.fields_dict["teller_invoice_details"].grid.get_field("paid_from").get_query =
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

          frm.fields_dict["teller_invoice_details"].grid.get_field("paid_from").get_query =
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

  //////////////////////////////////////////////////////////////////////////////////

  frappe.ui.form.on("Teller Invoice Details", {
    currency_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        console.log("Currency code changed:", row.currency_code);
        
        if (row.currency_code && frm.doc.treasury_code) {
            // Get account and currency based on currency code and treasury
            frappe.call({
                method: 'teller.teller_customization.doctype.teller_invoice.teller_invoice.get_treasury_accounts',
                args: {
                    filters: JSON.stringify({
                        custom_currency_code: row.currency_code,
                        treasury_code: frm.doc.treasury_code
                    })
                },
                callback: function(response) {
                    console.log("Account response:", response);
                    if (response.message && response.message.length > 0) {
                        let account = response.message[0];  // Get first account
                        
                        // Set the account and currency
                        frappe.model.set_value(cdt, cdn, 'account', account[0]);  // First element is account name
                        frappe.model.set_value(cdt, cdn, 'currency', account[1]); // Second element is currency
                        
                        // Get exchange rate
                        frappe.call({
                            method: 'frappe.client.get_list',
                            args: {
                                doctype: 'Currency Exchange',
                                filters: {
                                    'from_currency': account[1],
                                    'to_currency': 'EGP'
                                },
                                fields: ['custom_selling_exchange_rate', 'exchange_rate'],
                                order_by: 'date desc, creation desc',
                                limit: 1
                            },
                            callback: function(rate_response) {
                                console.log("Rate response:", rate_response);
                                if (rate_response.message && rate_response.message.length > 0) {
                                    let rate = rate_response.message[0];
                                    // Use selling exchange rate if available, otherwise use regular exchange rate
                                    let exchange_rate = rate.custom_selling_exchange_rate || rate.exchange_rate;
                                    if (exchange_rate) {
                                        frappe.model.set_value(cdt, cdn, 'exchange_rate', exchange_rate);
                                    }
                                }
                            }
                        });
                    } else {
                        frappe.msgprint(__('No accounts found for the selected currency code in your treasury.'));
                        frappe.model.set_value(cdt, cdn, 'account', '');
                        frappe.model.set_value(cdt, cdn, 'currency', '');
                        frappe.model.set_value(cdt, cdn, 'exchange_rate', '');
                    }
                }
            });
        } else if (!frm.doc.treasury_code) {
            frappe.msgprint(__('Please ensure treasury code is set before selecting currency.'));
            frappe.model.set_value(cdt, cdn, 'currency_code', '');
        }
    },

    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.account) {
            // Get currency and currency code from account
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Account',
                    name: row.account
                },
                callback: function(response) {
                    if (response.message) {
                        let account = response.message;
                        
                        // Set currency code and currency
                        frappe.model.set_value(cdt, cdn, 'currency_code', account.custom_currency_code);
                        frappe.model.set_value(cdt, cdn, 'currency', account.account_currency);
                        
                        // Get exchange rate
                        frappe.call({
                            method: 'frappe.client.get_list',
                            args: {
                                doctype: 'Currency Exchange',
                                filters: {
                                    'from_currency': account.account_currency
                                },
                                fields: ['custom_selling_exchange_rate'],
                                order_by: 'creation desc',
                                limit: 1
                            },
                            callback: function(rate_response) {
                                if (rate_response.message && rate_response.message.length > 0) {
                                    frappe.model.set_value(cdt, cdn, 'exchange_rate', 
                                        rate_response.message[0].custom_selling_exchange_rate);
                                }
                            }
                        });
                    }
                }
            });
        }
    },

    quantity: function(frm, cdt, cdn) {
        calculate_amounts(frm, cdt, cdn);
    },

    exchange_rate: function(frm, cdt, cdn) {
        calculate_amounts(frm, cdt, cdn);
    }
});

function calculate_amounts(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (row.quantity && row.exchange_rate) {
        // Calculate amount in original currency
        let amount = flt(row.quantity);
        frappe.model.set_value(cdt, cdn, 'amount', amount);
        
        // Calculate amount in EGY
        let egy_amount = flt(amount * row.exchange_rate);
        frappe.model.set_value(cdt, cdn, 'egy_amount', egy_amount);
        
        // Update total by summing all egy_amounts
        let total = 0;
        frm.doc.teller_invoice_details.forEach((item) => {
            total += flt(item.egy_amount || 0);
        });
        frm.set_value('total', total);
        frm.refresh_field('total');
    }
}

// Add handler for teller_invoice_details table
frappe.ui.form.on('Teller Invoice Details', {
    teller_invoice_details_remove: function(frm) {
        // Recalculate total when a row is removed
        let total = 0;
        frm.doc.teller_invoice_details.forEach((item) => {
            total += flt(item.egy_amount);
        });
        frm.set_value('total', total);
        frm.refresh_field('total');
    }
});

// Add helper function to show/hide identification fields
function showIdentificationFields(frm) {
    // First hide all ID fields
    frm.set_df_property('national_id', 'hidden', 1);
    frm.set_df_property('passport_number', 'hidden', 1);
    frm.set_df_property('military_number', 'hidden', 1);

    // Remove required flag from all ID fields
    frm.set_df_property('national_id', 'reqd', 0);
    frm.set_df_property('passport_number', 'reqd', 0);
    frm.set_df_property('military_number', 'reqd', 0);

    // Only show and require fields if we have a client type and card type
    if (frm.doc.client_type && frm.doc.card_type) {
        if (frm.doc.card_type === "National ID") {
            frm.set_df_property('national_id', 'hidden', 0);
            frm.set_df_property('national_id', 'reqd', 1);
        } else if (frm.doc.card_type === "Passport") {
            frm.set_df_property('passport_number', 'hidden', 0);
            frm.set_df_property('passport_number', 'reqd', 1);
        } else if (frm.doc.card_type === "Military ID") {
            frm.set_df_property('military_number', 'hidden', 0);
            frm.set_df_property('military_number', 'reqd', 1);
        }
    }

    // Refresh the fields to ensure visibility changes take effect
    frm.refresh_fields(['national_id', 'passport_number', 'military_number']);
}

// Helper function to add a transaction row
function addTransactionRow(frm, item, availableQty, booking_ib) {
    let child = frm.add_child("teller_invoice_details");
    
    child.currency_code = item.currency_code;
    child.currency = item.currency;
    child.quantity = availableQty;
    child.exchange_rate = item.rate;
    child.booking_interbank = booking_ib;
    child.amount = availableQty;
    child.egy_amount = availableQty * item.rate;
    
    if (item.currency) {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Account',
                filters: {
                    'account_currency': item.currency,
                    'account_type': ['in', ['Bank', 'Cash']],
                    'custom_teller_treasury': frm.doc.treasury_code
                },
                fields: ['name'],
                limit: 1
            },
            callback: function(account_response) {
                if (account_response.message && account_response.message.length > 0) {
                    child.account = account_response.message[0].name;
                    frm.refresh_field("teller_invoice_details");
                }
            }
        });
    }
    
    frm.refresh_field("teller_invoice_details");
    
    let total = 0;
    frm.doc.teller_invoice_details.forEach((item) => {
        total += flt(item.egy_amount || 0);
    });
    frm.set_value("total", total);
    frm.refresh_field("total");
}

// Add list indicator color
frappe.listview_settings['Teller Invoice'] = {
	get_indicator: function(doc) {
		if (doc.is_returned) {
			return [__("Returned"), "grey", "is_returned,=,1"];
		} else if (doc.docstatus == 0) {
			return [__("Draft"), "red", "docstatus,=,0"];
		} else if (doc.docstatus == 1) {
			return [__("Submitted"), "blue", "docstatus,=,1"];
		} else if (doc.docstatus == 2) {
			return [__("Cancelled"), "grey", "docstatus,=,2"];
		}
	}
};