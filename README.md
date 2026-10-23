# Tel-Hai Digital Signature

A static web page for signing equipment handover forms. The signer fills in the asset and person details, signs on the canvas, and clicks **אישור חתימה** (Approve signature). The page then renders the whole form, signature included, into a single PNG image.

## Files

| File | Purpose |
|---|---|
| `index.html` | The signature form |
| `signature.js` | Page logic: library loading, form fields, PNG generation and output |
| `content.json` | Form configuration: `logo`, `title` and `description` (the path to the declaration text) |
| `description.txt` | The declaration text shown on the form and included in the PNG |
| `signature_styles.css` | Form styles |
| `lib/` | Local copies of `html2canvas.min.js` and `signature_pad.umd.min.js` |
| `test_sig.html` | Test page for the popup and standalone flows |

## Libraries: local first, CDN fallback

The page loads each library from `lib/` first. If a local file is missing or fails to load, it falls back to the jsDelivr CDN and logs a warning to the console:

- `lib/html2canvas.min.js` → `html2canvas@1.4.1`
- `lib/signature_pad.umd.min.js` → `signature_pad@5.1.4`

With both files in `lib/`, the page works without internet access. If neither the local file nor the CDN copy loads, the approve button is disabled.

## Output: postMessage to the opener, or download

When the signer clicks **אישור חתימה**, the page builds the PNG and then does one of two things:

- **Opened as a popup** (`window.opener` exists, for example from SysAid): it sends the image to the window that opened it, then closes itself:
  ```js
  window.opener.postMessage({ type: 'SIG_DATA', img: '<data:image/png;base64,...>' }, '*');
  ```
- **Opened directly** (no opener): it downloads the image as `signature_document.png` and stays open.

To receive the image in the opening page:

```js
const popup = window.open('https://<host>/index.html', 'signature');
window.addEventListener('message', (e) => {
    if (e.source === popup && e.data?.type === 'SIG_DATA') {
        const pngDataUrl = e.data.img;
        // save or attach pngDataUrl
    }
});
```

The message is posted with target origin `'*'`, so the receiver should check `e.source` (or `e.origin`) as shown above.

## Running locally

The page loads `content.json` and `description.txt` with `fetch`, which does not work over `file://`. Serve the folder over HTTP:

```
python -m http.server 8000
```

Then open:

- http://localhost:8000/index.html for the form
- http://localhost:8000/test_sig.html for the tests. Test 1 opens the form as a popup and should receive the PNG. Test 2 opens it without an opener and should download the PNG.
