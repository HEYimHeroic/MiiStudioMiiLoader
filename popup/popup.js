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
let exportFormatPanel;
let exportFormatOptionsContainer;
let exportFormatSelect;
let exportFormatOptions = [];
let themeToggleButton;

const THEME_STORAGE_KEY = 'mii-studio-mii-loader-theme';
const MII_STUDIO_URL_REGEX = /https:\/\/studio\.mii\.nintendo\.com\/miis\/([a-f0-9]{16})\/edit\?client_id=([a-f0-9]{16})/;
const IS_HEX_REGEX = /^[a-f\d\s]+$/i;
const IS_B64_REGEX = /^((([a-z\d+/]{4})*)([a-z\d+/]{4}|[a-z\d+/]{3}=|[a-z\d+/]{2}==))$/i;
const QR_EXPORT_OVERLAY_FRACTION = 0.3;
const QR_EXPORT_OUTLINE_WIDTH = 4;
const MII_EXPORT_DEFAULTS = {
	creatorMac: '732F6D6E6D73',
	creatorName: 'Mii Loader',
	name: 'Mii Studio',
	systemId: '6D69692E746F6F6C'
};

let miijsPromise;
let qrIconPromise;

function getStoredTheme() {
	const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
	return storedTheme === 'dark' || storedTheme === 'light'
		? storedTheme
		: '';
}

function getPreferredTheme() {
	const storedTheme = getStoredTheme();
	if (storedTheme) {
		return storedTheme;
	}

	return 'light';
}

function applyTheme(theme) {
	const nextTheme = theme === 'dark' ? 'dark' : 'light';
	const isDark = nextTheme === 'dark';

	document.documentElement.dataset.theme = nextTheme;

	if (!themeToggleButton) {
		return;
	}

	themeToggleButton.setAttribute('aria-checked', String(isDark));
	themeToggleButton.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
	themeToggleButton.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
}

function initThemeToggle() {
	themeToggleButton = document.getElementById('theme-toggle');
	applyTheme(getPreferredTheme());

	if (!themeToggleButton) {
		return;
	}

	themeToggleButton.addEventListener('click', () => {
		const nextTheme = document.documentElement.dataset.theme === 'dark'
			? 'light'
			: 'dark';
		localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
		applyTheme(nextTheme);
	});
}

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

function withMiiExportDefaults(decodedMii) {
	const exportMii = structuredClone(decodedMii);
	exportMii.meta = {
		...(exportMii.meta ?? {}),
		...MII_EXPORT_DEFAULTS
	};
	return exportMii;
}

async function getQrIconData() {
	if (!qrIconPromise) {
		qrIconPromise = fetch(chrome.runtime.getURL('images/icon-full.png'))
			.then(response => {
				if (!response.ok) {
					throw new Error(`Could not load QR icon: ${response.status}`);
				}

				return response.arrayBuffer();
			})
			.then(arrayBuffer => new Uint8Array(arrayBuffer));
	}

	return qrIconPromise;
}

async function getQrExportOptions() {
	return {
		image: await getQrIconData(),
		noRenderMii: true,
		overlayFrac: QR_EXPORT_OVERLAY_FRACTION
	};
}

function getQrModuleBounds(imageData) {
	let minX = imageData.width;
	let minY = imageData.height;
	let maxX = -1;
	let maxY = -1;
	const { data, width, height } = imageData;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const offset = (y * width + x) * 4;
			const alpha = data[offset + 3];
			const red = data[offset];
			const green = data[offset + 1];
			const blue = data[offset + 2];

			if (alpha > 32 && red < 48 && green < 48 && blue < 48) {
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
		}
	}

	if (maxX === -1 || maxY === -1) {
		return null;
	}

	return { minX, minY, maxX, maxY };
}

async function drawQrOutline(qrPngData) {
	const qrBytes = toUint8Array(qrPngData);
	const qrBitmap = await createImageBitmap(new Blob([qrBytes], { type: 'image/png' }));
	const canvas = document.createElement('canvas');
	canvas.width = qrBitmap.width;
	canvas.height = qrBitmap.height;

	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Could not create a canvas context for QR outline.');
	}

	context.drawImage(qrBitmap, 0, 0);

	const qrBounds = getQrModuleBounds(context.getImageData(0, 0, canvas.width, canvas.height));
	const minimumQuietZone = qrBounds
		? Math.min(
			qrBounds.minX,
			qrBounds.minY,
			canvas.width - qrBounds.maxX - 1,
			canvas.height - qrBounds.maxY - 1
		)
		: QR_EXPORT_OUTLINE_WIDTH;
	const halfLineWidth = QR_EXPORT_OUTLINE_WIDTH / 2;
	const outlineInset = Math.max(halfLineWidth, minimumQuietZone / 2);
	const outlineSize = Math.min(canvas.width, canvas.height) - (outlineInset * 2);
	const outlineOffsetX = (canvas.width - outlineSize) / 2;
	const outlineOffsetY = (canvas.height - outlineSize) / 2;

	context.strokeStyle = '#000000';
	context.lineWidth = QR_EXPORT_OUTLINE_WIDTH;
	context.strokeRect(
		outlineOffsetX,
		outlineOffsetY,
		outlineSize,
		outlineSize
	);

	qrBitmap.close?.();

	const outlinedBlob = await new Promise((resolve, reject) => {
		canvas.toBlob(blob => {
			if (blob) {
				resolve(blob);
				return;
			}

			reject(new Error('Could not render the outlined QR PNG.'));
		}, 'image/png');
	});

	return new Uint8Array(await outlinedBlob.arrayBuffer());
}

