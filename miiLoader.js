(function () {
  const urlre = /^https:\/\/studio\.mii\.nintendo\.com\/miis\/([0-9a-f]*)\/edit\?client_id=([0-9a-f]*)/;
  const res = urlre.exec(window.location.href);
  if (!res || res.length < 2) {
    alert(
      "This page isn't the correct page. Please edit the Mii you'd like to download and run this script again."
    );
    return;
  }
  const miiID = res[1];
  const clientID = res[2];
  const storageURL = `https%3A%2F%2Fstudio.mii.nintendo.com%2Fmiis%2F${miiID}%2Fedit%3Fclient_id%3D${clientID}`;

  const setOrExtractData = confirm(
    "Press OK to load a Mii data file.\nPress Cancel to extract this Mii's Mii data file."
  );

  if (setOrExtractData) {
    setMiiData(storageURL);
  } else {
    const extractedMiiData = extractMiiData(storageURL);

    downloadMiiData(extractedMiiData, miiID);
  }
})();

function setMiiData(storageURL) {
  const miiData = prompt('Please input the bytes for the Mii data file.');

  localStorage.setItem(storageURL, miiData);
}

function extractMiiData(storageURL) {
  const extractedMiiData = localStorage.getItem(storageURL);

  if (!extractedMiiData) {
    const errorMessage =
      'The Mii data is not currently stored. Please make a change to this Mii, revert the change, and refresh the page to try again.';

    alert(errorMessage);
    throw new Error(errorMessage);
  }

  return extractedMiiData;
}

function downloadMiiData(miiData, miiID) {
  const encodedMiiData = encodeURI(miiData);

  const downloadElement = document.createElement('a');

  downloadElement.href = `data:attachment/text,${encodedMiiData}`;

  downloadElement.target = '_blank';

  downloadElement.download = `${miiID}.txt`;

  downloadElement.click();
}
