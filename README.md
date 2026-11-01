# Gallery Maker

**Select files on any Wikimedia Commons page and instantly generate copy-ready `<gallery>` code.**

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23852287.svg)](https://doi.org/10.5281/zenodo.23852287)

Gallery Maker is a user script for [Wikimedia Commons](https://commons.wikimedia.org). It adds a **Gallery Maker** link to the Tools menu. Click it on a category, gallery, search result or "uploads by user" page, tick the photos you want, and the `<gallery>` wikitext is built and copied to your clipboard automatically — ready to paste into Wikipedia, Wikisource, Wikivoyage, Commons gallery pages, event reports or any other wiki page.

It was made for event organisers and photographers who regularly need to showcase a selection of photos from a workshop, photowalk or edit-a-thon.

## Features

**Picking files**
- Collects every file linked on the current page (categories, galleries, `Special:ListFiles`, `Special:Search`, user pages and more)
- Click a card or its checkbox to select; **Shift-click** selects a range
- Select All / None / Invert for the files currently shown, plus Clear all
- Filter by file name, by file type (JPG, PNG, SVG, TIFF… with counts), and by selected / not selected
- ↗ link on each card opens the file page in a new tab

**Built for large pages**
- Opens **full-screen automatically** when a page has more than 40 files (toggle any time with ⛶)
- Three views: **Grid** (thumbnails with names), **Compact** (thumbnails only, dense), **List** (one row per file)
- **Thumbnail size slider** (60–320 px); sharper thumbnails are loaded automatically at larger sizes

**Sorting**
- Page order, name A → Z, name Z → A (natural number sorting, so "Oct 2" comes before "Oct 10"), file type
- **Click order** — the gallery follows the order you selected files, shown as numbered badges on the cards

**Gallery code options**
- Mode: `traditional`, `nolines`, `packed`, `packed-hover`, `packed-overlay`, `slideshow`
- `widths`, `heights`, `perrow`
- Gallery title (`caption=`)
- Per-file captions: none, file name without extension, full file name, or numbered 1, 2, 3…
- `showfilename="yes"`

**Convenience**
- **Auto-copy**: the code is copied to the clipboard every time the selection changes, plus a **Copy code** button
- Hide the code box to give photos more room
- Your view, size, sort and gallery settings are remembered between pages
- Works with light and dark themes; falls back to a floating button on skins without a Tools menu
- No external libraries, no data sent anywhere — everything runs in your browser

## Installation

Add this line to your Commons [common.js](https://commons.wikimedia.org/wiki/Special:MyPage/common.js) (`commons.wikimedia.org/wiki/Special:MyPage/common.js`):

```js
mw.loader.load('//commons.wikimedia.org/w/index.php?title=User:Manojk/GalleryMaker.js&action=raw&ctype=text/javascript');
```

Save, then hard-refresh any Commons page (**Ctrl+Shift+R** / **Cmd+Shift+R**). This loads the script from [User:Manojk/GalleryMaker.js](https://commons.wikimedia.org/wiki/User:Manojk/GalleryMaker.js), so you always get the latest version.

> The script must be installed on **Commons** (`commons.wikimedia.org`). A `common.js` on another wiki will not run on Commons.

## Usage

1. Open any Commons page that shows files — for example a category such as `Category:Wikisource Workshop at Sir Syed College Oct 2026`, or your uploads at `Special:ListFiles?user=<YourUsername>&limit=500`.
2. Click **Tools → Gallery Maker** (in Vector 2022 the Tools menu is at the top right).
3. Select the files you want and adjust the gallery options.
4. The code is copied automatically — paste it wherever you need it.

Example output:

```wikitext
<gallery mode="packed" heights="180px" caption="Wikisource Workshop, Oct 2026">
File:Wikisource Workshop at Sir Syed College 2026 Oct 01.jpg|Wikisource Workshop at Sir Syed College 2026 Oct 01
File:Wikisource Workshop at Sir Syed College 2026 Oct 03.jpg|Wikisource Workshop at Sir Syed College 2026 Oct 03
File:Wikisource Workshop at Sir Syed College 2026 Oct 05.jpg|Wikisource Workshop at Sir Syed College 2026 Oct 05
</gallery>
```

## Tips

- On category pages only the files currently listed are collected (200 per page by default). Use the "next page" link and run Gallery Maker again for more.
- On `Special:ListFiles`, add `&limit=500` to the address to load up to 500 uploads at once.
- Press **Esc** or click outside the window to close it.

## Troubleshooting

If the **Gallery Maker** link does not appear:

1. Make sure the `mw.loader.load` line is in your **Commons** `common.js` (not on another wiki), copied exactly — page titles are case-sensitive.
2. Hard-refresh the page with **Ctrl+Shift+R**.
3. Press **F12 → Console** and reload; any red error will show what went wrong.

## Author

**Manoj Karingamadathil**, [Wikimedians of Kerala User Group](https://meta.wikimedia.org/wiki/Wikimedians_of_Kerala)  
Commons: [User:Manojk](https://commons.wikimedia.org/wiki/User:Manojk)  
Script: [User:Manojk/GalleryMaker.js](https://commons.wikimedia.org/wiki/User:Manojk/GalleryMaker.js)

## Citation

If you use Gallery Maker in your work, please cite it:

> Karingamadathil, M. (2026). *Gallery Maker: a Wikimedia Commons user script for generating gallery code* [Computer software]. Wikimedians of Kerala User Group. https://doi.org/10.5281/zenodo.23852287

## License

MIT license
