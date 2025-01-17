const cors = require("cors");
const express = require("express");
const firebase = require("firebase-admin");
const helmet = require("helmet");
const app = express();
const PORT = 3000;

// Middleware
app.use(
    cors({
        origin: ['http://localhost:3000', 'https://nightshade.red'],
        credentials: true,
    }),
    helmet({
        contentSecurityPolicy: {
            directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "http://localhost:3000"], // Allow localhost connections
            },
        },
    }),
    // Allow anything in the /public directory
    express.static('public')
);

// Initialize Firebase
const servAcct = require("./fbsa.json");

// Initialize firebase with the database can2-prod in project origin-123f5
firebase.initializeApp({
    credential: firebase.credential.cert(servAcct),
});

// Initiate with CAN2-PROD database
const firestore = firebase.firestore();

// Expose index.html
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

/* ACCOUNTS */
// 01 - Get Account
app.get("/v2/accounts/get/", async (req, res) => {
    // Allow POST requests from localhost
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Get the a0UserId from the request
    const a0UserId = req.query.a0UserId;

    // Find a document in the accountDetail collection with an auth0UserId value of a0UserId
    // Don't send it back yet, there's more to do with the data
    var accountRaw = await firestore.collection("accountDetail")
                    .where("auth0UserId", "==", a0UserId)
                    .get();
    
    // Get the account data
    var account = accountRaw.docs[0].data();

    // ADMIN ONLY – Get the other exchange users in the same group
    var exchangeUsers = [];
    if (account.roles.includes('exchangeAdmin')) {
        // Get the group ID
        var groupID = account.userGroup[0]
        var groupData = await firestore.collection('accountDetail')
                        .where('userGroup', 'array-contains', groupID)
                        .get();
        
        groupData.forEach(doc => {
            // If doc.roles includes 'exchange', push; otherwise, skip
            if (doc.data().roles.includes('exchange')) {
                exchangeUsers.push({
                    accountHolderName: doc.data().accountHolderName[0],
                    accountNumber: doc.data().accountNumber,
                });
            }
        });
    }

    // BOOKMARK - Get the Bookmark groups
    var bookmarkGroups = [];
    if (account.roles.includes('bookmark')) {
        // For each bookmark group ID in account.athenaea, get the group ID and title and push it to the bookmarkGroups array
        await Promise.all(account.athenaea.map(async (groupID) => {
            var groupData = await firestore.collection('athenaeum_roster')
                            .where('atID', '==', groupID)
                            .get();
            bookmarkGroups.push({
                id: groupID, 
                title: groupData.docs[0].data().title
            });
        }));
    }

    // WIFI 
    var wifiPassword = false;
    if (account.roles.includes('wifi')) {
        var passData = await firestore.collection('wifiPassword')
                        .where('group', '==', account.userGroup[0])
                        .get();
        wifiPassword = passData.docs[0].data().key;
    }

    // NPR
    var randomNum = Math.floor(Math.random() * 10) + 1;
    var nprData = await firestore.collection('thisisnpr')
                    .where('jokeID', '==', randomNum)
                    .get();
    var npr = nprData.docs[0].data();

    // Return account, exchangeUsers, bookmarkGroups, wifiPassword, and npr
    res.json({
        accountDetail: account,
        thisIsNPR: npr,
        elements: {
            exchangeUsers: exchangeUsers,
            athenaeumLinks: bookmarkGroups,
        },
        wifiPassword: wifiPassword,
    });
});

// 02 - Generate API token


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
