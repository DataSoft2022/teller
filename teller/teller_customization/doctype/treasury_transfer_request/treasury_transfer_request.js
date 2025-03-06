// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on('Treasury Transfer Request', {
    setup: function(frm) {
        // Initialize flags to prevent confirmation dialogs on initial load
        if (frm.is_new()) {
            frm.__treasury_from_initial_load = true;
            frm.__treasury_to_initial_load = true;
        }
        
        // Set query for currency_code in currency_transfers table
        frm.set_query("currency_code", "currency_transfers", function(doc) {
            if (!doc.treasury_from) {
                frappe.throw(__('Please select source treasury first'));
                return;
            }
            return {
                query: "teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_available_currency_codes",
                filters: {
                    "treasury": doc.treasury_from
                }
            };
        });
    },

    onload: function(frm) {
        if (frm.is_new()) {
            // Get current user's employee record and associated treasury
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'User Permission',
                    filters: {
                        'user': frappe.session.user,
                        'allow': 'Teller Treasury'
                    },
                    fieldname: ['for_value']
                },
                callback: function(r) {
                    if (r.message && r.message.for_value) {
                        let treasury = r.message.for_value;
                        
                        // Get the branch from the treasury
                        frappe.db.get_value('Teller Treasury', treasury, 'branch')
                            .then(r => {
                                if (r.message && r.message.branch) {
                                    // First set the branch
                                    frm.set_value('branch_from', r.message.branch)
                                        .then(() => {
                                            // Set the destination branch to match the source branch
                                            frm.set_value('branch_to', r.message.branch)
                                                .then(() => {
                                                    // Then set the treasury after branch is set
                                                    frm.set_value('treasury_from', treasury);
                                                });
                                        });
                                }
                            });
                    }
                }
            });
        }
    },

    refresh: function(frm) {
        // Add button to get all currencies with positive balance
        if (frm.doc.docstatus === 0) {
            frm.add_custom_button(__('Get All Currencies'), function() {
                get_all_currencies(frm);
            });
            
            frm.add_custom_button(__('Show Summary'), function() {
                show_transfer_summary(frm);
            });
        }
        
        // Add custom buttons for manager approval/rejection
        if (frm.doc.docstatus === 1 && frm.doc.status === 'Pending Manager Approval' && 
            (frappe.user.has_role('System Manager') || frappe.user.has_role('Accounts Manager') || frappe.user.has_role('Branch Manager'))) {
            
            frm.add_custom_button(__('Approve'), function() {
                frappe.confirm(
                    __('Are you sure you want to approve this transfer request?<br><br>This will create a new Treasury Transfer document and cannot be undone.'),
                    function() {
                        frappe.call({
                            method: 'teller.teller_customization.doctype.treasury_transfer_request.treasury_transfer_request.approve_request',
                            args: {
                                request_name: frm.doc.name,
                                user: frappe.session.user
                            },
                            freeze: true,
                            freeze_message: __('Approving request and creating transfer...'),
                            callback: function(r) {
                                if (r.message) {
                                    let transfer_name = r.message;
                                    frappe.show_alert({
                                        message: __('Request approved and transfer {0} created', [transfer_name]),
                                        indicator: 'green'
                                    });
                                    
                                    // Show a link to the created transfer
                                    frappe.msgprint({
                                        title: __('Treasury Transfer Created'),
                                        indicator: 'green',
                                        message: __('Treasury Transfer <a href="/app/treasury-transfer/{0}">{0}</a> has been created successfully.', [transfer_name])
                                    });
                                    
                                    frm.reload_doc();
                                } else {
                                    frappe.show_alert({
                                        message: __('Error approving request'),
                                        indicator: 'red'
                                    });
                                }
                            },
                            error: function(r) {
                                frappe.show_alert({
                                    message: __('Error approving request: {0}', [r.message.error || 'Unknown error']),
                                    indicator: 'red'
                                });
                            }
                        });
                    }
                );
            }, __('Actions'));
            
            frm.add_custom_button(__('Reject'), function() {
                frappe.prompt([
                    {
                        fieldname: 'reason',
                        label: __('Reason for Rejection'),
                        fieldtype: 'Small Text',
                        reqd: 1,
                        description: __('Please provide a detailed reason for rejecting this request.')
                    }
                ],
                function(values) {
                    frappe.call({
                        method: 'teller.teller_customization.doctype.treasury_transfer_request.treasury_transfer_request.reject_request',
                        args: {
                            request_name: frm.doc.name,
                            user: frappe.session.user,
                            reason: values.reason
                        },
                        freeze: true,
                        freeze_message: __('Rejecting request...'),
                        callback: function(r) {
                            if (r.message === true) {
                                frappe.show_alert({
                                    message: __('Request rejected successfully'),
                                    indicator: 'green'
                                });
                                frm.reload_doc();
                            } else {
                                frappe.show_alert({
                                    message: __('Error rejecting request'),
                                    indicator: 'red'
                                });
                            }
                        },
                        error: function(r) {
                            frappe.show_alert({
                                message: __('Error rejecting request: {0}', [r.message.error || 'Unknown error']),
                                indicator: 'red'
                            });
                        }
                    });
                },
                __('Reject Request'),
                __('Submit')
                );
            }, __('Actions'));
        }
        
        // Add custom buttons for recipient approval/rejection
        if (frm.doc.docstatus === 1 && frm.doc.status === 'Pending Recipient Approval') {
            // Check if current user is the recipient (employee of destination treasury)
            frappe.call({
                method: 'teller.teller_customization.doctype.treasury_transfer_request.treasury_transfer_request.check_if_user_is_recipient',
                args: {
                    user: frappe.session.user,
                    treasury_code: frm.doc.treasury_to
                },
                callback: function(r) {
                    if (r.message) {
                        // Current user is the recipient, show approval/rejection buttons
                        frm.add_custom_button(__('Accept Transfer'), function() {
                            frappe.confirm(
                                __('Are you sure you want to accept this transfer?<br><br>This will create a new Treasury Transfer document and transfer the funds to your accounts.'),
                                function() {
                                    frappe.call({
                                        method: 'teller.teller_customization.doctype.treasury_transfer_request.treasury_transfer_request.recipient_approve_request',
                                        args: {
                                            request_name: frm.doc.name,
                                            user: frappe.session.user
                                        },
                                        freeze: true,
                                        freeze_message: __('Accepting transfer and creating transfer document...'),
                                        callback: function(r) {
                                            if (r.message) {
                                                let transfer_name = r.message;
                                                frappe.show_alert({
                                                    message: __('Transfer accepted and document {0} created', [transfer_name]),
                                                    indicator: 'green'
                                                });
                                                
                                                // Show a link to the created transfer
                                                frappe.msgprint({
                                                    title: __('Treasury Transfer Created'),
                                                    indicator: 'green',
                                                    message: __('Treasury Transfer <a href="/app/treasury-transfer/{0}">{0}</a> has been created successfully.', [transfer_name])
                                                });
                                                
                                                frm.reload_doc();
                                            } else {
                                                frappe.show_alert({
                                                    message: __('Error accepting transfer'),
                                                    indicator: 'red'
                                                });
                                            }
                                        },
                                        error: function(r) {
                                            frappe.show_alert({
                                                message: __('Error accepting transfer: {0}', [r.message.error || 'Unknown error']),
                                                indicator: 'red'
                                            });
                                        }
                                    });
                                }
                            );
                        }, __('Actions'));
                        
                        frm.add_custom_button(__('Decline Transfer'), function() {
                            frappe.prompt([
                                {
                                    fieldname: 'reason',
                                    label: __('Reason for Declining'),
                                    fieldtype: 'Small Text',
                                    reqd: 1,
                                    description: __('Please provide a reason for declining this transfer.')
                                }
                            ],
                            function(values) {
                                frappe.call({
                                    method: 'teller.teller_customization.doctype.treasury_transfer_request.treasury_transfer_request.recipient_reject_request',
                                    args: {
                                        request_name: frm.doc.name,
                                        user: frappe.session.user,
                                        reason: values.reason
                                    },
                                    freeze: true,
                                    freeze_message: __('Declining transfer...'),
                                    callback: function(r) {
                                        frappe.show_alert({
                                            message: __('Transfer declined successfully'),
                                            indicator: 'green'
                                        });
                                        frm.reload_doc();
                                    },
                                    error: function(r) {
                                        frappe.show_alert({
                                            message: __('Error declining transfer: {0}', [r.message.error || 'Unknown error']),
                                            indicator: 'red'
                                        });
                                    }
                                });
                            },
                            __('Reason for Declining'),
                            __('Submit')
                            );
                        }, __('Actions'));
                    }
                }
            });
        }
        
        // Show status indicator
        if (frm.doc.status) {
            let indicator = 'gray';
            if (frm.doc.status === 'Approved') indicator = 'green';
            else if (frm.doc.status === 'Rejected') indicator = 'red';
            else if (frm.doc.status === 'Pending Manager Approval') indicator = 'orange';
            else if (frm.doc.status === 'Pending Recipient Approval') indicator = 'orange';
            
            frm.page.set_indicator(frm.doc.status, indicator);
        }

        // Set filters for treasury fields
        frm.set_query('treasury_from', function() {
            return {
                filters: {
                    'branch': frm.doc.branch_from
                },
                // Keep user permissions for source treasury
                ignore_user_permissions: 0
            };
        });

        frm.set_query('treasury_to', function() {
            return {
                filters: {
                    'branch': frm.doc.branch_to,
                    'name': ['!=', frm.doc.treasury_from] // Can't transfer to same treasury
                },
                // Ignore permissions for destination treasury
                ignore_user_permissions: 1
            };
        });

        // Add Get All Currencies button
        if (frm.doc.docstatus !== 1) {
            frm.add_custom_button(__('Get All Currencies'), function() {
                get_all_currencies(frm);
            });
        }
    },
    
    branch_from: function(frm) {
        // Only clear treasury when branch changes manually
        if (frm.doc.branch_from && !frm.is_new()) {
            frm.set_value('treasury_from', '');
        }
        
        // Set destination branch to match source branch if it's not already set
        if (frm.doc.branch_from && (!frm.doc.branch_to || frm.is_new())) {
            frm.set_value('branch_to', frm.doc.branch_from);
        }
    },
    
    branch_to: function(frm) {
        // Clear treasury when branch changes
        if (frm.doc.branch_to) {
            frm.set_value('treasury_to', '');
        }
    },

    treasury_from: function(frm) {
        // Skip confirmation on initial load of a new form
        if (frm.is_new() && frm.__treasury_from_initial_load) {
            frm.__treasury_from_initial_load = false;
            get_treasury_employee(frm, 'from');
            return;
        }
        
        // Set the flag on the first load
        if (frm.is_new() && frm.__treasury_from_initial_load === undefined) {
            frm.__treasury_from_initial_load = true;
        }
        
        // Handle clearing currency transfers when treasury changes
        // Only show confirmation if we have currency transfers with valid amounts
        let has_valid_transfers = false;
        if (frm.doc.currency_transfers && frm.doc.currency_transfers.length > 0) {
            frm.doc.currency_transfers.forEach(function(row) {
                if (row.amount && flt(row.amount) > 0) {
                    has_valid_transfers = true;
                }
            });
        }
        
        if (has_valid_transfers) {
            frappe.confirm(
                __('Changing the source treasury will clear all currency transfers. Continue?'),
                function() {
                    // Clear currency transfers when source treasury changes
                    frm.clear_table('currency_transfers');
                    frm.refresh_field('currency_transfers');
                    calculate_total(frm);
                    
                    // Show success message
                    frappe.show_alert({
                        message: __('Currency transfers cleared'),
                        indicator: 'blue'
                    });
                    
                    // Get employee for source treasury after confirmation
                    get_treasury_employee(frm, 'from');
                },
                function() {
                    // If user cancels, revert to previous treasury
                    frappe.db.get_value('Treasury Transfer Request', frm.doc.name, 'treasury_from')
                        .then(r => {
                            if (r.message && r.message.treasury_from) {
                                frm.set_value('treasury_from', r.message.treasury_from);
                            }
                        });
                }
            );
        } else {
            // Get employee for source treasury
            get_treasury_employee(frm, 'from');
        }
        
        // Employee lookup is handled in the if/else blocks above
    },

    treasury_to: function(frm) {
        // Skip confirmation on initial load of a new form
        if (frm.is_new() && frm.__treasury_to_initial_load) {
            frm.__treasury_to_initial_load = false;
            get_treasury_employee(frm, 'to');
            return;
        }
        
        // Set the flag on the first load
        if (frm.is_new() && frm.__treasury_to_initial_load === undefined) {
            frm.__treasury_to_initial_load = true;
        }
        
        // Handle updating destination accounts when treasury changes
        // Only show confirmation if we have currency transfers with valid amounts
        let has_valid_transfers = false;
        if (frm.doc.currency_transfers && frm.doc.currency_transfers.length > 0) {
            frm.doc.currency_transfers.forEach(function(row) {
                if (row.amount && flt(row.amount) > 0) {
                    has_valid_transfers = true;
                }
            });
        }
        
        if (has_valid_transfers) {
            frappe.confirm(
                __('Changing the destination treasury will update all destination accounts. Continue?'),
                function() {
                    // Update destination accounts if we have currencies
                    update_destination_accounts(frm);
                    
                    // Get employee for destination treasury after confirmation
                    get_treasury_employee(frm, 'to');
                },
                function() {
                    // If user cancels, revert to previous treasury
                    frappe.db.get_value('Treasury Transfer Request', frm.doc.name, 'treasury_to')
                        .then(r => {
                            if (r.message && r.message.treasury_to) {
                                frm.set_value('treasury_to', r.message.treasury_to);
                            }
                        });
                }
            );
        } else {
            // Get employee for destination treasury
            get_treasury_employee(frm, 'to');
        }
    },
    
    validate: function(frm) {
        calculate_total(frm);
    }
});

