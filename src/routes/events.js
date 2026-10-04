const express = require('express');
const { addClient, removeClient } = require('../utils/events');

const router = express.Router();

router.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  res.write('event: connected\ndata: {"status":"connected"}\n\n');
  addClient(res);

  req.on('close', () => {
    removeClient(res);
  });
});

module.exports = router;
