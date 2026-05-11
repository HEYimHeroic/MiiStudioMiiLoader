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

let miiStudioStorageKey;
let miijs;
let exportFormatDropdown;
let exportFormatButton;
let exportFormatSearchInput;
let exportFormatPanel;
let exportFormatOptionsContainer;
let exportFormatSelect;
let exportFormatOptions = [];

const MII_STUDIO_URL_REGEX = /https:\/\/studio\.mii\.nintendo\.com\/miis\/([a-f0-9]{16})\/edit\?client_id=([a-f0-9]{16})/;
const IS_HEX_REGEX = /^[a-f\d\s]+$/i;
const IS_B64_REGEX = /^((([a-z\d+/]{4})*)([a-z\d+/]{4}|[a-z\d+/]{3}=|[a-z\d+/]{2}==))$/i;
const QR_EXPORT_OPTIONS = { noRenderMii: true };

let miijsPromise;

async function getMiijs() {
	if (!miijsPromise) {
		miijsPromise = import(chrome.runtime.getURL('miijs.browser.js'))
			.then(module => module.default)
			.catch(error => {
				console.error('Failed to load miijs.browser.js', error);
				throw error;
			});
	}

	return miijsPromise;
}

async function getCurrentTab() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab;
}

async function executeOnCurrentTab(func, args = []) {
	const [{ result }] = await chrome.scripting.executeScript({
		args,
		target: {
			tabId: currentTab.id
		},
		func
	});

	return result;
}

async function getPageLocalStorage(key) {
	return executeOnCurrentTab(function(storageKey) {
		return localStorage.getItem(storageKey);
	}, [key]);
}

async function setPageLocalStorage(key, value) {
	await executeOnCurrentTab(function(storageKey, storageValue) {
		localStorage.setItem(storageKey, storageValue);
	}, [key, value]);
}

