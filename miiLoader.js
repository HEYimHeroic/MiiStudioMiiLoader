(function() {
    const urlre = /^https:\/\/studio\.mii\.nintendo\.com\/miis\/([0-9a-f]*)\/edit\?client_id=([0-9a-f]*)/;
    const res = urlre.exec(window.location.href);
    if (!res || res.length < 2) {
        alert("This page isn't the correct page. Please edit the Mii you'd like to download and run this script again.");
        return;
    }
    const miiID = res[1];
    const clientID = res[2];
    const storageURL = `https%3A%2F%2Fstudio.mii.nintendo.com%2Fmiis%2F${miiID}%2Fedit%3Fclient_id%3D${clientID}`;
    const load = confirm("Press OK to load a Mii data file.\nPress Cancel to extract this Mii's Mii data file.");
    if (load) {
        const miiData = prompt("Please input the bytes for the Mii data file.");
        localStorage.setItem(storageURL, miiData);
        return;
    }
    var extractedMiiData = localStorage.getItem(storageURL);
    if (!extractedMiiData) {
        alert("The Mii data is not currently stored. Please make a change to this Mii, revert the change, and refresh the page to try again.");
        return;
    }
    var d = document.createElement("a");
    d.href = `data:attachment/text,${encodeURI(extractedMiiData)}`;
    d.target = "_blank";
    d.download = `${miiID}.txt`;
    d.click();
}());