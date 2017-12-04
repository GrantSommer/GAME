<?php
exit();
if($_SERVER['REQUEST_METHOD']==="POST"){
  $data=json_decode(file_get_contents("servers.json"),true);
  $data[]=array(
    "ip"=>$_POST['ip']
  )
}else{
  echo "invalid";
}
 ?>
