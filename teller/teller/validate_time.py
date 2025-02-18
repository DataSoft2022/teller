import frappe
from frappe.utils.data import now, get_datetime
from frappe.utils import nowtime
from datetime import datetime
@frappe.whitelist()
def cron_validate_interbank_time():
    cur_time = get_datetime(now()).strftime('%H:%M:%S')
    cur_day = get_datetime(now()).date()
    stopWatch = f"23:59:59"
    print(f"time {cur_time} ad cur day is {cur_day}")

    open_interbanks = frappe.get_all('InterBank', filters={'status': ['!=', 'Close'], 'type':'Daily','date':cur_day}, fields=['name','date','status','type'])
    for interbank in open_interbanks:
        # return cur_time >= stopWatch  and interbank.date == cur_day
        if cur_time == stopWatch and interbank.date == cur_day:
            # frappe.msgprint(f" function is good")
          ib = frappe.get_doc("InterBank",interbank.name,update_modified=True)
          ib.db_set('status', 'Ended')  
          return "Ended"
@frappe.whitelist()
def cron_validate_queue_time():
  cur_time = get_datetime(now()).strftime('%H:%M:%S')
  cur_day = get_datetime(now()).date()
  stopWatch = f"23:59:59"
  open_queues = frappe.get_all('Queue Request', filters={'status': ['!=', 'Close'], 'type':'Daily','date':cur_day}, fields=['name','date','status','type'])
  for queue in open_queues:
      # return cur_time >= stopWatch  and interbank.date == cur_day
      if cur_time == stopWatch and queue.date == cur_day:
          # frappe.msgprint(f" function is good")
        q = frappe.get_doc('Queue Request',queue.name,update_modified=True)
        q.db_set('status', 'Ended')  
        return "Ended"