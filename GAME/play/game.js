function $_GET(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

if(!$_GET("ip")){
  window.open("http://GAME.pie.cool/serverlist","_self");
}else{
  $(".server-info .server-ip").text($_GET("ip"));
}

var socket=io($_GET("ip"));
var canvas=document.getElementById("game");
var ctx=canvas.getContext("2d");
var Keys={
  "87":false, // w
  "65":false, // a
  "83":false, // s
  "68":false, // d
};

function addChatMessage(data){
  $(".chat .chat-messages").append("<b>"+data.from+"</b> "+data.message+"<br />");
  $(".chat .chat-messages").animate({ scrollTop: $('.chat .chat-messages').prop("scrollHeight")}, 1000);
}
addChatMessage({"from":"[Client]","message":"Attempting to connect..."});
socket.on("connect",()=>{
  $(".chat .chat-messages").html("");
  addChatMessage({"from":"[Client]","message":"Connected!"});
});
socket.on("disconnect",()=>{
  addChatMessage({"from":"[Client]","message":"Disconnected"});
});
socket.on("reconnect",()=>{
  addChatMessage({"from":"[Client]","message":"Reconnecting..."});
});

/* Socket Stuff */
socket.on("dialog",dialogID=>{
  /*if(dialogID==="name"){
    socket.emit("identify",{
      "name":localStorage.getItem("name")
    });
    console.log("DEBUG AT socket.on('dialog')");
    return;
  }*/
  document.getElementById(dialogID).showModal();
});
socket.on("room info",roomInfo=>{
  window.roomInfo=roomInfo;
});
socket.on("round status",round=>{
  switch(round.status){
    case "ended":
    $(".round-status meter").attr("max",round.countdown/1000);
    $(".round-status meter").val(round.countdown/1000);
    $(".round-status meter").show();
    $(".round-status .round").text("Ended");
    $(".shop").show();
    window.roundCountdown=setInterval(()=>{
      if(parseInt($(".round-status meter").val())){
        $(".round-status meter").val(parseInt($(".round-status meter").val())-1);
      }else{
        clearInterval(window.roundCountdown);
      }
    },1000);
    break;
    case "start":
    $(".shop").hide();
    $(".round-status .round").text(window.round);
    $(".round-status meter").hide();
    break;
  }
});
socket.on("chat",data=>{
  if(!data.message){return;}
  addChatMessage(data);
});
socket.on('uerror',msg=>{
  alert("Error!\n"+msg);
});
socket.on("people",people=>{
  window.everyone=people;
  var _people=[];
  people.forEach(a=>{
    if(a.room!==me.room){
      return;
    }
    _people.push(a);
  });
  window.people=_people;
  draw();
});
socket.on("me",me=>{
  window._me=window.me;
  window.me=me;
});
socket.on("clear chat",()=>{
  $(".chat .chat-messages").html("");
});
socket.on("dead",data=>{
  document.getElementById("death").showModal();
  $("#death").html("<h2>You Died!</h2>You died from "+data.from+"<br /><button onclick='window.location.reload()'>Respawn</button>");
  $("#death button").focus();
  //socket.emit("disconnect");
});
socket.on("round",round=>{
  window.round=round;
});
$(()=>{
  socket.emit("ready");
  $("input").focus(()=>{
    ignoreKeys=true;
  });
  $("input").blur(()=>{
    ignoreKeys=false;
  });
  socket.emit("config");
  socket.on("config",serverConfig=>{
    $(".server-info .server-name").text(serverConfig.name);
  })
});
$("#name .name-form").submit(e=>{
  e.preventDefault();
  document.getElementById("name").close();
  var $form=$("#name .name-form");
  socket.emit("identify",{
    "name":$form.find(".name").val()
  });
});
$(".chat .chat-toolbar .chat-action").submit(e=>{
  e.preventDefault();
  socket.emit("chat",$(".chat-action .chat-message").val());
  $(".chat-action .chat-message").val("");
});
$("#game").click(e=>{
  e.preventDefault();
  socket.emit("click",{
    "x":e.pageX-$("#game").offset().left,
    "y":e.pageY-$("#game").offset().top
  });
});

/* Key down */
var ignoreKeys=false;
$(document).keydown(e=>{
  if(ignoreKeys){return;}
  Keys[e.which]=true;
});
$(document).keyup(e=>{
  if(ignoreKeys){return;}
  Keys[e.which]=false;
});

var effects=[];

/* Functions */
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="black";
  effects.forEach(a=>{
    if(a.time<=0){
      effects.splice(effects.indexOf(a),1);
    }
    a.time--;
    a.code.forEach(a=>{
      eval(a);
    });
  });
  ctx.fillStyle="black";

  if(window.people){
    people.forEach(a=>{
      if(a.type==="zombie"){
        ctx.fillStyle="green";
      }
      if(!a.projectile&&a.type!=="lootbox"){
        ctx.fillRect(a.x,a.y,25,50);
        ctx.fillText(a.nickname,a.x,a.y-20);
        ctx.fillText(a.health+"/"+(a.maxHealth?a.maxHealth:"20"),a.x,a.y-10);
      }else if(a.projectile){
        ctx.fillRect(a.x,a.y,10,10);
      }else if(a.type==="lootbox"){
        ctx.fillStyle="tomato";
        ctx.fillRect(a.x,a.y,25,25);
        ctx.fillText(a.nickname,a.x,a.y-30);
        ctx.fillText(a.health+"/"+a.maxHealth,a.x,a.y-20);
        ctx.fillText("Expires: "+((a.age/1000).toString().split(".")[0])+"s",a.x,a.y-10);
      }
      ctx.fillStyle="black";
    });

    ctx.fillStyle="black";
    ctx.strokeStyle="black";
    ctx.strokeRect(0,0,canvas.width/4,canvas.height/4);
    var startY=10;
    var unknowns=0;
    var place=0;

    everyone.sort((a,b)=>(a.coins>b.coins?-1:(a.coins<b.coins?1:0))).forEach(a=>{
      if(!a.socket){return;}
      if(!a.nickname){unknowns++;return;}
      place++;
      if(place===1){
        ctx.fillStyle="gold";
      }
      ctx.fillText(a.nickname,3,startY+3);
      ctx.fillText(a.coins,(canvas.width/4)-(a.coins.toString().length*8),startY+3);
      startY+=10;
      ctx.fillStyle="black";
    });
    if(unknowns){
      ctx.fillText("... and "+unknowns+" unknown people",3,startY+3);
    }
    if(everyone.filter(a=>a.socket).length===1){
      ctx.fillStyle="red";
      ctx.fillText("Invite your friends! game.pie.cool",2,(canvas.height/4)-7);
      ctx.fillStyle="black";
    }
  }
  ctx.fillText(me.nickname,me.x,me.y-20);
  ctx.fillText(me.health+"/"+(me.maxHealth?me.maxHealth:"20"),me.x,me.y-10);
  ctx.fillRect(me.x,me.y,25,50);
  if(window._me){
    if(window._me.health<window.me.health){
      effects.push({
        "code":[
          "ctx.fillStyle='green';",
          "ctx.fillText('+"+(me.health-_me.health)+"',"+(me.x+grant.random(-10,10))+","+(me.y-30+grant.random(-10,10))+");"
        ],
        "time":100
      });
    }else if(window._me.health>window.me.health){
      effects.push({
        "code":[
          "ctx.fillStyle='red';",
          "ctx.fillText('-"+(_me.health-me.health)+"',"+(me.x+grant.random(-10,10))+","+(me.y-30+grant.random(-10,10))+");"
        ],
        "time":100
      });
    }
    ctx.fillStyle="black";
  }

  if(window.roomInfo&&!(me.x>canvas.width-canvas.width/4&&me.y<canvas.height-canvas.width/4)){
    ctx.strokeRect(canvas.width-(canvas.width/4),0,canvas.width/4,canvas.width/4);
    var startX=canvas.width-(canvas.width/4);
    var startY=0;
    var width=(canvas.width/4)/roomInfo[0].length;
    var height=(canvas.width/4)/roomInfo.length;
    roomInfo.forEach(a=>{
      startX=canvas.width-(canvas.width/4);
      a.forEach(b=>{
        ctx.strokeStyle="black";
        if(b.players.indexOf(me.nickname)>-1){
          ctx.strokeStyle="red";
          ctx.fillStyle="red";
          ctx.fillRect(startX+width-5,startY+height-5,5,5);
        }
        var count=0;
        b.players.forEach(a=>{
          if(a!==me.nickname){
            count++;
          }
        });
        if(count){
          ctx.strokeStyle="black";
          ctx.fillStyle="black";
          ctx.fillRect(startX+width-10,startY+height-5,5,5);
        }
        ctx.strokeRect(startX,startY,width,height);
        ctx.fillStyle="green";
        ctx.fillText((b.zombies?b.zombies:""),startX+3,startY+13);
        if(b.lootbox){
          ctx.strokeStyle="tomato";
          ctx.fillStyle="tomato";
          ctx.fillRect(startX+width-15,startY+height-5,5,5);
        }

        startX+=width;
      });
      startY+=height;
    });
  }

  $(".status").html("<b>Bullets:</b> "+me.bullets+" <b>Room:</b> "+me.room+" <b>Round:</b> "+window.round+" <b>Coins:</b> "+me.coins);
}
function sendKeys(){
  socket.emit("keys",Keys);
  requestAnimationFrame(sendKeys);
}
requestAnimationFrame(sendKeys);
