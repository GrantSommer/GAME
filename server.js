var express=require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var _=require("underscore");
var request=require("request");
var fs=require("fs");

/* Nodemon Graceful Shutdown */
process.once('SIGUSR2', function () {
  console.log("Shutting down...");
  broadcast("chat",{"from":"[Server]","message":"Shutting down..."});
  request.post("http://GAME.pie.cool/serverlist/register.php",{
    "form":{
      "unregister":true,
      "token":CONFIG.token
    }
  },(err,res,body)=>{
    console.log("Unregistered from server list.");
    process.kill(process.pid, 'SIGUSR2');
  });
});

const CONFIG=JSON.parse(fs.readFileSync("config.json","utf8"));

if(CONFIG.registerList){
  console.log("Registering server list identification...");
  request.post("http://GAME.pie.cool/serverlist/register.php",{
    "form":{
      "config":CONFIG
    }
  },(err,res,body)=>{
    console.log("Registered server list result:");
    console.log(body);
    if(typeof body!=="object"){
      body=JSON.parse(body);
    }
    if(!body.success){
      console.log("Unable to register to server list:");
      console.log(body.error);
      process.exit(1);
    }
    console.log("Successfully registered server list");
    CONFIG.token=body.token;
    fs.writeFileSync("config.json",JSON.stringify(CONFIG));
  });
}else{
  console.log("Server list identification disabled in config");
}

app.use(express.static("public"));

var sockets=[];
var users=[];

var round=1;
var allowNextRound=false;
var started=false;

function nextRound(force){
  if(!force){
    if(users.find(a=>a.type==="zombie")){
      return;
    }
    if(!allowNextRound){
      return;
    }
  }
  allowNextRound=false;
  broadcast("chat",{
    "from":"[Round]",
    "message":"Round ended. 10s until next round!"
  });
  users.forEach(a=>{
    a.bullets+=10;
  });

  broadcast("round status",{"status":"ended","countdown":10000});
  setTimeout(()=>{
    round++;
    broadcast("chat",{
      "from":"[Round]",
      "message":"Next round starting!"
    });
    broadcast("round status",{"status":"start","countdown":false})
    setTimeout(nextRound,30000);
    for(i=0;i<round*2;i++){
      spawnZombie();
    }
  },10000);
}

const RoomMap=[
  ["a1","a2","a3","a4","a5","a6","a7"],
  ["b1","b2","b3","b4","b5","b6","b7"],
  ["c1","c2","c3","c4","c5","c6","c7"],
  ["d1","d2","d3","d4","d5","d6","d7"],
  ["e1","e2","e3","e4","e5","e6","e7"],
  ["f1","f2","f3","f4","f5","f6","f7"],
  ["g1","g2","g3","g4","g5","g6","g7"],
];

/*var Keys={
  "87":false, // w
  "65":false, // a
  "83":false, // s
  "68":false, // d
};*/

function spawnLootbox(){
  if(users.filter(a=>a.type==="lootbox").length>=2){
    // Only two lootboxes at a time
    return;
  }
  function getRoom(){
    var room=RoomMap[_.random(0,RoomMap.length-1)][_.random(0,RoomMap[_.random(0,RoomMap.length-1)].length-1)];
    if(users.find(a=>a.type==="lootbox"&&a.room===room)){
      return getRoom();
    }else{
      return room;
    }
  }
  var room=getRoom();
  broadcast("chat",{
    "from":"[Lootbox]",
    "message":"Dropping in "+room
  });

  users.push({
    "type":"lootbox",
    "nickname":"Lootbox",
    "room":room,
    "x":300,
    "y":200,
    "health":5,
    "maxHealth":5,
    "width":25,
    "height":25,
    "age":30000
  });
}

var Events={
  "zombie":{
    "time":1000
  },
  "lootBox":{
    "time":5000
  },
  "healPlayers":{
    "time":1000
  }
};

