const express = require('express');
const passport = require('passport');
const crypto = require('crypto'); 
const { Dropbox } = require('dropbox');
const config = require('./config.json');

module.exports = function(db) {
    const router = express.Router();
    const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });

    function getIp(req) {
        const rawIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip;
        return rawIp ? rawIp.split(',')[0].trim() : '';
    }

    router.get('/', (req, res) => {
        let dbUser = null;
        if (req.user) {
            const stmt = db.prepare('SELECT * FROM users WHERE discord_id = ?');
            dbUser = stmt.get(req.user.id);
        }
        res.render('home', {
            user: req.user,
            dbUser: dbUser,
            appName: config.appName
        });
    });

    router.get('/auth', passport.authenticate('discord'));

    router.get('/auth/callback', passport.authenticate('discord', {
        failureRedirect: '/'
    }), async (req, res) => {
        
        const bdTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
        const ipAddress = getIp(req);
        const email = req.user.email || '';

        let pfpUrl = '';
        if (req.user.avatar) {
            pfpUrl = `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png?size=1024`;
        } else {
            const defaultAvatarIndex = (BigInt(req.user.id) >> 22n) % 6n;
            pfpUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
        }

        const stmt = db.prepare('SELECT * FROM users WHERE discord_id = ?');
        const existingUser = stmt.get(req.user.id);

        if (!existingUser) {
            const secretUuid = crypto.randomUUID();

            const insert = db.prepare(`
                INSERT INTO users (uuid, discord_id, username, pfp_url, email, register_date, ip_address) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            insert.run(secretUuid, req.user.id, req.user.username, pfpUrl, email, bdTime, ipAddress);

            try {
                const folderPath = `/websites/${secretUuid}`;
                await dbx.filesCreateFolderV2({ path: folderPath });

                const defaultHtml = `<!DOCTYPE html>\n<html>\n<head><title>${req.user.username}'s Website</title></head>\n<body><h1>Welcome to ${req.user.username}'s new website!</h1></body>\n</html>`;

                await dbx.filesUpload({
                    path: `${folderPath}/index.html`,
                    contents: Buffer.from(defaultHtml),
                    mode: { '.tag': 'add' },
                    autorename: true
                });
            } catch (error) {
                console.error(error?.error || error);
            }
        } else {
            const update = db.prepare('UPDATE users SET username = ?, pfp_url = ?, email = ?, ip_address = ? WHERE discord_id = ?');
            update.run(req.user.username, pfpUrl, email, ipAddress, req.user.id);
        }

        res.redirect('/');
    });

    router.get('/logout', (req, res, next) => {
        req.logout((err) => {
            if (err) return next(err);
            res.redirect('/');
        });
    });

    return router;
};
