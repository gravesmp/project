require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const config = require('./config.json');
const Database = require('better-sqlite3'); // Added SQLite

const app = express();

// Trust proxy for Cloudflare Tunnel (Required for accurate IPs)
app.set('trust proxy', 1);

// --- GLOBAL DATABASE INITIALIZATION ---
const db = new Database('users.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    discord_id TEXT PRIMARY KEY,
    username TEXT,
    register_date TEXT,
    ipv4 TEXT,
    ipv6 TEXT
  )
`);
console.log("✅ Database users.db initialized successfully!");

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Serialize and Deserialize user
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Set up Discord Strategy
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'email'] 
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

// --- ROUTE HANDLERS ---
// We execute require('./home.js') as a function and pass the 'db' variable into it
const homeRoutes = require('./home.js')(db);
app.use('/', homeRoutes);

// Start Server
app.listen(config.port, () => {
    const displayUrl = config.url || `http://localhost:${config.port}`;
    console.log(`✅ ${config.appName} is running on ${displayUrl}`);
});
