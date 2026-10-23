// Load each library from the local lib/ folder first; fall back to the CDN if the local file is missing.
function loadScript(localSrc, cdnSrc) {
    return new Promise((resolve, reject) => {
        const tryLoad = (src, onFail) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => { s.remove(); onFail(); };
            document.head.appendChild(s);
        };
        tryLoad(localSrc, () => {
            console.warn(`Local script not found (${localSrc}), loading from CDN: ${cdnSrc}`);
            tryLoad(cdnSrc, () => reject(new Error(`Failed to load ${localSrc} and ${cdnSrc}`)));
        });
    });
}

const librariesReady = Promise.all([
    loadScript('lib/html2canvas.min.js', 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'),
    loadScript('lib/signature_pad.umd.min.js', 'https://cdn.jsdelivr.net/npm/signature_pad@5.1.4/dist/signature_pad.umd.min.js')
]);

class SignatureField extends HTMLElement {
    constructor() {
        super();
        const labelText = this.getAttribute('label') || '';
        const inputId = this.getAttribute('id') || '';
        const inputName = this.getAttribute('name') || '';

        this.removeAttribute('id');

        this.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: nowrap; width: 100%;">
                <strong style="flex-shrink: 0; white-space: nowrap;">${labelText}</strong>
                <input type="text" id="${inputId}" name="${inputName}" style="flex-grow: 1; min-width: 0; padding: 4px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
            </div>
        `;
    }

    get label() {
        return this.querySelector('strong').innerText;
    }

    get value() {
        return this.querySelector('input').value.trim();
    }

    set value(val) {
        this.querySelector('input').value = val;
    }
}
customElements.define('signature-field', SignatureField);

fetch('content.json')
    .then(r => r.json())
    .then(json => {
        if(json.logo) {
            const logoImg = document.getElementById('logo');
            logoImg.src = json.logo;
            logoImg.style.display = 'block';
        }
        
        if(json.description) {
            fetch(json.description) 
                .then(res => res.text()) 
                .then(textContent => {
                    document.getElementById('description').innerText = textContent; 
                })
                .catch(err => console.error("Error fetching description text:", err));
        }

        if(json.title) document.getElementById('title').innerText = json.title;
    })
    .catch(err => console.error("Error loading localization JSON:", err));

const today = new Date();
document.getElementById('displayDate').value = today.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});

const canvas = document.getElementById('canvas');
let pad;

librariesReady.then(() => {
    pad = new SignaturePad(canvas);
}).catch(err => {
    console.error("Error loading libraries:", err);
    document.getElementById('approveBtn').disabled = true;
});

document.getElementById('clearBtn').onclick = () => pad && pad.clear();

document.getElementById('approveBtn').onclick = () => {
    if (!pad) return;
    const fields = document.querySelectorAll('signature-field');
    let dynamicRowsHtml = '';

    fields.forEach(field => {
        if (field.value !== '') {
            dynamicRowsHtml += `
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.8rem; font-size: 0.95rem; color: #555;">
                    <strong style="flex-shrink: 0; white-space: nowrap;">${field.label}</strong>
                    <span style="flex-grow: 1; padding: 4px; border-bottom: 1px dashed #ccc; text-align: left; direction: ltr;">${field.value}</span>
                </div>
            `;
        }
    });

    const logoImg = document.getElementById('logo');
    const logoHtml = logoImg.style.display !== 'none' ? `<img src="${logoImg.src}" style="max-width: 250px; display: block; margin: 0 auto 1rem auto;">` : '';
    const titleText = document.getElementById('title').innerText;
    const descText = document.getElementById('description').innerText;
    const sigLabel = document.getElementById('signatureLabel').innerText;
    
    const signatureDataUrl = pad.isEmpty() ? canvas.toDataURL("image/png") : pad.toDataURL();

    const pdfContainer = document.createElement('div');
    pdfContainer.dir = "rtl";
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.top = '-9999px';
    pdfContainer.style.width = '600px'; 
    pdfContainer.style.padding = '30px';
    pdfContainer.style.background = '#fff';
    pdfContainer.style.fontFamily = 'inherit';

    pdfContainer.innerHTML = `
        <div style="border: 1px solid #ccc; padding: 20px; border-radius: 8px; background: #fff;">
            ${logoHtml}
            <h1 style="text-align: center; margin-bottom: 1.5rem;">${titleText}</h1>
            
            <div style="margin-bottom: 1.5rem;">
                ${dynamicRowsHtml}
                ${descText ? `<p style="margin-top: 1rem; font-size: 0.95rem; color: #333; line-height: 1.5;">${descText}</p>` : ''}
            </div>

            <div style="margin-top: 2rem; text-align: right;">
                <label style="display: block; font-weight: bold; margin-bottom: 0.5rem;">${sigLabel}</label>
                <img src="${signatureDataUrl}" style="border: 1px solid #ccc; background: #fff; width: 400px; height: 200px; display: block;">
            </div>
        </div>
    `;

    document.body.appendChild(pdfContainer);

    html2canvas(pdfContainer, { scale: 2 }).then(capturedCanvas => {
        const fullImage = capturedCanvas.toDataURL("image/png");
        document.body.removeChild(pdfContainer);

        // Opened as a popup (e.g. from SysAid): hand the PNG back to the opener and close.
        // Opened directly: save the PNG locally.
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'SIG_DATA', img: fullImage }, "*"); window.close();
        } else {
            const downloadLink = document.createElement('a');
            downloadLink.href = fullImage;
            downloadLink.download = 'signature_document.png';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    }).catch(err => {
        console.error("Error generating capture canvas:", err);
        if(pdfContainer.parentNode) document.body.removeChild(pdfContainer);
    });
};
