const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

let restaurantData = [];
try {
  restaurantData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "restaurants.json"), "utf-8")
  );
} catch (err) {
  console.error("Error loading restaurant data:", err);
  process.exit(1);
}

const cities = [...new Set(restaurantData.map((r) => r.city.toLowerCase()))];
const cuisines = [...new Set(restaurantData.map((r) => r.cuisine.toLowerCase()))];

let sessionState = {
  intent: null,
  subIntent: null,
  userCity: null,
  userAddress: null,
  userPhone: null,
  selectedRestaurant: null,
  currentMenu: [],
  orderCart: [],
  reservationDetails: {},
  filteredRestaurants: [],
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.post("/message", (req, res) => {
  const raw = req.body.message || "";
  const msg = raw.toLowerCase().trim();
  let reply = "";

  const sendReply = (replyText) => {
    return res.json({ reply: replyText });
  };

  const resetSession = () => {
    sessionState = {
      intent: null,
      subIntent: null,
      userCity: null,
      userAddress: null,
      userPhone: null,
      selectedRestaurant: null,
      currentMenu: [],
      orderCart: [],
      reservationDetails: {},
      filteredRestaurants: [],
    };
  };

  const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  function getOrderSummaryAndConfirmPrompt(includeInitialPrompt = true) {
    let totalCost = 0;
    let orderSummaryText = "";
    if (sessionState.orderCart.length === 0) {
      return "Your cart is empty. Please add items before checking out.";
    }

    sessionState.orderCart.forEach((item, i) => {
        orderSummaryText += `${i + 1}. ${item.item.name} x${item.quantity} = Rs.${item.item.price * item.quantity}\n`;
        totalCost += item.item.price * item.quantity;
    });

    let details = `\n--- Order Summary ---\n`;
    details += `Restaurant: ${sessionState.selectedRestaurant || "Not Selected"}\n`;
    details += `Type: ${capitalize(sessionState.reservationDetails.orderType || "N/A")}\n`;
    if (sessionState.reservationDetails.orderType === "delivery") {
        details += `Delivery To: ${sessionState.userAddress || "Not Provided"}, ${sessionState.userCity || "Not Provided"}\n`;
    }
    details += `Items:\n${orderSummaryText}`;
    details += `Total: Rs.${totalCost}\n`;
    if (sessionState.userPhone) {
        details += `Contact: ${sessionState.userPhone}\n`;
    }
    details += `\n----------------------\n`;
    
    sessionState.subIntent = "await_payment_confirmation";
    
    let prompt = includeInitialPrompt ? "Almost there! Please review your order:\n" : "";
    return prompt + details + "Type 'confirm' to place your order and simulate payment, or 'cancel'.";
  }

  if (msg === "hi" || msg === "hello" || msg === "hey" || msg === "start over" || msg === "main menu") {
    resetSession();
    sessionState.intent = "await_option_selection";
    reply = `Hello! Welcome to Royal Tandoor Assistant!\n\nWhat would you like to do?\n1. Find restaurants\n2. View menu of a specific restaurant\n3. Place an order\n4. Book a table\n\nType a number (1-4) to continue, or type 'cancel' at any time.`;
    return sendReply(reply);
  }

  if (msg === "cancel") {
    resetSession();
    reply = "Okay, I've reset our conversation. Type 'hi' to start over.";
    return sendReply(reply);
  }

  const orderCommandMatch = msg.match(/^order (\d+)$/);
  const menuOfCommandMatch = msg.match(/^menu of (.+)$/);
  const findRestaurantCommandMatch = msg.match(/^(find restaurants|search restaurants|restaurants near me)$/);
  const bookTableCommandMatch = msg.match(/^(book a table|reserve a table|make a reservation)$/);
  const placeOrderInitialCommandMatch = msg.match(/^(place an order|i want to order|order food|can i book food online)$/);
  const listAllRestaurantsCommandMatch = msg.match(/^(provide me all restaurant name|list all restaurants|show all restaurants|all restaurants)$/);


  if (listAllRestaurantsCommandMatch) {
    if (restaurantData.length > 0) {
        let allRestaurantsList = "Here are all the restaurants we have:\n";
        allRestaurantsList += restaurantData.map((r, i) => 
            `${i + 1}. ${r.name} (${r.city}, ${r.cuisine}, Rating ${r.rating})`
        ).join("\n");
        allRestaurantsList += `\n\nTo view a menu, type 'menu of <Restaurant Name>'. To find restaurants by criteria, type 'find restaurants'. Type 'hi' for main menu.`;
        return sendReply(allRestaurantsList);
    } else {
        return sendReply("Sorry, I don't have any restaurant data loaded right now. Please try again later.");
    }
  }


  if (menuOfCommandMatch) {
    const restaurantName = menuOfCommandMatch[1].trim().toLowerCase();
    const match = restaurantData.find(r => r.name.toLowerCase() === restaurantName);
    if (match) {
      sessionState.currentMenu = match.menu;
      sessionState.selectedRestaurant = match.name;
      sessionState.intent = "view_menu";
      sessionState.subIntent = "display_menu_and_await_action";
      reply = `Menu for ${match.name}:\n` +
        sessionState.currentMenu.map((item, i) => `${i + 1}. ${item.name} -- Rs.${item.price}` + (item.description ? ` (${item.description})` : '')).join("\n") +
        `\n\nTo order an item, type 'order <item number>' (e.g., 'order 1').\nType 'hi' to return to the main menu.`;
    } else {
      reply = `Restaurant "${capitalize(restaurantName)}" not found.`;
      reply += `\nIf you don't know the exact name, you can type 'list all restaurants' or 'find restaurants' to search. Or 'hi' to see main options.`;
    }
    return sendReply(reply);
  }
  
  if (orderCommandMatch) {
    const itemIndex = parseInt(orderCommandMatch[1], 10) - 1;
    if (sessionState.selectedRestaurant && sessionState.currentMenu.length > 0 && sessionState.currentMenu[itemIndex]) {
      const itemToOrder = sessionState.currentMenu[itemIndex];
      const existingItemInCart = sessionState.orderCart.find(cartItem => cartItem.item.name === itemToOrder.name);
      
      if (existingItemInCart) {
        existingItemInCart.quantity++;
      } else {
        sessionState.orderCart.push({ item: itemToOrder, quantity: 1 });
      }
      
      reply = `Added "${itemToOrder.name}" to your cart. Your cart now has ${sessionState.orderCart.length} unique items.`;
      reply += `\nType 'order <item number>' to add more, 'view cart' to see your order, or 'checkout' to finalize.`;
      sessionState.intent = "place_order";
      sessionState.subIntent = "await_order_action";
    } else {
        reply = "To order an item, please first select a restaurant to order from (option 3 from main menu), or view a restaurant's menu (e.g., 'menu of Royal Tandoor') and then type 'order <item number>'. Or type 'hi' for main menu.";
    }
    return sendReply(reply);
  }


  if (findRestaurantCommandMatch) {
      sessionState.intent = "find_restaurant";
      sessionState.subIntent = "await_search_criteria";
      reply = "How would you like to find a restaurant?\n1. By City\n2. By Cuisine\n3. By Rating (e.g., 'restaurants with rating 4.5')\n\nType a number (1-3) or 'cancel'.";
      return sendReply(reply);
  }

  if (bookTableCommandMatch) {
      sessionState.intent = "book_table";
      sessionState.subIntent = "await_reservation_city";
      reply = "Great! For your reservation, please tell me the city.";
      return sendReply(reply);
  }

  if (placeOrderInitialCommandMatch && sessionState.subIntent !== "await_order_type") {
      sessionState.intent = "place_order";
      sessionState.subIntent = "await_order_type";
      reply = "Would you like this order for 'delivery' or 'pickup'?";
      return sendReply(reply);
  }

  if (sessionState.intent === "await_option_selection") {
    if (msg === "1") {
      sessionState.intent = "find_restaurant";
      sessionState.subIntent = "await_search_criteria";
      reply = "How would you like to find a restaurant?\n1. By City\n2. By Cuisine\n3. By Rating (e.g., 'restaurants with rating 4.5')\n\nType a number (1-3) to continue, or 'cancel'.";
    } else if (msg === "2") {
      sessionState.intent = "view_menu";
      sessionState.subIntent = "await_city_for_menu";
      reply = "To view a menu, please tell me the city where the restaurant is located.";
    } else if (msg === "3") {
      sessionState.intent = "place_order";
      sessionState.subIntent = "await_order_type"; 
      reply = "Would you like this order for 'delivery' or 'pickup'?";
    } else if (msg === "4") {
      sessionState.intent = "book_table";
      sessionState.subIntent = "await_reservation_city";
      reply = "Great! For your reservation, please tell me the city.";
    } else {
      reply = "Invalid option. Please type 1, 2, 3, or 4, or 'cancel'.";
    }
    return sendReply(reply);
  }

  if (sessionState.intent === "find_restaurant") {
    if (sessionState.subIntent === "await_search_criteria") {
      if (msg === "1") {
        sessionState.subIntent = "await_city_for_search";
        reply = "Please enter the city name.";
      } else if (msg === "2") {
        sessionState.subIntent = "await_cuisine_for_search";
        reply = `What cuisine are you looking for? (e.g., Indian, Japanese, Italian)\nAvailable cuisines: ${cuisines.map(capitalize).join(', ')}`;
      } else if (msg === "3") {
        sessionState.subIntent = "await_rating_for_search";
        reply = "What minimum rating are you looking for? (e.g., '4.5' or 'at least 4')";
      } else {
        reply = "Invalid choice. Please type 1, 2, or 3, or 'cancel'.";
      }
      return sendReply(reply);
    }
    
    if (sessionState.subIntent === "await_city_for_search") {
      const city = msg.toLowerCase();
      if (cities.includes(city)) {
        sessionState.filteredRestaurants = restaurantData.filter(r => r.city.toLowerCase() === city);
        sessionState.userCity = capitalize(city);
        if (sessionState.filteredRestaurants.length > 0) {
          reply = `Restaurants in ${sessionState.userCity}:\n` +
            sessionState.filteredRestaurants.map((r, i) =>
              `${i + 1}. ${r.name} (${r.cuisine}, ${r.price_range.symbol} ~Rs.${r.price_range.approximate_cost_for_two}, Rating ${r.rating})`
            ).join("\n") +
            `\n\nTo view a menu, type: 'menu of <Restaurant Name>'. To search again, type 'find restaurants'. Type 'hi' to go back to main menu.`;
        } else {
          reply = `No restaurants found in ${sessionState.userCity}. Try another city, 'find restaurants' to search differently, or 'hi' to go back.`;
        }
        sessionState.intent = null;
        sessionState.subIntent = null;
      } else {
        reply = `Sorry, we don't have restaurants listed in "${msg}". Please enter a valid city, or 'cancel' to return to main menu.`;
      }
      return sendReply(reply);
    }

    if (sessionState.subIntent === "await_cuisine_for_search") {
      const cuisine = msg.toLowerCase();
      if (cuisines.includes(cuisine)) {
        sessionState.filteredRestaurants = restaurantData.filter(r => r.cuisine.toLowerCase() === cuisine);
        if (sessionState.filteredRestaurants.length > 0) {
          reply = `${capitalize(cuisine)} restaurants:\n` +
            sessionState.filteredRestaurants.map((r, i) =>
              `${i + 1}. ${r.name} (${r.city}, ${r.price_range.symbol} ~Rs.${r.price_range.approximate_cost_for_two}, Rating ${r.rating})`
            ).join("\n") +
            `\n\nTo view a menu, type: 'menu of <Restaurant Name>'. To search again, type 'find restaurants'. Type 'hi' to go back to main menu.`;
        } else {
          reply = `No ${capitalize(cuisine)} restaurants found. Try another cuisine, 'find restaurants' to search differently, or 'hi' to go back.`;
        }
        sessionState.intent = null;
        sessionState.subIntent = null;
      } else {
        reply = `Sorry, I don't recognize "${msg}" as a cuisine. Please try one of these: ${cuisines.map(capitalize).join(', ')}, or 'cancel'.`;
      }
      return sendReply(reply);
    }

    if (sessionState.subIntent === "await_rating_for_search") {
      const ratingMatch = msg.match(/(\d+\.?\d*)/);
      let minRating = 0;
      if (ratingMatch && parseFloat(ratingMatch[1]) >= 0 && parseFloat(ratingMatch[1]) <= 5) {
        minRating = parseFloat(ratingMatch[1]);
        sessionState.filteredRestaurants = restaurantData.filter(r => r.rating >= minRating);
        if (sessionState.filteredRestaurants.length > 0) {
          reply = `Restaurants with a rating of ${minRating} or higher:\n` +
            sessionState.filteredRestaurants.map((r, i) =>
              `${i + 1}. ${r.name} (${r.city}, ${r.cuisine}, Rating ${r.rating})`
            ).join("\n") +
            `\n\nTo view a menu, type: 'menu of <Restaurant Name>'. To search again, type 'find restaurants'. Type 'hi' to go back to main menu.`;
        } else {
          reply = `No restaurants found with a rating of ${minRating} or higher. Try a lower rating, 'find restaurants' to search differently, or 'hi' to go back.`;
        }
        sessionState.intent = null;
        sessionState.subIntent = null;
      } else {
        reply = "Please provide a valid minimum rating between 0 and 5, e.g., '4.5', or 'cancel'.";
      }
      return sendReply(reply);
    }
  }

  if (sessionState.intent === "view_menu") {
    if (sessionState.subIntent === "await_city_for_menu") {
        const city = msg.toLowerCase();
        if (cities.includes(city)) {
            sessionState.userCity = capitalize(city);
            sessionState.subIntent = "await_restaurant_name_for_menu";
            const restaurantsInCity = restaurantData.filter(r => r.city.toLowerCase() === city);
            if (restaurantsInCity.length > 0) {
                let list = restaurantsInCity.map((r, i) => `${i + 1}. ${r.name} (${r.cuisine})`).join("\n");
                reply = `Great! Here are the restaurants in ${sessionState.userCity}:\n${list}\n\nPlease enter the name of the restaurant whose menu you'd like to view.`;
            } else {
                reply = `No restaurants found in ${sessionState.userCity}. Please enter a valid city, or 'cancel'.`;
            }
        } else {
            reply = `Sorry, we don't have restaurants listed in "${msg}". Please enter a valid city, or 'cancel'.`;
        }
        return sendReply(reply);
    }

    if (sessionState.subIntent === "await_restaurant_name_for_menu") {
      if (msg.includes("near me") || msg.includes("find restaurants")) {
          sessionState.intent = "find_restaurant";
          sessionState.subIntent = "await_search_criteria";
          reply = "It looks like you want to *find* restaurants, not just view a menu. How would you like to search?\n1. By City\n2. By Cuisine\n3. By Rating\n\nType a number (1-3) or 'cancel'.";
          return sendReply(reply);
      }
      const match = restaurantData.find(r => r.name.toLowerCase() === msg && r.city.toLowerCase() === sessionState.userCity.toLowerCase());
      if (match) {
        sessionState.currentMenu = match.menu;
        sessionState.selectedRestaurant = match.name;
        sessionState.subIntent = "display_menu_and_await_action";
        
        reply = `Menu for ${match.name}:\n` +
          sessionState.currentMenu.map((item, i) => `${i + 1}. ${item.name} -- Rs.${item.price}` + (item.description ? ` (${item.description})` : '')).join("\n") +
          `\n\nTo order an item, type 'order <item number>' (e.g., 'order 1').\nType 'hi' to return to the main menu.`;
      } else {
        const restaurantsInCurrentCity = restaurantData.filter(r => r.city.toLowerCase() === sessionState.userCity.toLowerCase());
        let list = restaurantsInCurrentCity.map((r, i) => `${i + 1}. ${r.name} (${r.cuisine})`).join("\n");
        reply = `Restaurant "${capitalize(msg)}" not found in ${sessionState.userCity}. Please choose from the available restaurants:\n${list}\n\nPlease enter a valid restaurant name, or type 'cancel' to go back.`
      }
      return sendReply(reply);
    }
  }

  if (sessionState.intent === "place_order") {
    if (sessionState.subIntent === "await_order_type") {
      if (msg === "delivery") {
        sessionState.reservationDetails.orderType = "delivery";
        sessionState.subIntent = "await_location_for_order";
        reply = "Please provide your delivery location in this format: City, Full Address (e.g., 'Mumbai, 123 Main St')";
      } else if (msg === "pickup") {
        sessionState.reservationDetails.orderType = "pickup";
        sessionState.subIntent = "await_pickup_restaurant";
        reply = "For pickup, which restaurant are you ordering from?";
      } else {
        reply = "Please specify 'delivery' or 'pickup', or 'cancel'.";
      }
      return sendReply(reply);
    }

    if (sessionState.subIntent === "await_location_for_order") {
      const parts = msg.split(",").map(p => p.trim());
      if (parts.length >= 2) {
        sessionState.userCity = capitalize(parts[0]);
        sessionState.userAddress = parts.slice(1).join(", ");
        sessionState.subIntent = "await_user_phone_order";
        reply = `Got your delivery address: ${sessionState.userAddress}, ${sessionState.userCity}.\nFor confirmation, please provide your 10-digit mobile number.`;
      } else {
        reply = "Please provide location in format: City, Full Address (e.g., 'Mumbai, 123 Main St'), or 'cancel'.";
      }
      return sendReply(reply);
    }
    
    if (sessionState.subIntent === "await_user_phone_order") {
        const phoneMatch = msg.match(/^\d{10}$/);
        if (phoneMatch) {
            sessionState.userPhone = msg;
            if (sessionState.orderCart.length === 0) {
              sessionState.subIntent = "await_restaurant_name_for_order";
              const restaurantsInCurrentCity = restaurantData.filter(r => r.city.toLowerCase() === sessionState.userCity.toLowerCase());
              if (restaurantsInCurrentCity.length > 0) {
                  let list = restaurantsInCurrentCity.map((r, i) => `${i + 1}. ${r.name}`).join("\n");
                  reply = `Thanks! Your number is ${sessionState.userPhone}.\nWhich restaurant would you like to order from in ${sessionState.userCity}?\n${list}\n\nPlease enter the restaurant name.`;
              } else {
                  reply = `Thanks! Your number is ${sessionState.userPhone}.\nWhich restaurant would you like to order from? (e.g., 'Royal Tandoor')`;
              }
            } else {
              return sendReply(getOrderSummaryAndConfirmPrompt());
            }
        } else {
            reply = "Please enter a valid 10-digit mobile number, or 'cancel'.";
        }
        return sendReply(reply);
    }

    if (sessionState.subIntent === "await_pickup_restaurant") {
        const restaurantName = msg.toLowerCase();
        const restaurant = restaurantData.find(r => r.name.toLowerCase() === restaurantName);
        if (restaurant) {
            sessionState.selectedRestaurant = restaurant.name;
            sessionState.currentMenu = restaurant.menu;
            sessionState.subIntent = "await_user_phone_order_pickup";
            reply = `Perfect, you've selected ${restaurant.name} for pickup. For confirmation, please provide your 10-digit mobile number.`;
        } else {
            const allRestaurantNames = restaurantData.map(r => r.name).join(", ");
            reply = `Restaurant not found. Please enter a valid restaurant name for pickup (e.g., '${restaurantData[0].name}'). Or type 'list all restaurants'.`;
        }
        return sendReply(reply);
    }

    if (sessionState.subIntent === "await_user_phone_order_pickup") {
        const phoneMatch = msg.match(/^\d{10}$/);
        if (phoneMatch) {
            sessionState.userPhone = msg;
            if (sessionState.orderCart.length === 0) {
                sessionState.subIntent = "await_add_items_to_cart";
                reply = `Thanks! Your number is ${sessionState.userPhone}. Here's the menu for ${sessionState.selectedRestaurant}:\n` +
                        sessionState.currentMenu.map((item, i) => `${i + 1}. ${item.name} -- Rs.${item.price}` + (item.description ? ` (${item.description})` : '')).join("\n") +
                        `\n\nType 'order <item number>' to add items to your cart. Type 'view cart' or 'checkout' when done.`;
            } else {
                return sendReply(getOrderSummaryAndConfirmPrompt());
            }
        } else {
            reply = "Please enter a valid 10-digit mobile number, or 'cancel'.";
        }
        return sendReply(reply);
    }


    if (sessionState.subIntent === "await_restaurant_name_for_order") {
      const restaurantName = msg.toLowerCase();
      const restaurant = restaurantData.find(r => r.name.toLowerCase() === restaurantName && r.city.toLowerCase() === sessionState.userCity.toLowerCase());
      if (restaurant) {
        sessionState.selectedRestaurant = restaurant.name;
        sessionState.currentMenu = restaurant.menu;
        sessionState.subIntent = "await_add_items_to_cart";
        reply = `Great! Here's the menu for ${restaurant.name}:\n` +
          sessionState.currentMenu.map((item, i) => `${i + 1}. ${item.name} -- Rs.${item.price}` + (item.description ? ` (${item.description})` : '')).join("\n") +
          `\n\nType 'order <item number>' to add items to your cart. Type 'view cart' or 'checkout' when done.`;
      } else {
        const restaurantsInCurrentCity = restaurantData.filter(r => r.city.toLowerCase() === sessionState.userCity.toLowerCase());
        if (restaurantsInCurrentCity.length > 0) {
            let list = restaurantsInCurrentCity.map((r, i) => `${i + 1}. ${r.name} (${r.cuisine})`).join("\n");
            reply = `Restaurant "${capitalize(restaurantName)}" not found in ${sessionState.userCity}. Please choose from the available restaurants:\n${list}\n\nPlease enter a valid restaurant name, or type 'cancel' to go back.`;
        } else {
            reply = `No restaurants found in ${sessionState.userCity}. Please try another city for delivery, or 'cancel'.`;
            sessionState.subIntent = "await_location_for_order";
        }
      }
      return sendReply(reply);
    }

    if (sessionState.subIntent === "await_add_items_to_cart" || sessionState.subIntent === "await_order_action") {
      if (orderCommandMatch) {
        const itemIndex = parseInt(orderCommandMatch[1], 10) - 1;
        if (sessionState.currentMenu[itemIndex]) {
          const itemToOrder = sessionState.currentMenu[itemIndex];
          const existingItemInCart = sessionState.orderCart.find(cartItem => cartItem.item.name === itemToOrder.name);
          
          if (existingItemInCart) {
            existingItemInCart.quantity++;
          } else {
            sessionState.orderCart.push({ item: itemToOrder, quantity: 1 });
          }
          
          reply = `Added "${itemToOrder.name}" to your cart. Your cart now has ${sessionState.orderCart.length} unique items.`;
          reply += `\nType 'order <item number>' to add more, 'view cart' to see your order, or 'checkout' to finalize.`;
          sessionState.subIntent = "await_order_action";
          return sendReply(reply);
        } else {
          reply = `Invalid item number. Please select an item from the menu by typing 'order <item number>' (e.g., 'order 1').`;
          reply += `\nType 'view cart' to see your cart, or 'hi' to return to main menu.`;
          return sendReply(reply);
        }
      }

      if (msg === "add more") {
        sessionState.subIntent = "await_add_items_to_cart";
        reply = `Sure, here's the menu for ${sessionState.selectedRestaurant}:\n` +
                sessionState.currentMenu.map((item, i) => `${i + 1}. ${item.name} -- Rs.${item.price}` + (item.description ? ` (${item.description})` : '')).join("\n") +
                `\n\nTo add items, type 'order <item number>' (e.g., 'order 1'). Type 'view cart' or 'checkout'.`;
        return sendReply(reply);
      } else if (msg === "view cart") {
        if (sessionState.orderCart.length === 0) {
          reply = "Your cart is empty. Add items by typing 'order <item number>' from the menu shown above.";
        } else {
          let cartSummary = "Your current order:\n";
          let totalCost = 0;
          sessionState.orderCart.forEach((item, i) => {
            cartSummary += `${i + 1}. ${item.item.name} x${item.quantity} = Rs.${item.item.price * item.quantity}\n`;
            totalCost += item.item.price * item.quantity;
          });
          cartSummary += `\nTotal: Rs.${totalCost}\n\nType 'remove <item number>' to remove an item, 'checkout' to finalize, or 'add more' to continue Browse the menu.`;
          reply = cartSummary;
        }
        sessionState.subIntent = "await_order_action";
        return sendReply(reply);
      } else if (msg.startsWith("remove ")) {
          const itemToRemoveIndex = parseInt(msg.split(" ")[1], 10) - 1;
          if (itemToRemoveIndex >= 0 && itemToRemoveIndex < sessionState.orderCart.length) {
              const removedItem = sessionState.orderCart.splice(itemToRemoveIndex, 1)[0];
              reply = `Removed ${removedItem.item.name} from your cart.`;
              if (sessionState.orderCart.length === 0) {
                  reply += "\nYour cart is now empty. Type 'add more' to select items or 'cancel'.";
                  sessionState.subIntent = "await_add_items_to_cart";
              } else {
                  reply += "\n" + getOrderSummaryAndConfirmPrompt(false);
              }
          } else {
              reply = "Invalid item number to remove. Please check your cart and try again. Type 'view cart' to see your cart.";
          }
          return sendReply(reply);
      } else if (msg === "checkout") {
        if (sessionState.orderCart.length === 0) {
          reply = "Your cart is empty. Please add items before checking out. Type 'add more' to see the menu again.";
          sessionState.subIntent = "await_add_items_to_cart";
          return sendReply(reply);
        }
        return sendReply(getOrderSummaryAndConfirmPrompt());
      } else {
          reply = "I didn't understand that. To add items, please type 'order <item number>' (e.g., 'order 1').";
          reply += "\nYou can also 'add more' items, 'view cart', 'remove <item number>', or 'checkout'. Or type 'hi' to go to main menu.";
          return sendReply(reply);
      }
    }

    if (sessionState.subIntent === "await_payment_confirmation") {
      if (msg === "confirm") {
        let totalCost = sessionState.orderCart.reduce((sum, cartItem) => sum + (cartItem.item.price * cartItem.quantity), 0);
        let finalReply = `Order Confirmed! Your total is Rs.${totalCost}.\n`;
        if (sessionState.reservationDetails.orderType === "delivery") {
          finalReply += `Your order from ${sessionState.selectedRestaurant} is being prepared and will be delivered to:\n${sessionState.userAddress}, ${sessionState.userCity}\n`;
        } else {
          finalReply += `Pick up your order from ${sessionState.selectedRestaurant}.\n`;
        }
        finalReply += `A confirmation SMS will be sent to ${sessionState.userPhone}.\n`;
        finalReply += "Thank you for using Royal Tandoor Assistant! Type 'hi' to start a new interaction.";
        resetSession();
        return sendReply(finalReply);
      } else if (msg === "cancel") {
        resetSession();
        reply = "Order cancelled. Type 'hi' to start over.";
        return sendReply(reply);
      } else {
        reply = "Please type 'confirm' to place the order or 'cancel' to abort.";
        return sendReply(reply);
      }
    }
  }

  if (sessionState.intent === "book_table") {
    if (sessionState.subIntent === "await_reservation_city") {
      const city = msg.toLowerCase();
      if (cities.includes(city)) {
        sessionState.reservationDetails.city = capitalize(city);
        sessionState.subIntent = "await_reservation_restaurant";
        const restaurantsInCity = restaurantData.filter(r => r.city.toLowerCase() === city);
        let restaurantNames = restaurantsInCity.map(r => r.name).join(", ");
        if (restaurantsInCity.length > 0) {
            reply = `Got it. Which restaurant in ${capitalize(city)} would you like to book a table at? Available: ${restaurantsInCity.map(r => r.name).join(', ')}.`;
        } else {
            reply = `There are no restaurants listed in ${capitalize(city)}. Please choose another city, or 'cancel' to return to main menu.`;
        }
      } else {
        reply = `Sorry, we don't have restaurants listed in "${msg}". Please enter a valid city or 'cancel'.`;
      }
      return sendReply(reply);
    }

    if (sessionState.subIntent === "await_reservation_restaurant") {
      const restaurantName = msg.toLowerCase();
      const restaurant = restaurantData.find(r => r.name.toLowerCase() === restaurantName && r.city.toLowerCase() === sessionState.reservationDetails.city.toLowerCase());
      if (restaurant) {
        sessionState.selectedRestaurant = restaurant.name;
        sessionState.reservationDetails.restaurant = restaurant.name;
        sessionState.subIntent = "await_reservation_details";
        reply = `Okay, booking at ${restaurant.name} in ${sessionState.reservationDetails.city}.\nNow, please tell me the date, time, and number of guests. (e.g., 'July 25, 7 PM, 4 people' or 'tomorrow at 8pm for 2')`;
      } else {
        const availableRestaurantsInCity = restaurantData.filter(r => r.city.toLowerCase() === sessionState.reservationDetails.city.toLowerCase());
        if (availableRestaurantsInCity.length > 0) {
            let list = availableRestaurantsInCity.map((r, i) => `${i + 1}. ${r.name}`).join("\n");
            reply = `Restaurant "${capitalize(restaurantName)}" not found in ${sessionState.reservationDetails.city}. Available restaurants are:\n${list}\n\nPlease enter a valid restaurant name from the list, or 'cancel'.`;
        } else {
            reply = `No restaurants found in ${sessionState.reservationDetails.city}. Please enter a valid restaurant name or 'cancel'.`;
            sessionState.subIntent = "await_reservation_city";
            reply += `\nPlease try another city, or 'cancel'.`;
        }
      }
      return sendReply(reply);
    }

    if (sessionState.subIntent === "await_reservation_details") {
      let date = "not specified";
      let time = "not specified";
      let guests = "1";
      let requests = "None";

      const dateMatch = msg.match(/(january|february|march|april|may|june|july|august|september|october|november|december|\w+ \d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2}|today|tomorrow|on \w+)/i);
      const timeMatch = msg.match(/(\d{1,2}(:\d{2})?\s*(?:am|pm)?|noon|midnight|at \d{1,2}(:\d{2})?(?:am|pm)?)/i);
      const guestsMatch = msg.match(/(\d+)\s*(?:people|person|guests|for)/i);
      const requestsMatch = msg.match(/(special requests|request|note):? (.+)/i);

      if (dateMatch) date = dateMatch[0].replace(/on /i, '').trim();
      if (timeMatch) time = timeMatch[0].replace(/at /i, '').trim();
      if (guestsMatch) guests = guestsMatch[1];
      if (requestsMatch) requests = requestsMatch[2];

      if (date === "not specified" || time === "not specified") {
          reply = "I couldn't understand the date or time. Please provide them in a clear format (e.g., 'July 25, 7 PM, 4 people' or 'tomorrow at 8pm for 2'). Or 'cancel' to restart reservation.";
          return sendReply(reply);
      }

      sessionState.reservationDetails.date = capitalize(date);
      sessionState.reservationDetails.time = time.toUpperCase();
      sessionState.reservationDetails.guests = guests;
      sessionState.reservationDetails.specialRequests = requests;
      sessionState.subIntent = "await_reservation_phone";
      
      reply = `Got it. For ${sessionState.selectedRestaurant} on ${sessionState.reservationDetails.date} at ${sessionState.reservationDetails.time} for ${sessionState.reservationDetails.guests} people.`;
      if (requests !== "None") {
          reply += `\nSpecial requests: "${sessionState.reservationDetails.specialRequests}".`;
      }
      reply += `\nFor confirmation, please provide your 10-digit mobile number.`;
      return sendReply(reply);
    }

    if (sessionState.subIntent === "await_reservation_phone") {
        const phoneMatch = msg.match(/^\d{10}$/);
        if (phoneMatch) {
            sessionState.userPhone = msg;
            sessionState.subIntent = "await_reservation_confirmation";
            reply = `Thanks! Your number is ${sessionState.userPhone}.\n\nDoes this look correct? (yes/no)`;
            return sendReply(reply);
        } else {
            reply = "Please enter a valid 10-digit mobile number, or 'cancel'.";
            return sendReply(reply);
        }
    }

    if (sessionState.subIntent === "await_reservation_confirmation") {
      if (msg === "yes") {
        reply = `Your table at ${sessionState.selectedRestaurant} in ${sessionState.reservationDetails.city} for ${sessionState.reservationDetails.guests} on ${sessionState.reservationDetails.date} at ${sessionState.reservationDetails.time} is confirmed! We look forward to your visit.`;
        if (sessionState.reservationDetails.specialRequests && sessionState.reservationDetails.specialRequests !== "None") {
            reply += `\n(Note: Special request: "${sessionState.reservationDetails.specialRequests}")`;
        }
        reply += `\nA confirmation SMS will be sent to ${sessionState.userPhone}.\n`;
        reply += `\n\nType 'hi' to do more.`;
        resetSession();
      } else if (msg === "no") {
        sessionState.subIntent = "await_reservation_details";
        reply = "No problem, let's re-enter the details. Please tell me the date, time, and number of guests again, and any special requests. (e.g., 'July 25, 7 PM, 4 people, requests: window seat')";
      } else {
        reply = "Please reply 'yes' to confirm or 'no' to re-enter details, or 'cancel'.";
      }
      return sendReply(reply);
    }
  }

  let fallbackMessage = "I didn't understand that.";
  
  if (sessionState.intent === null) {
      fallbackMessage += "\nType 'hi' to see the main options: Find restaurants, View menu, Place order, Book table. You can also 'list all restaurants'.";
  } else if (sessionState.intent === "find_restaurant") {
      fallbackMessage += `\nI'm currently helping you find restaurants. You can type '1' for city, '2' for cuisine, '3' for rating, or 'cancel'.`;
  } else if (sessionState.intent === "view_menu") {
      if (sessionState.subIntent === "await_city_for_menu") {
          fallbackMessage += `\nI'm currently asking for the city to view a menu. Please enter a city name (e.g., 'Mumbai'), or 'cancel'.`;
      } else if (sessionState.subIntent === "await_restaurant_name_for_menu") {
          const restaurantsInCurrentCity = restaurantData.filter(r => r.city.toLowerCase() === sessionState.userCity.toLowerCase());
          let list = restaurantsInCurrentCity.map((r, i) => `${i + 1}. ${r.name}`).join(", ");
          fallbackMessage += `\nI'm currently asking for a restaurant name in ${sessionState.userCity}. Please choose from: ${list}. Or type 'list all restaurants'.`;
      } else {
          fallbackMessage += `\nI'm currently helping you view a menu. To order, please type 'order <item number>' (e.g., 'order 1'), or 'cancel'. If you want to *find* restaurants, type 'find restaurants' or 'hi' to go to main menu. You can also 'list all restaurants'.`;
      }
  } else if (sessionState.intent === "place_order") {
      if (sessionState.subIntent === "await_order_type") {
          fallbackMessage += `\nI'm waiting for you to say 'delivery' or 'pickup' for your order, or 'cancel'.`;
      } else if (sessionState.subIntent && (sessionState.subIntent.includes("order") || sessionState.subIntent === "await_add_items_to_cart" || sessionState.subIntent === "await_order_action" || sessionState.subIntent === "await_payment_confirmation" || sessionState.subIntent === "await_user_phone_order" || sessionState.subIntent === "await_user_phone_order_pickup")) {
          fallbackMessage += `\nI'm currently processing your order. To add items, type 'order <item number>' (e.g., 'order 1'). You can also 'view cart', 'remove <item number>', or 'checkout'.`;
          if (!sessionState.userPhone && (sessionState.subIntent === "await_location_for_order" || sessionState.subIntent === "await_pickup_restaurant")) {
            fallbackMessage += `\nRemember to provide your 10-digit mobile number for confirmation.`;
          }
      } else {
          fallbackMessage += `\nI'm currently helping you with ordering. Please provide the requested information or type 'hi' to go to the main menu.`;
      }
  } else if (sessionState.intent === "book_table") {
      if (sessionState.subIntent === "await_reservation_city") {
          fallbackMessage += `\nI'm currently asking for the city for your reservation. Please enter a city name (e.g., 'Mumbai'), or 'cancel'.`;
      } else if (sessionState.subIntent === "await_reservation_restaurant") {
          const restaurantsInCurrentCity = restaurantData.filter(r => r.city.toLowerCase() === sessionState.reservationDetails.city.toLowerCase());
          let list = restaurantsInCurrentCity.map((r, i) => `${i + 1}. ${r.name}`).join(", ");
          fallbackMessage += `\nI'm currently asking for a restaurant name in ${sessionState.reservationDetails.city}. Please choose from: ${list}. Or type 'list all restaurants'.`;
      } else {
          fallbackMessage += `\nI'm currently helping you book a table. Please provide the requested reservation details, or 'cancel'. You can also 'list all restaurants' to see names.`;
          if (!sessionState.userPhone && sessionState.subIntent === "await_reservation_details") {
            fallbackMessage += `\nRemember to provide your 10-digit mobile number for confirmation.`;
          }
      }
  }
  
  fallbackMessage += "\nOr type 'hi' to go back to the main menu.";
  return sendReply(fallbackMessage);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});