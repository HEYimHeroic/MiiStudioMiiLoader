(() => {
	'use strict';

	const REQUEST = 'mii-studio-mii-loader:page';
	const HEX_ID = /^[a-f0-9]{16}$/;

	chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		if (message?.type !== REQUEST) return;

		(async () => {
			const url = new URL(location.href);
			if (url.origin !== 'https://studio.mii.nintendo.com') return { status: 'wrong-page' };
			if (/^\/miis\/new\/?$/.test(url.pathname)) {
				return { status: message.action === 'read' ? 'new' : 'wrong-page' };
			}

			const editPage = /^\/miis\/([^/]+)\/edit\/?$/.exec(url.pathname);
			if (!editPage) return { status: 'wrong-page' };
			const clientId = url.searchParams.get('client_id');
			if (!HEX_ID.test(editPage[1]) || !HEX_ID.test(clientId ?? '')) {
				return { status: 'missing-id' };
			}

			const exactKey = encodeURIComponent(location.href);
			const canonicalKey = encodeURIComponent(`${url.origin}/miis/${editPage[1]}/edit?client_id=${clientId}`);
			if (message.action === 'write') {
				if ((message.key !== exactKey && message.key !== canonicalKey)
					|| typeof message.value !== 'string' || !/^(?:[a-f0-9]{2})+$/i.test(message.value)) {
					return { status: 'invalid-key' };
				}
				localStorage.setItem(message.key, message.value);
				return { status: 'written' };
			}
			if (message.action !== 'read') return { status: 'invalid-action' };

			for (let attempt = 0; attempt < 20; attempt++) {
				const exactData = localStorage.getItem(exactKey);
				if (exactData) return { status: 'ready', key: exactKey, data: exactData };
				const canonicalData = localStorage.getItem(canonicalKey);
				if (canonicalData) return { status: 'ready', key: canonicalKey, data: canonicalData };

				let hydrationResult;
				const onHydrationResult = event => { hydrationResult = event.detail; };
				document.addEventListener('mii-studio-mii-loader:hydrate-result', onHydrationResult);
				document.dispatchEvent(new Event('mii-studio-mii-loader:hydrate-request'));
				document.removeEventListener('mii-studio-mii-loader:hydrate-result', onHydrationResult);

				const hydratedData = localStorage.getItem(exactKey);
				if (hydratedData) return { status: 'ready', key: exactKey, data: hydratedData };
				const fallbackData = localStorage.getItem(canonicalKey);
				if (fallbackData) return { status: 'ready', key: canonicalKey, data: fallbackData };
				if (hydrationResult === 'no-data' || hydrationResult === 'error') {
					return { status: 'missing-data' };
				}
				await new Promise(resolve => setTimeout(resolve, 100));
			}
			return { status: 'missing-data' };
		})().then(sendResponse, error => {
			console.warn('Could not access the current Mii Studio page.', error);
			sendResponse({ status: 'error' });
		});
		return true;
	});
})();
