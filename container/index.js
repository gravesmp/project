require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const config = require('./config.json');
const Database = require('better-sqlite3'); 

const app = express();
app.set('trust proxy', 1);

const db = new Database('users.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE,
    discord_id TEXT UNIQUE,
    username TEXT,
    pfp_url TEXT,
    email TEXT,
    register_date TEXT,
    ip_address TEXT
  )
`);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } 
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'email'] 
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

const homeRoutes = require('./home.js')(db);
app.use('/', homeRoutes);

app.listen(config.port, () => {
    const displayUrl = config.url || `http://localhost:${config.port}`;
    console.log(`✅ ${config.appName} is running on ${displayUrl}`);
});
