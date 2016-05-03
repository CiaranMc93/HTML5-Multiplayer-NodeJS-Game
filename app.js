//file communication using express
//package communication using socket.io

var express = require('express');
var app = express();
var serv = require('http').Server(app);

//if the query is empty, the index file will be hit
app.get('/', function(req,res) {
	res.sendFile(_dirname + '/client/index.html');
});

//if the route is client, hit the client
app.use('/client',express.static(_dirname + '/client'));

//listen on port 2000
serv.listen(2000);
