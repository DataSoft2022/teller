// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on('Treasury Transfer Request', {
    setup: function(frm) {
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
                                            // Then set the treasury after branch is set
                                            frm.set_value('treasury_from', treasury);
                                        });
                                }
                            });
                    }
                }
            });
        }
    },

    refresh: function(frm) {
        // Add custom buttons for master approval/rejection
        if (frm.doc.docstatus === 1 && frm.doc.status === 'Pending Master Approval' && 
            frappe.user.has_role('System Manager')) {  // Replace with actual master role
            
            frm.add_custom_button(__('Approve'), function() {
                frappe.confirm(
                    'Are you sure you want to approve this transfer request?',
                    function() {
                        frappe.call({
                            method: 'teller.teller_customization.doctype.treasury_transfer_request.treasury_transfer_request.approve_request',
                            args: {
                                request_name: frm.doc.name,
                                user: frappe.session.user
                            },
                            callback: function(r) {
                                if (r.message) {
                                    frappe.show_alert({
                                        message: __('Request approved and transfer created'),
                                        indicator: 'green'
                                    });
                                    frm.reload_doc();
                                }
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
                        reqd: 1
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
                        callback: function() {
                            frappe.show_alert({
                                message: __('Request rejected'),
                                indicator: 'red'
                            });
                            frm.reload_doc();
                        }
                    });
                },
                __('Reject Request'),
                __('Reject')
                );
            }, __('Actions'));
        }
        
        // Show status indicator
        if (frm.doc.status) {
            let indicator = 'gray';
            if (frm.doc.status === 'Approved') indicator = 'green';
            else if (frm.doc.status === 'Rejected') indicator = 'red';
            else if (frm.doc.status === 'Pending Master Approval') indicator = 'orange';
            
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
    },
    
    branch_to: function(frm) {
        // Clear treasury when branch changes
        if (frm.doc.branch_to) {
            frm.set_value('treasury_to', '');
        }
    },

    treasury_from: function(frm) {
        // Clear child table when treasury changes
        frm.clear_table('currency_transfers');
        frm.refresh_field('currency_transfers');
        
        // Get employee for source treasury
        if (frm.doc.treasury_from) {
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'User Permission',
                    filters: {
                        'allow': 'Teller Treasury',
                        'for_value': frm.doc.treasury_from
                    },
                    fieldname: 'user'
                },
                callback: function(r) {
                    if (r.message && r.message.user) {
                        frappe.db.get_value('Employee', {'user_id': r.message.user}, ['employee_name'])
                            .then(r => {
                                if (r.message && r.message.employee_name) {
                                    console.log("Setting treasury_from_employee to:", r.message.employee_name);
                                    frm.set_value('treasury_from_employee', r.message.employee_name);
                                    frm.refresh_field('treasury_from_employee');
                                }
                            });
                    } else {
                        console.log("No employee found for treasury:", frm.doc.treasury_from);
                        frm.set_value('treasury_from_employee', '');
                        frappe.show_alert({
                            message: __('No employee found assigned to treasury {0}', [frm.doc.treasury_from]),
                            indicator: 'orange'
                        });
                    }
                }
            });
        }
    },

    treasury_to: function(frm) {
        // Update destination accounts if we have currencies
        if (frm.doc.currency_transfers && frm.doc.currency_transfers.length) {
            update_destination_accounts(frm);
        }
        
        // Get employee for destination treasury - now using a direct DB query
        if (frm.doc.treasury_to) {
            frappe.db.get_value('Teller Treasury', frm.doc.treasury_to, 'branch')
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
                        console.log("Setting treasury_to_employee to:", employees[0].employee_name);
                        frm.set_value('treasury_to_employee', employees[0].employee_name);
                        frm.refresh_field('treasury_to_employee');
                    } else {
                        console.log("No employee found for treasury:", frm.doc.treasury_to);
                        frm.set_value('treasury_to_employee', '');
                    }
                });
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
                                    }
                                }
                            });
                        }
                    }
                }
            });
        }
    },

    amount: function(frm) {
        calculate_total(frm);
    }
});

function get_all_currencies(frm) {
    if (!frm.doc.treasury_from || !frm.doc.treasury_to) {
        frappe.msgprint(__('Please select both treasuries first'));
        return;
    }

    frappe.call({
        method: 'teller.teller_customization.doctype.treasury_transfer.treasury_transfer.get_available_currencies',
        args: {
            from_treasury: frm.doc.treasury_from
        },
        callback: function(r) {
            if (r.message) {
                frm.clear_table('currency_transfers');
                
                r.message.forEach(function(currency) {
                    let row = frm.add_child('currency_transfers');
                    row.currency_code = currency.currency_code;
                    row.currency_display = currency.currency_name;
                    row.from_account = currency.account;
                    row.from_account_balance = currency.balance;
                });
                
                frm.refresh_field('currency_transfers');
                update_destination_accounts(frm);
            }
        }
    });
}

function update_destination_accounts(frm) {
    if (!frm.doc.treasury_to) return;

    let promises = frm.doc.currency_transfers.map(row => {
        return new Promise(resolve => {
            frappe.call({
                method: 'teller.teller_customization.doctype.treasury_transfer_request.treasury_transfer_request.get_destination_account',
                args: {
                    treasury: frm.doc.treasury_to,
                    currency: row.currency_display
                },
                callback: function(r) {
                    if (r.message) {
                        frappe.model.set_value(row.doctype, row.name, 'to_account', r.message.name);
                    }
                    resolve();
                }
            });
        });
    });

    Promise.all(promises).then(() => {
        frm.refresh_field('currency_transfers');
    });
}

function calculate_total(frm) {
    let total = 0;
    if (frm.doc.currency_transfers) {
        total = frm.doc.currency_transfers.reduce((sum, row) => sum + (row.amount || 0), 0);
    }
    frm.set_value('total_amount', total);
} 