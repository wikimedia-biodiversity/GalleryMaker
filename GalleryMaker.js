/**
 * Gallery Maker — Wikimedia Commons user script
 * Select files on any Commons page and instantly generate copy-ready <gallery> code.
 *
 * Author:  Manoj Karingamadathil, Wikimedians of Kerala User Group
 * Script:  https://commons.wikimedia.org/wiki/User:Manojk/GalleryMaker.js
 * Source:  https://github.com/wikimedia-biodiversity/GalleryMaker
 * DOI:     https://doi.org/10.5281/zenodo.23852287
 * License: MIT license
 *
 * Adds "Gallery Maker" to the Tools menu. Click it on any page with files
 * (categories, galleries, Special:ListFiles / uploads by user, search results…),
 * pick the files you want, and get ready-to-paste <gallery> code.
 * The code is copied to your clipboard automatically (and via the Copy button).
 *
 * Features
 *  - Opens full-screen automatically on pages with many files (toggle with ⛶)
 *  - Views: Grid, Compact (thumbnails only), List
 *  - Thumbnail size slider (sharper thumbnails are loaded for larger sizes)
 *  - Filter by name, by file type, and by selected / unselected
 *  - Sort: page order, name A→Z / Z→A, file type, click order
 *  - Click a card or its checkbox; Shift-click selects a range
 *  - Gallery options: mode, widths, heights, per row, gallery title,
 *    per-file captions, show file names
 *  - Your settings are remembered between pages
 *
 * Install: add this line to your Commons common.js
 *   (https://commons.wikimedia.org/wiki/Special:MyPage/common.js):
 *   mw.loader.load('//commons.wikimedia.org/w/index.php?title=User:Manojk/GalleryMaker.js&action=raw&ctype=text/javascript');
 */