frappe.ui.form.on('Treasury Transfer Detail', {
    currency_transfers_add: function(frm, cdt, cdn) {
        // Clear the row if it's manually added
        var row = locals[cdt][cdn];
        row.currency_code = '';
        row.currency_display = '';
        row.from_account = '';
        row.to_account = '';
        row.amount = 0;
        frm.refresh_field('currency_transfers');
    },

    currency_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.currency_code && frm.doc.treasury_from) {
            // First get source account details only
            frappe.call({
                method: 'teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_currency_details',
                args: {
                    currency_code: row.currency_code,
                    from_treasury: frm.doc.treasury_from
                },
                callback: function(r) {
                    if (r.message) {
                        // Set currency display name
                        frappe.model.set_value(cdt, cdn, 'currency_display', r.message.currency_name);
                        
                        // Set source account and its balance
                        frappe.model.set_value(cdt, cdn, 'from_account', r.message.from_account);
                        frappe.model.set_value(cdt, cdn, 'from_account_balance', r.message.from_balance);
                        
                        // If we have a destination treasury, get its account using our new method
                        if (frm.doc.treasury_to) {
                            frappe.call({
                                method: 'teller.teller_customization.doctype.treasury_transfer_request.treasury_transfer_request.get_destination_account',
                                args: {
                                    treasury: frm.doc.treasury_to,
                                    currency: r.message.currency_name
                                },
                                callback: function(r) {
                                    if (r.message) {
                                        frappe.model.set_value(cdt, cdn, 'to_account', r.message.name);
                                        if (r.message.balance !== undefined) {
                                            frappe.model.set_value(cdt, cdn, 'to_account_balance', r.message.balance);
                                        }
                                    }
                                },
                                error: function(r) {
                                    // Clear the to_account field if there's an error
                                    frappe.model.set_value(cdt, cdn, 'to_account', '');
                                    frappe.show_alert({
                                        message: __('Error finding destination account: {0}', [r.message.error || 'Unknown error']),
                                        indicator: 'red'
                                    });
                                }
                            });
                        }
                    }
                },
                error: function(r) {
                    frappe.show_alert({
                        message: __('Error getting currency details: {0}', [r.message.error || 'Unknown error']),
                        indicator: 'red'
                    });
                    // Clear the row values
                    frappe.model.set_value(cdt, cdn, 'currency_display', '');
                    frappe.model.set_value(cdt, cdn, 'from_account', '');
                    frappe.model.set_value(cdt, cdn, 'from_account_balance', 0);
                }
            });
        }
    },

    amount: function(frm) {
        calculate_total(frm);
    },
    
    before_submit: function(frm) {
        return validate_form(frm);
    }
});

