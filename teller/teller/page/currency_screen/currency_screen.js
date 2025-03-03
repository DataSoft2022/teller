frappe.pages['currency-screen'].on_page_load = function (wrapper) {
  var page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "Currency Rates",
      single_column: true,
  });
  
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.justifyContent = "flex-start";
  container.style.alignItems = "center";
  container.style.width = "100%";
  container.style.height = "100vh";
  container.style.padding = "20px 0";

  const timeDiv = document.createElement("div");
  timeDiv.style.fontSize = "20px";
  timeDiv.style.fontWeight = "bold";
  timeDiv.style.marginBottom = "20px";
  timeDiv.style.backgroundColor = "white";
  timeDiv.style.padding = "10px";
  timeDiv.style.width = "100%";
  timeDiv.style.textAlign = "center";
  timeDiv.id = "current-time";

  const table = document.createElement("table");
  table.classList.add("currency-table");
  table.style.borderCollapse = "collapse";
  table.style.width = "50%";
  table.style.minWidth = "600px";
  table.style.backgroundColor = "white";
  table.style.boxShadow = "0px 0px 10px rgba(0, 0, 0, 0.1)";
  table.style.textAlign = "center";
  table.style.marginBottom = "20px";

  table.innerHTML = `
      <thead>
          <tr>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #007bff; color: white;">Last Update</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #007bff; color: white;">Purchase Rate</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #007bff; color: white;">Selling Rate</th>
              <th style="border: 1px solid #ddd; padding: 12px; background-color: #007bff; color: white;">Currency</th>
          </tr>
      </thead>
      <tbody id="currency-table-body">
      </tbody>
  `;

  // Add page indicator
  const pageIndicator = document.createElement("div");
  pageIndicator.style.marginTop = "10px";
  pageIndicator.style.fontSize = "16px";
  pageIndicator.id = "page-indicator";
  pageIndicator.style.textAlign = "center";

  container.appendChild(timeDiv);
  container.appendChild(table);
  container.appendChild(pageIndicator);
  wrapper.appendChild(container);

  let currentPage = 0;
  const itemsPerPage = 16; // Changed from 15 to 9 items per page
  let allData = []; // Store all data

  function populateTable(data) {
      allData = data;
      showCurrentPage();
      
      // Update time display
      let isoString = data[0].latest_date;
      const now = new Date();
      const str = "اسعار العملات الرسمية";
      const day = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const time = new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12:false });
      document.getElementById("current-time").textContent = ` ${str} ${day} - ${time}`;
  }

  function showCurrentPage() {
      const tableBody = document.getElementById("currency-table-body");
      tableBody.innerHTML = "";
      
      const startIndex = currentPage * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, allData.length);
      const pageData = allData.slice(startIndex, endIndex);

      pageData.forEach((item) => {
          let row = document.createElement("tr");
          row.innerHTML = `
              <td style="border: 1px solid #ddd; padding: 12px;">${new Date(item.latest_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit',hour12:false })}</td>
              <td style="border: 1px solid #ddd; padding: 12px;">${item.exchange_rate}</td>
              <td style="border: 1px solid #ddd; padding: 12px;">${item.custom_selling_exchange_rate}</td>
              <td style="border: 1px solid #ddd; padding: 12px;">${item.from_currency}</td>
          `;
          tableBody.appendChild(row);
      });

      // Update page indicator
      const totalPages = Math.ceil(allData.length / itemsPerPage);
      pageIndicator.textContent = `Page ${currentPage + 1} of ${totalPages}`;
  }

  function rotatePages() {
      const totalPages = Math.ceil(allData.length / itemsPerPage);
      currentPage = (currentPage + 1) % totalPages;
      showCurrentPage();
  }

  function fetchData() {
      frappe.call({
          method: "teller.teller.page.currency_screen.currency_screen.get_data",
          callback: function(r) {
              if (r.message) {
                  populateTable(r.message);
              }
          }
      });
  }

  // Fetch initial data
  fetchData();

  // Rotate pages every 5 seconds
  setInterval(rotatePages, 5000);

  // Listen for real-time updates
  frappe.realtime.on("currency_update", function(data) {
      console.log("Real-time update received:", data);
      populateTable(data);
  });
};


// function updateTime() {
//   const now = new Date();
//   const str = "اسعار العملات الرسمية"
//   const day = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
// const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' ,hour12: false });
//   document.getElementById("current-time").textContent = ` ${str} ${day} - ${time}`;
// }
function updateTime2(data) {
  let last_time = data[0].latest_date
  document.getElementById("current-time").textContent = last_time;
}
// Update time every second
setInterval(updateTime, 1000);
updateTime();  // Initial time display