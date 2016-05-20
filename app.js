//file communication using express
//package communication using socket.io

var mongojs = require('mongojs');
//listen to the correct port address and bring in the collection you want/need
var db = mongojs('localhost:27017.myGame', ['account','progress']);


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

	self.getDistance = function(point)
	{
		//return square root of the point and player
		return Math.sqrt(Math.pow(self.x-point.x,2) + Math.pow(self.y-point.y,2));
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
	self.attack = false;
	self.mouseAngle = 0;
	self.maxSpd = 10;

	var super_update = self.update;
	self.update = function()
	{
		self.updateSpd();
		super_update();

		//bullets
		//create a bullet at a random angle
		//shoot on mouse click
		if(self.attack)
		{
			//shoot bullet at mouse direction angle
			self.shootBullet(self.mouseAngle);
		}
	}

	self.shootBullet = function(angle) {
		var b = Bullet(self.id,angle);
		b.x = self.x;
		b.y = self.y;
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
var Bullet = function(parent,angle)
{
	var self = Entity();
	self.id = Math.random();
	self.spdX = Math.cos(angle/180*Math.PI) * 10;
	self.spdY = Math.sin(angle/180*Math.PI) * 10;
	//parent bullets cant touch parent
	self.parent = parent;
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;

	self.update = function()
	{
		if(self.timer++ > 50)
		{
			self.toRemove = true;
		}

		super_update();

		//loop through every player
		for(var i in Player.list)
		{
			//get the player
			var p = Player.list[i];

			//if distance is 
			if(self.getDistance(p) < 32 && self.parent !== p.id){
				//handle collision
				self.toRemove = true;
			}
		}
	}

	Bullet.list[self.id] = self;

	return self;
}

//Bullet Update
Bullet.update = function()
{
	var pack = [];

	for(var i in Bullet.list)
	{
		var bullet = Bullet.list[i];
		//update the players position
		bullet.update();

		//remove bullet
		if(bullet.toRemove)
		{
			delete Bullet.list[i];
		}

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
		else if(data.inputId === 'attack')
			player.attack = data.state;
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
	});
}

//disconnect static function
Player.onDisconnect = function(socket)
{
	//delete player from list
	delete Player.list[socket.id];
}

var isValidUser = function(data,cb){
	db.account.find({username:data.username,password:data.password}, function(err,res){
		//cb = callback
		//if res has a value
		if(res[0])
		{
			cb(true);
		}
		else
		{
			cb(false);
		}
	});
}

var isUsernameTaken = function(data,cb){
	//return true if username is taken
	db.account.find({username:data.username}, function(err,res){
		//cb = callback
		//if res has a value
		if(res[0])
		{
			cb(true);
		}
		else
		{
			cb(false);
		}
	});
}

var addUsername = function(data,cb){
	//add the user
	db.account.insert({username:data.username,password:data.password}, function(err){
		//cb = callback
		cb();
	});
}

//socket.io
//loads and init the file and returns an object
var io = require('socket.io')(serv,{});
//allow admin debug
var DEBUG = true;

//when a player connects
io.sockets.on('connection', function(socket){
	//add identifiers for each player
	socket.id = Math.random();

	//create a player on sign-in success
	socket.on('signIn',function(data)
	{
		//check if there is a valid user
		isValidUser(data, function(res)
		{
			if(res)
			{
				//create a player
				Player.onConnect(socket);
				//send success to client
				socket.emit('signInResponse', {success:true});

			} 
			else
			{
				socket.emit('signInResponse', {success:false});
			}
		});
	});

	//sign-up success
	socket.on('signUp',function(data)
	{
		//check if there is a username already taken
		isUsernameTaken(data, function(res){
			if(res)
			{
				//send success to client
				socket.emit('signUpResponse', {success:false});
			} else
			{
				addUsername(data, function(){
					socket.emit('signUpResponse', {success:true});
				});
			}
		});
		
	});
	
	
	//add to the socket list
	SOCKET_LIST[socket.id] = socket;

	//when there is a disconnect
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});

	//when there is a message sent
	socket.on('SendToServer', function(data) {
		//player name is their ID
		var playerName = ("" + socket.id).slice(2,7);
		
		//loop through each player and emit the data for any player who chats
		for(var i in SOCKET_LIST)
		{
			SOCKET_LIST[i].emit('addToChat', playerName + ': ' + data);
		}
	});

	//if the player submits a message with a '/' we will eval the data
	socket.on('evalServer', function(data) {

		//evaluate the data
		var res = eval(data);
		socket.emit('evalAnswer', res);
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
