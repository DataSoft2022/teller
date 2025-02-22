frappe.ui.form.on('Central Bank Export', {
    refresh: function(frm) {
        if (frm.doc.docstatus === 0) {
            frm.add_custom_button(__('Get Transactions'), function() {
                get_transactions(frm);
            });
        }
        
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Download Export File'), function() {
                download_export_file(frm);
            });
        }
    },
    
    validate: function(frm) {
        if(frm.doc.docstatus === 1) {
            frm.doc.status = 'Exported';
        }
    }
});

function get_transactions(frm) {
    let d = new frappe.ui.Dialog({
        title: __('Get Transactions'),
        fields: [
            {
                label: __('From Date'),
                fieldname: 'from_date',
                fieldtype: 'Date',
                reqd: 1,
                default: frappe.datetime.add_days(frappe.datetime.get_today(), -7)
            },
            {
                label: __('To Date'),
                fieldname: 'to_date',
                fieldtype: 'Date',
                reqd: 1,
                default: frappe.datetime.get_today()
            }
        ],
        primary_action_label: __('Get Transactions'),
        primary_action(values) {
            frappe.show_progress('Fetching Transactions', 0, 100, 'Please wait');
            frappe.call({
                method: 'teller.teller_customization.doctype.central_bank_export.central_bank_export.get_unexported_transactions',
                args: {
                    from_date: values.from_date,
                    to_date: values.to_date
                },
                freeze: true,
                freeze_message: __('Fetching Transactions...'),
                callback: function(r) {
                    frappe.hide_progress();
                    if(r.message && r.message.length) {
                        r.message.forEach(function(row) {
                            let child = frm.add_child('transactions');
                            child.transaction_type = row.transaction_type;
                            child.reference_doctype = row.reference_doctype;
                            child.reference_name = row.reference_name;
                            child.posting_date = row.posting_date;
                            child.client_type = row.client_type;
                            child.central_bank_number = row.central_bank_number;
                            child.quantity = row.quantity;
                            child.amount = row.amount;
                            child.currency_code = row.currency_code;
                        });
                        frm.refresh_field('transactions');
                        frappe.show_alert({
                            message: __('Added {0} transactions', [r.message.length]),
                            indicator: 'green'
                        }, 5);
                    } else {
                        frappe.msgprint(__('No new transactions found'));
                    }
                    d.hide();
                },
                error: function(r) {
                    frappe.hide_progress();
                    d.hide();
                    frappe.msgprint(__('Error fetching transactions'));
                }
            });
        }
    });
    d.show();
}

function download_export_file(frm) {
    var file_url = frm.doc.attached_file;
    if (!file_url) {
        frappe.msgprint(__('No export file found. Please generate the export file first.'));
        return;
    }
    window.open(file_url);
} 