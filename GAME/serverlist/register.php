<?php
if($_SERVER['REQUEST_METHOD']==="POST"){
  $data=json_decode(file_get_contents("servers.json"),true);
  if(isset($_POST['unregister'])){
    foreach($data as $k=>$server){
      if($server['token']===$_POST['token']){
        unset($data[$k]);
      }
    }
    exit();
  }
  foreach($data as $server){
    if(($server['name']===$_POST['config']['name']||$server['ip']===$_POST['config']['ip'])&&$server['token']!==$_POST['config']['token']){
      echo json_encode(array("success"=>false,"error"=>"Server already registered with name or ip"));
      exit();
    }
  }
  foreach($data as $k=>$server){
    if($server['token']===$_POST['config']['token']){
      unset($data[$k]);
    }
  }

  $token=($_POST['config']['token']?$_POST['config']['token']:uniqid());
  $data[]=array(
    "ip"=>$_POST['config']['ip'],
    "name"=>$_POST['config']['name'],
    "token"=>$token,
    "score"=>0
  );
  file_put_contents("servers.json",json_encode($data));
  echo json_encode(array("success"=>true,"token"=>$token));
}else{
  echo "invalid";
}
 ?>
