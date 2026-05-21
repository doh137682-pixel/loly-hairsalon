const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'loly.db');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_COOKIE_NAME = 'loly_admin';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || `local:${ADMIN_PASSWORD || 'disabled'}`;

const PUBLIC_PAGES = new Set([
    'index.html',
    'about.html',
    'services.html',
    'booking.html',
    'blog.html',
    'blog-detail.html',
    'contact.html',
    'thanks.html',
    '404.html'
]);

const SITEMAP_PAGES = [
    { path: '/', priority: '1.0' },
    { path: '/about.html', priority: '0.7' },
    { path: '/services.html', priority: '0.9' },
    { path: '/booking.html', priority: '0.9' },
    { path: '/blog.html', priority: '0.6' },
    { path: '/contact.html', priority: '0.8' }
];

const ALLOWED_TIMES = new Set([
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'
]);

const ALLOWED_SERVICES = new Set(['', 'Cat-toc-nam', 'Uon-toc', 'Nhuom-toc', 'Phuc-hoi']);
const ALLOWED_STYLISTS = new Set(['Ngau-nhien', 'Master-Tuan', 'Stylist-Huy', 'Stylist-Lan']);
const ALLOWED_STATUSES = new Set(['pending', 'confirmed', 'completed', 'cancelled']);
const ALLOWED_CONTACT_SERVICES = new Set(['', 'cat-toc', 'uon-nhuom', 'phuc-hoi', 'goi-dau']);
const ALLOWED_CONTACT_STATUSES = new Set(['new', 'contacted', 'closed']);

function sendAdminAuthChallenge(res) {
    res.set('WWW-Authenticate', 'Basic realm="Loly Admin", charset="UTF-8"');
    return res.status(401).send('Authentication required.');
}

function parseCookies(req) {
    return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(cookie => {
        const separatorIndex = cookie.indexOf('=');
        const name = cookie.slice(0, separatorIndex).trim();
        const value = cookie.slice(separatorIndex + 1).trim();
        return [name, decodeURIComponent(value)];
    }));
}

function signAdminPayload(payload) {
    return crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');
}

function createAdminToken() {
    const payload = Buffer.from(JSON.stringify({
        user: ADMIN_USER,
        exp: Date.now() + 8 * 60 * 60 * 1000
    })).toString('base64url');

    return `${payload}.${signAdminPayload(payload)}`;
}

function isValidAdminToken(token) {
    if (!token || !token.includes('.')) return false;

    const [payload, signature] = token.split('.');
    const expectedSignature = signAdminPayload(payload);
    if (signature.length !== expectedSignature.length) return false;

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return false;
    }

    try {
        const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return session.user === ADMIN_USER && session.exp > Date.now();
    } catch (err) {
        return false;
    }
}

function setAdminCookie(res) {
    const secure = IS_PRODUCTION ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${ADMIN_COOKIE_NAME}=${encodeURIComponent(createAdminToken())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`);
}

function clearAdminCookie(res) {
    res.setHeader('Set-Cookie', `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function requireAdminAuth(req, res, next) {
    if (!ADMIN_PASSWORD) {
        return res
            .status(503)
            .type('text/plain')
            .send('Admin is disabled. Set ADMIN_PASSWORD before publishing the admin page.');
    }

    const cookies = parseCookies(req);
    if (isValidAdminToken(cookies[ADMIN_COOKIE_NAME])) {
        return next();
    }

    const authHeader = req.get('authorization') || '';
    const [scheme, encoded] = authHeader.split(' ');

    if (scheme !== 'Basic' || !encoded) {
        return sendAdminAuthChallenge(res);
    }

    let credentials = '';
    try {
        credentials = Buffer.from(encoded, 'base64').toString('utf8');
    } catch (err) {
        return sendAdminAuthChallenge(res);
    }

    const separatorIndex = credentials.indexOf(':');
    const user = credentials.slice(0, separatorIndex);
    const password = credentials.slice(separatorIndex + 1);

    if (separatorIndex === -1 || user !== ADMIN_USER || password !== ADMIN_PASSWORD) {
        return sendAdminAuthChallenge(res);
    }

    next();
}

function cleanText(value, maxLength = 120) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizePhone(value) {
    return cleanText(value, 20).replace(/[^\d+]/g, '');
}

function isFutureOrToday(dateValue) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return false;

    const selectedDate = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return selectedDate >= today;
}

function hasCallbackError(res, err) {
    if (!err) return false;

    console.error(err.message);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.' });
    return true;
}

// Security Middlewares
app.use((req, res, next) => {
    const origin = req.get('origin');
    const isLocalDevOrigin = origin === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');

    if (!IS_PRODUCTION && isLocalDevOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

// Using helmet with adjusted CSP to allow inline scripts/styles and external images/fonts for the current static template.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://ui-avatars.com"],
            connectSrc: ["'self'"],
            formAction: ["'self'"]
        }
    }
}));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));