setInterval(()=>{
  if(!users.filter(a=>a.socket).length){
    return;
  }

  /* Round Detection */
  nextRound(false);

  if(Events.healPlayers.time<=0){
    var healPlayers=true;
    Events.healPlayers.time=1000;
  }else{
    Events.healPlayers.time--;
    var healPlayers=false;
  }

  users.forEach(a=>{
    /* Lootbox Age */
    if(a.type==="lootbox"){
      if(a.age<=0){
        users.splice(users.indexOf(a),1);
      }else{
        a.age--;
      }
    }

    /* Heal Players */
    if(healPlayers&&a.socket){
      if(a.health<a.maxHealth&&!a.regenTimeout){
        a.health++;
      }else if(a.regenTimeout){
        a.regenTimeout--;
      }
    }

    /* Bullets */
    if(a.socket){
      if(users.find(b=>a.room===b.room&&b.type==="bullet"&&a.x-10<b.x&&a.y-10<b.y&&a.x+35>b.x&&a.y+60>b.y)){
        //
      }
    }
    if(a.type==="bullet"){
      var done=[0,0];
      if(a.target.x>a.x){
        a.x++;
      }else if(a.target.x<a.x){
        a.x--;
      }
      if(a.target.x-2<a.x&&a.target.x+2>a.x){
        done[0]=true;
      }
      if(a.target.y>a.y){
        a.y++;
      }else if(a.target.y<a.y){
        a.y--;
      }
      if(a.target.y-2<a.y&&a.target.y+2>a.y){
        done[1]=true;
      }
      if(done[0]&&done[1]){
        users.splice(users.indexOf(a),1);
      }
      var opp=users.find(b=>
        b.x+b.width>a.x&&b.y+b.height>a.y&&
        b.x<a.x&&b.y<a.y&&
        !b.projectile&&a.owner!==b.nickname&&b.room===a.room&&(b.socket||b.type==="zombie"||b.type==="lootbox"));
      if(opp){
        if(opp.type==="lootbox"){
          if(opp.health<=0){
            var _bullets=_.random(10,50);
            users[users.indexOf(users.find(b=>b.nickname===a.owner))].bullets+=_bullets;
            sockets[users[users.indexOf(users.find(b=>b.nickname===a.owner))].socket].emit("chat",{
              "from":"[Lootbox]",
              "message":"You collected "+_bullets+" bullet(s)"
            });
            users.splice(users.indexOf(opp),1);
          }else{
            opp.health--;
          }
        }else{
          if(opp.health>0){
            opp.health--;
            if(opp.socket){
              opp.regenTimeout=5;
            }
          }
          if(opp.health<=0){
            kill(opp,"bullet",a);
            users[users.indexOf(users.find(b=>b.nickname===a.owner))].coins+=(opp.socket?opp.coins:(opp.prize?opp.prize:1));
          }
        }
        users.splice(users.indexOf(a),1);
      }
    }
  });

  /* Loot Boxes */
  if(Events.lootBox.time<=0){
    spawnLootbox();

    Events.lootBox.time=5000/(round/2);
  }else{
    Events.lootBox.time--;
  }

  /* lastRoomUpdate */
  users.forEach(a=>{
    users[users.indexOf(a)].lastRoomUpdate-=(users[users.indexOf(a)].lastRoomUpdate?1:0);
  });

  /*if(!Events.zombie.time){

    //broadcast("chat",{"from":"Server","message":"Spawned a zombie"});
    Events.zombie.time=1000;
  }else{
    Events.zombie.time--;
  }*/

  users.forEach(a=>{
    /* Fix "undefined" nicknames */
    if(a.socket&&!a.nickname){
      //sockets[a.socket].emit("dialog","name");
    }
    /* Zombie AI */
    if(a.type==="zombie"){
      var usersInRoom=[];
      users.forEach(b=>{
        if(b.room===a.room&&b.type!=="zombie"&&b.socket){
          usersInRoom.push(b);
        }
      });

      if(!a.track||!usersInRoom.find(b=>b.nickname===a.track)){
        if(!usersInRoom||!usersInRoom.length){
          var MyRoomIndex=null;
          var MyRowIndex=null;
          RoomMap.forEach(b=>{
            if(b.indexOf(a.room)>-1){
              MyRoomIndex=b.indexOf(a.room);
              MyRowIndex=RoomMap.indexOf(b);
            }
          });
          if(RoomMap[MyRowIndex-1]){
            if(users.find(a=>a.room===RoomMap[MyRowIndex-1][MyRoomIndex])){
              a.room=RoomMap[MyRowIndex-1][MyRoomIndex];
              return;
            }
          }
          if(RoomMap[MyRowIndex+1]){
            if(users.find(a=>a.room===RoomMap[MyRowIndex+1][MyRoomIndex])){
              a.room=RoomMap[MyRowIndex+1][MyRoomIndex];
              return;
            }
          }
          if(RoomMap[MyRowIndex][MyRoomIndex-1]){
            if(users.find(a=>a.room===RoomMap[MyRowIndex][MyRoomIndex-1])){
              a.room=RoomMap[MyRowIndex][MyRoomIndex-1];
              return;
            }
          }
          if(RoomMap[MyRowIndex][MyRoomIndex+1]){
            if(users.find(a=>a.room===RoomMap[MyRowIndex][MyRoomIndex+1])){
              a.room=RoomMap[MyRowIndex][MyRoomIndex+1];
              return;
            }
          }

          return;
        }
        a.track=usersInRoom[_.random(0,usersInRoom.length-1)].nickname;
      }

      var target=usersInRoom.find(b=>b.nickname===a.track);
      var damage=[0,0];

      if(a.x+12<target.x){
        a.x+=(a.speed?a.speed:0.1);
        damage[0]=false;
      }else if(a.x-12>target.x){
        a.x-=(a.speed?a.speed:0.1);
        damage[0]=false;
      }else{
        damage[0]=true;
      }
      if(a.y+25<target.y){
        a.y+=(a.speed?a.speed:0.1);
        damage[1]=false;
      }else if(a.y-25>target.y){
        a.y-=(a.speed?a.speed:0.1);
        damage[1]=false;
      }else{
        damage[1]=true;
      }
      if(damage[0]&&damage[1]){
        if(!a.lastBite){
          target.health--;
          a.lastBite=500;
          target.regenTimeout=5;
        }else{
          a.lastBite-=(a.lastBite?1:0);
        }
        if(target.health<=0){
          kill(target,"zombie");
        }
      }
    }
  });
},1);

