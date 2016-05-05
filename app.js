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
var PLAYER_LIST = {};

var Player = function(id) {
	var self = {
		x:250,
		y:250,
		id:id,
		number:"" + Math.floor(10 * Math.random()),
		moveRight:false,
		moveLeft:false,
		moveUp:false,
		moveDown:false,
		maxSpd:10,
	}

	self.updateEntityPosition = function(){
		//move the player appropriately
		if(self.moveRight)
		{
			self.x += self.maxSpd;
		}
		if(self.moveLeft)
		{
			self.x -= self.maxSpd;
		}
		if(self.moveDown)
		{
			self.y += self.maxSpd;
		}
		if(self.moveUp)
		{
			self.y -= self.maxSpd;
		}
	}


	return self;
}
//socket.io
//loads and init the file and returns an object
var io = require('socket.io')(serv,{});


io.sockets.on('connection', function(socket){
	//add identifiers for each player
	socket.id = Math.random();

	var player = Player(socket.id);
	
	//add to the socket list
	SOCKET_LIST[socket.id] = socket;
	//add player to player list
	PLAYER_LIST[socket.id] = player;

	//when there is a disconnect
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
	});

	//when there is movement change
	socket.on('keyPress', function(data) {
		//check if the data sent back is the direction and chnage the state accordingly
		if(data.inputId === 'left')
			player.moveLeft = data.state;
		else if(data.inputId === 'right')
			player.moveRight = data.state;
		else if(data.inputId === 'up')
			player.moveUp = data.state;
		else if(data.inputId === 'down')
			player.moveDown = data.state;
	});
});

//loop through socket list
setInterval(function()
{
	var pack = [];

	for(var i in PLAYER_LIST)
	{
		var player = PLAYER_LIST[i];
		//update the players position
		player.updateEntityPosition();

		pack.push({
			x:player.x,
			y:player.y,
			number:player.number
		});
		
	}
	//for each player, send the package
	for(var i in SOCKET_LIST)
	{
		var socket = SOCKET_LIST[i];
		socket.emit('New Position',pack);
	}

},1000/25);
