document.addEventListener("DOMContentLoaded", function() {

    // ==========================================
    // 1. MOBILE MENU TOGGLE
    // ==========================================
    const menuToggle = document.querySelector(".menu-toggle");
    const menu = document.querySelector(".menu");
    
    if (menuToggle && menu) {
        menuToggle.addEventListener("click", () => {
            menu.classList.toggle("active");
            menuToggle.classList.toggle("active");
            document.body.classList.toggle("no-scroll");
        });
    }

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
    // Nếu bạn đã đổi tên class ở HTML thì sửa lại dòng này, ví dụ: .product-grid
    
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
    // 7. BLOG DATA 
    // ==========================================
    const blogData = {
        1: {
            title: "Bí quyết \"cứu nguy\" cho mái tóc khô xơ mùa lạnh",
            date: "20/10/2025",
            category: "Chăm sóc tóc",
            content: `
                <p>Mùa đông đến, độ ẩm không khí giảm mạnh khiến mái tóc của chị em dễ gặp tình trạng tích điện, khô xơ và gãy rụng. Đừng lo lắng, hãy cùng Loly điểm qua 3 bước đơn giản sau:</p>
                
                <h3>1. Đừng gội đầu bằng nước quá nóng</h3>
                <p>Nước nóng làm mở biểu bì tóc quá mức, khiến dưỡng chất trôi đi nhanh chóng. Hãy gội bằng nước ấm và xả lại lần cuối bằng nước mát để khóa biểu bì tóc, giúp tóc bóng mượt hơn.</p>
                
                <h3>2. Dùng dầu dưỡng (Hair Oil) mỗi ngày</h3>
                <p>Chỉ cần 2-3 giọt tinh dầu Argan hoặc Macadamia thoa vào đuôi tóc trước khi sấy khô sẽ tạo lớp màng bảo vệ tóc khỏi nhiệt độ cao và tình trạng tĩnh điện.</p>
                
                <h3>3. Cấp ẩm sâu 1 lần/tuần</h3>
                <p>Hãy dành thời gian ủ tóc tại nhà hoặc đến Salon hấp phục hồi collagen. Tóc đủ ẩm sẽ có độ đàn hồi tốt, giảm thiểu gãy rụng đáng kể khi chải.</p>
            `
        },
        2: {
            title: "Balayage Nâu Lạnh: Màu tóc \"quốc dân\" mùa lễ hội",
            date: "15/12/2025",
            category: "Xu hướng",
            content: `
                <p>Nếu bạn sợ tẩy tóc hỏng da đầu nhưng vẫn muốn nổi bật, Balayage Nâu Lạnh chính là chân ái của mùa lễ hội năm nay.</p>
                
                <h3>Tại sao kiểu tóc này lại HOT?</h3>
                <p>Kỹ thuật này chỉ tẩy nhẹ các sợi highlight đan xen, giữ nguyên nền tóc đen hoặc nâu tự nhiên ở chân tóc. Khi tóc dài ra không bị lộ chân đen xấu xí (tình trạng "chia hai dòng sông").</p>
                
                <h3>Phù hợp với ai?</h3>
                <p>Tone nâu lạnh cực kỳ tôn da châu Á, giúp da trông sáng hơn. Đặc biệt phù hợp với các bạn văn phòng muốn "cháy" nhẹ nhàng mà không quá chói lóa.</p>
                
                <p>Tại Loly Hairsalon, chúng tôi sử dụng kỹ thuật AirTouch để đường nối màu mềm mại nhất có thể.</p>
            `
        },
        3: {
            title: "Tại sao tóc uốn nhanh duỗi? Những sai lầm chết người",
            date: "10/12/2025",
            category: "Bí quyết",
            content: `
                <p>Rất nhiều khách hàng than phiền tóc uốn về nhà chỉ đẹp được 2 tuần là duỗi thẳng đơ. Lý do chính không phải do thuốc, mà do 5 sai lầm kinh điển sau:</p>
                
                <h3>1. Chải tóc khi còn ướt</h3>
                <p>Lúc ướt là lúc liên kết tóc yếu nhất. Dùng lược dày chải mạnh sẽ làm giãn sóng xoăn ngay lập tức. Hãy sấy khô 80% rồi mới dùng lược hoặc tay vuốt vào nếp.</p>
                
                <h3>2. Không sấy đúng chiều xoăn</h3>
                <p>Nhiều bạn sấy tung tóe không theo quy luật. Hãy vừa sấy vừa dùng ngón tay xoắn lọn tóc theo chiều thợ đã hướng dẫn (xoắn ra sau hoặc về trước).</p>
                
                <h3>3. Lười dùng kẹp càng cua</h3>
                <p>Khi ở nhà hoặc đi ngủ, hãy cuộn tóc lại và kẹp lên cao bằng kẹp càng cua. Đây là cách giữ nếp "thần thánh" và rẻ tiền nhất.</p>
                
                <h3>4. Lạm dụng dầu gội có tính tẩy mạnh</h3>
                <p>Các loại dầu gội trị gàu hoặc bạc hà thường có chất tẩy rửa mạnh (Sulfates) khiến tóc khô và mất thuốc nhanh. Hãy đầu tư một cặp dầu gội chuyên dụng cho tóc uốn (pH 5.5) để cấp ẩm, giúp sóng xoăn nảy và bóng hơn.</p>
                
                <h3>5. Quên dùng tinh dầu (Serum)</h3>
                <p>Tóc uốn thực chất là tóc đã bị tổn thương do nhiệt và hóa chất, nên nó rất "khát nước". Nếu không thoa tinh dầu dưỡng hàng ngày, đuôi tóc sẽ bị chẻ ngọn và duỗi thẳng chỉ sau 1 tháng. Hãy nhớ nguyên tắc: <em>"Dưỡng trước khi sấy và dưỡng sau khi khô"</em>.</p>
            `
        }
    };

    // Logic hiển thị chi tiết bài viết (nếu đang ở trang blog-detail)
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    
    if (postId && document.getElementById('post-title')) {
        const post = blogData[postId] || blogData[1]; 
        
        document.title = post.title + " - Loly Hairsalon";
        document.getElementById('post-category').innerText = post.category;
        document.getElementById('post-title').innerText = post.title;
        document.getElementById('post-date').innerText = post.date;
        
        // Cập nhật nội dung HTML
        const contentDiv = document.getElementById('post-body');
        if (contentDiv) contentDiv.innerHTML = post.content;
        
        // Cập nhật ảnh minh họa tương ứng
        const imgDiv = document.getElementById('post-image');
        if (imgDiv) imgDiv.src = `images/blog-${postId}.jpg`; 
    }
});