setInterval(()=>{
  var _rooms=[];
  RoomMap.forEach(a=>{
    var _copy=[];
    a.forEach(b=>{
      _copy.push({
        "players":[],
        "zombies":0,
        "id":b
      });
    });
    _rooms.push(_copy);
  });
  _rooms.forEach(a=>{
    a.forEach(c=>{
      users.forEach(b=>{
        if(b.room===c.id){
          if(b.socket){
            // players
            c.players.push(b.nickname);
          }
          if(b.type==="zombie"){
            c.zombies++;
          }
          if(b.type==="lootbox"){
            c.lootbox=true;
          }
        }
      });
    });
  });
  broadcast("room info",_rooms);
},1000);

function getRandomRoom(){
  var _rand=_.random(0,RoomMap.length-1);
  return RoomMap[_rand][_.random(0,RoomMap[_rand].length-1)];
}

function kill(target,by,data){
  if(!target.socket||!sockets[target.socket]){
    users.splice(users.indexOf(target),1);
    return;
  }
  switch(by){
    case "zombie":
    sockets[target.socket].emit("dead",{"from":"Zombie"});
    broadcast("chat",{"from":"Server","message":target.nickname+" died from a Zombie"});
    break;
    case "bullet":
    sockets[target.socket].emit("dead",{"from":(data.owner?data.owner+"'s ":"")+"Bullet"});
    broadcast("chat",{"from":"Server","message":target.nickname+" died from a Bullet"});
    break;
    default:
    sockets[target.socket].emit("dead",{"from":"Unknown"});
    broadcast("chat",{"from":"Server","message":target.nickname+" died."});
  }
  target.room="Dead_"+target.socket;
}