function normaliseDropdownFilterText(text) {
	return text
		.toLowerCase()
		.replaceAll('/', ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function getCurrentStudioMiiData() {
	return miiStudioMiiDataDiv?.textContent?.trim() ?? '';
}

function normaliseStudioMiiData(value) {
	let miiData = value?.trim() ?? '';

	if (!miiData) {
		return '';
	}

	if (!IS_HEX_REGEX.test(miiData)) {
		const base64MiiData = miiData.replaceAll(" ","");
		if (!IS_B64_REGEX.test(base64MiiData)) {
			return '';
		}
		const decodedBytes = Uint8Array.from(atob(base64MiiData), character => character.charCodeAt(0));
		miiData = Array.from(decodedBytes, byte => byte.toString(16).padStart(2, '0')).join('');
	}

	return miiData.replaceAll(" ","");
}

function toUint8Array(data) {
	if (data instanceof Uint8Array) {
		return data;
	}
	if (data instanceof ArrayBuffer) {
		return new Uint8Array(data);
	}
	if (ArrayBuffer.isView(data)) {
		return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	}
	return new Uint8Array(data);
}

function triggerFileDownload(fileName, data, mimeType) {
	const fileBytes = toUint8Array(data);
	const blob = new Blob([fileBytes], { type: mimeType });
	const downloadUrl = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = downloadUrl;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

async function buildExportPayload(decodedMii, exportFormat) {
	if (exportFormat === 'PNG_3DS') {
		const qrData = await miijs.encodeMii(
			decodedMii,
			decodedMii?.hasOwnProperty('tl') ? miijs.MiiFormats.TLE : miijs.MiiFormats.CFED
		);
		return await miijs.makeQR(qrData, QR_EXPORT_OPTIONS);
	}

	if (exportFormat === 'PNG_WIIU') {
		const qrData = await miijs.encodeMii(decodedMii, miijs.MiiFormats.FFED);
		return await miijs.makeQR(qrData, QR_EXPORT_OPTIONS);
	}

	return await miijs.encodeMii(decodedMii, miijs.MiiFormats[exportFormat]);
}

function getVisibleExportFormatOptionButtons() {
	if (!exportFormatOptionsContainer) {
		return [];
	}

	return Array.from(exportFormatOptionsContainer.querySelectorAll('.searchable-select-option'));
}

function focusExportFormatOption(index) {
	const optionButtons = getVisibleExportFormatOptionButtons();
	if (optionButtons.length === 0) {
		return;
	}

	const boundedIndex = Math.max(0, Math.min(index, optionButtons.length - 1));
	optionButtons[boundedIndex].focus();
}

function clearExportFormatOptions() {
	if (!exportFormatOptionsContainer) {
		return;
	}

	exportFormatOptionsContainer.replaceChildren();
}

function closeExportFormatDropdown({ resetFilter = true } = {}) {
	if (!exportFormatPanel || !exportFormatButton) {
		return;
	}

	exportFormatPanel.hidden = true;
	exportFormatButton.setAttribute('aria-expanded', 'false');
	clearExportFormatOptions();

	if (resetFilter && exportFormatSearchInput) {
		exportFormatSearchInput.value = '';
	}
}

function setSelectedExportFormat(value) {
	if (!exportFormatSelect || !exportFormatButton) {
		return;
	}

	const selectedOption = Array.from(exportFormatSelect.options).find(option => option.value === value);
	if (!selectedOption) {
		return;
	}

	exportFormatSelect.value = selectedOption.value;
	exportFormatButton.textContent = selectedOption.textContent;
}

function renderExportFormatOptions(filterText = '') {
	if (!exportFormatSelect || !exportFormatOptionsContainer) {
		return;
	}

	const currentValue = exportFormatSelect.value;
	const normalisedFilter = normaliseDropdownFilterText(filterText);
	const matchingOptions = exportFormatOptions.filter(option => {
		if (!normalisedFilter) {
			return true;
		}

		return normaliseDropdownFilterText(option.text).includes(normalisedFilter);
	});

	exportFormatOptionsContainer.replaceChildren();

	if (matchingOptions.length === 0) {
		const emptyState = document.createElement('div');
		emptyState.className = 'searchable-select-empty';
		emptyState.textContent = 'No formats found.';
		exportFormatOptionsContainer.appendChild(emptyState);
		return;
	}

	for (const option of matchingOptions) {
		const optionElement = document.createElement('button');
		optionElement.type = 'button';
		optionElement.className = 'searchable-select-option';
		if (option.value === currentValue) {
			optionElement.classList.add('is-selected');
		}
		optionElement.textContent = option.text;
		optionElement.dataset.value = option.value;
		optionElement.setAttribute('role', 'option');
		optionElement.setAttribute('aria-selected', option.value === currentValue ? 'true' : 'false');
		optionElement.addEventListener('click', () => {
			setSelectedExportFormat(option.value);
			closeExportFormatDropdown();
		});
		optionElement.addEventListener('keydown', event => {
			const optionButtons = getVisibleExportFormatOptionButtons();
			const currentIndex = optionButtons.indexOf(optionElement);

			if (event.key === 'ArrowDown') {
				event.preventDefault();
				focusExportFormatOption(currentIndex + 1);
				return;
			}

			if (event.key === 'ArrowUp') {
				event.preventDefault();
				if (currentIndex <= 0) {
					exportFormatSearchInput.focus();
					return;
				}
				focusExportFormatOption(currentIndex - 1);
				return;
			}

			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				optionElement.click();
				return;
			}

			if (event.key === 'Escape') {
				event.preventDefault();
				closeExportFormatDropdown();
				exportFormatButton.focus();
			}
		});
		exportFormatOptionsContainer.appendChild(optionElement);
	}
}

function initExportFormatSearch() {
	exportFormatDropdown = document.getElementById('export-format-dropdown');
	exportFormatButton = document.getElementById('export-format-button');
	exportFormatSearchInput = document.getElementById('export-format-search');
	exportFormatPanel = document.getElementById('export-format-panel');
	exportFormatOptionsContainer = document.getElementById('export-format-options');
	exportFormatSelect = document.getElementById('export-format-select');

	if (!exportFormatDropdown || !exportFormatButton || !exportFormatSearchInput || !exportFormatPanel || !exportFormatOptionsContainer || !exportFormatSelect) {
		return;
	}

	exportFormatOptions = Array.from(exportFormatSelect.options).map(option => ({
		text: option.textContent,
		value: option.value
	}));

	setSelectedExportFormat(exportFormatSelect.value);
	clearExportFormatOptions();

	exportFormatButton.addEventListener('click', () => {
		if (!exportFormatPanel.hidden) {
			closeExportFormatDropdown();
			return;
		}

		exportFormatPanel.hidden = false;
		exportFormatButton.setAttribute('aria-expanded', 'true');
		exportFormatSearchInput.value = '';
		renderExportFormatOptions();
		setTimeout(() => {
			exportFormatSearchInput.focus();
		}, 0);
	});

	exportFormatButton.addEventListener('keydown', event => {
		if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (exportFormatPanel.hidden) {
				exportFormatButton.click();
			}
		}
	});

	exportFormatSearchInput.addEventListener('input', event => {
		renderExportFormatOptions(event.target.value);
	});

	exportFormatSearchInput.addEventListener('keydown', event => {
		if (event.key === 'Escape') {
			closeExportFormatDropdown();
			exportFormatButton.focus();
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			focusExportFormatOption(0);
		}
	});

	document.addEventListener('click', event => {
		if (!exportFormatDropdown.contains(event.target)) {
			closeExportFormatDropdown();
		}
	});
}

function initPopupWheelScrolling() {
	document.addEventListener('wheel', event => {
		if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
			return;
		}

		const target = event.target instanceof Element
			? event.target
			: null;
		if (!target) {
			return;
		}

		const isExportDropdownOpen = exportFormatPanel && !exportFormatPanel.hidden;
		if (isExportDropdownOpen && exportFormatOptionsContainer?.contains(target)) {
			return;
		}

		const scrollElement = document.scrollingElement || document.documentElement;
		if (!scrollElement || scrollElement.scrollHeight <= scrollElement.clientHeight) {
			return;
		}

		const previousScrollTop = scrollElement.scrollTop;
		scrollElement.scrollTop += event.deltaY;

		if (scrollElement.scrollTop !== previousScrollTop) {
			event.preventDefault();
		}
	}, { passive: false });
}

