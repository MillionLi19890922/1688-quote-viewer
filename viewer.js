const urlParams = new URLSearchParams(window.location.search);
const quoteId = urlParams.get('id');

let globalData = [];
let quoteMetadata = {};

document.addEventListener('DOMContentLoaded', async () => {
    if (!quoteId) {
        showError('Ungültiger Link: Keine Angebots-ID gefunden.');
        return;
    }

    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${quoteId}`, {
            method: 'GET',
            headers: {
                'X-Bin-Meta': 'false' // We only want the record data
            }
        });

        if (!response.ok) {
            throw new Error(`Fehler beim Laden des Angebots (${response.status})`);
        }

        const data = await response.json();
        
        // Parse data
        globalData = data.globalData || [];
        quoteMetadata = data.metadata || {};

        // Hide loader, show content
        document.getElementById('loadingOverlay').style.display = 'none';
        document.getElementById('quoteHeader').classList.remove('hidden');
        document.getElementById('summaryBar').classList.remove('hidden');
        document.getElementById('quoteFooter').classList.remove('hidden');

        // Populate header & footer
        document.getElementById('displayCompanyName').textContent = quoteMetadata.companyName || '';
        document.getElementById('displayPaymentInfo').textContent = quoteMetadata.paymentInfo || '';
        document.getElementById('displayTerms').textContent = quoteMetadata.terms || '';
        document.getElementById('displayQuoteDate').textContent = `Datum: ${quoteMetadata.date || new Date().toLocaleDateString('de-DE')}`;

        renderHierarchy();
        setupImagePreview();

    } catch (error) {
        showError(error.message);
    }
});

function showError(msg) {
    document.getElementById('loadingOverlay').style.display = 'none';
    const alert = document.getElementById('statusAlert');
    alert.className = 'alert alert-error';
    alert.textContent = msg;
    alert.style.display = 'block';
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&(?!#?\w+;)/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderHierarchy() {
    const container = document.getElementById('hierarchyContainer');
    container.innerHTML = '';
    
    let totalProducts = 0;
    let totalQty = 0;
    
    // 从 metadata 获取财务汇总信息
    const totalProductCny = quoteMetadata.totalProductCny || 0;
    const domesticShippingCny = quoteMetadata.domesticShippingCny || 0;
    const rate = quoteMetadata.rate || 7;
    const markup = quoteMetadata.markup || 0;

    // 告知文字
    document.getElementById('validityNotice').textContent =
      `Angebot erstellt am ${quoteMetadata.date || new Date().toLocaleDateString('de-DE')}. Da sich die Einkaufspreise ändern können, ist dieses Angebot 7 Tage lang gültig. Nach Ablauf verliert das Angebot seine Gültigkeit.`;

    globalData.forEach((store, index) => {
        const storeDiv = document.createElement('div');
        storeDiv.className = 'store-group';

        let displayStoreName = store.storeNameDe || store.storeName;
        if (!displayStoreName || displayStoreName === '未知店铺') {
            displayStoreName = `Lieferant ${index + 1}`;
        }

        const storeHeader = document.createElement('div');
        storeHeader.className = 'store-header';
        storeHeader.style.color = '#000';
        storeHeader.style.fontWeight = '800';
        storeHeader.innerHTML = `<span style="font-weight: 900; font-size: 1.15em; margin-right: 6px;">${index + 1}.</span> ${escapeHtml(displayStoreName)}`;
        storeDiv.appendChild(storeHeader);

        store.products.forEach(prod => {
            totalProducts++;
            const prodDiv = document.createElement('div');
            prodDiv.className = 'product-group';

            const prodHeader = document.createElement('div');
            prodHeader.className = 'product-header';
            prodHeader.innerHTML = `
                ${prod.imgUrl ? `<img src="${prod.imgUrl}" class="previewable-image" alt="Product">` : '<div style="width:80px;height:80px;background:#e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8;border:1px dashed #cbd5e1;">无图</div>'}
                <div class="product-titles">
                    <div class="product-de-title">${escapeHtml(prod.titleDe || prod.title)} ${prod.link ? `<a href="${prod.link}" target="_blank" class="link-icon" style="font-size:12px; margin-left:8px; color:#2563eb; text-decoration:none;">🔗 Link</a>` : ''}</div>
                </div>
            `;
            prodDiv.appendChild(prodHeader);

            if (prod.skus.length > 0) {
                const skuContainer = document.createElement('div');
                skuContainer.className = 'sku-table-container';
                
                let skuHtml = `
                    <table>
                        <thead>
                            <tr>
                                <th width="35%">Artikel</th>
                                <th width="8%" class="num-center">Menge</th>
                                <th width="19%" class="num-center">Listenpreis</th>
                                <th width="19%" class="num-center">Angebotspreis</th>
                                <th width="19%" class="num-center" style="background-color: #f0f7ff;">Summe</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                prod.skus.forEach(sku => {
                    totalQty += sku.quantity;
                    const skuSubtotalCny = sku.price * sku.quantity;

                    skuHtml += `
                        <tr>
                            <td>
                                <div style="display: flex; gap: 12px; align-items: center;">
                                    ${sku.imgUrl ? `<img src="${sku.imgUrl}" class="previewable-image" style="width: 40px; height: 40px; border-radius: 4px; border: 1px solid #e2e8f0; object-fit: cover; flex-shrink: 0;" alt="SKU Img">` : ''}
                                    <div>
                                        <div class="sku-de" style="font-size:12px;">${escapeHtml(sku.skuDe || sku.skuZh)}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="num-center font-semibold" style="font-size: 14px;">${sku.quantity}</td>
                            <td class="num-center">
                                ${sku.priceRanges && sku.priceRanges.length > 0 ? 
                                    `<div style="display:flex; flex-direction:column; gap:4px; font-size:11px; align-items:center;">
                                    ${sku.priceRanges.map(text => {
                                        const match = text.match(/^(.*?)(?:：|:)\s*([\d.]+)$/);
                                        if (match) {
                                            const qtyStr = match[1].trim();
                                            const cnyVal = parseFloat(match[2]);
                                            const eurVal = (cnyVal / rate).toFixed(2);
                                            return `<div style="display:flex; align-items:center; gap:8px;">
                                                <span style="color:#64748b; width:55px; text-align:right;">${escapeHtml(qtyStr)}:</span>
                                                <div class="dual-currency" style="align-items:center; gap:0; width:40px;">
                                                <span class="cny" style="font-size:10px;">¥${cnyVal.toFixed(2)}</span>
                                                <span class="eur" style="font-size:11px;">€${eurVal}</span>
                                                </div>
                                            </div>`;
                                        }
                                        return `<span style="color:#64748b;">${escapeHtml(text)}</span>`;
                                    }).join('')}
                                    </div>`
                                :
                                    `<div class="dual-currency">
                                        <span class="cny">¥${(sku.originalPrice || sku.price).toFixed(2)}</span>
                                        <span class="eur">€${sku.originalPriceEur.toFixed(2)}</span>
                                    </div>`
                                }
                            </td>
                            <td class="num-center">
                                <div class="dual-currency">
                                    <span class="cny">¥${sku.price.toFixed(2)}</span>
                                    <span class="eur">€${sku.priceEur.toFixed(2)}</span>
                                </div>
                            </td>
                            <td class="num-center" style="background-color: #f8fbff;">
                                <div class="dual-currency">
                                    <span class="cny" style="color:#b45309;">¥${skuSubtotalCny.toFixed(2)}</span>
                                    <span class="eur" style="font-weight: 800;">€${sku.totalPriceEur.toFixed(2)}</span>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                skuHtml += `</tbody></table>`;
                skuContainer.innerHTML = skuHtml;
                prodDiv.appendChild(skuContainer);
            }
            storeDiv.appendChild(prodDiv);
        });

        let storeProductCny = 0;
        let storeCostEur = 0;
        store.products.forEach(p => p.skus.forEach(s => {
            storeProductCny += s.price * s.quantity;
            storeCostEur += s.totalPriceEur;
        }));

        const storeFooter = document.createElement('div');
        storeFooter.style.cssText = `margin: 5px 0 15px 0; padding: 5px 40px; display: flex; justify-content: flex-end; align-items: center;`;
        storeFooter.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 13px; font-weight: 600; color: #64748b;">Summe</span>
                <span style="font-size: 15px; font-weight: 800; color: #0f172a;">¥${storeProductCny.toFixed(2)}</span>
                <div style="width: 1px; height: 14px; background: #e2e8f0;"></div>
                <span style="font-size: 15px; font-weight: 800; color: #2563eb;">€${storeCostEur.toFixed(2)}</span>
            </div>
        `;
        storeDiv.appendChild(storeFooter);
        container.appendChild(storeDiv);
    });

    // 财务汇总
    const productTotalEur = totalProductCny / rate;
    const shippingEur = domesticShippingCny / rate;
    const itemsSubtotalCny = totalProductCny + domesticShippingCny;
    const itemsSubtotalEur = productTotalEur + shippingEur;
    const serviceFeeCny = totalProductCny * (markup / 100);
    const serviceFeeEur = serviceFeeCny / rate;
    const finalTotalCny = itemsSubtotalCny + serviceFeeCny;
    const finalTotalEur = itemsSubtotalEur + serviceFeeEur;

    // 更新底部汇总栏
    document.getElementById('totalStores').textContent = globalData.length;
    document.getElementById('totalItems').textContent = totalProducts;
    document.getElementById('totalQty').textContent = totalQty;

    document.getElementById('productTotalCny').textContent = `¥${totalProductCny.toFixed(2)}`;
    document.getElementById('productTotalEur').textContent = `€${productTotalEur.toFixed(2)}`;

    document.getElementById('shippingCny').textContent = `¥${domesticShippingCny.toFixed(2)}`;
    document.getElementById('shippingEur').textContent = `€${shippingEur.toFixed(2)}`;

    document.getElementById('itemsSubtotalCny').textContent = `¥${itemsSubtotalCny.toFixed(2)}`;
    document.getElementById('itemsSubtotalEur').textContent = `€${itemsSubtotalEur.toFixed(2)}`;

    document.getElementById('labelServiceFee').textContent = `Servicegebühr (${markup}%)`;
    document.getElementById('serviceFeeCny').textContent = `¥${serviceFeeCny.toFixed(2)}`;
    document.getElementById('serviceFeeEur').textContent = `€${serviceFeeEur.toFixed(2)}`;

    document.getElementById('totalCny').textContent = `¥${finalTotalCny.toFixed(2)}`;
    document.getElementById('totalEur').textContent = `€${finalTotalEur.toFixed(2)}`;
}

function setupImagePreview() {
    const preview = document.getElementById('imagePreview');
    function onMouseOver(e) {
        if (e.target.classList.contains('previewable-image')) {
            preview.innerHTML = `<img src="${e.target.src}">`;
            preview.style.display = 'block';
        }
    }
    function onMouseMove(e) {
        if (preview.style.display === 'block') {
            const previewWidth = 260;
            const previewHeight = 260;
            let left = e.pageX + 15;
            let top = e.pageY + 15;
            if (left + previewWidth > window.innerWidth) left = e.pageX - previewWidth - 15;
            if (top + previewHeight > window.innerHeight) top = e.pageY - previewHeight - 15;
            preview.style.left = left + 'px';
            preview.style.top = top + 'px';
        }
    }
    function onMouseOut(e) {
        if (e.target.classList.contains('previewable-image')) {
            preview.style.display = 'none';
        }
    }
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseout', onMouseOut);
}