// Rate limiting to prevent spam on API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau!' }
});
app.use('/api/', apiLimiter);

// Serve only the browser assets and pages that are safe to expose.
app.use('/images', express.static(path.join(__dirname, 'images'), {
    dotfiles: 'ignore',
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
}));

app.get('/main.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.css'));
});

app.get('/main.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.js'));
});

app.get('/robots.txt', (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    res
        .type('text/plain')
        .send([
            'User-agent: *',
            'Allow: /',
            '',
            'Disallow: /admin.html',
            'Disallow: /api/',
            '',
            `Sitemap: ${origin}/sitemap.xml`,
            ''
        ].join('\n'));
});

app.get('/sitemap.xml', (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const lastmod = new Date().toISOString().split('T')[0];
    const urls = SITEMAP_PAGES.map(page => `
    <url>
        <loc>${origin}${page.path}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>${page.priority}</priority>
    </url>`).join('');

    res
        .type('application/xml')
        .send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/:page', (req, res, next) => {
    if (!PUBLIC_PAGES.has(req.params.page)) {
        return next();
    }

    res.sendFile(path.join(__dirname, req.params.page));
});

// --- Database Setup ---
fs.mkdirSync(DATA_DIR, { recursive: true });

const legacyDbPath = path.join(__dirname, 'loly.db');
if (!process.env.DB_PATH && !fs.existsSync(DB_PATH) && fs.existsSync(legacyDbPath)) {
    fs.copyFileSync(legacyDbPath, DB_PATH);
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Lỗi kết nối Database:', err.message);
    } else {
        console.log('Đã kết nối thành công tới SQLite database.');
        
        // Create Bookings Table
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            service TEXT,
            stylist TEXT,
            note TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            service TEXT,
            message TEXT,
            status TEXT DEFAULT 'new',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Posts Table (for Blog)
        db.run(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT
        )`, (err) => {
            if (!err) {
                // Seed some initial data if the table is empty
                db.get("SELECT COUNT(*) AS count FROM posts", (err, row) => {
                    if (row && row.count === 0) {
                        const stmt = db.prepare("INSERT INTO posts (title, date, category, content, image_url) VALUES (?, ?, ?, ?, ?)");
                        stmt.run(
                            "Bí quyết \"cứu nguy\" cho mái tóc khô xơ mùa lạnh",
                            "20/10/2025",
                            "Chăm sóc tóc",
                            `<p>Mùa đông đến, độ ẩm không khí giảm mạnh khiến mái tóc của chị em dễ gặp tình trạng tích điện, khô xơ và gãy rụng. Đừng lo lắng, hãy cùng Loly điểm qua 3 bước đơn giản sau:</p>
                            <h3>1. Đừng gội đầu bằng nước quá nóng</h3>
                            <p>Nước nóng làm mở biểu bì tóc quá mức, khiến dưỡng chất trôi đi nhanh chóng. Hãy gội bằng nước ấm và xả lại lần cuối bằng nước mát để khóa biểu bì tóc, giúp tóc bóng mượt hơn.</p>
                            <h3>2. Dùng dầu dưỡng (Hair Oil) mỗi ngày</h3>
                            <p>Chỉ cần 2-3 giọt tinh dầu Argan hoặc Macadamia thoa vào đuôi tóc trước khi sấy khô sẽ tạo lớp màng bảo vệ tóc khỏi nhiệt độ cao và tình trạng tĩnh điện.</p>
                            <h3>3. Cấp ẩm sâu 1 lần/tuần</h3>
                            <p>Hãy dành thời gian ủ tóc tại nhà hoặc đến Salon hấp phục hồi collagen. Tóc đủ ẩm sẽ có độ đàn hồi tốt, giảm thiểu gãy rụng đáng kể khi chải.</p>`,
                            "images/blog-1.jpg"
                        );
                        stmt.run(
                            "Balayage Nâu Lạnh: Màu tóc \"quốc dân\" mùa lễ hội",
                            "15/12/2025",
                            "Xu hướng",
                            `<p>Nếu bạn sợ tẩy tóc hỏng da đầu nhưng vẫn muốn nổi bật, Balayage Nâu Lạnh chính là chân ái của mùa lễ hội năm nay.</p>
                            <h3>Tại sao kiểu tóc này lại HOT?</h3>
                            <p>Kỹ thuật này chỉ tẩy nhẹ các sợi highlight đan xen, giữ nguyên nền tóc đen hoặc nâu tự nhiên ở chân tóc. Khi tóc dài ra không bị lộ chân đen xấu xí (tình trạng "chia hai dòng sông").</p>
                            <h3>Phù hợp với ai?</h3>
                            <p>Tone nâu lạnh cực kỳ tôn da châu Á, giúp da trông sáng hơn. Đặc biệt phù hợp với các bạn văn phòng muốn "cháy" nhẹ nhàng mà không quá chói lóa.</p>`,
                            "images/blog-2.jpg"
                        );
                        stmt.run(
                            "Tại sao tóc uốn nhanh duỗi? Những sai lầm chết người",
                            "10/12/2025",
                            "Bí quyết",
                            `<p>Rất nhiều khách hàng than phiền tóc uốn về nhà chỉ đẹp được 2 tuần là duỗi thẳng đơ. Lý do chính không phải do thuốc, mà do những sai lầm sau:</p>
                            <h3>1. Chải tóc khi còn ướt</h3>
                            <p>Lúc ướt là lúc liên kết tóc yếu nhất. Dùng lược dày chải mạnh sẽ làm giãn sóng xoăn ngay lập tức.</p>
                            <h3>2. Lười dùng kẹp càng cua</h3>
                            <p>Khi ở nhà hoặc đi ngủ, hãy cuộn tóc lại và kẹp lên cao bằng kẹp càng cua. Đây là cách giữ nếp "thần thánh" và rẻ tiền nhất.</p>`,
                            "images/blog-3.jpg"
                        );
                        stmt.finalize();
                        console.log("Đã tạo dữ liệu mẫu cho bài viết (Blog).");
                    }
                });
            }
        });
    }
});

// --- API Endpoints ---

app.post('/api/admin/login', (req, res) => {
    if (!ADMIN_PASSWORD) {
        return res.status(503).json({
            success: false,
            error: 'Admin đang bị khóa. Hãy chạy server với ADMIN_PASSWORD.'
        });
    }

    const username = cleanText(req.body.username, 80);
    const password = String(req.body.password || '');

    if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Sai tài khoản hoặc mật khẩu.' });
    }

    setAdminCookie(res);
    res.json({ success: true });
});

app.post('/api/admin/logout', requireAdminAuth, (req, res) => {
    clearAdminCookie(res);
    res.json({ success: true });
});

app.get('/api/admin/me', requireAdminAuth, (req, res) => {
    res.json({ success: true, user: ADMIN_USER });
});

// 1. Tạo lịch đặt mới (Booking)
app.post('/api/bookings', (req, res) => {
    const name = cleanText(req.body.name, 80);
    const phone = normalizePhone(req.body.phone);
    const date = cleanText(req.body.date, 10);
    const time = cleanText(req.body.time, 5);
    const service = cleanText(req.body.service, 40);
    const stylist = cleanText(req.body.stylist || 'Ngau-nhien', 40);
    const note = cleanText(req.body.note, 500);

    if (!name || !phone || !date || !time) {
        return res.status(400).json({ success: false, error: 'Vui lòng điền đầy đủ tên, số điện thoại, ngày và giờ.' });
    }

    if (!/^\+?\d{9,15}$/.test(phone)) {
        return res.status(400).json({ success: false, error: 'Số điện thoại không hợp lệ.' });
    }

    if (!isFutureOrToday(date)) {
        return res.status(400).json({ success: false, error: 'Ngày đặt lịch không hợp lệ hoặc đã qua.' });
    }

    if (!ALLOWED_TIMES.has(time)) {
        return res.status(400).json({ success: false, error: 'Khung giờ đặt lịch không hợp lệ.' });
    }

    if (!ALLOWED_SERVICES.has(service) || !ALLOWED_STYLISTS.has(stylist)) {
        return res.status(400).json({ success: false, error: 'Dịch vụ hoặc stylist không hợp lệ.' });
    }

    const duplicateSql = `
        SELECT id FROM bookings
        WHERE date = ?
            AND time = ?
            AND status IN ('pending', 'confirmed')
            AND (stylist = ? OR stylist = 'Ngau-nhien' OR ? = 'Ngau-nhien')
        LIMIT 1
    `;

    db.get(duplicateSql, [date, time, stylist, stylist], (err, existingBooking) => {
        if (hasCallbackError(res, err)) return;

        if (existingBooking) {
            return res.status(409).json({
                success: false,
                error: 'Khung giờ này đã có lịch hẹn. Vui lòng chọn giờ hoặc stylist khác.'
            });
        }

        const sql = `INSERT INTO bookings (name, phone, date, time, service, stylist, note) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [name, phone, date, time, service, stylist, note], function(insertErr) {
            if (hasCallbackError(res, insertErr)) return;

            res.status(201).json({ success: true, message: 'Đặt lịch thành công!', bookingId: this.lastID });
        });
    });
});

