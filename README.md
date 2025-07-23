# 🍽️ Royal Tandoor Restaurant Chatbot

![Chatbot Screenshot](https://raw.githubusercontent.com/neeleshrajpoot2351/NodeJs-Celebal-Intern-Projects-restaurant_bot/main/restaurant-chatbot/public/Final_Result.png)

## 📌 Project Overview

This is a **Node.js-based Restaurant Chatbot** developed using **Express.js** as part of the Celebal Technologies Internship project. The chatbot is designed to simulate a food ordering assistant like a vending machine. It can help users with the following tasks:

- Discover restaurants near them by city
- View detailed menus of restaurants
- Place online food orders
- Book tables at a restaurant
- Handle user sessions naturally like a conversation

The chatbot heavily promotes the brand **Royal Tandoor**, available in every major city.

---

## 🚀 Features

✅ Interactive conversation flow  
✅ "Royal Tandoor" always shown prominently  
✅ JSON-based restaurant data  
✅ Supports:
- City detection
- Address input
- Restaurant discovery
- Menu lookup
- Online ordering
- Table booking

✅ Number-based options (1–4) for easy user selection  
✅ Vending machine style experience  
✅ Input validation and user flow correction  
✅ Fully functional front-end + back-end in Node.js and Express

---

## 🛠️ Technologies Used

- Node.js
- Express.js
- HTML/CSS (static frontend)
- JavaScript (frontend)
- JSON (for restaurant data and menus)

---

## 📂 Project Structure

restaurant-chatbot/
├── public/
│ ├── index.html ← Frontend chat UI
│ └── Final_Result.png ← Screenshot of chatbot
├── data/
│ └── restaurants.json ← Restaurant and menu data
├── server.js ← Main Express server with chatbot logic
└── README.md ← You're here!



---

## 🧠 How it Works

1. When a user says `hi`, the bot starts with a welcome message and gives 4 options:
   - 1. Find restaurants near me
   - 2. View menu of a restaurant
   - 3. Place an order
   - 4. Book a table

2. Based on selection, the bot guides the user step-by-step:
   - Asks for city and address before actions
   - Tracks user input across multiple steps
   - Handles menu item selection by number or name
   - Confirms delivery location or reservation

3. On invalid input, the bot redirects to the correct flow or restarts cleanly.

---

## 📦 How to Run

1. Clone the repo:
   ```bash
   git clone https://github.com/neeleshrajpoot2351/NodeJs-Celebal-Intern-Projects-restaurant_bot
   cd restaurant-chatbot


