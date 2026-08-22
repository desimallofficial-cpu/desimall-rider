/**
 * Desi Mall - Live Search Component
 */

const LiveSearch = {
    init() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const searchResults = document.getElementById('searchResults');

        if (!searchInput || !searchResults) return;

        let debounceTimer;

        const performSearch = () => {
            const query = searchInput.value.trim().toLowerCase();
            if (!query) {
                searchResults.classList.add('hidden');
                searchResults.innerHTML = '';
                return;
            }

            const filtered = DesiMallApp.state.products.filter(p =>
                (p.ProductName && p.ProductName.toLowerCase().includes(query)) ||
                (p.Category && p.Category.toLowerCase().includes(query)) ||
                (p.Description && p.Description.toLowerCase().includes(query))
            );

            this.renderResults(filtered);
        };

        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(performSearch, 200);
        });

        if (searchBtn) searchBtn.addEventListener('click', performSearch);

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.add('hidden');
            }
        });
    },

    renderResults(results) {
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) return;

        if (results.length === 0) {
            searchResults.innerHTML = '<div style="padding:12px; text-align:center; color:#666;">No matching products found</div>';
            searchResults.classList.remove('hidden');
            return;
        }

        searchResults.innerHTML = results.map(product => `
            <div class="search-item" style="padding:10px; border-bottom:1px solid #eee; display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="LiveSearch.selectResult('${product.ProductID}')">
                <img src="${product.ImageURL}" style="width:40px; height:40px; object-fit:contain; border-radius:4px; background:#f9f9f9;" onerror="this.src='assets/products/noimage.jpg'">
                <div>
                    <div style="font-size:14px; font-weight:600; color:#222;">${product.ProductName}</div>
                    <div style="font-size:12px; color:#ff6b00; font-weight:700;">₹${product.FinalPrice || product.Price}</div>
                </div>
            </div>
        `).join('');

        searchResults.classList.remove('hidden');
    },

    selectResult(productId) {
        const searchResults = document.getElementById('searchResults');
        if (searchResults) searchResults.classList.add('hidden');

        const filtered = DesiMallApp.state.products.filter(p => String(p.ProductID) === String(productId));
        DesiMallApp.renderProducts(filtered);

        const popularSection = document.getElementById('popular');
        if (popularSection) popularSection.scrollIntoView({ behavior: 'smooth' });
    }
};