app.get('/api/availability', (req, res) => {
    const date = cleanText(req.query.date, 10);
    const stylist = cleanText(req.query.stylist || 'Ngau-nhien', 40);

    if (!isFutureOrToday(date)) {
        return res.status(400).json({ success: false, error: 'Ngày kiểm tra không hợp lệ.' });
    }

    if (!ALLOWED_STYLISTS.has(stylist)) {
        return res.status(400).json({ success: false, error: 'Stylist không hợp lệ.' });
    }

    const sql = `
        SELECT DISTINCT time FROM bookings
        WHERE date = ?
            AND status IN ('pending', 'confirmed')
            AND (stylist = ? OR stylist = 'Ngau-nhien' OR ? = 'Ngau-nhien')
    `;

    db.all(sql, [date, stylist, stylist], (err, rows) => {
        if (hasCallbackError(res, err)) return;

        res.json({
            success: true,
            bookedTimes: rows.map(row => row.time),
            allTimes: Array.from(ALLOWED_TIMES)
        });
    });
});

app.post('/api/contacts', (req, res) => {
    const name = cleanText(req.body.name, 80);
    const phone = normalizePhone(req.body.phone);
    const service = cleanText(req.body.service, 40);
    const message = cleanText(req.body.message, 800);

    if (!name || !phone) {
        return res.status(400).json({ success: false, error: 'Vui lòng nhập tên và số điện thoại.' });
    }

    if (!/^\+?\d{9,15}$/.test(phone)) {
        return res.status(400).json({ success: false, error: 'Số điện thoại không hợp lệ.' });
    }

    if (!ALLOWED_CONTACT_SERVICES.has(service)) {
        return res.status(400).json({ success: false, error: 'Dịch vụ quan tâm không hợp lệ.' });
    }

    const sql = `INSERT INTO contacts (name, phone, service, message) VALUES (?, ?, ?, ?)`;
    db.run(sql, [name, phone, service, message], function(err) {
        if (hasCallbackError(res, err)) return;

        res.status(201).json({
            success: true,
            message: 'Đã gửi thông tin liên hệ. Loly Hairsalon sẽ gọi lại sớm.',
            contactId: this.lastID
        });
    });
});

