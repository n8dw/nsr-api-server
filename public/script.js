async function test() {
    const userID = localStorage.getItem('a0UserId');
    console.log('USERID:', userID);
    const response = await fetch("http://localhost:3000/v2/accounts/get/", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            a0UserId: userID,
        })
    });

    if (response.ok) {
        const data = await response.json();
        console.log(data);
        document.getElementById("data_demo").innerHTML = JSON.stringify(data);
    } else {
        console.error('Error:', response.statusText);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('myButton');
    button.addEventListener('click', async () => {
        await test();
    });
});