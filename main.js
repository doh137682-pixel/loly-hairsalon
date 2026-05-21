
document.addEventListener("DOMContentLoaded", function() {
    const API_BASE_URL = (() => {
        if (window.location.protocol === 'file:') {
            return 'http://localhost:3000';
        }

        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalHost && window.location.port && window.location.port !== '3000') {
            return `${window.location.protocol}//${window.location.hostname}:3000`;
        }

        return '';
    })();

    const apiUrl = (path) => `${API_BASE_URL}${path}`;

    const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));

    const stripHtml = (value = '') => String(value).replace(/<[^>]+>/g, '').trim();

    const safeImagePath = (value = '') => {
        const imagePath = String(value).trim();
        if (/^images\/[\w.-]+\.(jpg|jpeg|png|webp|gif)$/i.test(imagePath)) {
            return imagePath;
        }
        return 'images/logo.png';
    };

    const sanitizeBlogHtml = (html = '') => {
        const template = document.createElement('template');
        template.innerHTML = String(html);

        template.content.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach(el => el.remove());
        template.content.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                const value = attr.value.trim().toLowerCase();

                if (name.startsWith('on') || ((name === 'href' || name === 'src') && value.startsWith('javascript:'))) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return template.innerHTML;
    };

    // ==========================================
    // 1. MOBILE MENU TOGGLE
    // ==========================================
    const menuToggle = document.querySelector(".menu-toggle");
    const menu = document.querySelector(".menu");
    
    if (menuToggle && menu) {
        menuToggle.setAttribute('role', 'button');
        menuToggle.setAttribute('tabindex', '0');
        menuToggle.setAttribute('aria-label', 'Mở menu');
        menuToggle.setAttribute('aria-expanded', 'false');

        const toggleMenu = () => {
            menu.classList.toggle("active");
            menuToggle.classList.toggle("active");
            document.body.classList.toggle("no-scroll");
            menuToggle.setAttribute('aria-expanded', menu.classList.contains("active") ? 'true' : 'false');
        };

        menuToggle.addEventListener("click", toggleMenu);
        menuToggle.addEventListener("keydown", (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleMenu();
            }
        });
    }

    document.querySelectorAll('a[target="_blank"]').forEach(link => {
        link.rel = 'noopener noreferrer';
    });

    document.querySelectorAll('.btn-phone').forEach(link => link.setAttribute('aria-label', 'Gọi hotline'));
    document.querySelectorAll('.btn-zalo').forEach(link => link.setAttribute('aria-label', 'Chat Zalo'));
    document.querySelectorAll('.btn-mess').forEach(link => link.setAttribute('aria-label', 'Chat Messenger'));
    document.querySelectorAll('.btn-map').forEach(link => link.setAttribute('aria-label', 'Xem bản đồ'));

    // ==========================================
    // 2. ACTIVE LINK HIGHLIGHT
    // ==========================================
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const navLinks = document.querySelectorAll(".menu a");
    navLinks.forEach(link => {
        if (link.getAttribute("href") === currentPage) {
            link.classList.add("active");
        }
    });

    // ==========================================
    // 3. FADE IN SCROLL EFFECT
    // ==========================================
    const fadeSections = document.querySelectorAll('.fade-in-section');
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    fadeSections.forEach(section => observer.observe(section));

    // ==========================================
    // 4. HOME SLIDER
    // ==========================================
    const slides = document.querySelectorAll(".slide");
    const dots = document.querySelectorAll(".dot");
    
    if (slides.length > 0) {
        let slideIndex = 0;
        let slideInterval;

        function showSlides(n) {
            slides.forEach(slide => slide.classList.remove("active"));
            dots.forEach(dot => dot.classList.remove("active"));
            
            if (n !== undefined) {
                slideIndex = n;
            } else {
                slideIndex++;
            }
            
            if (slideIndex >= slides.length) slideIndex = 0;
            if (slideIndex < 0) slideIndex = slides.length - 1;
            
            slides[slideIndex].classList.add("active");
            if(dots[slideIndex]) dots[slideIndex].classList.add("active");
        }

        function startAutoSlide() {
            slideInterval = setInterval(() => showSlides(), 5000);
        }

        startAutoSlide(); // Chạy ngay khi load

        dots.forEach((dot, index) => {
            dot.addEventListener("click", () => {
                clearInterval(slideInterval);
                showSlides(index);
                startAutoSlide();
            });
        });
    }

    // ==========================================
    // 5. SERVICES FILTER & SORT
    // ==========================================
    const grid = document.querySelector(".swans-grid"); 
        
    if (grid) {
        const cards = Array.from(document.querySelectorAll(".swans-card"));
        const filterItems = document.querySelectorAll(".filter-item");
        const sortSelect = document.querySelector(".sort-dropdown");
        const paginationLinks = document.querySelectorAll(".pagination .page-item");
        
        let currentCategory = 'all';
        let currentPage = 1;

        function renderProducts() {
            // Lọc theo danh mục
            let filteredCards = cards.filter(card => {
                if (currentCategory === 'all') return true;
                return card.getAttribute('data-group') === currentCategory;
            });

            // Sắp xếp
            if (sortSelect) {
                const sortValue = sortSelect.value;
                if (sortValue === 'Giá thấp đến cao') {
                    filteredCards.sort((a, b) => Number(a.dataset.price) - Number(b.dataset.price));
                } else if (sortValue === 'Mới nhất') {
                    // Logic sắp xếp mới nhất (demo giữ nguyên thứ tự)
                }
            }

            // Hiển thị ra màn hình
            grid.innerHTML = "";
            if (currentCategory !== 'all') {
                // Nếu đang lọc, hiện tất cả kết quả (tạm tắt phân trang khi lọc để trải nghiệm tốt hơn)
                filteredCards.forEach(card => {
                    card.style.display = "block";
                    grid.appendChild(card);
                });
            } else {
                // Nếu là tất cả, chạy logic phân trang (Page 1 / Page 2)
                cards.forEach(c => c.style.display = 'none');
                let pageClass = `page-${currentPage}`;
                let pageCards = filteredCards.filter(card => card.classList.contains(pageClass));
                
                pageCards.forEach(card => {
                    card.style.display = "block";
                    grid.appendChild(card);
                });
            }
        }

        // Sự kiện click Filter
        filterItems.forEach(item => {
            item.addEventListener("click", function () {
                filterItems.forEach(i => i.classList.remove("active"));
                this.classList.add("active");
                
                currentCategory = this.getAttribute("data-group");
                currentPage = 1; // Reset về trang 1
                
                updatePaginationUI();
                renderProducts();
            });
        });

        // Sự kiện click Sort
        if(sortSelect) {
            sortSelect.addEventListener("change", renderProducts);
        }

        // Sự kiện Pagination
        paginationLinks.forEach(link => {
            link.addEventListener("click", function (e) {
                e.preventDefault();
                if (this.classList.contains('next')) {
                    if (currentPage < 2) currentPage++;
                } else {
                    currentPage = parseInt(this.innerText);
                }
                updatePaginationUI();
                renderProducts();
            });
        });

        function updatePaginationUI() {
            paginationLinks.forEach(link => {
                link.classList.remove('active');
                if (link.innerText == currentPage) link.classList.add('active');
            });
        }
        
        // Khởi chạy lần đầu
        renderProducts();
    }

    // ==========================================
    // 6. TOGGLE SIDEBAR FILTER (Mobile)
    // ==========================================
    const toggleBtn = document.querySelector('.toggle-filter');
    const filterList = document.querySelector('.filter-list');
    
    if (toggleBtn && filterList) {
        toggleBtn.addEventListener('click', () => {
            filterList.classList.toggle('collapsed');
            if (filterList.classList.contains('collapsed')) {
                toggleBtn.innerHTML = 'Mở rộng <i class="fas fa-chevron-down"></i>';
            } else {
                toggleBtn.innerHTML = 'Thu gọn <i class="fas fa-chevron-up"></i>';
            }
        });
    }

    // ==========================================
    // 7. BLOG API & RENDERING
    // ==========================================
    
        const blogListContainer = document.getElementById('blog-list-container');
    if (blogListContainer) {
        fetch(apiUrl('/api/posts'))
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data.length > 0) {
                    blogListContainer.innerHTML = data.data.map(post => {
                        const title = escapeHtml(post.title);
                        const category = escapeHtml(post.category);
                        const date = escapeHtml(post.date);
                        const excerpt = escapeHtml(stripHtml(post.content).substring(0, 100));
                        const imageUrl = safeImagePath(post.image_url);
                        const postId = encodeURIComponent(post.id);

                        return `
                        <article class="blog-card">
                            <div class="blog-img-wrap"><img src="${imageUrl}" alt="${title}" loading="lazy"></div>
                            <div class="blog-content">
                                <div class="blog-meta">
                                    <i class="far fa-calendar-alt"></i> ${date} | <i class="far fa-folder"></i> ${category}
                                </div>
                                <h3 class="blog-title"><a href="blog-detail.html?id=${postId}">${title}</a></h3>
                                <p class="blog-excerpt">${excerpt}...</p>
                                <a href="blog-detail.html?id=${postId}" class="read-more-btn">Đọc chi tiết <i class="fas fa-arrow-right"></i></a>
                            </div>
                        </article>
                    `;
                    }).join('');
                } else {
                    blogListContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Chưa có bài viết nào.</p>';
                }
            })
            .catch(err => {
                console.error(err);
                if (!blogListContainer.querySelector('.blog-api-warning')) {
                    const warning = document.createElement('p');
                    warning.className = 'blog-api-warning';
                    warning.style.gridColumn = '1/-1';
                    warning.style.textAlign = 'center';
                    warning.style.color = '#856404';
                    warning.style.margin = '0 0 10px';
                    warning.textContent = 'Đang hiển thị bài viết mẫu vì chưa kết nối được hệ thống dữ liệu tại localhost:3000.';
                    blogListContainer.prepend(warning);
                }
            });
    }

        const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    
    if (postId && document.getElementById('post-title')) {
        fetch(apiUrl(`/api/posts/${postId}`))
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    const post = data.data;
                    document.title = post.title + " - Loly Hairsalon";
                    document.getElementById('post-category').innerText = post.category;
                    document.getElementById('post-title').innerText = post.title;
                    document.getElementById('post-date').innerText = post.date;
                    
                    const contentDiv = document.getElementById('post-body');
                    if (contentDiv) contentDiv.innerHTML = sanitizeBlogHtml(post.content);
                    
                    const imgDiv = document.getElementById('post-image');
                    if (imgDiv) imgDiv.src = safeImagePath(post.image_url);
                } else {
                    document.getElementById('post-title').innerText = 'Bài viết không tồn tại hoặc đã bị xóa.';
                }
            })
            .catch(err => console.error('Lỗi tải chi tiết bài viết:', err));
    }

    // ==========================================
    // 8. BOOKING FORM SUBMISSION
    // ==========================================
    const bookingForm = document.getElementById('booking-form');
    if (bookingForm) {
        const bookingMessage = document.getElementById('booking-message');
        const stylistSelect = bookingForm.querySelector('select[name="stylist"]');
        const dateInput = bookingForm.querySelector('input[name="date"]');
        const timeInputs = Array.from(bookingForm.querySelectorAll('input[name="time"]'));

        const setBookingMessage = (message, type = 'info') => {
            if (!bookingMessage) return;

            bookingMessage.textContent = message;
            bookingMessage.className = `booking-message is-visible is-${type}`;
        };

        const clearBookingMessage = () => {
            if (!bookingMessage) return;

            bookingMessage.textContent = '';
            bookingMessage.className = 'booking-message';
        };

        const setDisabledTimes = (bookedTimes = []) => {
            const bookedSet = new Set(bookedTimes);

            timeInputs.forEach(input => {
                const label = input.closest('.time-slot');
                const isBooked = bookedSet.has(input.value);

                input.disabled = isBooked;
                if (label) label.classList.toggle('disabled', isBooked);

                if (isBooked && input.checked) {
                    input.checked = false;
                }
            });
        };

        const refreshAvailability = () => {
            if (!dateInput || !dateInput.value) {
                setDisabledTimes([]);
                return;
            }

            const params = new URLSearchParams({
                date: dateInput.value,
                stylist: stylistSelect ? stylistSelect.value : 'Ngau-nhien'
            });

            fetch(apiUrl(`/api/availability?${params.toString()}`))
                .then(res => {
                    if (!res.ok) throw new Error('availability unavailable');
                    return res.json();
                })
                .then(result => {
                    if (!result.success) throw new Error('availability failed');
                    setDisabledTimes(result.bookedTimes || []);

                    if ((result.bookedTimes || []).length > 0) {
                        setBookingMessage('Một số khung giờ đã có lịch và đã được khóa lại.', 'info');
                    } else {
                        clearBookingMessage();
                    }
                })
                .catch(() => {
                    setDisabledTimes([]);
                    setBookingMessage('Không kết nối được hệ thống đặt lịch tại localhost:3000. Hãy chạy npm start rồi thử lại.', 'error');
                });
        };

        if (dateInput) {
            const today = new Date();
            today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
            dateInput.min = today.toISOString().split('T')[0];
            dateInput.addEventListener('change', refreshAvailability);
        }
        if (stylistSelect) stylistSelect.addEventListener('change', refreshAvailability);

        bookingForm.addEventListener('submit', function(e) {
            e.preventDefault();
            clearBookingMessage();
            
            // Đổi text nút thành "Đang xử lý..."
            const submitBtn = bookingForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.innerText = "ĐANG XỬ LÝ...";
            submitBtn.disabled = true;

            const formData = new FormData(bookingForm);
            const data = Object.fromEntries(formData.entries());
            data.phone = String(data.phone || '').replace(/[^\d+]/g, '');

            if (!/^\+?\d{9,15}$/.test(data.phone || '')) {
                setBookingMessage('Số điện thoại không hợp lệ.', 'error');
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
                return;
            }

            if (!data.time) {
                setBookingMessage('Vui lòng chọn khung giờ phục vụ.', 'error');
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
                return;
            }

            fetch(apiUrl('/api/bookings'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    window.location.href = "thanks.html";
                } else {
                    setBookingMessage(result.error || 'Vui lòng thử lại sau.', 'error');
                    submitBtn.innerText = originalText;
                    submitBtn.disabled = false;
                }
            })
            .catch(err => {
                console.error(err);
                setBookingMessage('Không thể kết nối hệ thống đặt lịch tại localhost:3000. Hãy chạy npm start rồi thử lại.', 'error');
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            });
        });
    }

    // ==========================================
    // 9. CONTACT FORM SUBMISSION
    // ==========================================
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        const contactMessage = document.getElementById('contact-message');

        const setContactMessage = (message, type = 'info') => {
            if (!contactMessage) return;

            contactMessage.textContent = message;
            contactMessage.className = `contact-message is-visible is-${type}`;
        };

        contactForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerText;
            submitButton.innerText = 'ĐANG GỬI...';
            submitButton.disabled = true;

            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());
            data.phone = String(data.phone || '').replace(/[^\d+]/g, '');

            if (!/^\+?\d{9,15}$/.test(data.phone || '')) {
                setContactMessage('Số điện thoại không hợp lệ.', 'error');
                submitButton.innerText = originalText;
                submitButton.disabled = false;
                return;
            }

            fetch(apiUrl('/api/contacts'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
                .then(res => res.json().then(result => ({ ok: res.ok, result })))
                .then(({ ok, result }) => {
                    if (!ok || !result.success) {
                        throw new Error(result.error || 'Không thể gửi thông tin liên hệ.');
                    }

                    contactForm.reset();
                    setContactMessage(result.message || 'Đã gửi thông tin liên hệ.', 'success');
                })
                .catch(err => {
                    setContactMessage(err.message || 'Không thể kết nối hệ thống liên hệ tại localhost:3000.', 'error');
                })
                .finally(() => {
                    submitButton.innerText = originalText;
                    submitButton.disabled = false;
                });
        });
    }
});
