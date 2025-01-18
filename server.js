const cors = require("cors");
const express = require("express");
const firebase = require("firebase-admin");
const app = express();
const PORT = 1599;

// Initialize Firebase
const servAcct = require("./fbsa.json");

// Initialize firebase with the database can2-prod in project origin-123f5
firebase.initializeApp({
    credential: firebase.credential.cert(servAcct),
});

// Initiate with CAN2-PROD database
const firestore = firebase.firestore();

// Middleware
const allowedOrigins = ['http://localhost:3000', 'https://nightshade.red', 'https://dev2.nightshade.red', 'https://can3.api.nightshade.red'];
app.use(
    // CORS
    cors({
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }),
    // Allow anything in the /public directory
    express.static('public'),
    // Parse JSON bodies
    express.json(),
);

// Expose index.html
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});
/* UPTIME SERVICE */
app.get("/v2/platform/uptime/", (req, res) => {
    // Return 200 OK
    res.sendStatus(200);
});

/* ACCOUNTS */
// 01 - Get Account
app.post("/v2/accounts/get/", async (req, res) => {
    // Allow POST requests from localhost
    //res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    //res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Get a0UserId from the request body
    const { a0UserId } = req.body;

    // If there's no a0UserId, return an error
    if (!a0UserId) {
        return res.status(400).json({
            error: "No a0UserId provided",
        });
    }

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
                title: groupData.docs[0].data().title,
                showOnHub: groupData.docs[0].data().showOnHub,
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

/* BOOKMARK */
// 01 – Get Entire Group
app.post("/v2/bookmark/get/", async (req, res) => {
    // Get the a0UserId and groupID from the request body
    const { a0UserId, groupID } = req.body;
    console.log('BODY', req.body);

    // If there's no a0UserId or groupID, return an error
    if (!a0UserId || !groupID) {
        console.log('ERROR 400');
        return res.status(400).json({
            error: "No a0UserId or groupID provided",
        });
    }

    // Find a document in the accountDetail collection with an auth0UserId value of a0UserId
    // Don't send it back yet, there's more to do with the data
    var accountRaw = await firestore.collection("accountDetail")
                    .where("auth0UserId", "==", a0UserId)
                    .get();

    // Get the account data
    var account = accountRaw.docs[0].data();
    console.log('FOUND ACCOUNT', 'account');

    // Get the group data
    console.log('GET DATA');
    var groupData = await firestore.collection('athenaeum_roster')
                    .where('atID', '==', groupID)
                    .get();

    // Check publicity / access
    console.log('CHECK PUBLICITY');
    if (groupData.docs[0].data().user !== account.accountNumber) {
        if (groupData.docs[0].data().access !== "public") {
            if (groupData.docs[0].data().userGroup === accountDetail.docs[0].data().userGroup[0]) {
                // Permitted
            }
            else {
                // Return error
                return res.status(403).json({
                    error: "Access denied",
                });
            }
        }
    }

    // Get the athenaeumData in the group
    console.log('GET RECORDS');
    var athenaeumData = [];
    for (let i = 0; i < groupData.docs[0].data().recordIDs.length; i++) {
        var recordData = await firestore.collection('athenaeum_data')
                        .where('recordID', '==', groupData.docs[0].data().recordIDs[i])
                        .get();
        athenaeumData.push(recordData.docs[0].data());
    }

    // Sort by title
    console.log('SORT RECORDS');
    athenaeumData.sort((a, b) => {
        if (a.recordTitle < b.recordTitle) {
            return -1;
        }
        if (a.recordTitle > b.recordTitle) {
            return 1;
        }
        return 0;
    });

    console.log('RETURNING...');
    res.json({
        athenaeumData,
        access: groupData.docs[0].data().access,
        atID: groupID,
        iconLink: null,
        title: groupData.docs[0].data().title,
        type: groupData.docs[0].data().type,
        showOnHub: groupData.docs[0].data().showOnHub,
        user: groupData.docs[0].data().user,
    });
});


// 02 - Create/Edit/Save Record
app.post("/v2/bookmark/saverecord/", async (req, res) => {
    // Get a0UserId, recordID, recordTitle (string), recordCategory (string), recordTags (array), recordLinkToData and group ID from the request body
    const { a0UserId, recordID, recordTitle, recordCategory, recordTags, recordLinkToData, groupID } = req.body;

    // If any are missing, return an error
    if (!a0UserId || !recordTitle || !recordCategory || !groupID) {
        console.log('ERROR 400');
        console.log('BODY', req.body);
        return res.status(400).json({
            error: "Missing data",
        });
    }

    // Get the account data
    var accountRaw = await firestore.collection("accountDetail")
                    .where("auth0UserId", "==", a0UserId)
                    .get();

    // Get the account data
    var account = accountRaw.docs[0].data();

    // Get the group data
    var groupData = await firestore.collection('athenaeum_roster')
                    .where('atID', '==', groupID)
                    .get();

    // Check publicity / access
    if (groupData.docs[0].data().access === "private" && groupData.docs[0].data().user !== account.accountNumber) {
        // If the userGroup in the athenaeum and the user's userGroup do not match, and the user's athenaea array does not contain the athenaeumID, return an error
        if ((groupData.docs[0].data().userGroup !== account.docs[0].data().userGroup[0]) && (account.docs[0].data().athenaea.includes(athenaeumID) === false)) {
            return res.status(403).json({
                error: "Access denied",
            });
        }
    }
    
    // If the record does not exist create it.
    // If the record does not exist, create a new record
    else if (recordID === "" || recordID === null || recordID === undefined) {
        console.log("NEW RECORD");
        // Generate random 32-character string (A-Z, a-z, 0-9)
        var chars =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var newRecordID = "";
        for (var i = 0; i < 32; i++) {
          newRecordID += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        console.log("NEW RECORD ID", newRecordID);
        console.log("ADDING");
        // Add the record to Firestore (athenaeum_data)
        await firestore.collection("athenaeum_data").add({
          recordCategory: recordCategory,
          recordID: newRecordID,
          recordLinkToData: recordLinkToData,
          recordTags: recordTags,
          recordTitle: recordTitle,
        });
        console.log("ADDED SUCCESSFULLY");
        // Add the recordID to the athenaeum_roster
        // Get the athenaeum from Firestore (athenaeum_roster; contains atID and an array of recordIDs)
        console.log("UPDATING ROSTER");
  
        // Get the recordIDs from the athenaeum
        let recordIDs = groupData.docs[0].data().recordIDs;
        recordIDs.push(newRecordID);
        // Update the athenaeum with the new recordID
        await firestore.collection('athenaeum_roster').doc(groupData.docs[0].id).update({
          recordIDs: recordIDs,
        });
        console.log("ROSTER UPDATED");
        // Return a message and the entire record
        return res.json({
          message: "Record added successfully",
          record: {
            recordCategory: recordCategory,
            recordID: newRecordID,
            recordLinkToData: recordLinkToData,
            recordTags: recordTags,
            recordTitle: recordTitle,
          },
        });
    }

    // Otherwise, create a new record
    else {
        // Get the record from Firestore (athenaeum_data)
        const record = await firestore
          .collection("athenaeum_data")
          .where("recordID", "==", recordID)
          .get();
        await firestore.collection("athenaeum_data").doc(record.docs[0].id).update({
            recordTitle: recordTitle,
            recordCategory: recordCategory,
            recordTags: recordTags,
            recordLinkToData: recordLinkToData,
        });
        return res.json({
            message: "Record updated successfully",
            recordCategory: recordCategory,
            recordID: recordID,
            recordLinkToData: recordLinkToData,
            recordTags: recordTags,
            recordTitle: recordTitle,
        });
    }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
