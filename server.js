const Alpaca = require("@alpacahq/alpaca-trade-api");
const alpaca = new Alpaca();
const WebSocket = require('ws');

const wss = new WebSocket("wss://stream.data.alpaca.markets/v1beta1/news");

wss.on('open', function() {
    console.log("Websocket connected!");

    // Logging into the data source
    const authMsg = {
        action: 'auth',
        key: process.env.APCA_API_KEY_ID,
        secret: process.env.APCA_API_SECRET_KEY
    };

    wss.send(JSON.stringify(authMsg)); // Essentially "logging us in", send auth data to ws

    // Subscribe to all news feeds
    const subscribeMsg = {
        action: 'subscribe',
        news: ['*']
    };
    wss.send(JSON.stringify(subscribeMsg)); // Connecting us to the live data source of news
});

wss.on('message', async function(message) {
    console.log("Message is " + message);
    const currentEvent = JSON.parse(message)[0];
    if (currentEvent.T === "n") { // This is a news event
        let impact = 0;

        // Asking CHATGPT its thoughts
        const apiRequestBody = {
            "model": "gpt-3.5-turbo", // Correct model name
            "messages": [
                { role: "system", content: "Only respond with a number from 1-100 detailing the impact of the headline."}, // How ChatGPT should talk to us
                { role: "user", content: "Given the headline '" + currentEvent.headline + "', show me a number from 1-100 detailing the impact of this headline."}
            ]
        };

        await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(apiRequestBody)
        }).then((response) => response.json())
          .then((data) => {
              if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                  console.log(data);
                  console.log(data.choices[0].message);
                  impact = parseInt(data.choices[0].message.content);
              } else {
                  console.error("Invalid data structure or no data:", data);
                  impact = 0; // default or fallback impact value if data is not as expected
              }
          }).catch((error) => {
              console.error("Error fetching or processing data:", error);
              impact = 0; // default or fallback impact value in case of errors
          });

        const tickerSymbol = currentEvent.symbols[0];

        if (impact >= 70) { // Buy stock if score >= 70
            let order = await alpaca.createOrder({
                symbol: tickerSymbol,
                qty: 1,
                side: 'buy',
                type: 'market',
                time_in_force: 'day'
            });
        } else if (impact <= 30) { // Sell stock if score <= 30
            let closedPosition = await alpaca.closePosition(tickerSymbol);
        }
    }
});