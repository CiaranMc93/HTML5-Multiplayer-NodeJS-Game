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

//shared template
var Entity = function() {
	var self = {
		x:250,
		y:250,
		spdX:0,
		spdY:0,
		id:"",
	}

	//common functions
	self.update = function()
	{
		self.updateEntityPosition();
	}

	self.updateEntityPosition = function()
	{
		self.x += self.spdX;
		self.y += self.spdY;
	}

	return self;
}

var Player = function(id) {

	var self = Entity();
	//player values
	self.id = id;
	self.number = Math.floor(10 * Math.random());
	self.moveRight = false;
	self.moveLeft = false;
	self.moveUp = false;
	self.moveDown = false;
	self.maxSpd = 10;

	var super_update = self.update;
	self.update = function()
	{
		self.updateSpd();
		super_update();
	}

	self.updateSpd = function(){
		//move the player appropriately
		if(self.moveRight)
		{
			self.spdX = self.maxSpd;
		}
		else if(self.moveLeft)
		{
			self.spdX = -self.maxSpd;
		}
		else
		{
			self.spdX = 0;
		}

		if(self.moveDown)
		{
			self.spdY = self.maxSpd;
		}
		else if(self.moveUp)
		{
			self.spdY = -self.maxSpd;
		}
		else
		{
			self.spdY = 0;
		}
	}

	//add the player to the list
	Player.list[id] = self;

	return self;
}
//player list
Player.list = {};

//bullet entity
var Bullet = function(angle)
{
	var self = Entity();
	self.id = Math.random();
	self.spdX = Math.cos(angle/180*Math.PI) * 10;
	self.spdY = Math.sin(angle/180*Math.PI) * 10;

	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function()
	{
		if(self.timer++ > 10)
		{
			self.toRemove = true;
		}

		super_update();
	}

	Bullet.list[self.id] = self;

	return self;
}

//Bullet Update
Bullet.update = function()
{

	//create a bullet at a random angle
	if(Math.random() < 0.1)
	{
		Bullet(Math.random()*360);
	}

	var pack = [];

	for(var i in Bullet.list)
	{
		var bullet = Bullet.list[i];
		//update the players position
		bullet.update();

		pack.push({
			x:bullet.x,
			y:bullet.y,
		});
	}

	return pack;
}

Bullet.list = {};

//on connect static function
Player.onConnect = function(socket)
{
	var player = Player(socket.id);
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
}

//disconnect static function
Player.onDisconnect = function(socket)
{
	//delete player from list
	delete Player.list[socket.id];
}

//socket.io
//loads and init the file and returns an object
var io = require('socket.io')(serv,{});

//when a player connects
io.sockets.on('connection', function(socket){
	//add identifiers for each player
	socket.id = Math.random();

	Player.onConnect(socket)
	
	//add to the socket list
	SOCKET_LIST[socket.id] = socket;

	//when there is a disconnect
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});

	//when there is a message sent
	socket.on('SendToServer', function(data) {
		var playerName = ("" + socket.id).slice(2,7);
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
});

Player.update = function()
{
	var pack = [];

	for(var i in Player.list)
	{
		var player = Player.list[i];
		//update the players position
		player.update();

		pack.push({
			x:player.x,
			y:player.y,
			number:player.number
		});
	}

	return pack;
}

//loop through socket list
//main game loop
setInterval(function()
{
	var pack = {
		player:Player.update(),
		bullet:Bullet.update(),
	}


	//for each player, send the package
	for(var i in SOCKET_LIST)
	{
		var socket = SOCKET_LIST[i];
		socket.emit('New Position',pack);
	}

},1000/25);