async function convertPngToJpeg(pngData) {
	const pngBytes = toUint8Array(pngData);
	const imageBitmap = await createImageBitmap(new Blob([pngBytes], { type: 'image/png' }));
	const canvas = document.createElement('canvas');
	canvas.width = imageBitmap.width;
	canvas.height = imageBitmap.height;

	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Could not create a canvas context for JPG export.');
	}

	context.fillStyle = '#ffffff';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.drawImage(imageBitmap, 0, 0);
	imageBitmap.close?.();

	const jpegBlob = await new Promise((resolve, reject) => {
		canvas.toBlob(blob => {
			if (blob) {
				resolve(blob);
				return;
			}

			reject(new Error('Could not convert the QR PNG to JPG.'));
		}, 'image/jpeg', 0.95);
	});

	return new Uint8Array(await jpegBlob.arrayBuffer());
}

async function makeQrExport(qrData) {
	const qrPng = await miijs.makeQR(qrData, await getQrExportOptions());
	return await drawQrOutline(qrPng);
}

async function buildExportPayload(decodedMii, exportFormat) {
	const exportMii = withMiiExportDefaults(decodedMii);

	if (exportFormat === 'PNG_3DS' || exportFormat === 'JPG_3DS') {
		const qrData = await miijs.encodeMii(
			exportMii,
			exportMii?.hasOwnProperty('tl') ? miijs.MiiFormats.TLE : miijs.MiiFormats.CFED
		);
		const qrPng = await makeQrExport(qrData);
		return exportFormat === 'JPG_3DS'
			? await convertPngToJpeg(qrPng)
			: qrPng;
	}

	if (exportFormat === 'PNG_WIIU') {
		const qrData = await miijs.encodeMii(exportMii, miijs.MiiFormats.FFED);
		return await makeQrExport(qrData);
	}

	return await miijs.encodeMii(exportMii, miijs.MiiFormats[exportFormat]);
}

function getExportConfig(exportFormat) {
	const extension = exportFormat.includes("_")
		? exportFormat.toLowerCase().split("_")[0]
		: exportFormat.toLowerCase();

	if (extension === 'png') {
		return { extension, mimeType: 'image/png' };
	}

	if (extension === 'jpg') {
		return { extension, mimeType: 'image/jpeg' };
	}

	return { extension, mimeType: 'application/octet-stream' };
}

function getVisibleExportFormatOptionButtons() {
	if (!exportFormatOptionsContainer) {
		return [];
	}

	return Array.from(exportFormatOptionsContainer.querySelectorAll('.format-select-option'));
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

function closeExportFormatDropdown() {
	if (!exportFormatPanel || !exportFormatButton) {
		return;
	}

	exportFormatPanel.hidden = true;
	exportFormatButton.setAttribute('aria-expanded', 'false');
	clearExportFormatOptions();
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

function renderExportFormatOptions() {
	if (!exportFormatSelect || !exportFormatOptionsContainer) {
		return;
	}

	const currentValue = exportFormatSelect.value;

	exportFormatOptionsContainer.replaceChildren();

	for (const option of exportFormatOptions) {
		const optionElement = document.createElement('button');
		optionElement.type = 'button';
		optionElement.className = 'format-select-option';
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
					exportFormatButton.focus();
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

function initExportFormatDropdown() {
	exportFormatDropdown = document.getElementById('export-format-dropdown');
	exportFormatButton = document.getElementById('export-format-button');
	exportFormatPanel = document.getElementById('export-format-panel');
	exportFormatOptionsContainer = document.getElementById('export-format-options');
	exportFormatSelect = document.getElementById('export-format-select');

	if (!exportFormatDropdown || !exportFormatButton || !exportFormatPanel || !exportFormatOptionsContainer || !exportFormatSelect) {
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
		renderExportFormatOptions();
		setTimeout(() => {
			const selectedIndex = exportFormatOptions.findIndex(option => option.value === exportFormatSelect.value);
			focusExportFormatOption(selectedIndex === -1 ? 0 : selectedIndex);
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
	initThemeToggle();
	initExportFormatDropdown();
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
		const exportConfig = getExportConfig(exportFormat);

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