function get_all_currencies(frm) {
    if (!frm.doc.treasury_from) {
        frappe.msgprint(__('Please select source treasury first'));
        return;
    }
    
    // Check if we have any valid currency transfers with amounts
    let has_valid_transfers = false;
    if (frm.doc.currency_transfers && frm.doc.currency_transfers.length > 0) {
        frm.doc.currency_transfers.forEach(function(row) {
            if (row.amount && flt(row.amount) > 0) {
                has_valid_transfers = true;
            }
        });
    }
    
    // Only show confirmation if we have valid transfers
    if (has_valid_transfers) {
        frappe.confirm(
            __('This will replace all existing currency transfers. Continue?'),
            function() {
                // Proceed with fetching currencies
                fetch_currencies(frm);
            }
        );
    } else {
        // No valid currencies, proceed directly
        fetch_currencies(frm);
    }
}

function fetch_currencies(frm) {
    // Check if both treasuries are selected
    if (!frm.doc.treasury_from) {
        frappe.msgprint(__('Please select source treasury first'));
        return;
    }
    
    if (!frm.doc.treasury_to) {
        frappe.msgprint(__('Please select destination treasury first'));
        return;
    }
    
    // Show loading message
    frm.set_value('status_message', __('Loading available currencies...'));
    frm.refresh_field('status_message');
    
    // Show a loading indicator


    // First get all available currencies from source treasury
    frappe.call({
        method: 'teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_available_currencies',
        args: {
            from_treasury: frm.doc.treasury_from
        },
        freeze: true,
        freeze_message: __('Fetching currencies...'),
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                // Clear existing table
                frm.clear_table('currency_transfers');
                
                // Update status message
                frm.set_value('status_message', __('Found {0} currencies. Checking destination accounts...', [r.message.length]));
                frm.refresh_field('status_message');
                
                // Create a counter for currencies with both accounts
                let valid_currency_count = 0;
                let promises = [];
                
                // For each currency, check if destination account exists before adding to table
                r.message.forEach(function(currency) {
                    promises.push(new Promise((resolve) => {
                        frappe.call({
                            method: 'teller.teller_customization.doctype.treasury_transfer_request.treasury_transfer_request.get_destination_account',
                            args: {
                                treasury: frm.doc.treasury_to,
                                currency: currency.currency_name
                            },
                            callback: function(dest_r) {
                                if (dest_r.message && dest_r.message.name && !dest_r.message.missing && !dest_r.message.error) {
                                    // Both source and destination accounts exist, add to table
                                    let row = frm.add_child('currency_transfers');
                                    row.currency_code = currency.currency_code;
                                    row.currency_display = currency.currency_name;
                                    row.from_account = currency.account;
                                    row.from_account_balance = currency.balance;
                                    row.to_account = dest_r.message.name;
                                    row.to_account_balance = dest_r.message.balance;
                                    valid_currency_count++;
                                }
                                resolve();
                            },
                            error: function() {
                                resolve(); // Continue even if there's an error
                            }
                        });
                    }));
                });
                
                // After checking all currencies
                Promise.all(promises).then(() => {
                    frm.refresh_field('currency_transfers');
                    calculate_total(frm);
                    
                    // Clear status message
                    frm.set_value('status_message', '');
                    frm.refresh_field('status_message');
                    
                    // Show appropriate message based on results
                    if (valid_currency_count > 0) {
                        frappe.show_alert({
                            message: __('Loaded {0} currencies with matching accounts in both treasuries', [valid_currency_count]),
                            indicator: 'green'
                        });
                    } else {
                        frappe.show_alert({
                            message: __('No matching currency accounts found in both treasuries'),
                            indicator: 'orange'
                        });
                    }
                });
            } else {
                frm.set_value('status_message', '');
                frappe.show_alert({
                    message: __('No currencies with positive balance found in treasury {0}', [frm.doc.treasury_from]),
                    indicator: 'orange'
                });
            }
        },
        error: function(r) {
            frm.set_value('status_message', '');
            frappe.show_alert({
                message: __('Error loading currencies: {0}', [r.message ? r.message.error : 'Unknown error']),
                indicator: 'red'
            });
        }
    });
}