io.on('connection', function(socket){
  if(!started){
    for(i=0;i<round*2;i++){
      spawnZombie();
    }
    started=true;
  }
  users.push({
    "socket":socket.id,
    "x":300,
    "y":200,
    "room":"Welcome_"+socket.id,
    "lastRoomUpdate":0,
    "health":20,
    "maxHealth":20,
    "inventory":[],
    "bullets":50,
    "coins":0,
    "width":25,
    "height":50
  });
  sockets[socket.id]=socket;
  socket.on("ready",()=>{
    socket.emit("round status",{"status":"start"});
    socket.emit("round",round);
    socket.emit("dialog","name");
    socket.emit("chat",{
      "from":"Server",
      "message":"Started"
    })
  });
  var me=users[users.indexOf(users.find(a=>a.socket===socket.id))];
  socket.on("disconnect",()=>{
    users.splice(users.indexOf(users.find(a=>a.socket===socket.id)),1);
    delete sockets[socket.id];
    broadcast("chat",{
      "from":"Server",
      "message":"Goodbye, "+me.nickname+"!"
    });
  });

  socket.on("shop buy",item=>{
    switch(item){
      case "max health":
      if(me.coins<100){
        socket.emit("chat",{
          "from":"[Shop]",
          "message":"You don't have enough money! "+me.coins+"<100"
        });
        return;
      }
      me.coins-=100;
      me.maxHealth+=5;
      socket.emit("chat",{
        "from":"[Shop]",
        "message":"Upgraded MaxHealth! You have "+me.maxHealth+" now!"
      });
    }
  })

  socket.on("identify",data=>{
    var name=data.name;
    if(users.find(a=>a.nickname===name)||name==="Server"){
      socket.emit("dialog","name");
      socket.emit("uerror","Name already in use!");
      return;
    }
    me.nickname=name;
    me.room=getRandomRoom();
    broadcast("chat",{"from":"Server","message":"Welcome "+name+" to the server!"});
  });
  socket.on("chat",msg=>{
    if(!msg){
      return;
    }
    if(msg.indexOf("/")===0){
      processCommand(msg,socket);
      return;
    }
    broadcast("chat",{"from":me.nickname,"message":msg});
  });

  socket.on("config",()=>{
    socket.emit("config",CONFIG);
  });

  socket.on("keys",keys=>{
    me.keys=keys;

    if(!me.speed){
      me.speed=1;
    }

    if(!keys["87"]&&!keys["83"]&&!keys["65"]&&!keys["68"]){
      me.speed=1;
    }else{
      me.speed+=(me.speed<7?0.1:0);
    }

    if(keys["87"]){
      me.y-=me.speed;
    }else if(keys["83"]){
      me.y+=me.speed;
    }
    if(keys["65"]){
      me.x-=me.speed;
    }else if(keys["68"]){
      me.x+=me.speed;
    }

    if(me.x<0){
      var _roomIndex=0;
      RoomMap.forEach(a=>{
        var _room2=a.find(a=>a===me.room);
        if(_room2){
          _roomIndex=RoomMap.indexOf(a);
          if(a.indexOf(_room2)-1<0){
            me.x=0;
          }else{
            me.room=a[a.indexOf(_room2)-1];
            me.x=600;
          }
        }
      });
    }else if(me.x>600){
      var _roomIndex=0;
      RoomMap.forEach(a=>{
        var _room2=a.find(a=>a===me.room);
        if(_room2){
          _roomIndex=RoomMap.indexOf(a);
          if(a.indexOf(_room2)+1>a.length-1){
            me.x=0;
          }else{
            me.room=a[a.indexOf(_room2)+1];
            me.x=0;
          }
        }
      });
    }else if(me.y<0){
      var _roomIndex=0;
      RoomMap.forEach(a=>{
        var _room2=a.find(a=>a===me.room);
        if(_room2){
          _roomIndex=RoomMap.indexOf(a);
          if(RoomMap[_roomIndex-1]&&RoomMap[_roomIndex-1][a.indexOf(_room2)]){
            me.room=RoomMap[_roomIndex-1][a.indexOf(_room2)];
            me.y=400;
          }else{
            me.y=0;
          }
        }
      });
    }else if(me.y>400){
      var _roomIndex=0;
      RoomMap.forEach(a=>{
        var _room2=a.find(a=>a===me.room);
        if(_room2){
          _roomIndex=RoomMap.indexOf(a);
          if(RoomMap[_roomIndex+1]&&RoomMap[_roomIndex+1][a.indexOf(_room2)]&&!me.lastRoomUpdate){
            me.room=RoomMap[_roomIndex+1][a.indexOf(_room2)];
            me.y=400;
            me.lastRoomUpdate=5;
          }else{
            me.y=0;
          }
        }
      });
    }

    socket.emit("me",me);
    socket.emit("round",round);

    var _users=[];
    users.forEach(user=>{
      if(user.room===me.room){
        _users.push(user);
      }
    });
    socket.emit("people",users);
  });

  socket.on("me",()=>{
    socket.emit("me",me);
  });

  socket.on("click",e=>{
    // create a projectile
    if(!me.bullets){
      return;
    }

    me.bullets--;
    users.push({
      "projectile":true,
      "type":"bullet",
      "x":me.x,
      "y":me.y,
      "owner":me.nickname,
      "target":{
        "x":e.x,
        "y":e.y
      },
      "room":me.room
    });
  });
});

