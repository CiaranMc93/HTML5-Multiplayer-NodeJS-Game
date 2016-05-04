//file communication using express
//package communication using socket.io

var express = require('express');
var app = express();
var serv = require('http').Server(app);

//if the query is empty, the index file will be hit
app.get('/', function(req,res) {
	res.sendFile(__dirname + '/client/index.html');
});

//if the route is client, hit the client
app.use('/client',express.static(__dirname + '/client'));

//listen on port 2000
serv.listen(2000);
console.log('Server Started');

//create a list of sockets and assign unique ID to each
var SOCKET_LIST = {};


//socket.io
//loads and init the file and returns an object
var io = require('socket.io')(serv,{});


io.sockets.on('connection', function(socket){
	//add identifiers for each player
	socket.id = Math.random();
	socket.x = 0;
	socket.y = 0;

	//add to the socket list
	SOCKET_LIST[socket.id] = socket;

	socket.on('happy', function(){
		console.log('Happy');
	});
});

//loop through socket list
setInterval(function()
{
	var pack = [];

	for(var i in SOCKET_LIST)
	{
		var socket = SOCKET_LIST[i];
		socket.x++;
		socket.y++;
		pack.push({
			x:socket.x,
			y:socket.y
		});
		
	}
	//for each player, send the package
	for(var i in SOCKET_LIST)
	{
		var socket = SOCKET_LIST[i];
		socket.emit('New Position',pack);
	}

},1000/25);