function update_destination_accounts(frm) {
    if (!frm.doc.treasury_to) return;
    
    frm.set_value('status_message', __('Updating destination accounts...'));
    frm.refresh_field('status_message');

    let promises = frm.doc.currency_transfers.map(row => {
        return new Promise((resolve, reject) => {
            if (!row.currency_display) {
                resolve();
                return;
            }
            
            frappe.call({
                method: 'teller.teller_customization.doctype.treasury_transfer_request.treasury_transfer_request.get_destination_account',
                args: {
                    treasury: frm.doc.treasury_to,
                    currency: row.currency_display
                },
                callback: function(r) {
                    if (r.message) {
                        if (r.message.missing) {
                            // Account not found in destination treasury
                            frappe.model.set_value(row.doctype, row.name, 'to_account', '');
                            frappe.model.set_value(row.doctype, row.name, 'to_account_balance', 0);
                            
                            // Show a warning for missing account
                            frappe.show_alert({
                                message: __('No matching account found in treasury {0} for currency {1}. Please create the account first.', 
                                    [frm.doc.treasury_to, row.currency_display]),
                                indicator: 'orange'
                            });
                        } else if (r.message.error) {
                            // Error occurred while fetching account
                            frappe.model.set_value(row.doctype, row.name, 'to_account', '');
                            frappe.model.set_value(row.doctype, row.name, 'to_account_balance', 0);
                            
                            // Show an error message
                            frappe.show_alert({
                                message: __('Error finding destination account: {0}', [r.message.account_name]),
                                indicator: 'red'
                            });
                        } else {
                            // Account found successfully
                            frappe.model.set_value(row.doctype, row.name, 'to_account', r.message.name);
                            if (r.message.balance !== undefined) {
                                frappe.model.set_value(row.doctype, row.name, 'to_account_balance', r.message.balance);
                            }
                        }
                        resolve();
                    } else {
                        // Clear the account if no message received
                        frappe.model.set_value(row.doctype, row.name, 'to_account', '');
                        resolve();
                    }
                },
                error: function(r) {
                    // Clear the account on error
                    frappe.model.set_value(row.doctype, row.name, 'to_account', '');
                    frappe.show_alert({
                        message: __('Error finding destination account for {0}: {1}', 
                            [row.currency_display, r.message ? r.message.error : 'Unknown error']),
                        indicator: 'red'
                    });
                    resolve(); // Still resolve to continue with other rows
                }
            });
        });
    });

    Promise.all(promises).then(() => {
        frm.refresh_field('currency_transfers');
        frm.set_value('status_message', '');
        frm.refresh_field('status_message');
    });
}