(function () {
	'use strict';

	var DIALOG_ID = 'gm-overlay';
	var SETTINGS_KEY = 'gm-settings';
	var LARGE_PAGE = 40; // open full-screen automatically above this many files
	var THUMB_STEPS = [60, 120, 250, 330, 500, 960]; // standard Wikimedia thumbnail widths
	var collator = (window.Intl && Intl.Collator) ?
		new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }) :
		{ compare: function (a, b) { return a < b ? -1 : a > b ? 1 : 0; } };

	var defaults = {
		view: 'grid', size: 150, sort: 'page',
		mode: 'traditional', widths: '', heights: '', perrow: '',
		caption: 'none', title: '', showfilename: false,
		autoCopy: true, codeOpen: true
	};
	var state = null;

	/* ---------- Start-up ---------- */

	function init() {
		if (document.getElementById('t-gallerymaker') || document.getElementById('gm-fab')) { return; }
		addStyles();

		var portlets = ['p-tb', 'p-cactions', 'p-navigation', 'p-personal'];
		var li = null;
		for (var i = 0; i < portlets.length && !li; i++) {
			if (document.getElementById(portlets[i])) {
				li = mw.util.addPortletLink(
					portlets[i], '#', 'Gallery Maker', 't-gallerymaker',
					'Select files on this page and generate <gallery> code'
				);
			}
		}
		var trigger = li;
		if (!li) {
			trigger = document.createElement('button');
			trigger.id = 'gm-fab';
			trigger.type = 'button';
			trigger.textContent = 'Gallery Maker';
			document.body.appendChild(trigger);
		}
		trigger.addEventListener('click', function (e) {
			e.preventDefault();
			openDialog();
		});
	}

	mw.loader.using(['mediawiki.util']).then(function () {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', init);
		} else {
			init();
		}
	});

	/* ---------- Settings ---------- */

	function loadSettings() {
		var s = {};
		try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { s = {}; }
		var out = {};
		Object.keys(defaults).forEach(function (k) { out[k] = (k in s) ? s[k] : defaults[k]; });
		return out;
	}

	function saveSettings() {
		try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.opt)); } catch (e) { /* ignore */ }
	}

	/* ---------- File collection ---------- */

	function fileNameFromHref(href) {
		try {
			var url = new URL(href, location.href);
			if (url.host !== location.host) { return null; }
			if (url.searchParams.has('action') || url.searchParams.has('oldid') || url.searchParams.has('diff')) { return null; }
			var t = url.searchParams.get('title');
			if (!t) {
				var m = url.pathname.match(/^\/wiki\/(.+)$/);
				if (!m) { return null; }
				t = decodeURIComponent(m[1]);
			}
			t = t.replace(/_/g, ' ');
			var m2 = t.match(/^(File|Image)\s*:\s*(.+)$/i);
			if (!m2) { return null; }
			var name = m2[2].trim();
			return /\.[a-z0-9]{2,5}$/i.test(name) ? name : null;
		} catch (e) {
			return null;
		}
	}

	function collectFiles() {
		var root = document.getElementById('bodyContent') ||
			document.getElementById('content') || document.body;
		var map = {};
		var list = [];
		root.querySelectorAll('a[href]').forEach(function (a) {
			var name = fileNameFromHref(a.getAttribute('href'));
			if (!name) { return; }
			var img = a.querySelector('img');
			var thumb = img ? (img.getAttribute('src') || '') : '';
			if (!map[name]) {
				map[name] = {
					name: name,
					lname: name.toLowerCase(),
					ext: (name.split('.').pop() || '').toLowerCase(),
					href: a.href,
					thumb: thumb,
					idx: list.length,
					selected: false,
					order: 0
				};
				list.push(map[name]);
			} else if (!map[name].thumb && thumb) {
				map[name].thumb = thumb;
			}
		});
		return list;
	}

	// Ask for a sharper thumbnail when the cards are big
	function thumbFor(f, px) {
		if (!f.thumb || !/\/thumb\//.test(f.thumb)) { return f.thumb; }
		var m = f.thumb.match(/(\d+)px-(?=[^\/]*$)/);
		if (!m) { return f.thumb; }
		var need = px * (window.devicePixelRatio || 1);
		var current = parseInt(m[1], 10);
		if (current >= need) { return f.thumb; }
		var step = THUMB_STEPS[THUMB_STEPS.length - 1];
		for (var i = 0; i < THUMB_STEPS.length; i++) {
			if (THUMB_STEPS[i] >= need) { step = THUMB_STEPS[i]; break; }
		}
		return step > current ? f.thumb.replace(/(\d+)px-(?=[^\/]*$)/, step + 'px-') : f.thumb;
	}

	/* ---------- Small DOM helper ---------- */

	function el(tag, attrs, children) {
		var node = document.createElement(tag);
		Object.keys(attrs || {}).forEach(function (k) {
			var v = attrs[k];
			if (k === 'text') { node.textContent = v; }
			else if (k === 'className') { node.className = v; }
			else if (k === 'checked' || k === 'value') { node[k] = v; }
			else { node.setAttribute(k, v); }
		});
		(children || []).forEach(function (c) { if (c) { node.appendChild(c); } });
		return node;
	}

	function $id(id) { return document.getElementById(id); }

	/* ---------- Dialog ---------- */

	function openDialog() {
		closeDialog();
		var files = collectFiles();
		state = {
			files: files,
			shown: [],
			opt: loadSettings(),
			filter: '',
			type: '',
			show: 'all',
			lastPos: null,
			clickSeq: 0,
			full: files.length > LARGE_PAGE
		};
		var o = state.opt;

		var overlay = el('div', { id: DIALOG_ID });
		var panel = el('div', { className: 'gm-panel', id: 'gm-panel', role: 'dialog', 'aria-label': 'Gallery Maker' });

		/* Header */
		var fullBtn = el('button', { type: 'button', className: 'gm-iconbtn', id: 'gm-fullbtn' });
		fullBtn.addEventListener('click', function () { setFull(!state.full); });
		var closeBtn = el('button', { type: 'button', className: 'gm-iconbtn', title: 'Close (Esc)', text: '×' });
		closeBtn.addEventListener('click', closeDialog);
		var header = el('div', { className: 'gm-header' }, [
			el('strong', { text: 'Gallery Maker' }),
			el('span', { className: 'gm-count', id: 'gm-count' }),
			fullBtn,
			closeBtn
		]);

		/* Row 1: find, filter, view */
		var search = el('input', { type: 'search', placeholder: 'Filter by name…', className: 'gm-search' });
		search.addEventListener('input', function () {
			state.filter = search.value.toLowerCase().trim();
			renderGrid();
		});

		var typeSel = el('select', { title: 'File type' }, [el('option', { value: '', text: 'All types' })]);
		var counts = {};
		files.forEach(function (f) { counts[f.ext] = (counts[f.ext] || 0) + 1; });
		Object.keys(counts).sort().forEach(function (x) {
			typeSel.appendChild(el('option', { value: x, text: x.toUpperCase() + ' (' + counts[x] + ')' }));
		});
		typeSel.addEventListener('change', function () { state.type = typeSel.value; renderGrid(); });

		var showSel = el('select', { title: 'Show' }, [
			el('option', { value: 'all', text: 'Show all' }),
			el('option', { value: 'sel', text: 'Selected only' }),
			el('option', { value: 'unsel', text: 'Not selected' })
		]);
		showSel.addEventListener('change', function () { state.show = showSel.value; renderGrid(); });

		var sortSel = el('select', { title: 'Order (also used in the gallery code)' }, [
			el('option', { value: 'page', text: 'Page order' }),
			el('option', { value: 'az', text: 'Name A → Z' }),
			el('option', { value: 'za', text: 'Name Z → A' }),
			el('option', { value: 'type', text: 'File type' }),
			el('option', { value: 'click', text: 'Click order' })
		]);
		sortSel.value = o.sort;
		sortSel.addEventListener('change', function () { o.sort = sortSel.value; saveSettings(); renderGrid(); updateCode(); });

		var viewGroup = el('div', { className: 'gm-seg', role: 'group', 'aria-label': 'View' });
		[['grid', 'Grid'], ['compact', 'Compact'], ['list', 'List']].forEach(function (v) {
			var b = el('button', { type: 'button', 'data-view': v[0], text: v[1] });
			b.addEventListener('click', function () { o.view = v[0]; saveSettings(); applyView(); });
			viewGroup.appendChild(b);
		});

		var sizeRange = el('input', { type: 'range', min: '60', max: '320', step: '10', id: 'gm-size', value: String(o.size) });
		var sizeVal = el('span', { className: 'gm-sizeval', id: 'gm-sizeval' });
		var sizeTimer;
		sizeRange.addEventListener('input', function () {
			o.size = parseInt(sizeRange.value, 10);
			applySize();
			clearTimeout(sizeTimer);
			sizeTimer = setTimeout(function () { saveSettings(); upgradeThumbs(); }, 300);
		});

		var row1 = el('div', { className: 'gm-row' }, [
			search, typeSel, showSel, sortSel, viewGroup,
			el('label', { className: 'gm-sizectl', title: 'Thumbnail size' }, [el('span', { text: 'Size' }), sizeRange, sizeVal])
		]);

		/* Row 2: selection */
		function selBtn(label, fn, title) {
			var b = el('button', { type: 'button', className: 'gm-btn', text: label, title: title || '' });
			b.addEventListener('click', function () { fn(); syncCards(); updateCode(); });
			return b;
		}
		var row2 = el('div', { className: 'gm-row' }, [
			el('span', { className: 'gm-label', text: 'Select (shown files):' }),
			selBtn('All', function () { state.shown.forEach(function (f) { setSel(f, true); }); }),
			selBtn('None', function () { state.shown.forEach(function (f) { setSel(f, false); }); }),
			selBtn('Invert', function () { state.shown.forEach(function (f) { setSel(f, !f.selected); }); }),
			selBtn('Clear all', function () { state.files.forEach(function (f) { setSel(f, false); }); }, 'Unselect every file, including hidden ones'),
			el('span', { className: 'gm-hint', text: 'Tip: Shift-click to select a range' })
		]);

		/* Row 3: gallery code options */
		var mode = el('select', {});
		['traditional', 'nolines', 'packed', 'packed-hover', 'packed-overlay', 'slideshow'].forEach(function (m) {
			mode.appendChild(el('option', { value: m, text: m }));
		});
		mode.value = o.mode;
		var widths = el('input', { type: 'number', min: '0', placeholder: 'auto', className: 'gm-num', value: o.widths });
		var heights = el('input', { type: 'number', min: '0', placeholder: 'auto', className: 'gm-num', value: o.heights });
		var perrow = el('input', { type: 'number', min: '0', placeholder: 'auto', className: 'gm-num', value: o.perrow, title: 'Only for traditional / nolines' });
		var caption = el('select', {}, [
			el('option', { value: 'none', text: 'None' }),
			el('option', { value: 'noext', text: 'Name (no extension)' }),
			el('option', { value: 'full', text: 'Full file name' }),
			el('option', { value: 'num', text: 'Numbered 1, 2, 3…' })
		]);
		caption.value = o.caption;
		var title = el('input', { type: 'text', placeholder: 'optional', className: 'gm-title', value: o.title });
		var showfn = el('input', { type: 'checkbox', checked: !!o.showfilename });
		var autoCopy = el('input', { type: 'checkbox', checked: !!o.autoCopy });

		function bind(ctrl, key, isCheck) {
			var h = function () {
				o[key] = isCheck ? ctrl.checked : ctrl.value;
				saveSettings();
				updateCode();
			};
			ctrl.addEventListener('change', h);
			ctrl.addEventListener('input', h);
		}
		bind(mode, 'mode'); bind(widths, 'widths'); bind(heights, 'heights'); bind(perrow, 'perrow');
		bind(caption, 'caption'); bind(title, 'title'); bind(showfn, 'showfilename', true); bind(autoCopy, 'autoCopy', true);

		function opt(label, control) {
			return el('label', { className: 'gm-opt' }, [el('span', { text: label }), control]);
		}
		function chk(label, control) {
			return el('label', { className: 'gm-opt gm-inline' }, [control, el('span', { text: label })]);
		}
		var row3 = el('div', { className: 'gm-row gm-options' }, [
			opt('Mode', mode),
			opt('Widths px', widths),
			opt('Heights px', heights),
			opt('Per row', perrow),
			opt('Captions', caption),
			opt('Gallery title', title),
			chk('Show file names', showfn),
			chk('Auto-copy', autoCopy)
		]);

		/* Grid */
		var grid = el('div', { className: 'gm-grid', id: 'gm-grid' });
		grid.addEventListener('click', onGridClick);

		/* Footer */
		var output = el('textarea', { className: 'gm-output', id: 'gm-output', readonly: 'readonly', rows: '6', spellcheck: 'false' });
		var copyBtn = el('button', { type: 'button', className: 'gm-btn gm-primary', text: 'Copy code' });
		copyBtn.addEventListener('click', function () { copyCode(true); });
		var codeToggle = el('button', { type: 'button', className: 'gm-btn', id: 'gm-codetoggle' });
		codeToggle.addEventListener('click', function () { o.codeOpen = !o.codeOpen; saveSettings(); applyCodeOpen(); });
		var footer = el('div', { className: 'gm-footer' }, [
			output,
			el('div', { className: 'gm-actions' }, [
				copyBtn, codeToggle,
				el('span', { className: 'gm-status', id: 'gm-status' }),
				el('a', {
					className: 'gm-credit',
					href: 'https://github.com/wikimedia-biodiversity/GalleryMaker-',
					target: '_blank',
					rel: 'noopener',
					title: 'Source code, DOI 10.5281/zenodo.23852287, MIT license',
					text: 'Gallery Maker · Wikimedians of Kerala · GitHub'
				})
			])
		]);

		[header, row1, row2, row3, grid, footer].forEach(function (n) { panel.appendChild(n); });
		overlay.appendChild(panel);
		overlay.addEventListener('click', function (e) { if (e.target === overlay) { closeDialog(); } });
		document.body.appendChild(overlay);
		document.documentElement.classList.add('gm-noscroll');
		document.addEventListener('keydown', onKey);

		setFull(state.full);
		applyView();
		applySize();
		applyCodeOpen();
		renderGrid();
		updateCode();
		search.focus();
	}

	function closeDialog() {
		var ov = $id(DIALOG_ID);
		if (ov) { ov.remove(); }
		document.documentElement.classList.remove('gm-noscroll');
		document.removeEventListener('keydown', onKey);
	}

	function onKey(e) {
		if (e.key === 'Escape') { closeDialog(); }
	}

	function setFull(on) {
		state.full = on;
		$id('gm-panel').classList.toggle('gm-full', on);
		var b = $id('gm-fullbtn');
		b.textContent = on ? '⧉' : '⛶';
		b.title = on ? 'Exit full screen' : 'Full screen';
	}

	function applyView() {
		var grid = $id('gm-grid');
		grid.classList.remove('gm-v-grid', 'gm-v-compact', 'gm-v-list');
		grid.classList.add('gm-v-' + state.opt.view);
		document.querySelectorAll('#gm-overlay .gm-seg button').forEach(function (b) {
			b.classList.toggle('gm-on', b.getAttribute('data-view') === state.opt.view);
		});
	}

	function applySize() {
		$id('gm-grid').style.setProperty('--gm-size', state.opt.size + 'px');
		$id('gm-sizeval').textContent = state.opt.size + 'px';
	}

	function applyCodeOpen() {
		$id('gm-output').style.display = state.opt.codeOpen ? '' : 'none';
		$id('gm-codetoggle').textContent = state.opt.codeOpen ? 'Hide code' : 'Show code';
	}

	/* ---------- Sorting / filtering ---------- */

	function sortList(arr, key) {
		var by = {
			page: function (a, b) { return a.idx - b.idx; },
			az: function (a, b) { return collator.compare(a.name, b.name); },
			za: function (a, b) { return collator.compare(b.name, a.name); },
			type: function (a, b) { return collator.compare(a.ext, b.ext) || collator.compare(a.name, b.name); },
			click: function (a, b) { return (a.order || Infinity) - (b.order || Infinity) || a.idx - b.idx; }
		};
		return arr.sort(by[key] || by.page);
	}

	function computeShown() {
		var q = state.filter, t = state.type, s = state.show;
		var arr = state.files.filter(function (f) {
			if (q && f.lname.indexOf(q) === -1) { return false; }
			if (t && f.ext !== t) { return false; }
			if (s === 'sel' && !f.selected) { return false; }
			if (s === 'unsel' && f.selected) { return false; }
			return true;
		});
		// In click order, keep page order on screen and show numbers on the cards
		return sortList(arr, state.opt.sort === 'click' ? 'page' : state.opt.sort);
	}

	/* ---------- Grid ---------- */

	function renderGrid() {
		var grid = $id('gm-grid');
		if (!grid) { return; }
		grid.textContent = '';
		state.shown = computeShown();
		state.lastPos = null;

		if (!state.files.length) {
			grid.appendChild(el('p', { className: 'gm-empty', text: 'No file links found on this page.' }));
			updateCount();
			return;
		}
		if (!state.shown.length) {
			grid.appendChild(el('p', { className: 'gm-empty', text: 'No files match the filters.' }));
			updateCount();
			return;
		}

		var frag = document.createDocumentFragment();
		state.shown.forEach(function (f, pos) {
			var src = thumbFor(f, state.opt.size);
			var thumb;
			if (src) {
				thumb = el('img', { src: src, alt: '', loading: 'lazy', decoding: 'async' });
				if (src !== f.thumb) {
					thumb.addEventListener('error', function onErr() {
						thumb.removeEventListener('error', onErr);
						thumb.src = f.thumb;
					});
				}
			} else {
				thumb = el('div', { className: 'gm-nothumb', text: f.ext.toUpperCase() });
			}
			var card = el('div', {
				className: 'gm-card',
				'data-idx': String(f.idx),
				'data-pos': String(pos),
				title: f.name
			}, [
				el('div', { className: 'gm-thumb' }, [thumb]),
				el('input', { type: 'checkbox', className: 'gm-cb', 'aria-label': f.name }),
				el('span', { className: 'gm-badge' }),
				el('div', { className: 'gm-name' }, [
					el('span', { className: 'gm-fname', text: f.name }),
					el('span', { className: 'gm-ext', text: f.ext.toUpperCase() }),
					el('a', { href: f.href, target: '_blank', rel: 'noopener', className: 'gm-open', title: 'Open file page in new tab', text: '↗' })
				])
			]);
			frag.appendChild(card);
		});
		grid.appendChild(frag);
		syncCards();
	}

	function upgradeThumbs() {
		document.querySelectorAll('#gm-grid .gm-card').forEach(function (card) {
			var f = state.files[+card.getAttribute('data-idx')];
			var img = card.querySelector('img');
			if (!img || !f) { return; }
			var src = thumbFor(f, state.opt.size);
			if (src && img.getAttribute('src') !== src && src !== f.thumb) {
				img.addEventListener('error', function onErr() {
					img.removeEventListener('error', onErr);
					img.src = f.thumb;
				});
				img.src = src;
			}
		});
	}

	function setSel(f, val) {
		if (val && !f.selected) { f.order = ++state.clickSeq; }
		if (!val) { f.order = 0; }
		f.selected = val;
	}

	function onGridClick(e) {
		if (e.target.closest('a')) { return; }
		var card = e.target.closest('.gm-card');
		if (!card) { return; }
		var f = state.files[+card.getAttribute('data-idx')];
		var pos = +card.getAttribute('data-pos');
		var isCb = e.target.classList.contains('gm-cb');
		var val = isCb ? e.target.checked : !f.selected;

		if (e.shiftKey && state.lastPos !== null) {
			var a = Math.min(state.lastPos, pos), b = Math.max(state.lastPos, pos);
			for (var k = a; k <= b; k++) { setSel(state.shown[k], val); }
		} else {
			setSel(f, val);
		}
		state.lastPos = pos;
		syncCards();
		updateCode();
	}

	function syncCards() {
		var click = state.opt.sort === 'click';
		var rank = {};
		if (click) {
			state.files.filter(function (f) { return f.selected; })
				.sort(function (a, b) { return a.order - b.order; })
				.forEach(function (f, i) { rank[f.idx] = i + 1; });
		}
		document.querySelectorAll('#gm-grid .gm-card').forEach(function (card) {
			var idx = +card.getAttribute('data-idx');
			var f = state.files[idx];
			card.classList.toggle('gm-sel', f.selected);
			card.querySelector('.gm-cb').checked = f.selected;
			var badge = card.querySelector('.gm-badge');
			badge.textContent = (click && f.selected) ? rank[idx] : '';
		});
		updateCount();
	}

	function updateCount() {
		var n = state.files.filter(function (f) { return f.selected; }).length;
		$id('gm-count').textContent = n + ' selected · ' + state.shown.length + ' shown · ' + state.files.length + ' files';
	}

	/* ---------- Code generation ---------- */

	function buildCode() {
		var o = state.opt;
		var sel = sortList(state.files.filter(function (f) { return f.selected; }), o.sort);
		if (!sel.length) { return ''; }

		var attrs = [];
		var w = parseInt(o.widths, 10), h = parseInt(o.heights, 10), pr = parseInt(o.perrow, 10);
		if (o.mode !== 'traditional') { attrs.push('mode="' + o.mode + '"'); }
		if (w > 0) { attrs.push('widths="' + w + 'px"'); }
		if (h > 0) { attrs.push('heights="' + h + 'px"'); }
		if (pr > 0 && (o.mode === 'traditional' || o.mode === 'nolines')) { attrs.push('perrow="' + pr + '"'); }
		if (o.title && o.title.trim()) { attrs.push('caption="' + o.title.trim().replace(/"/g, '&quot;') + '"'); }
		if (o.showfilename) { attrs.push('showfilename="yes"'); }

		var lines = sel.map(function (f, i) {
			var c = '';
			if (o.caption === 'full') { c = f.name; }
			else if (o.caption === 'noext') { c = f.name.replace(/\.[^.]+$/, ''); }
			else if (o.caption === 'num') { c = String(i + 1); }
			return 'File:' + f.name + (c ? '|' + c : '');
		});

		return '<gallery' + (attrs.length ? ' ' + attrs.join(' ') : '') + '>\n' +
			lines.join('\n') + '\n</gallery>';
	}

	function updateCode() {
		if (!state || !$id('gm-output')) { return; }
		var code = buildCode();
		$id('gm-output').value = code;
		if (code && state.opt.autoCopy) {
			copyCode(false);
		} else if (!code) {
			setStatus('');
		}
	}

	function copyCode(manual) {
		var ta = $id('gm-output');
		var code = ta.value;
		if (!code) { setStatus('Nothing selected'); return; }
		var n = state.files.filter(function (f) { return f.selected; }).length;
		var done = function () { setStatus((manual ? 'Copied ' : 'Auto-copied ') + n + ' file' + (n === 1 ? '' : 's') + ' ✓'); };
		var fail = function () { setStatus('Copy failed — press Ctrl+C'); };
		if (navigator.clipboard && window.isSecureContext) {
			navigator.clipboard.writeText(code).then(done, function () { if (fallbackCopy(ta)) { done(); } else { fail(); } });
		} else if (fallbackCopy(ta)) { done(); } else { fail(); }
	}

	function fallbackCopy(ta) {
		var hidden = ta.style.display === 'none';
		try {
			if (hidden) { ta.style.display = ''; }
			ta.focus();
			ta.select();
			return document.execCommand('copy');
		} catch (e) {
			return false;
		} finally {
			if (hidden) { ta.style.display = 'none'; }
		}
	}

	var statusTimer;
	function setStatus(msg) {
		var s = $id('gm-status');
		if (!s) { return; }
		s.textContent = msg;
		clearTimeout(statusTimer);
		if (msg) { statusTimer = setTimeout(function () { s.textContent = ''; }, 2500); }
	}

	/* ---------- Styles ---------- */

	function addStyles() {
		mw.util.addCSS([
			'html.gm-noscroll{overflow:hidden}',
			'#gm-fab{position:fixed;right:16px;bottom:16px;z-index:1500;padding:8px 14px;background:#36c;color:#fff;border:0;border-radius:20px;font-weight:bold;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}',
			'#gm-overlay{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}',
			'#gm-overlay .gm-panel{background:var(--background-color-base,#fff);color:var(--color-base,#202122);width:min(1100px,95vw);height:min(92vh,960px);display:flex;flex-direction:column;border-radius:6px;box-shadow:0 8px 30px rgba(0,0,0,.35);overflow:hidden;font-size:14px}',
			'#gm-overlay .gm-panel.gm-full{width:100vw;height:100vh;max-width:none;border-radius:0}',
			'#gm-overlay .gm-header{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--border-color-base,#a2a9b1)}',
			'#gm-overlay .gm-header strong{font-size:16px}',
			'#gm-overlay .gm-count{color:var(--color-subtle,#54595d);flex:1}',
			'#gm-overlay .gm-iconbtn{border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:inherit;padding:4px 6px;border-radius:3px}',
			'#gm-overlay .gm-iconbtn:hover{background:var(--background-color-interactive,#eaecf0)}',
			'#gm-overlay .gm-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 14px}',
			'#gm-overlay .gm-options{border-bottom:1px solid var(--border-color-base,#a2a9b1);align-items:flex-end;padding-bottom:8px}',
			'#gm-overlay .gm-search{flex:1;min-width:160px;padding:5px 8px}',
			'#gm-overlay .gm-label{font-size:13px;color:var(--color-subtle,#54595d)}',
			'#gm-overlay .gm-hint{font-size:12px;color:var(--color-subtle,#72777d);margin-left:auto}',
			'#gm-overlay .gm-opt{display:flex;flex-direction:column;font-size:12px;gap:2px}',
			'#gm-overlay .gm-opt.gm-inline{flex-direction:row;align-items:center;gap:4px;font-size:13px;padding-bottom:4px}',
			'#gm-overlay .gm-num{width:72px}',
			'#gm-overlay .gm-title{width:180px}',
			'#gm-overlay input,#gm-overlay select,#gm-overlay textarea{background:var(--background-color-base,#fff);color:inherit;border:1px solid var(--border-color-base,#a2a9b1);border-radius:2px;padding:3px 5px}',
			'#gm-overlay input[type=checkbox],#gm-overlay input[type=range]{padding:0}',
			'#gm-overlay .gm-btn,#gm-overlay .gm-seg button{padding:5px 12px;border:1px solid var(--border-color-base,#a2a9b1);background:var(--background-color-interactive-subtle,#f8f9fa);color:inherit;border-radius:2px;cursor:pointer}',
			'#gm-overlay .gm-btn:hover,#gm-overlay .gm-seg button:hover{background:var(--background-color-interactive,#eaecf0)}',
			'#gm-overlay .gm-seg{display:inline-flex}',
			'#gm-overlay .gm-seg button{border-radius:0;margin-left:-1px}',
			'#gm-overlay .gm-seg button:first-child{border-radius:2px 0 0 2px;margin-left:0}',
			'#gm-overlay .gm-seg button:last-child{border-radius:0 2px 2px 0}',
			'#gm-overlay .gm-seg button.gm-on{background:#36c;border-color:#36c;color:#fff}',
			'#gm-overlay .gm-sizectl{display:flex;align-items:center;gap:6px;font-size:13px}',
			'#gm-overlay .gm-sizectl input{width:120px}',
			'#gm-overlay .gm-sizeval{width:44px;font-variant-numeric:tabular-nums;color:var(--color-subtle,#54595d)}',
			'#gm-overlay .gm-primary{background:#36c;border-color:#36c;color:#fff;font-weight:bold}',
			'#gm-overlay .gm-primary:hover{background:#2a4b8d}',

			/* Grid base */
			'#gm-overlay .gm-grid{--gm-size:150px;flex:1 1 auto;min-height:0;overflow:auto;padding:10px 14px;align-content:start;grid-auto-rows:max-content}',
			'#gm-overlay .gm-card{flex:none;position:relative;display:flex;flex-direction:column;border:2px solid var(--border-color-subtle,#c8ccd1);border-radius:4px;cursor:pointer;overflow:hidden;user-select:none;background:var(--background-color-base,#fff)}',
			'#gm-overlay .gm-card:hover{border-color:#6485d1}',
			'#gm-overlay .gm-card.gm-sel{border-color:#36c;background:rgba(51,102,204,.10)}',
			'#gm-overlay .gm-thumb{flex:none;display:flex;align-items:center;justify-content:center;background:var(--background-color-neutral-subtle,#f8f9fa);overflow:hidden}',
			'#gm-overlay .gm-thumb img{max-width:100%;object-fit:contain;display:block}',
			'#gm-overlay .gm-nothumb{font-weight:bold;color:var(--color-subtle,#72777d)}',
			'#gm-overlay .gm-cb{position:absolute;top:6px;left:6px;width:18px;height:18px;margin:0;cursor:pointer;z-index:1}',
			'#gm-overlay .gm-badge:empty{display:none}',
			'#gm-overlay .gm-badge{position:absolute;top:5px;right:5px;min-width:20px;padding:1px 5px;border-radius:10px;background:#36c;color:#fff;font-size:12px;font-weight:bold;text-align:center;z-index:1}',
			'#gm-overlay .gm-name{display:flex;align-items:flex-start;gap:4px;padding:4px 6px;font-size:11px;line-height:1.3}',
			'#gm-overlay .gm-fname{flex:1;word-break:break-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
			'#gm-overlay .gm-ext{display:none;color:var(--color-subtle,#72777d)}',
			'#gm-overlay .gm-open{text-decoration:none;opacity:.6}',
			'#gm-overlay .gm-open:hover{opacity:1}',

			/* Grid view */
			'#gm-overlay .gm-v-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--gm-size),1fr));gap:8px}',
			'#gm-overlay .gm-v-grid .gm-thumb{height:calc(var(--gm-size) * .75)}',
			'#gm-overlay .gm-v-grid .gm-thumb img{max-height:calc(var(--gm-size) * .75)}',

			/* Compact view: thumbnails only */
			'#gm-overlay .gm-v-compact{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--gm-size),1fr));gap:4px}',
			'#gm-overlay .gm-v-compact .gm-thumb{height:var(--gm-size)}',
			'#gm-overlay .gm-v-compact .gm-thumb img{width:100%;height:100%;object-fit:cover}',
			'#gm-overlay .gm-v-compact .gm-name{display:none}',
			'#gm-overlay .gm-v-compact .gm-card{border-width:3px}',

			/* List view */
			'#gm-overlay .gm-v-list{display:flex;flex-direction:column;gap:3px}',
			'#gm-overlay .gm-v-list .gm-card{flex-direction:row;align-items:center;border-width:1px;padding-left:32px}',
			'#gm-overlay .gm-v-list .gm-cb{top:50%;transform:translateY(-50%);left:8px}',
			'#gm-overlay .gm-v-list .gm-thumb{width:calc(var(--gm-size) * .6);height:calc(var(--gm-size) * .45);flex:none}',
			'#gm-overlay .gm-v-list .gm-thumb img{max-height:100%}',
			'#gm-overlay .gm-v-list .gm-name{flex:1;align-items:center;font-size:13px;padding:4px 10px}',
			'#gm-overlay .gm-v-list .gm-fname{-webkit-line-clamp:1}',
			'#gm-overlay .gm-v-list .gm-ext{display:inline;width:48px}',
			'#gm-overlay .gm-v-list .gm-badge{position:static;margin-right:10px}',

			'#gm-overlay .gm-empty{grid-column:1/-1;text-align:center;color:var(--color-subtle,#72777d);padding:30px}',
			'#gm-overlay .gm-footer{border-top:1px solid var(--border-color-base,#a2a9b1);padding:8px 14px;display:flex;flex-direction:column;gap:6px}',
			'#gm-overlay .gm-output{width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;resize:vertical;height:7.5em}',
			'#gm-overlay .gm-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
			'#gm-overlay .gm-status{color:#14866d;font-weight:bold}',
			'#gm-overlay .gm-credit{margin-left:auto;font-size:11px;color:var(--color-subtle,#72777d)}'
		].join('\n'));
	}
}());