async function initPopup() {
	loadingDiv = document.querySelector('#loading');
	notValidURLDiv = document.querySelector('#not-valid-url');
	initExportFormatSearch();
	initPopupWheelScrolling();

	try {
		currentTab = await getCurrentTab();

		if (!MII_STUDIO_URL_REGEX.test(currentTab?.url ?? '')) {
			notValidURLDiv.hidden = false;
			return;
		}

		await initMiiStudio();
	}
	catch (error) {
		console.error('Failed to initialize popup', error);
		notValidURLDiv.hidden = false;
		const errorHeading = notValidURLDiv.querySelector('h2');
		if (errorHeading) {
			errorHeading.textContent = 'The popup failed to initialize. Check the popup console for details and try again.';
		}
	}
	finally {
		loadingDiv.hidden = true;
	}

	getMiijs()
		.then(loadedMiijs => {
			miijs = loadedMiijs;
		})
		.catch(error => {
			console.error('miijs is unavailable in popup.js', error);
		});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initPopup, { once: true });
}
else {
	initPopup();
}

async function initMiiStudio() {
	miiStudioDiv = document.querySelector('#mii-studio');
	miiStudioNoMiiIDOrClientIDWarningDiv = miiStudioDiv.querySelector('#no-mii-id-or-client-id');
	miiStudioNoMiiDataWarningDiv = miiStudioDiv.querySelector('#no-mii-data-warning');
	miiStudioContentDiv = miiStudioDiv.querySelector('.content');
	miiStudioMiiDataDiv = miiStudioContentDiv.querySelector('#mii-data');
	newMiiStudioDataInput = miiStudioContentDiv.querySelector('#new-mii-studio-data');
	updateMiiStudioDataButton = miiStudioContentDiv.querySelector('#update-mii-studio-data');

	miiStudioDiv.hidden=false;

	const regexResult = MII_STUDIO_URL_REGEX.exec(currentTab.url);

	if (regexResult.length !== 3) {
		miiStudioNoMiiIDOrClientIDWarningDiv.hidden=false;
		return;
	}

	const [, miiStudioMiiID, miiStudioClientID] = regexResult;
	miiStudioStorageKey = `https%3A%2F%2Fstudio.mii.nintendo.com%2Fmiis%2F${miiStudioMiiID}%2Fedit%3Fclient_id%3D${miiStudioClientID}`;

	const miiData = await getPageLocalStorage(miiStudioStorageKey);

	if (!miiData) {
		miiStudioNoMiiDataWarningDiv.hidden=false;
		return;
	}

	miiStudioContentDiv.querySelector('form')?.addEventListener('submit', event => {
		event.preventDefault();
	});

	miiStudioContentDiv.hidden=false;

	miiStudioMiiDataDiv.textContent = miiData;
	updateMiiStudioDataButton.addEventListener('click', updateMiiStudioData);
}

