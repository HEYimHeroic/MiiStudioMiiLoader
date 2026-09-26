(() => {
	'use strict';

	document.addEventListener('mii-studio-mii-loader:hydrate-request', () => {
		let result = 'unavailable';
		try {
			const key = encodeURIComponent(location.href);
			if (localStorage.getItem(key)) {
				result = 'already-present';
			} else {
				const canvas = document.querySelector('canvas#canvas');
				const visited = new Set();
				for (let element = canvas; element && result === 'unavailable'; element = element.parentElement) {
					for (let editor = element.__vue__; editor && !visited.has(editor); editor = editor.$parent) {
						visited.add(editor);
						if (editor.isPartsPage !== true || !editor.history?.current
							|| typeof editor.onPartsUpdated !== 'function') continue;
						editor.onPartsUpdated(editor.history.current);
						result = localStorage.getItem(key) ? 'hydrated' : 'no-data';
						break;
					}
				}
			}
		} catch (error) {
			console.warn('Could not load the current Mii into local storage.', error);
			result = 'error';
		}
		document.dispatchEvent(new CustomEvent('mii-studio-mii-loader:hydrate-result', { detail: result }));
	});
})();
