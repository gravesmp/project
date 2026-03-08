const express = require('express');
const passport = require('passport');
const config = require('./config.json');

// We wrap the router in a module.exports function to accept 'db' from index.js
module.exports = function(db) {
    const router = express.Router();

    // Helper to extract IP (Compatible with Cloudflare Tunnels)
    function extractIps(req) {
        const rawIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip;
        let ip = rawIp ? rawIp.split(',')[0].trim() : '';
        
        let ipv4 = null;
        let ipv6 = null;

        if (ip.includes(':')) {
            // Handle IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.1)
            if (ip.includes('::ffff:')) {
                ipv4 = ip.split('::ffff:')[1];
            } else {
                ipv6 = ip;
            }
        } else if (ip) {
            ipv4 = ip;
        }

        return { ipv4, ipv6 };
    }

    // Home Page
    router.get('/', (req, res) => {
        res.render('home', {
            user: req.user,
            appName: config.appName
        });
    });

    // Initialize Discord Authentication
    router.get('/auth/discord', passport.authenticate('discord'));

    // Discord Authentication Callback
    router.get('/auth/discord/callback', passport.authenticate('discord', {
        failureRedirect: '/'
    }), (req, res) => {
        // 1. Get Bangladesh Time
        const bdTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
        
        // 2. Extract IPs
        const { ipv4, ipv6 } = extractIps(req);

        // 3. Database Logic using the 'db' passed from index.js
        const stmt = db.prepare('SELECT * FROM users WHERE discord_id = ?');
        const existingUser = stmt.get(req.user.id);

        if (!existingUser) {
            // Create new user
            const insert = db.prepare(`
                INSERT INTO users (discord_id, username, register_date, ipv4, ipv6) 
                VALUES (?, ?, ?, ?, ?)
            `);
            insert.run(req.user.id, req.user.username, bdTime, ipv4, ipv6);
        } else {
            // Update IPs and username if they logged in with a new one
            const newIpv4 = ipv4 || existingUser.ipv4;
            const newIpv6 = ipv6 || existingUser.ipv6;
            const update = db.prepare('UPDATE users SET username = ?, ipv4 = ?, ipv6 = ? WHERE discord_id = ?');
            update.run(req.user.username, newIpv4, newIpv6, req.user.id);
        }

        // On success, redirect back to home
        res.redirect('/');
    });

    // Logout Route
    router.get('/logout', (req, res, next) => {
        req.logout((err) => {
            if (err) return next(err);
            res.redirect('/');
        });
    });

    // Return the configured router back to index.js
    return router;
};
