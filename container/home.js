const express = require('express');
const passport = require('passport');
const config = require('./config.json');
const router = express.Router();

// Home Page
router.get('/', (req, res) => {
    // req.user will be populated if the user is authenticated
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

module.exports = router;