function calculate_total(frm) {
    let total = 0;
    if (frm.doc.currency_transfers) {
        total = frm.doc.currency_transfers.reduce((sum, row) => sum + (row.amount || 0), 0);
    }
    frm.set_value('total_amount', total);
}

function get_treasury_employee(frm, direction) {
    const treasury_field = direction === 'from' ? 'treasury_from' : 'treasury_to';
    const employee_field = direction === 'from' ? 'treasury_from_employee' : 'treasury_to_employee';
    const treasury_value = frm.doc[treasury_field];
    
    if (!treasury_value) {
        frm.set_value(employee_field, '');
        return;
    }
    
    // First check if this is a manager treasury
    frappe.db.get_value('Teller Treasury', treasury_value, ['branch', 'teller_type'])
        .then(r => {
            if (r.message) {
                // Check if destination is a manager treasury
                if (direction === 'to' && r.message.teller_type === 'Manager') {
                    frappe.show_alert({
                        message: __('Destination is a manager treasury. If this is your reporting manager, the request will be auto-approved on submission.'),
                        indicator: 'blue'
                    });
                }
                
                // Find employee based on branch and treasury
                if (r.message.branch) {
                    // First try to find employees directly assigned to this treasury
                    return frappe.call({
                        method: 'frappe.client.get_value',
                        args: {
                            doctype: 'User Permission',
                            filters: {
                                'allow': 'Teller Treasury',
                                'for_value': treasury_value
                            },
                            fieldname: 'user'
                        },
                        callback: function(r) {
                            if (r.message && r.message.user) {
                                frappe.db.get_value('Employee', {'user_id': r.message.user}, ['employee_name'])
                                    .then(r => {
                                        if (r.message && r.message.employee_name) {
                                            frm.set_value(employee_field, r.message.employee_name);
                                            frm.refresh_field(employee_field);
                                        } else {
                                            // If no employee found by user permission, try by branch
                                            findEmployeeByBranch();
                                        }
                                    });
                            } else {
                                // If no user permission found, try by branch
                                findEmployeeByBranch();
                            }
                        }
                    });
                }
            }
        });
        
    // Helper function to find employee by branch
    function findEmployeeByBranch() {
        frappe.db.get_value('Teller Treasury', treasury_value, 'branch')
            .then(r => {
                if (r.message && r.message.branch) {
                    return frappe.db.get_list('Employee', {
                        filters: {
                            'branch': r.message.branch,
                            'status': 'Active'
                        },
                        fields: ['employee_name'],
                        limit: 1
                    });
                }
            })
            .then(employees => {
                if (employees && employees.length) {
                    frm.set_value(employee_field, employees[0].employee_name);
                    frm.refresh_field(employee_field);
                } else {
                    frm.set_value(employee_field, '');
                    frappe.show_alert({
                        message: __('No employee found for treasury {0}', [treasury_value]),
                        indicator: 'orange'
                    });
                }
            });
    }
}

