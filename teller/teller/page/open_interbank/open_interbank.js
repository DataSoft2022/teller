frappe.pages["open-interbank"].on_page_load = function (wrapper) {
  var page = frappe.ui.make_app_page({
    parent: wrapper,
    title: "Open InterBank",
    single_column: true,
    set_title_sub: "InterBank",
  });

  // Create a dedicated container for the cards and add it to the page
  const cardContainerWrapper = document.createElement("div");
  cardContainerWrapper.id = "card-container-wrapper";
  wrapper.appendChild(cardContainerWrapper);

  let field = page.add_field({
    label: "Status",
    fieldtype: "Select",
    fieldname: "status",
    options: ["Open", "Closed"],
    change() {
      console.log(field.get_value());
      if (field.get_value() === "Closed") {
        frappe.call({
          method: "frappe.client.get_list",
          args: {
            doctype: "InterBank",
            fields: ["name", "transaction", "custom_is_save_disabled"],
            filters: { custom_is_save_disabled: 1 },
          },
          callback: function (response) {
            let data = response.message;
            renderCards(data); // Call function to render the cards
          },
        });
      } else if(field.get_value() === "Open"){
        // Clear cards if the status is not "Closed"
        frappe.call({
          method: "frappe.client.get_list",
          args: {
            doctype: "InterBank",
            fields: ["name", "transaction", "custom_is_save_disabled"],
            filters: { custom_is_save_disabled: 0 },
          },
          callback: function (response) {
            let data = response.message;
            renderCards(data); // Call function to render the cards
          },
        });
      }
    },
  });

  // Function to render HTML cards
  function renderCards(data) {
    // Clear any existing content in the card container before rendering new ones
    cardContainerWrapper.innerHTML = "";

    // Check if there is data to display
    if (data.length === 0) {
      cardContainerWrapper.innerHTML = "<p>No records found.</p>";
      return;
    }

    // Create a container for the cards
    const cardContainer = document.createElement("div");
    cardContainer.classList.add("card-container");

    // Loop through the data and create a card for each record
    data.forEach((item) => {
      const card = document.createElement("div");
      card.classList.add("card");

      card.innerHTML = `
        <div class="card-content">
          <h3>Name: ${item.name}</h3>
          <p>Transaction: ${item.transaction}</p>
          <p> Status: ${item.custom_is_save_disabled ? "Closed" : "Open"}</p>
        </div>
      `;

      cardContainer.appendChild(card);
    });

    // Append the card container to the card container wrapper
    cardContainerWrapper.appendChild(cardContainer);
  }

  // Add styles for the grid layout and card styling
  const style = document.createElement("style");
  style.innerHTML = `
    #card-container-wrapper .card-container {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      padding: 16px;
    }
    #card-container-wrapper .card {
      border: 1px solid #ddd;
      padding: 16px;
      border-radius: 8px;
      background-color: #f9f9f9;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    #card-container-wrapper .card h3 {
      margin: 0 0 8px;
    }
    #card-container-wrapper .card p {
      margin: 4px 0;
    }
  `;
  document.head.appendChild(style);
};