async function updateMiiStudioData() {
	const newMiiData = normaliseStudioMiiData(newMiiStudioDataInput.value);

	if (
		!newMiiData
		|| newMiiData.length % 2 !== 0
		|| !IS_HEX_REGEX.test(newMiiData)
	) {
		alert('Invalid Mii Data');
		return;
	}

	await setPageLocalStorage(miiStudioStorageKey, newMiiData);

	alert('Accept the reload and click "Continue editing" after the page reloads');

	chrome.tabs.reload(currentTab.id);
}

document.getElementById("copyHex").addEventListener('click',()=>{
	navigator.clipboard.writeText(getCurrentStudioMiiData());
});
document.getElementById("copyB64").addEventListener('click',()=>{
	const currentStudioMiiData = getCurrentStudioMiiData().replaceAll(" ","");
	let copied=new Uint8Array(
		currentStudioMiiData.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
	);
	copied=btoa(String.fromCharCode(...copied));
	navigator.clipboard.writeText(copied);
});

document.getElementById("impFile").addEventListener('click',async ()=>{
	const inputFile = document.getElementById("fileInp").files?.[0];
	if (!inputFile) {
		return;
	}

	try {
		miijs ??= await getMiijs();

		let decodedInput = new Uint8Array(await inputFile.arrayBuffer());
		const isImageFile = inputFile.type.startsWith('image/')
			|| /\.(png|jpe?g)$/i.test(inputFile.name);

		if (isImageFile) {
			const scannedMii = await miijs.scanQR(inputFile);
			if (!scannedMii) {
				throw new Error('MiiJS could not decode a QR from the selected image.');
			}
			decodedInput = scannedMii;
		}

		const decodedMii = await miijs.decodeMii(decodedInput);
		const studioMiiData = (await miijs.encodeMii(decodedMii, miijs.MiiFormats.MNMS)).toString('hex');
		newMiiStudioDataInput.value = studioMiiData;
		updateMiiStudioDataButton.click();
	}
	catch (error) {
		console.error('Failed to decode uploaded Mii file', error);
	}
});

document.getElementById("download").addEventListener('click',async ()=>{
	try {
		miijs ??= await getMiijs();

		const currentMiiData = getCurrentStudioMiiData();
		if (!currentMiiData) {
			throw new Error('No Mii Studio data is loaded to export.');
		}

		const exportFormat = exportFormatSelect?.value ?? 'MNMS';
		const exportConfig ={
			extension: exportFormat.includes("_")?exportFormat.toLowerCase().split("_")[0]:exportFormat.toLowerCase(),
			mimeType: exportFormat.includes("PNG")?`image/png`:`application/octet-stream`
		};
		if (!exportConfig) {
			throw new Error(`Unsupported export format: ${exportFormat}`);
		}

		const decodedMii = await miijs.decodeMii(currentMiiData);
		const exportedData = await buildExportPayload(decodedMii, exportFormat);
		triggerFileDownload(
			`mii.${exportConfig.extension}`,
			exportedData,
			exportConfig.mimeType
		);
	}
	catch (error) {
		console.error('Failed to export Mii file', error);
		alert('Failed to export the current Mii. Check the popup console for details.');
	}
});
