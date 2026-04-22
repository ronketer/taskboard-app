const express = require('express');
const router = express.Router();
const { getTodayQuote } = require('../controllers/quotes');

router.get('/today', getTodayQuote);

module.exports = router;
