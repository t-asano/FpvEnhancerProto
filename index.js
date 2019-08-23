'use strict';

const LISTEN_PORT = 3000;
var express = require('express');
var app = express();
var http = require('http').Server(app);

app.use(express.static('docs', {
  index: 'index.html'
}));

http.listen(LISTEN_PORT, function () {
  console.log('HTTP listening on *:' + LISTEN_PORT);
});