// 2. Lấy danh sách lịch đặt (Dành cho trang Admin)
app.get('/api/bookings', requireAdminAuth, (req, res) => {
    const sql = `SELECT * FROM bookings ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

app.patch('/api/bookings/:id/status', requireAdminAuth, (req, res) => {
    const bookingId = Number.parseInt(req.params.id, 10);
    const status = cleanText(req.body.status, 20);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
        return res.status(400).json({ success: false, error: 'ID lịch hẹn không hợp lệ.' });
    }

    if (!ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({ success: false, error: 'Trạng thái lịch hẹn không hợp lệ.' });
    }

    db.run('UPDATE bookings SET status = ? WHERE id = ?', [status, bookingId], function(err) {
        if (hasCallbackError(res, err)) return;

        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy lịch hẹn.' });
        }

        res.json({ success: true, message: 'Đã cập nhật trạng thái lịch hẹn.' });
    });
});

app.delete('/api/bookings/:id', requireAdminAuth, (req, res) => {
    const bookingId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
        return res.status(400).json({ success: false, error: 'ID lịch hẹn không hợp lệ.' });
    }

    db.run('DELETE FROM bookings WHERE id = ?', [bookingId], function(err) {
        if (hasCallbackError(res, err)) return;

        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy lịch hẹn.' });
        }

        res.json({ success: true, message: 'Đã xóa lịch hẹn.' });
    });
});

app.get('/api/contacts', requireAdminAuth, (req, res) => {
    const sql = `SELECT * FROM contacts ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        res.json({ success: true, data: rows });
    });
});

