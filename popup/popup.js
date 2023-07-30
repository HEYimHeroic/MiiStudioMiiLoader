let loadingDiv;
let notValidURLDiv;
let miiStudioDiv;
let miiStudioNoMiiIDOrClientIDWarningDiv;
let miiStudioNoMiiDataWarningDiv;
let miiStudioContentDiv;
let miiStudioMiiDataDiv;
let newMiiStudioDataInput;
let updateMiiStudioDataButton;

let currentTab;

let miiStudioMiiID;
let miiStudioClientID;
let miiStudioStorageKey;

const MII_STUDIO_URL_REGEX = /https:\/\/studio\.mii\.nintendo\.com\/miis\/([a-f0-9]{16})\/edit\?client_id=([a-f0-9]{16})/;
const IS_HEX_REGEX = /^[A-Fa-f0-9]+$/;

async function getCurrentTab() {
	const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
	return tabs[0];
}

async function getPageLocalStorage(key) {
	const response = await chrome.scripting.executeScript({
		args: [key],
		target: {
			tabId: currentTab.id
		},
		func: function(key) {
			return localStorage.getItem(key);
		}
	});

	return response[0]?.result;
}

async function setPageLocalStorage(key, value) {
	await chrome.scripting.executeScript({
		args: [key, value],
		target: {
			tabId: currentTab.id
		},
		func: function(key, value) {
			localStorage.setItem(key, value);
		}
	});
}

document.addEventListener('DOMContentLoaded', async () => {
	loadingDiv = document.querySelector('#loading');
	notValidURLDiv = document.querySelector('#not-valid-url');

	currentTab = await getCurrentTab();

	loadingDiv.classList.add('hidden');

	if (!MII_STUDIO_URL_REGEX.test(currentTab.url)) {
		notValidURLDiv.classList.remove('hidden');
		return;
	}

	initMiiStudio();
});

async function initMiiStudio() {
	miiStudioDiv = document.querySelector('#mii-studio');
	miiStudioNoMiiIDOrClientIDWarningDiv = miiStudioDiv.querySelector('#no-mii-id-or-client-id');
	miiStudioNoMiiDataWarningDiv = miiStudioDiv.querySelector('#no-mii-data-warning');
	miiStudioContentDiv = miiStudioDiv.querySelector('.content');
	miiStudioMiiDataDiv = miiStudioContentDiv.querySelector('#mii-data');
	newMiiStudioDataInput = miiStudioContentDiv.querySelector('#new-mii-studio-data');
	updateMiiStudioDataButton = miiStudioContentDiv.querySelector('#update-mii-studio-data');

	miiStudioDiv.classList.remove('hidden');

	const regexResult = MII_STUDIO_URL_REGEX.exec(currentTab.url);

	if (regexResult.length !== 3) {
		miiStudioNoMiiIDOrClientIDWarningDiv.classList.remove('hidden');
		return;
	}

	miiStudioMiiID = regexResult[1];
	miiStudioClientID = regexResult[2];
	miiStudioStorageKey = `https%3A%2F%2Fstudio.mii.nintendo.com%2Fmiis%2F${miiStudioMiiID}%2Fedit%3Fclient_id%3D${miiStudioClientID}`;

	const miiData = await getPageLocalStorage(miiStudioStorageKey);

	if (!miiData) {
		miiStudioNoMiiDataWarningDiv.classList.remove('hidden');
		return;
	}

	miiStudioContentDiv.classList.remove('hidden');

	miiStudioMiiDataDiv.innerHTML = miiData;
	updateMiiStudioDataButton.addEventListener('click', updateMiiStudioData);
}

async function updateMiiStudioData() {
	const newMiiData = newMiiStudioDataInput.value;

	if (!newMiiData || newMiiData.length !== 92 || !IS_HEX_REGEX.test(newMiiData)) {
		alert('Invalid Mii Data');
		return;
	}

	await setPageLocalStorage(miiStudioStorageKey, newMiiData);

	alert('Accept the reload and click "Continue editing" after the page reloads');

	chrome.tabs.reload(currentTab.id);
}