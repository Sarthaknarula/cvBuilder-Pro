// Used to run the backend communication (download pdf, fetching templates)

// configuring the .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Connecting to database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Fetching templates
app.get('/api/templates', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM templates ORDER BY title ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// Complining Latex code to make downloadable pdf
app.post('/api/compile-pdf', (req, res) => {
    const latexString = req.body.latex;

    if (!latexString) {
        return res.status(400).json({ error: 'No LaTeX code provided' });
    }

    const uniqueId = crypto.randomUUID();
    const tempDir = path.join(__dirname, 'temp', uniqueId);
    
    fs.mkdirSync(tempDir, { recursive: true });

    const texFilePath = path.join(tempDir, 'resume.tex');
    const pdfFilePath = path.join(tempDir, 'resume.pdf');

    fs.writeFileSync(texFilePath, latexString);

    const command = `pdflatex -interaction=nonstopmode -halt-on-error resume.tex`;

    exec(command, { cwd: tempDir }, (error, stdout, stderr) => {
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

const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Middleware for sessions
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback" // This MUST match your Cloud Console exactly
}, async (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value;
    try {
        // Check if user exists, if not, create them
        let res = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (res.rows.length === 0) {
            res = await pool.query(
                "INSERT INTO users (email, oauth_provider) VALUES ($1, $2) RETURNING *",
                [email, 'google']
            );
        }
        return done(null, res.rows[0]);
    } catch (err) {
        return done(err);
    }
}));

// Serialize/Deserialize to keep the user logged in
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, res.rows[0]);
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/'); // Take the user home after they log in
    }
);

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 Server running at: http://localhost:${PORT}`);
    console.log(`=========================================`);
});