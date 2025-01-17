const userID = "auth0|6591609c687600590068d1f9"
const response = fetch("./v2/accounts/get/", {
    method: 'POST',
    body: JSON.stringify({
        userID: userID,
    })
});

if (response.ok) {
    const data = await response.json();
    console.log(data);
    document.getElementById("data_demo").innerHTML = JSON.stringify(data);
} else {
    console.error('Error:', response.statusText);
}