// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Teller Purchase", {
  onload_post_render: function(frm) {
    showIdentificationFields(frm);
  },

  onload: function(frm) {
    // Only clear ID fields for new documents
    if (frm.is_new()) {
      frm.set_value('buyer_national_id', '');
      frm.set_value('buyer_passport_number', '');
      frm.set_value('buyer_military_number', '');
    }
    
    // For submitted documents, ensure fields are read-only
    if (frm.doc.docstatus === 1) {
      makeIdentificationFieldsReadOnly(frm);
    }
    
    // Set branch details if missing - only for new or draft documents
    if (!frm.doc.branch_name && frm.doc.branch_no && frm.doc.docstatus === 0) {
      frappe.db.get_value('Branch', frm.doc.branch_no, 'custom_branch_no')
        .then(r => {
          if (r.message && r.message.custom_branch_no) {
            frm.doc.branch_name = r.message.custom_branch_no;
            frm.refresh_field('branch_name');
          }
        });
    }

    // Update egy_balance display only - don't save the document
    if (frm.doc.egy && !frm.is_new()) {
      frappe.call({
        method: "teller.teller_customization.doctype.teller_purchase.teller_purchase.account_to_balance",
        args: {
          paid_to: frm.doc.egy,
        },
        callback: function (r) {
          if (r.message) {
            frm.set_value('egy_balance', r.message);
            frm.refresh_field('egy_balance');
          }
        },
      });
    }

    // Ensure proper document state on load
    if (frm.doc.docstatus === 1) {
      frm.doc.__unsaved = 0;
      frm.page.wrapper.find('.indicator-pill').removeClass('unsaved');
      frm.disable_save();
    }
  },

  buyer_card_type: function(frm) {
    // Don't modify fields if document is submitted
    if (frm.doc.docstatus === 1) return;
    
    // Clear all ID fields first
    frm.set_value('buyer_national_id', '');
    frm.set_value('buyer_passport_number', '');
    frm.set_value('buyer_military_number', '');
    
    // Set the appropriate field based on card type
    if (frm.doc.buyer_card_type === "National ID") {
      frm.set_df_property('buyer_national_id', 'reqd', 1);
      frm.set_df_property('buyer_passport_number', 'reqd', 0);
      frm.set_df_property('buyer_military_number', 'reqd', 0);
    } else if (frm.doc.buyer_card_type === "Passport") {
      frm.set_df_property('buyer_national_id', 'reqd', 0);
      frm.set_df_property('buyer_passport_number', 'reqd', 1);
      frm.set_df_property('buyer_military_number', 'reqd', 0);
    } else if (frm.doc.buyer_card_type === "Military Card") {
      frm.set_df_property('buyer_national_id', 'reqd', 0);
      frm.set_df_property('buyer_passport_number', 'reqd', 0);
      frm.set_df_property('buyer_military_number', 'reqd', 1);
    }
    
    // Show/hide fields based on selection
    showIdentificationFields(frm);
    
    frm.refresh_fields(['buyer_national_id', 'buyer_passport_number', 'buyer_military_number']);
  },

  buyer_search_id: function(frm) {
    if (!frm.doc.category_of_buyer || !frm.doc.buyer_search_id) {
      return;
    }
    
    // Show a loading indicator
    frm.set_value('buyer', ''); // Clear buyer first to avoid conflicts
    frm.toggle_display('search_buyer', true);
    
    // Automatically search when ID is entered
    frappe.call({
      method: 'teller.teller_customization.doctype.teller_purchase.teller_purchase.search_buyer_by_id',
      args: {
        search_id: frm.doc.buyer_search_id
      },
      callback: function(r) {
        if (r.message) {
          const customer = r.message;
          
          // First set the category to trigger any dependent field updates
          if (customer.category_of_buyer) {
            frm.set_value('category_of_buyer', customer.category_of_buyer);
          }
          
          // Then set the buyer
          if (customer.buyer) {
            frm.set_value('buyer', customer.buyer);
          }
          
          // Set card type if available
          if (customer.buyer_card_type) {
            frm.set_value('buyer_card_type', customer.buyer_card_type);
          }
          
          // Set fields based on customer type
          if (customer.category_of_buyer === 'Egyptian' || customer.category_of_buyer === 'Foreigner') {
            // Set individual fields
            const individualFields = [
              'buyer_name', 'buyer_nationality', 'buyer_gender',
              'buyer_work_for', 'buyer_phone', 'buyer_mobile_number',
              'buyer_place_of_birth', 'buyer_date_of_birth', 'buyer_job_title',
              'buyer_address', 'buyer_issue_date', 'buyer_expired'
            ];
            
            // Set each field if it has a value
            individualFields.forEach(field => {
              if (customer[field] !== undefined && customer[field] !== null) {
                frm.set_value(field, customer[field]);
              }
            });
            
            // Clear all ID fields first
            frm.set_value('buyer_national_id', '');
            frm.set_value('buyer_passport_number', '');
            frm.set_value('buyer_military_number', '');
            
            // Set the appropriate ID field based on card type
            if (customer.buyer_card_type === "National ID" && customer.buyer_national_id) {
              frm.set_value('buyer_national_id', customer.buyer_national_id);
            } else if (customer.buyer_card_type === "Passport" && customer.buyer_passport_number) {
              frm.set_value('buyer_passport_number', customer.buyer_passport_number);
            } else if (customer.buyer_card_type === "Military Card" && customer.buyer_military_number) {
              frm.set_value('buyer_military_number', customer.buyer_military_number);
            }
            
            // Show the appropriate ID field
            showIdentificationFields(frm);
            
          } else if (customer.category_of_buyer === 'Company' || customer.category_of_buyer === 'Interbank') {
            // Set company fields
            const companyFields = [
              'buyer_company_name', 'buyer_company_activity', 'buyer_company_commercial_no',
              'buyer_company_start_date', 'buyer_company_end_date',
              'buyer_company_address', 'buyer_company_legal_form'
            ];
            
            // Set each field if it has a value
            companyFields.forEach(field => {
              if (customer[field] !== undefined && customer[field] !== null) {
                frm.set_value(field, customer[field]);
              }
            });
            
            // Set boolean fields
            if (customer.is_expired1 !== undefined) {
              frm.set_value('is_expired1', customer.is_expired1);
            }
            
            if (customer.interbank !== undefined) {
              frm.set_value('interbank', customer.interbank);
            }
          }
          
          // Set exceed flag if available
          if (customer.exceed !== undefined) {
            frm.set_value('exceed', customer.exceed);
          }
          
          // Refresh all fields to ensure UI is updated
          frm.refresh_fields();
          
          frappe.show_alert({
            message: __('Customer information loaded successfully'),
            indicator: 'green'
          });
        } else {
          frappe.show_alert({
            message: __('No customer found with ID: {0}', [frm.doc.buyer_search_id]),
            indicator: 'red'
          });
        }
      },
      error: function(err) {
        console.error("Error searching buyer:", err);
        frappe.show_alert({
          message: __('Error searching for customer'),
          indicator: 'red'
        });
      }
    });
  },

  category_of_buyer: function(frm) {
    // First clear all ID fields
    frm.set_value('buyer_national_id', '');
    frm.set_value('buyer_passport_number', '');
    frm.set_value('buyer_military_number', '');
    
    // Set appropriate card type based on category
    if (frm.doc.category_of_buyer == "Foreigner") {
        frm.set_value("buyer_card_type", "Passport");
    } else if (frm.doc.category_of_buyer == "Egyptian") {
        frm.set_value("buyer_card_type", "National ID");
    }
    
    // Clear fields
    clearFieldsBasedOnCategory(frm);
    
    // Get and set the central bank number based on category
    if (frm.doc.category_of_buyer) {
        let field_name;
        switch(frm.doc.category_of_buyer) {
            case 'Egyptian':
                field_name = 'purchase_egyptian_number';
                break;
            case 'Foreigner':
                field_name = 'purchase_foreigner_number';
                break;
            case 'Company':
                field_name = 'purchase_company_number';
                break;
            case 'Interbank':
                field_name = 'purchase_interbank_number';
                
                // For Interbank, automatically set the buyer to "البنك الاهلي"
                frappe.db.get_value('Customer', {customer_name: 'البنك الاهلي'}, 'name')
                  .then(r => {
                    if (r && r.message && r.message.name) {
                      frm.set_value('buyer', r.message.name);
                    } else {
                      frappe.msgprint(__('Customer "البنك الاهلي" not found. Please create this customer first.'));
                    }
                  });
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

    // Show/hide identification fields based on category
    showIdentificationFields(frm);

    // If there's already a search ID, trigger the search after a short delay
    // This ensures all field updates are complete before searching
    if (frm.doc.buyer_search_id) {
        setTimeout(() => {
            frm.trigger('buyer_search_id');
        }, 100);
    }
  },

  search_buyer: function(frm) {
    if (!frm.doc.buyer_search_id) {
      frappe.msgprint(__('Please enter an ID/Number to search'));
      return;
    }
    
    frappe.call({
      method: 'teller.teller_customization.doctype.teller_purchase.teller_purchase.search_buyer_by_id',
      args: {
        search_id: frm.doc.buyer_search_id
      },
      callback: function(r) {
        if (r.message) {
          const customer = r.message;
          
          // First set the category to trigger any dependent field updates
          frm.set_value('category_of_buyer', customer.category_of_buyer);
          
          // Then set the buyer
          frm.set_value('buyer', customer.buyer);
          
          // Set fields based on customer type
          if (customer.category_of_buyer === 'Egyptian' || customer.category_of_buyer === 'Foreigner') {
            // Set individual fields
            frm.set_value('buyer_name', customer.buyer_name);
            frm.set_value('buyer_card_type', customer.buyer_card_type);
            
            // Clear all ID fields first
            frm.set_value('buyer_national_id', '');
            frm.set_value('buyer_passport_number', '');
            frm.set_value('buyer_military_number', '');
            
            // Set the appropriate ID field based on card type
            if (customer.buyer_card_type === "National ID") {
              frm.set_value('buyer_national_id', customer.buyer_national_id);
            } else if (customer.buyer_card_type === "Passport") {
              frm.set_value('buyer_passport_number', customer.buyer_passport_number);
            } else if (customer.buyer_card_type === "Military Card") {
              frm.set_value('buyer_military_number', customer.buyer_military_number);
            }
            
            // Explicitly show/hide fields after setting values
            setTimeout(() => {
              if (customer.buyer_card_type === "National ID") {
                frm.set_df_property('buyer_national_id', 'hidden', 0);
                frm.set_df_property('buyer_passport_number', 'hidden', 1);
                frm.set_df_property('buyer_military_number', 'hidden', 1);
              } else if (customer.buyer_card_type === "Passport") {
                frm.set_df_property('buyer_national_id', 'hidden', 1);
                frm.set_df_property('buyer_passport_number', 'hidden', 0);
                frm.set_df_property('buyer_military_number', 'hidden', 1);
              } else if (customer.buyer_card_type === "Military Card") {
                frm.set_df_property('buyer_national_id', 'hidden', 1);
                frm.set_df_property('buyer_passport_number', 'hidden', 1);
                frm.set_df_property('buyer_military_number', 'hidden', 0);
              }
              frm.refresh_fields(['buyer_national_id', 'buyer_passport_number', 'buyer_military_number']);
            }, 100);
            
            // Set other fields
            frm.set_value('buyer_nationality', customer.buyer_nationality);
            frm.set_value('buyer_work_for', customer.buyer_work_for);
            frm.set_value('buyer_phone', customer.buyer_phone);
            frm.set_value('buyer_place_of_birth', customer.buyer_place_of_birth);
            frm.set_value('buyer_date_of_birth', customer.buyer_date_of_birth);
            frm.set_value('buyer_job_title', customer.buyer_job_title);
            frm.set_value('buyer_address', customer.buyer_address);
            frm.set_value('buyer_expired', customer.buyer_expired);
          } else if (customer.category_of_buyer === 'Company' || customer.category_of_buyer === 'Interbank') {
            // Set company fields
            frm.set_value('buyer_company_name', customer.buyer_company_name);
            frm.set_value('buyer_company_activity', customer.buyer_company_activity);
            frm.set_value('buyer_company_commercial_no', customer.buyer_company_commercial_no);
            frm.set_value('buyer_company_start_date', customer.buyer_company_start_date);
            frm.set_value('buyer_company_end_date', customer.buyer_company_end_date);
            frm.set_value('buyer_company_address', customer.buyer_company_address);
            frm.set_value('is_expired1', customer.is_expired1);
            frm.set_value('interbank', customer.interbank);
            frm.set_value('buyer_company_legal_form', customer.buyer_company_legal_form);
          }
          
          // Set exceed flag
          frm.set_value('exceed', customer.exceed);
          
          // Clear the search field
          frm.set_value('buyer_search_id', '');
          
          // Refresh all fields
          frm.refresh_fields();
          
          frappe.show_alert({
            message: __('Customer found and details populated'),
            indicator: 'green'
          });
        } else {
          frappe.msgprint(__('No customer found with the given ID/Number'));
        }
      }
    });
  },

  custom_special_price2(frm) {
    // Log the current branch for debugging
    console.log("Current branch:", frm.doc.branch_no);
    
    // Check if there are any Booking Interbank records at all
    frappe.db.get_list('Booking Interbank', {
      fields: ['name', 'transaction', 'branch'],
      limit: 10
    }).then(records => {
      console.log("All Booking Interbank records:", records);
      
      // Check if there are any records matching our criteria
      frappe.db.get_list('Booking Interbank', {
        fields: ['name', 'transaction', 'branch'],
        filters: {
          'transaction': 'Purchasing'
        },
        limit: 10
      }).then(filtered_records => {
        console.log("Filtered Booking Interbank records by transaction:", filtered_records);
      });
    });
    
    var d = new frappe.ui.Dialog({
      title: "Select Booking Interbank",
      fields: [
        {
          label: "Booking Interbank",
          fieldname: "name",
          fieldtype: "Link",
          options: "Booking Interbank",
          get_query: function() {
            // Get the current branch from the form
            console.log("Dialog filter - branch_no:", frm.doc.branch_no);
            
            // Only filter by transaction type, not by branch
            let filters = {
              'transaction': 'Purchasing'
            };
            console.log("Dialog filters:", filters);
            
            return {
                filters: filters
            };
          }
        },
      ],
      size: "small", // small, large, extra-large
      primary_action_label: "Submit",
      primary_action: async function (values) {
        if (!values.name) {
          frappe.msgprint("Please select a Booking Interbank record");
          return;
        }
        
        console.log(values.name);
        let doc = await frappe.db.get_doc(
          "Booking Interbank",
          values.name
        );
        console.log(doc.booked_currency);
        let book_table = doc.booked_currency;
        for (let item of book_table) {
          console.log(item.currency);
          let child = frm.add_child("transactions");
          child.currency = item.currency;
          child.currency_code = item.currency_code;
          child.rate = item.rate;
          child.qty = item.booking_qty || item.qty;
        }
        frm.refresh_field("transactions");
        d.hide();
      },
    });
    d.show();
  },
  // validation on national id and registration date
  validate: function (frm) {
    if (frm.doc.is_expired1 == 1) {
      frappe.throw({
        title: __("Buyer Expired"),
        message: __("Expired Registration Date For Buyer")
      });
    }

    // Validate registration dates if provided
    if (frm.doc.buyer_company_start_date && frm.doc.buyer_company_end_date) {
      validateRegistrationDate(frm, frm.doc.buyer_company_start_date, frm.doc.buyer_company_end_date);
      validateRegistrationDateExpiration(frm, frm.doc.buyer_company_end_date);
    }

    // Validate national ID if provided
    if (frm.doc.buyer_national_id) {
      validateNationalId(frm, frm.doc.buyer_national_id);
    }

    // Ensure branch details are set before saving
    if (!frm.doc.branch_name && frm.doc.branch_no) {
      frappe.db.get_value('Branch', frm.doc.branch_no, 'custom_branch_no')
        .then(r => {
          if (r.message && r.message.custom_branch_no) {
            frm.set_value('branch_name', r.message.custom_branch_no);
          }
        });
    }

    // Ensure submitted documents can't be saved
    if (frm.doc.docstatus === 1) {
      frappe.throw(__('Cannot save a submitted document'));
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

  setup(frm) {
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
    
    // Make treasury_code and shift read-only after submission
    if (frm.doc.docstatus === 1) {
      frm.set_df_property('treasury_code', 'read_only', 1);
      frm.set_df_property('shift', 'read_only', 1);
    }
    
    // Filter accounts in child table to only show accounts linked to user's treasury
    frm.fields_dict["purchase_transactions"].grid.get_field("account").get_query = function(doc) {
      return {
        query: "teller.teller_customization.doctype.teller_purchase.teller_purchase.get_treasury_accounts",
        filters: {
          treasury_code: doc.treasury_code
        }
      };
    };
    
    // Hide all ID fields by default
    frm.set_df_property('buyer_national_id', 'hidden', 1);
    frm.set_df_property('buyer_passport_number', 'hidden', 1);
    frm.set_df_property('buyer_military_number', 'hidden', 1);
    
    // Set ID fields as read-only
    frm.set_df_property('buyer_national_id', 'read_only', 1);
    frm.set_df_property('buyer_passport_number', 'read_only', 1);
    frm.set_df_property('buyer_military_number', 'read_only', 1);
    
    // Set focus on buyer field only for new documents
    if (frm.is_new()) {
      setTimeout(function () {
        const buyerField = frm.get_field("buyer");
        if (buyerField && buyerField.$input) {
          buyerField.$input.focus();
        }
      }, 100);
    }

    // filter buyers based on category
    frm.set_query("buyer", function (doc) {
      return {
        filters: {
          custom_type: doc.category_of_buyer,
        },
      };
    });

    // Set query for current_roll to only show active printing rolls
    frm.set_query("current_roll", function() {
      return {
        filters: {
          status: "Active"
        }
      };
    });

    // Make total and egy_balance read-only but visible
    frm.set_df_property('total', 'read_only', 1);
    frm.set_df_property('egy_balance', 'read_only', 1);
    frm.set_df_property('egy_balance', 'hidden', 0);

    // Ensure egy_balance is always visible
    frm.toggle_display('egy_balance', true);
    frm.set_df_property('egy_balance', 'hidden', 0);
  },

  refresh: function(frm) {
    // Handle form state based on docstatus
    if (frm.doc.docstatus === 1) {
      // For submitted documents
      frm.page.clear_primary_action();
      frm.disable_save();
      frm.page.set_indicator('Submitted', 'green');
    } else if (frm.doc.docstatus === 2) {
      // For cancelled documents
      frm.page.clear_primary_action();
      frm.disable_save();
      frm.page.set_indicator('Cancelled', 'red');
    } else {
      // For draft documents
      if (frm.is_new()) {
        frm.page.set_primary_action(__('Save'), () => frm.save());
      } else {
        frm.page.set_primary_action(__('Submit'), () => frm.savesubmit());
      }
      frm.page.set_indicator('Not Submitted', 'orange');
    }

    // Force refresh the docstatus indicator
    frm.page.wrapper.find('.indicator').attr('data-docstatus', frm.doc.docstatus);
    
    // Ensure form is marked as not dirty for submitted/cancelled docs
    if (frm.doc.docstatus !== 0) {
      frm.doc.__unsaved = 0;
      frm.page.wrapper.find('.indicator-pill').removeClass('unsaved');
    }

    // Make treasury_code and shift read-only after submission
    if (frm.doc.docstatus === 1) {
      frm.set_df_property('treasury_code', 'read_only', 1);
      frm.set_df_property('shift', 'read_only', 1);
    }

    // Update egy_balance if egy account is set
    if (frm.doc.egy) {
      frappe.call({
        method: "teller.teller_customization.doctype.teller_purchase.teller_purchase.account_to_balance",
        args: {
          paid_to: frm.doc.egy
        },
        callback: function(r) {
          if (r.message) {
            frm.set_value('egy_balance', r.message);
            frm.refresh_field('egy_balance');
          }
        }
      });
    }

    // Ensure branch name is displayed correctly
    if (!frm.doc.branch_name && frm.doc.branch_no) {
      frappe.db.get_value('Branch', frm.doc.branch_no, 'custom_branch_no')
        .then(r => {
          if (r.message && r.message.custom_branch_no) {
            frm.set_value('branch_name', r.message.custom_branch_no);
            frm.refresh_field('branch_name');
          }
        });
    }
    
    // Add custom buttons for submitted documents
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

      // Add standalone return button if document is not already returned
      if (!frm.doc.is_returned) {
        frm.add_custom_button(__('Return'), function() {
          // Show confirmation dialog
          frappe.confirm(
            __(`Are you sure you want to create a return for this purchase?<br><br>
            This will:<br>
            • Reverse all currency amounts and quantities<br>
            • Create reverse GL entries<br>
            • Mark this purchase as returned<br>
            • Total amount of <strong>${format_currency(Math.abs(frm.doc.total), 'EGP')}</strong> will be reversed<br><br>
            This action cannot be undone.`),
            function() {
              // On 'Yes' - proceed with return
              frappe.call({
                method: 'teller.teller_customization.doctype.teller_purchase.teller_purchase.make_purchase_return',
                args: {
                  doc: frm.doc
                },
                callback: function(r) {
                  if (r.message) {
                    frappe.show_alert({
                      message: __('Return created successfully'),
                      indicator: 'green'
                    });
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

    // Set query filters for buyer
    frm.set_query("buyer", function (doc) {
      return {
        filters: {
          custom_type: doc.category_of_buyer,
        },
      };
    });

    // Get current printing roll and set receipt number
    if (frm.doc.__islocal) {
      frappe.call({
        method: "teller.teller_customization.doctype.teller_invoice.teller_invoice.get_printing_roll",
        callback: function(r) {
          if (r.message) {
            // Set current_roll as string value only (first element of the tuple)
            frm.set_value('current_roll', r.message[0]);
            
            // Show a message to the user with the roll info
            frappe.show_alert({
              message: __(`Using Printing Roll: ${r.message[0]} (Last number: ${r.message[1]})`),
              indicator: 'blue'
            });
          }
        }
      });
    }

    // add ledger button in refresh
    frm.events.show_general_ledger(frm);
    set_branch_and_shift(frm);
    
    // Get and set EGY account balance
    if (frm.doc.egy_account) {
      frappe.call({
        method: "teller.teller_customization.doctype.teller_purchase.teller_purchase.account_to_balance",
        args: {
          paid_to: frm.doc.egy_account
        },
        callback: function(r) {
          if (r.message) {
            frm.set_value('egy_balance', r.message);
          }
        }
      });
    }

    // filters commissar based on company name
    frm.set_query("purchase_commissar", function (doc) {
      return {
        query: "teller.teller_customization.doctype.teller_purchase.teller_purchase.filters_commissars_by_company",
        filters: {
          link_doctype: "Customer",
          link_name: doc.buyer,
        },
      };
    });

    // Ensure egy_balance is always visible
    frm.toggle_display('egy_balance', true);
    frm.set_df_property('egy_balance', 'hidden', 0);
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

  // get customer information if exists
  buyer: function (frm) {
    if (!frm.doc.buyer) {
      return;  // Exit if no buyer selected
    }

    frappe.call({
      method: "frappe.client.get",
      args: {
        doctype: "Customer",
        name: frm.doc.buyer,
      },
      callback: function (r) {
        if (!r.message) {
          return;
        }

        const customer = r.message;
        
        // Set common fields regardless of category
        frm.set_value("buyer_name", customer.customer_name);
        
        if (frm.doc.category_of_buyer == "Egyptian" || frm.doc.category_of_buyer === "Foreigner") {
          // Set individual fields
          const individualFields = [
            'buyer_name', 'buyer_gender', 'buyer_nationality',
            'buyer_work_for', 'buyer_phone', 
            'buyer_place_of_birth', 'buyer_date_of_birth', 'buyer_job_title', 
            'buyer_address', 'buyer_national_id', 'buyer_passport_number', 
            'buyer_military_number'
          ];

          // Set individual fields only if they have values
          Object.entries(individualFields).forEach(([field, value]) => {
            if (value) {
              frm.set_value(field, value);
            }
          });

          // First hide all ID fields
          frm.set_df_property('buyer_national_id', 'hidden', 1);
          frm.set_df_property('buyer_passport_number', 'hidden', 1);
          frm.set_df_property('buyer_military_number', 'hidden', 1);

          // Set ID fields based on card type and show the relevant one
          if (customer.custom_card_type === "National ID") {
            frm.set_value("buyer_national_id", customer.custom_national_id);
            frm.set_df_property('buyer_national_id', 'hidden', 0);
          } else if (customer.custom_card_type === "Passport") {
            frm.set_value("buyer_passport_number", customer.custom_passport_number);
            frm.set_df_property('buyer_passport_number', 'hidden', 0);
          } else if (customer.custom_card_type === "Military Card") {
            frm.set_value("buyer_military_number", customer.custom_military_number);
            frm.set_df_property('buyer_military_number', 'hidden', 0);
          }

          // Ensure fields are refreshed
          frm.refresh_fields(['buyer_national_id', 'buyer_passport_number', 'buyer_military_number']);

        } else if (frm.doc.category_of_buyer == "Company" || frm.doc.category_of_buyer === "Interbank") {
          // Set company fields
          const companyFields = {
            "buyer_company_name": customer.customer_name,
            "buyer_company_address": customer.custom_comany_address1,
            "buyer_company_commercial_no": customer.custom_commercial_no,
            "buyer_company_start_date": customer.custom_start_registration_date,
            "buyer_company_end_date": customer.custom_end_registration_date,
            "buyer_company_legal_form": customer.custom_legal_form,
            "buyer_company_activity": customer.custom_company_activity,
            "is_expired1": customer.custom_is_expired,
            "interbank": customer.custom_interbank
          };

          // Set company fields only if they have values
          Object.entries(companyFields).forEach(([field, value]) => {
            if (value !== undefined && value !== null) {
              frm.set_value(field, value);
            }
          });
        }

        frm.refresh_fields();
      }
    });

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
            custom_address: frm.doc.buyer_address,
            custom_date_of_birth: frm.doc.buyer_date_of_birth
              ? frm.doc.buyer_date_of_birth
              : frappe.datetime.get_today(),
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
                  latest_client.custom_address = frm.doc.buyer_address;

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

  egy: function(frm) {
    if (frm.doc.egy) {
      frappe.call({
        method: "teller.teller_customization.doctype.teller_purchase.teller_purchase.account_to_balance",
        args: {
          paid_to: frm.doc.egy,
        },
        callback: function (r) {
          if (r.message) {
            frm.set_value('egy_balance', r.message);
            frm.refresh_field('egy_balance');
          }
        },
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
  special_price: function(frm) {
    if (!frm.doc.category_of_buyer || frm.doc.category_of_buyer !== 'Interbank') {
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
            transaction: "Purchasing"
          }
        };
      },
      action(selections, args) {
        // Clear console for debugging
        console.clear();
        console.log("Selected bookings:", selections);
        console.log("Args:", args);
        
        if (!selections || selections.length === 0) {
          frappe.msgprint(__("No bookings selected"));
          return;
        }
        
        // Process each selected booking
        selections.forEach(function(booking_ib) {
          if (booking_ib) {
            frappe.call({
              method: "frappe.client.get",
              args: {
                doctype: "Booking Interbank",
                name: booking_ib
              },
              callback: function(response) {
                console.log("Booking response:", response);
                
                if (response && response.message) {
                  let booking = response.message;
                  
                  // Check if booked_currency exists and has items
                  if (booking.booked_currency && booking.booked_currency.length > 0) {
                    console.log("Processing booked currencies:", booking.booked_currency);
                    
                    // Filter to get only items with status "Not Billed" or "Partial Billed"
                    let availableItems = booking.booked_currency.filter(item => 
                      item.status === "Not Billed" || item.status === "Partial Billed");
                    
                    console.log("Available items:", availableItems);
                    
                    if (availableItems.length === 0) {
                      frappe.msgprint(__("No available currencies in booking {0}", [booking_ib]));
                      return;
                    }
                    
                    // Process filtered items
                    availableItems.forEach(function(item) {
                      // Calculate available quantity
                      let availableQty = item.qty;
                      if (item.booking_qty) {
                        availableQty -= item.booking_qty;
                      }
                      
                      if (availableQty <= 0) {
                        console.log("Item has no available quantity:", item);
                        return; // Skip items with no available quantity
                      }
                      
                      console.log("Adding item with available qty:", availableQty, item);
                      
                      // Add to purchase transactions
                      let child = frm.add_child("purchase_transactions");
                      
                      // Set all required fields
                      child.currency_code = item.currency_code;
                      child.currency = item.currency;
                      child.quantity = availableQty;
                      child.exchange_rate = item.rate;
                      child.booking_interbank = booking_ib;
                      child.amount = availableQty;
                      child.egy_amount = availableQty * item.rate;
                      
                      // If there's an account field that needs to be set based on currency
                      if (item.currency) {
                        // Find the appropriate account for this currency
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
                              frm.refresh_field("purchase_transactions");
                            }
                          }
                        });
                      }
                    });
                    
                    // Refresh the child table
                    frm.refresh_field("purchase_transactions");
                    
                    // Update total
                    let total = 0;
                    frm.doc.purchase_transactions.forEach((item) => {
                      total += flt(item.egy_amount || 0);
                    });
                    frm.set_value("total", total);
                    frm.refresh_field("total");
                    
                    frappe.show_alert({
                      message: __('Successfully added currencies from booking {0}', [booking_ib]),
                      indicator: 'green'
                    });
                  } else {
                    frappe.msgprint(__("No booked currencies found in booking {0}", [booking_ib]));
                  }
                } else {
                  frappe.msgprint(__("Could not retrieve booking {0}", [booking_ib]));
                }
              },
              error: function(err) {
                console.error("Error fetching booking:", err);
                frappe.msgprint(__("Error fetching booking details"));
              }
            });
          }
        });
      }
    });
  }
});
// currency transactions table

frappe.ui.form.on("Teller Purchase Child", {
    currency_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        console.log("Currency code changed:", row.currency_code); // Debug message
        
        if (row.currency_code && frm.doc.treasury_code) {
            // Get account and currency based on currency code AND treasury code
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Account',
                    filters: {
                        'custom_currency_code': row.currency_code,
                        'account_type': ['in', ['Bank', 'Cash']],
                        'custom_teller_treasury': frm.doc.treasury_code
                    },
                    fields: ['name', 'account_currency'],
                    limit: 1
                },
                callback: function(account_response) {
                    console.log("Account response:", account_response); // Debug message
                    if (account_response.message && account_response.message.length > 0) {
                        let account = account_response.message[0];
                        
                        // Set the currency first
                        frappe.model.set_value(cdt, cdn, 'currency', account.account_currency);
                        
                        // Get exchange rate before setting account
                        frappe.call({
                            method: 'frappe.client.get_list',
                            args: {
                                doctype: 'Currency Exchange',
                                filters: {
                                    'from_currency': account.account_currency,
                                    'to_currency': 'EGP'
                                },
                                fields: ['custom_special_purchasing', 'exchange_rate'],
                                order_by: 'date desc, creation desc',
                                limit: 1
                            },
                            callback: function(rate_response) {
                                console.log("Rate response:", rate_response); // Debug message
                                if (rate_response.message && rate_response.message.length > 0) {
                                    let rate = rate_response.message[0];
                                    // Use special purchasing rate if available, otherwise use regular exchange rate
                                    let exchange_rate = rate.custom_special_purchasing || rate.exchange_rate;
                                    
                                    if (exchange_rate) {
                                        // Set both the account and exchange rate together to prevent race conditions
                                        frappe.model.set_value(cdt, cdn, 'exchange_rate', exchange_rate);
                                        frappe.model.set_value(cdt, cdn, 'account', account.name);
                                        
                                        // Get account balance
                                        frappe.call({
                                            method: 'teller.teller_customization.doctype.teller_purchase.teller_purchase.account_from_balance',
                                            args: {
                                                paid_from: account.name
                                            },
                                            callback: function(balance_response) {
                                                if (balance_response.message) {
                                                    frappe.model.set_value(cdt, cdn, 'balance_after', balance_response.message);
                                                }
                                            }
                                        });
                                    } else {
                                        frappe.msgprint(__('No valid exchange rate found for currency ' + account.account_currency));
                                    }
                                } else {
                                    frappe.msgprint(__('No exchange rate record found for currency ' + account.account_currency));
                                }
                            }
                        });
                    } else {
                        frappe.msgprint(__('No account found for currency code ' + row.currency_code + ' in treasury ' + frm.doc.treasury_code));
                    }
                }
            });
        } else if (!frm.doc.treasury_code) {
            frappe.msgprint(__('Please ensure treasury code is set before selecting currency code'));
        }
    },

    account: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        // Store the originally selected account
        let selectedAccount = row.account;
        
        // Only proceed if the exchange rate is not already set
        if (selectedAccount && !row.exchange_rate) {
            // Get currency and currency code from account
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Account',
                    name: selectedAccount
                },
                callback: function(response) {
                    if (response.message) {
                        let account = response.message;
                        
                        // Set currency code and currency without changing the account
                        frappe.model.set_value(cdt, cdn, 'currency_code', account.custom_currency_code);
                        frappe.model.set_value(cdt, cdn, 'currency', account.account_currency);
                        
                        // Ensure the account stays as originally selected
                        frappe.model.set_value(cdt, cdn, 'account', selectedAccount);
                        
                        // Only get exchange rate if it's not already set
                        if (!row.exchange_rate) {
                            frappe.call({
                                method: 'frappe.client.get_list',
                                args: {
                                    doctype: 'Currency Exchange',
                                    filters: {
                                        'from_currency': account.account_currency,
                                        'to_currency': 'EGP'
                                    },
                                    fields: ['custom_special_purchasing', 'exchange_rate'],
                                    order_by: 'date desc, creation desc',
                                    limit: 1
                                },
                                callback: function(rate_response) {
                                    if (rate_response.message && rate_response.message.length > 0) {
                                        let rate = rate_response.message[0];
                                        let exchange_rate = rate.custom_special_purchasing || rate.exchange_rate;
                                        if (exchange_rate) {
                                            frappe.model.set_value(cdt, cdn, 'exchange_rate', exchange_rate);
                                            // Ensure account is still correct after setting exchange rate
                                            frappe.model.set_value(cdt, cdn, 'account', selectedAccount);
                                        }
                                    }
                                }
                            });
                        }
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
    },
  
  purchase_transactions_remove: function(frm) {
    // Recalculate total when a row is removed
    let total = 0;
    if (frm.doc.purchase_transactions) {
      frm.doc.purchase_transactions.forEach((item) => {
        total += flt(item.egy_amount || 0);
      });
    }
    frm.set_value('total', total);
    frm.refresh_field('total');
    
    // Check limits if buyer is set
    if (frm.doc.buyer && total > 0) {
      isExceededLimit(frm, frm.doc.buyer, total);
    }
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
    
    // Update balance after
    if (row.balance_after !== undefined) {
      let new_balance = flt(row.balance_after) + flt(amount);
      frappe.model.set_value(cdt, cdn, 'balance_after', new_balance);
    }
    
    // Update parent's total by summing all egy_amounts
    let total = 0;
    frm.doc.purchase_transactions.forEach((item) => {
      total += flt(item.egy_amount || 0);
    });
    frm.set_value('total', total);
    frm.refresh_field('total');
    
    // Check limits if buyer is set
    if (frm.doc.buyer && total > 0) {
      isExceededLimit(frm, frm.doc.buyer, total);
    }
  }
}

// fetch the allowed amount from teller setting
async function fetchAllowedAmount() {
  return frappe.db.get_single_value("Teller Setting", "purchase_allowed_amount");
}

// fetch the duration of days for the limit
async function fetchLimitDuration() {
  return frappe.db.get_single_value("Teller Setting", "purchase_duration");
}

// get the customer Total Invoices Amount
async function getCustomerTotalAmount(buyerName) {
  let limiDuration = await fetchLimitDuration();
  return new Promise((resolve, reject) => {
    frappe.call({
      method: "teller.teller_customization.doctype.teller_purchase.teller_purchase.get_customer_total_amount",
      args: {
        client_name: buyerName,
        duration: limiDuration,
      },
      callback: function (r) {
        if (r.message !== undefined) {
          resolve(r.message);
        } else {
          reject("No response message");
        }
      },
      error: function(err) {
        console.error("Error fetching customer total:", err);
        resolve(0); // Default to 0 on error to avoid breaking the flow
      }
    });
  });
}

// Check if the current invoice or customer total invoices exceeds the limit
async function isExceededLimit(frm, buyerName, invoiceTotal) {
  if (!buyerName || !invoiceTotal) {
    return;
  }
  
  try {
    let allowedAmount = await fetchAllowedAmount();
    console.log("Allowed amount:", allowedAmount);
    
    let customerTotal = await getCustomerTotalAmount(buyerName);
    console.log("Customer total:", customerTotal);
    
    let limiDuration = await fetchLimitDuration();
    console.log("Limit duration:", limiDuration);
    
    // Convert values to numbers to ensure proper comparison
    allowedAmount = parseFloat(allowedAmount) || 0;
    customerTotal = parseFloat(customerTotal) || 0;
    invoiceTotal = parseFloat(invoiceTotal) || 0;
    
    if (customerTotal >= 0) {
      let total = customerTotal + invoiceTotal;
      console.log("Total (customer + current):", total);
      
      if (total > allowedAmount) {
        frm.set_value("exceed", 1);
        frappe.msgprint({
          message: `<div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 14px;">
                      Customer total transactions (${format_currency(total, "EGP")}) exceed the allowed amount (${format_currency(allowedAmount, "EGP")}). 
                      Additional information is required.
                    </div>`,
          title: "Limit Exceeded",
          indicator: "red",
        });
      } else {
        frm.set_value("exceed", 0);
      }
    } else {
      // If we couldn't get customer total, just check current invoice
      if (invoiceTotal > allowedAmount) {
        frm.set_value("exceed", 1);
        frappe.msgprint({
          message: `<div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 14px;">
                      Transaction amount (${format_currency(invoiceTotal, "EGP")}) exceeds the allowed amount (${format_currency(allowedAmount, "EGP")}). 
                      Additional information is required.
                    </div>`,
          title: "Limit Exceeded",
          indicator: "red",
        });
      } else {
        frm.set_value("exceed", 0);
      }
    }
    
    // Refresh the exceed field to ensure UI is updated
    frm.refresh_field("exceed");
    
  } catch (error) {
    console.error("Error in isExceededLimit:", error);
    // Don't change exceed status on error
  }
}

// validate the national id
function validateNationalId(frm, nationalId) {
  if (nationalId && nationalId.length !== 14) {
    frappe.throw({
      title: __("Invalid National ID"),
      message: __("National ID must be 14 digits")
    });
  }
}

// validate end registration date is must be after start registration
function validateRegistrationDate(frm, start, end) {
  if (start && end) {
    let startDate = frappe.datetime.str_to_obj(start);
    let endDate = frappe.datetime.str_to_obj(end);
    
    if (startDate > endDate) {
      frappe.throw({
        title: __("Invalid Date"),
        message: __("Start Date cannot be greater than End Date")
      });
    }
  }
}

// validate if the registration date is expired
function validateRegistrationDateExpiration(frm, end) {
  if (end) {
    let endDate = frappe.datetime.str_to_obj(end);
    let today = frappe.datetime.str_to_obj(frappe.datetime.get_today());
    
    if (endDate < today) {
      frm.set_value('is_expired1', 1);
    } else {
      frm.set_value('is_expired1', 0);
    }
  }
}

// Helper function to show identification fields
function showIdentificationFields(frm) {
    // First hide all ID fields
    frm.set_df_property('buyer_national_id', 'hidden', 1);
    frm.set_df_property('buyer_passport_number', 'hidden', 1);
    frm.set_df_property('buyer_military_number', 'hidden', 1);

    // Only show fields if we have a category and card type
    if (frm.doc.category_of_buyer && frm.doc.buyer_card_type) {
        if (frm.doc.buyer_card_type === "National ID") {
            frm.set_df_property('buyer_national_id', 'hidden', 0);
            frm.set_df_property('buyer_national_id', 'reqd', 1);
        } else if (frm.doc.buyer_card_type === "Passport") {
            frm.set_df_property('buyer_passport_number', 'hidden', 0);
            frm.set_df_property('buyer_passport_number', 'reqd', 1);
        } else if (frm.doc.buyer_card_type === "Military Card") {
            frm.set_df_property('buyer_military_number', 'hidden', 0);
            frm.set_df_property('buyer_military_number', 'reqd', 1);
        }
    }

    // Refresh the fields to ensure visibility changes take effect
    frm.refresh_fields(['buyer_national_id', 'buyer_passport_number', 'buyer_military_number']);
}

function makeIdentificationFieldsReadOnly(frm) {
  const fields = ['buyer_national_id', 'buyer_passport_number', 'buyer_military_number'];
  
  fields.forEach(field => {
    // Only set read-only property, don't change visibility
    frm.set_df_property(field, 'read_only', frm.doc.docstatus === 1);
    if (frm.fields_dict[field]) {
      frm.fields_dict[field].refresh();
    }
  });
  
  frm.refresh_fields(fields);
}

function clearFieldsBasedOnCategory(frm) {
    // Only clear fields if document is not submitted
    if (frm.doc.docstatus !== 1) {
        // Store the current search ID if it exists
        const currentSearchId = frm.doc.buyer_search_id;
        
        if (frm.doc.category_of_buyer !== "Egyptian" && frm.doc.category_of_buyer !== "Foreigner") {
            const individualFields = [
                'buyer_name', 'buyer_gender', 'buyer_nationality',
                'buyer_work_for', 'buyer_phone', 
                'buyer_place_of_birth', 'buyer_date_of_birth', 'buyer_job_title', 
                'buyer_address', 'buyer_national_id', 'buyer_passport_number', 
                'buyer_military_number'
            ];
            individualFields.forEach(field => frm.set_value(field, ''));
        }
        
        if (frm.doc.category_of_buyer !== "Company" && frm.doc.category_of_buyer !== "Interbank") {
            const companyFields = [
                'buyer_company_name', 'buyer_company_activity', 
                'buyer_company_start_date', 'buyer_company_end_date', 
                'buyer_company_address', 'is_expired1', 'interbank',
                'buyer_company_legal_form', 'buyer'
            ];
            companyFields.forEach(field => frm.set_value(field, ''));
        }

        // Restore the search ID if it existed
        if (currentSearchId) {
            frm.set_value('buyer_search_id', currentSearchId);
        }
    }
    
    frm.refresh_fields();
}

function make_return(frm) {
  frappe.confirm(
    'Are you sure you want to convert this document to a return? This will reverse all GL entries.',
    () => {
      frm.call({
        method: "teller.teller_customization.doctype.teller_purchase.teller_purchase.make_purchase_return",
        args: {
          doc: frm.doc
        },
        freeze: true,
        freeze_message: __("Converting to Return..."),
        callback: (r) => {
          if (r.message) {
            frappe.show_alert({
              message: __("Document converted to return successfully"),
              indicator: 'green'
            });
            frm.reload_doc();
          }
        }
      });
    }
  );
}