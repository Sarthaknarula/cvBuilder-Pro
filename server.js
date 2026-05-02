require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const { Pool } = require('pg');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname));

// --- DATABASE CONNECTION ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- PASSPORT GOOGLE AUTH ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    proxy: true
}, async (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value;
    try {
        let res = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (res.rows.length === 0) {
            res = await pool.query("INSERT INTO users (email, oauth_provider) VALUES ($1, $2) RETURNING *", [email, 'google']);
        }
        return done(null, res.rows[0]);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        done(null, res.rows[0]);
    } catch (err) {
        done(err, null);
    }
});

// --- 1. AUTH ROUTES ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('/'));
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) res.json({ loggedIn: true, user: req.user });
    else res.json({ loggedIn: false });
});
app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

// --- 2. CLOUD SAVE/LOAD ROUTES ---
app.post('/api/save-resume', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'You must be logged in to save.' });
    
    const userId = req.user.id;
    const { templateId, resumeData } = req.body;
    
    if (!templateId || !resumeData) return res.status(400).json({ error: 'Missing template ID or resume data.' });

    try {
        const query = `
            INSERT INTO resumes (user_id, template_id, resume_data)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, template_id)
            DO UPDATE SET resume_data = EXCLUDED.resume_data, updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        await pool.query(query, [userId, templateId, JSON.stringify(resumeData)]);
        res.json({ success: true, message: 'Saved successfully!' });
    } catch (err) {
        console.error("Database Save Error:", err);
        res.status(500).json({ error: 'Failed to save resume to cloud.' });
    }
});

app.get('/api/load-resume/:templateId', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not logged in.' });
    
    const userId = req.user.id;
    const templateId = req.params.templateId;

    try {
        const query = `SELECT resume_data FROM resumes WHERE user_id = $1 AND template_id = $2;`;
        const result = await pool.query(query, [userId, templateId]);

        if (result.rows.length > 0) res.json({ resumeData: result.rows[0].resume_data });
        else res.status(404).json({ message: 'No saved resume found.' });
    } catch (err) {
        console.error("Database Load Error:", err);
        res.status(500).json({ error: 'Failed to load resume.' });
    }
});

app.get('/api/my-resumes', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not logged in' });
    
    try {
        const query = `
            SELECT r.template_id, r.updated_at, t.title, t.description, t.preview_html
            FROM resumes r
            JOIN templates t ON r.template_id = t.id
            WHERE r.user_id = $1
            ORDER BY r.updated_at DESC;
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error("Fetch My Resumes Error:", err);
        res.status(500).json({ error: 'Failed to fetch saved resumes.' });
    }
});

// --- 3. TEMPLATE & COMPILATION ROUTES ---
app.get('/api/templates', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM templates ORDER BY title ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

app.post('/api/compile-pdf', (req, res) => {
    const latexString = req.body.latex;
    if (!latexString) return res.status(400).json({ error: 'No LaTeX code provided' });

    const uniqueId = crypto.randomUUID();
    const tempDir = path.join(__dirname, 'temp', uniqueId);
    fs.mkdirSync(tempDir, { recursive: true });

    const texFilePath = path.join(tempDir, 'resume.tex');
    const pdfFilePath = path.join(tempDir, 'resume.pdf');
    fs.writeFileSync(texFilePath, latexString);

    exec(`pdflatex -interaction=nonstopmode -halt-on-error resume.tex`, { cwd: tempDir }, (error, stdout, stderr) => {
        if (fs.existsSync(pdfFilePath)) {
            res.download(pdfFilePath, 'Resume.pdf', (err) => {
                if (err) console.error('Error sending file:', err);
                fs.rmSync(tempDir, { recursive: true, force: true });
            });
        } else {
            console.error('LaTeX Compilation Error:', stdout);
            fs.rmSync(tempDir, { recursive: true, force: true });
            res.status(500).json({ error: 'LaTeX compilation failed.', details: stdout });
        }
    });
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 Server running at: http://localhost:${PORT}`);
    console.log(`=========================================`);
});