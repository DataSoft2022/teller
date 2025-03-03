// Copyright (c) 2024, Mohamed AbdElsabour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Branch Deal interbank", {
	refresh(frm) {
		// Set default bank value instead of customer
		// The field is 'bank' in this doctype, not 'customer'
		if (!frm.doc.bank) {
			frm.set_value('bank', 'البنك الاهلي');
		}
		
		// Get current user
		let currentUser = frappe.session.logged_in_user;
		if (!frm.doc.user) {
			frm.set_value('user', currentUser);
		}
		
		// Add buttons for submitted documents
		if (frm.doc.docstatus === 1) {
			// Button to update interbank percentages
			frm.add_custom_button(__('Update Interbank Percentages'), function() {
				frappe.confirm(
					__('This will update the booking percentages for all related interbank records. Continue?'),
					function() {
						// Yes - update percentages
						frm.call({
							doc: frm.doc,
							method: 'update_interbank_records',
							callback: function(r) {
								frappe.msgprint(__('Interbank percentages have been updated.'));
							}
						});
					},
					function() {
						// No - do nothing
					}
				);
			});
			
			// Button to create booking interbank
			frm.add_custom_button(__('Create Booking Interbank'), function() {
				frappe.confirm(
					__('This will create a new Booking Interbank record. Continue?'),
					function() {
						// Yes - create booking
						frm.call({
							doc: frm.doc,
							method: 'create_booking_interbank',
							callback: function(r) {
								if (r.message) {
									frappe.msgprint(__('Booking Interbank has been created.'));
								}
							}
						});
					},
					function() {
						// No - do nothing
					}
				);
			});
		}
	},
});