const Items={
  "weapon":[
    {
      "name":"Pistol",
      "bullets":10,
      "type":"weapon"
    }
  ]
};

function fetchItem(itemID){
  // itemID=section:name_with_underscores
  return Items[itemID.split(":")[0]].find(a=>a.name.replace(" ","_").toLowerCase()===itemID.split(":")[1].toLowerCase());
}

function giveItem(playerSocketID,item){
  users[users.indexOf(users.find(a=>a.socket===playerSocketID))].inventory.push(fetchItem(item));
}

function processCommand(cmd,socket){
  switch(cmd.split(" ")[0].replace("/","")){
    case "exec":
    socket.emit("chat",{
      "from":"Server",
      "message":eval(cmd.replace("/exec ",""))
    });
    break;
    case "tp":
    if(!cmd.split(" ")[1]){
      socket.emit("chat",{
        "from":"Server",
        "message":"/tp [roomID]"
      });
      return;
    }
    users[users.indexOf(users.find(a=>a.socket===socket.id))].room=cmd.split(" ")[1];
    socket.emit("chat",{
      "from":"Server",
      "message":"Teleported you to "+cmd.split(" ")[1]
    });
    break;
    case "bullets":
    users[users.indexOf(users.find(a=>a.socket===socket.id))].bullets+=parseInt(cmd.split(" ")[1]);
    socket.emit("chat",{
      "from":"Server",
      "message":"Added "+cmd.split(" ")[1]+" bullets"
    });
    break;
    case "lootbox":
    Events.lootBox.time=0;
    socket.emit("chat",{
      "from":"Server",
      "message":"Spawning lootbox..."
    });
    break;
    case "health":
    users[users.indexOf(users.find(a=>a.nickname===cmd.split(" ")[1]))].health=parseInt(cmd.split(" ")[2]);
    socket.emit("chat",{
      "from":"Server",
      "message":"Set "+cmd.split(" ")[1]+"'s health to "+cmd.split(" ")[2]
    });
    break;
    case "clear":
    socket.emit("clear chat");
  }
}

function spawnZombie(room){
  var zombie={
    "health":5*(round/2),
    "type":"zombie",
    "nickname":"Zombie",
    "maxHealth":5*(round/2),
    "width":25,
    "height":50
  };
  if(!room){
    zombie.room=getRandomRoom();
  }else{
    zombie.room=room;
  }

  zombie.x=_.random(0,600);
  zombie.y=_.random(0,400);

  users.push(zombie);
  if(!allowNextRound){
    allowNextRound=true;
  }
}

function broadcast(event,data){
  users.forEach(a=>{
    if(!sockets[a.socket]){
      return;
    }
    sockets[a.socket].emit(event,data);
  });
}

http.listen(3000, function(){
  console.log('listening on *:3000');
});
