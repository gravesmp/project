const express = require('express');
const passport = require('passport');
const config = require('./config.json');

module.exports = function(db) {
    const router = express.Router();

    // Helper to extract IP securely (Cloudflare Tunnel Compatible)
    function extractIps(req) {
        const rawIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip;
        let ip = rawIp ? rawIp.split(',')[0].trim() : '';
        
        let ipv4 = null;
        let ipv6 = null;

        if (ip.includes(':')) {
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

    // Clean Auth Endpoint
    router.get('/auth', passport.authenticate('discord'));

    // Clean Callback Endpoint
    router.get('/auth/callback', passport.authenticate('discord', {
        failureRedirect: '/'
    }), (req, res) => {
        // 1. Get Bangladesh Time
        const bdTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
        
        // 2. Extract IPs
        const { ipv4, ipv6 } = extractIps(req);

        // 3. Database Logic
        const stmt = db.prepare('SELECT * FROM users WHERE discord_id = ?');
        const existingUser = stmt.get(req.user.id);

        if (!existingUser) {
            const insert = db.prepare(`
                INSERT INTO users (discord_id, username, register_date, ipv4, ipv6) 
                VALUES (?, ?, ?, ?, ?)
            `);
            insert.run(req.user.id, req.user.username, bdTime, ipv4, ipv6);
        } else {
            const newIpv4 = ipv4 || existingUser.ipv4;
            const newIpv6 = ipv6 || existingUser.ipv6;
            const update = db.prepare('UPDATE users SET username = ?, ipv4 = ?, ipv6 = ? WHERE discord_id = ?');
            update.run(req.user.username, newIpv4, newIpv6, req.user.id);
        }

        res.redirect('/');
    });

    // Logout Route
    router.get('/logout', (req, res, next) => {
        req.logout((err) => {
            if (err) return next(err);
            res.redirect('/');
        });
    });

    return router;
};