app.patch('/api/contacts/:id/status', requireAdminAuth, (req, res) => {
    const contactId = Number.parseInt(req.params.id, 10);
    const status = cleanText(req.body.status, 20);

    if (!Number.isInteger(contactId) || contactId <= 0) {
        return res.status(400).json({ success: false, error: 'ID liên hệ không hợp lệ.' });
    }

    if (!ALLOWED_CONTACT_STATUSES.has(status)) {
        return res.status(400).json({ success: false, error: 'Trạng thái liên hệ không hợp lệ.' });
    }

    db.run('UPDATE contacts SET status = ? WHERE id = ?', [status, contactId], function(err) {
        if (hasCallbackError(res, err)) return;

        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy liên hệ.' });
        }

        res.json({ success: true, message: 'Đã cập nhật trạng thái liên hệ.' });
    });
});

app.delete('/api/contacts/:id', requireAdminAuth, (req, res) => {
    const contactId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(contactId) || contactId <= 0) {
        return res.status(400).json({ success: false, error: 'ID liên hệ không hợp lệ.' });
    }

    db.run('DELETE FROM contacts WHERE id = ?', [contactId], function(err) {
        if (hasCallbackError(res, err)) return;

        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy liên hệ.' });
        }

        res.json({ success: true, message: 'Đã xóa liên hệ.' });
    });
});

// 3. Lấy danh sách bài viết Blog
app.get('/api/posts', (req, res) => {
    const sql = `SELECT * FROM posts ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

// 4. Lấy chi tiết 1 bài viết Blog
app.get('/api/posts/:id', (req, res) => {
    const sql = `SELECT * FROM posts WHERE id = ?`;
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        if (!row) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
        }
        res.json({ success: true, data: row });
    });
});

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy API.' });
    }

    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.use((err, req, res, next) => {
    console.error(err);

    if (res.headersSent) {
        return next(err);
    }

    if (req.path.startsWith('/api/')) {
        return res.status(500).json({ success: false, error: 'Lỗi máy chủ nội bộ.' });
    }

    res.status(500).type('text/plain').send('Lỗi máy chủ nội bộ.');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