function show_transfer_summary(frm) {
    if (!frm.doc.treasury_from || !frm.doc.treasury_to) {
        frappe.msgprint(__('Please select both source and destination treasuries first'));
        return;
    }
    
    if (!frm.doc.currency_transfers || !frm.doc.currency_transfers.length) {
        frappe.msgprint(__('No currency transfers found. Please add at least one currency transfer.'));
        return;
    }
    
    // Count valid transfers
    let valid_transfers = 0;
    let total_amount = 0;
    let currencies = [];
    
    frm.doc.currency_transfers.forEach(function(row) {
        if (row.amount && flt(row.amount) > 0) {
            valid_transfers++;
            total_amount += flt(row.amount);
            currencies.push({
                currency: row.currency_display || row.currency_code,
                amount: format_currency(row.amount, row.currency_code),
                from_account: row.from_account,
                to_account: row.to_account || __('Not set')
            });
        }
    });
    
    if (valid_transfers === 0) {
        frappe.msgprint(__('No valid transfers found. Please add at least one currency transfer with amount greater than zero.'));
        return;
    }
    
    // Build summary HTML
    let html = `
    <div style="padding: 10px; max-width: 600px;">
        <h4 style="margin-top: 0;">${__('Treasury Transfer Summary')}</h4>
        <div style="margin-bottom: 15px;">
            <div><strong>${__('From Treasury')}:</strong> ${frm.doc.treasury_from}</div>
            <div><strong>${__('To Treasury')}:</strong> ${frm.doc.treasury_to}</div>
            <div><strong>${__('Total Amount')}:</strong> ${format_currency(total_amount)}</div>
            <div><strong>${__('Number of Currencies')}:</strong> ${valid_transfers}</div>
        </div>
        
        <h5>${__('Currency Details')}</h5>
        <table class="table table-bordered" style="margin-bottom: 15px;">
            <thead>
                <tr>
                    <th>${__('Currency')}</th>
                    <th>${__('Amount')}</th>
                    <th>${__('From Account')}</th>
                    <th>${__('To Account')}</th>
                </tr>
            </thead>
            <tbody>
                ${currencies.map(c => `
                <tr>
                    <td>${c.currency}</td>
                    <td>${c.amount}</td>
                    <td>${c.from_account}</td>
                    <td>${c.to_account}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="text-muted">
            ${__('Please verify all details before submitting the transfer request.')}
        </div>
    </div>
    `;
    
    frappe.msgprint({
        title: __('Transfer Request Summary'),
        indicator: 'blue',
        message: html
    });
}

function validate_form(frm) {
    // Check if source and destination treasuries are different
    if (frm.doc.treasury_from === frm.doc.treasury_to) {
        frappe.throw(__('Source and destination treasuries must be different'));
        return false;
    }
    
    // Check if we have at least one currency transfer with amount > 0
    let has_valid_transfer = false;
    (frm.doc.currency_transfers || []).forEach(function(row) {
        if (row.amount && flt(row.amount) > 0) {
            has_valid_transfer = true;
        }
    });
    
    if (!has_valid_transfer) {
        frappe.throw(__('At least one currency transfer with amount greater than zero is required'));
        return false;
    }
    
    // Check if all required accounts are present
    let missing_accounts = [];
    (frm.doc.currency_transfers || []).forEach(function(row) {
        if (row.amount && flt(row.amount) > 0) {
            if (!row.from_account) {
                missing_accounts.push(__('Source account for {0}', [row.currency_display || row.currency_code]));
            }
            if (!row.to_account) {
                missing_accounts.push(__('Destination account for {0}', [row.currency_display || row.currency_code]));
            }
        }
    });
    
    if (missing_accounts.length > 0) {
        frappe.throw(__('Missing accounts: {0}', [missing_accounts.join(', ')]));
        return false;
    }
    
    return true;
}