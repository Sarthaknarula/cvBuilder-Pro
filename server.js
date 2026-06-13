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
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production", maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

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

const redisConnection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});

const pdfQueue = new Queue('pdf-compilation', { 
    connection: redisConnection,
    streams: { events: { maxLen: 10 } }
});

const pdfWorker = new Worker('pdf-compilation', async (job) => {
    const { latexString, jobId } = job.data;
    const tempDir = path.join(__dirname, 'temp', jobId);
    const texFilePath = path.join(tempDir, 'resume.tex');
    const pdfFilePath = path.join(tempDir, 'resume.pdf');
    
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(texFilePath, latexString);

    return new Promise((resolve, reject) => {
        exec(`pdflatex -interaction=nonstopmode -halt-on-error resume.tex`, { cwd: tempDir, timeout: 20000 }, (error, stdout, stderr) => {
            if (fs.existsSync(pdfFilePath)) {
                const pdfBuffer = fs.readFileSync(pdfFilePath);
                const base64Pdf = pdfBuffer.toString('base64');
                fs.rmSync(tempDir, { recursive: true, force: true });
                resolve({ pdfBase64: base64Pdf });
            } else {
                fs.rmSync(tempDir, { recursive: true, force: true });
                reject(new Error('Compilation failed. Check LaTeX syntax.'));
            }
        });
    });
}, { 
    connection: redisConnection,
    concurrency: 1,
    streams: { events: { maxLen: 10 } }
});

pdfWorker.on('completed', async () => {
    await redisConnection.xtrim('bull:pdf-compilation:events', 'MAXLEN', '~', '10');
});

pdfWorker.on('failed', async () => {
    await redisConnection.xtrim('bull:pdf-compilation:events', 'MAXLEN', '~', '10');
});

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

app.post('/api/save-resume', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'You must be logged in.' });
    
    const userId = req.user.id;
    const { templateId, resumeName, resumeData } = req.body;
    
    if (!templateId || !resumeName || !resumeData) return res.status(400).json({ error: 'Missing data.' });

    try {
        const query = `
            INSERT INTO resumes (user_id, template_id, resume_name, resume_data)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, resume_name)
            DO UPDATE SET 
                resume_data = EXCLUDED.resume_data, 
                template_id = EXCLUDED.template_id, 
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        await pool.query(query, [userId, templateId, resumeName, JSON.stringify(resumeData)]);
        res.json({ success: true, message: 'Saved successfully!' });
    } catch (err) {
        console.error("Save Error:", err);
        res.status(500).json({ error: 'Failed to save.' });
    }
});

app.get('/api/load-resume/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not logged in.' });
    try {
        const query = `SELECT resume_data, resume_name FROM resumes WHERE id = $1 AND user_id = $2;`;
        const result = await pool.query(query, [req.params.id, req.user.id]);
        if (result.rows.length > 0) res.json({ resumeData: result.rows[0].resume_data, resumeName: result.rows[0].resume_name });
        else res.status(404).json({ message: 'Not found.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load.' });
    }
});

app.get('/api/my-resumes', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not logged in' });
    try {
        const query = `
            SELECT r.id, r.resume_name, r.template_id, r.updated_at, t.preview_html
            FROM resumes r
            JOIN templates t ON r.template_id = t.id
            WHERE r.user_id = $1
            ORDER BY r.updated_at DESC;
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch saves.' });
    }
});

app.delete('/api/delete-resume/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not logged in' });
    try {
        await pool.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete.' });
    }
});

app.get('/api/templates', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM templates ORDER BY title ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/compile-pdf', async (req, res) => {
    const latexString = req.body.latex;
    if (!latexString) return res.status(400).json({ error: 'No LaTeX code provided' });

    const uniqueId = crypto.randomUUID();
    
    const job = await pdfQueue.add('compile', { latexString, jobId: uniqueId }, {
        removeOnComplete: { age: 30, count: 5 },
        removeOnFail: { age: 30, count: 5 }
    });
    
    res.json({ message: 'Compilation queued', jobId: job.id });
});

app.get('/api/job-status/:id', async (req, res) => {
    try {
        const job = await pdfQueue.getJob(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        const state = await job.getState();
        
        if (state === 'completed') {
            res.json({ status: 'completed', result: job.returnvalue });
        } else if (state === 'failed') {
            res.json({ status: 'failed', error: job.failedReason });
        } else {
            res.json({ status: state }); 
        }
    } catch (error) {
        res.status(500).json({ error: 'Error checking job status' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at: http://localhost:${PORT}`);
});