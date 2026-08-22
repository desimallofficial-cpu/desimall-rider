/**
 * Desi Mall - Banner Slider Component
 */

const BannerSlider = {
    currentSlide: 0,
    banners: [],
    slideInterval: null,

    async init() {
        const wrapper = document.getElementById('sliderWrapper');
        const dotsContainer = document.getElementById('sliderDots');
        if (!wrapper) return;

        this.banners = await getBanners();
        wrapper.innerHTML = '';
        if (dotsContainer) dotsContainer.innerHTML = '';

        this.banners.forEach((banner, index) => {
            const img = document.createElement('img');
            img.src = banner.ImageURL;
            img.alt = banner.BannerTitle || `Banner ${index + 1}`;
            img.style.objectFit = 'cover';
            img.onerror = () => { img.src = 'assets/products/noimage.jpg'; };
            wrapper.appendChild(img);

            if (dotsContainer) {
                const dot = document.createElement('span');
                dot.className = `dot ${index === 0 ? 'active' : ''}`;
                dot.onclick = () => this.goToSlide(index);
                dotsContainer.appendChild(dot);
            }
        });

        this.setupControls();
        this.startAutoSlide();
    },

    goToSlide(index) {
        const wrapper = document.getElementById('sliderWrapper');
        const dots = document.querySelectorAll('#sliderDots .dot');
        const total = this.banners.length;

        if (total === 0 || !wrapper) return;

        this.currentSlide = (index + total) % total;
        wrapper.style.transform = `translateX(-${this.currentSlide * 100}%)`;

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentSlide);
        });
    },

    setupControls() {
        const prevBtn = document.getElementById('prevSlide');
        const nextBtn = document.getElementById('nextSlide');
        const container = document.querySelector('.banner-slider-container');

        if (prevBtn) {
            prevBtn.onclick = () => {
                this.goToSlide(this.currentSlide - 1);
                this.startAutoSlide();
            };
        }

        if (nextBtn) {
            nextBtn.onclick = () => {
                this.goToSlide(this.currentSlide + 1);
                this.startAutoSlide();
            };
        }

        if (container) {
            container.onmouseenter = () => clearInterval(this.slideInterval);
            container.onmouseleave = () => this.startAutoSlide();
        }
    },

    startAutoSlide() {
        clearInterval(this.slideInterval);
        this.slideInterval = setInterval(() => {
            if (this.banners.length > 0) {
                this.goToSlide(this.currentSlide + 1);
            }
        }, 4000);
    }
};