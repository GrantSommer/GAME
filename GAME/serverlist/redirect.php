<?php
$data=json_decode(file_get_contents("servers.json"),true);
foreach($data as $k=>$server){
  $data[$k]['score']+=1;
}
file_put_contents("servers.json",json_encode($data));
header("location:http://play.GAME.pie.cool/?ip=".$_GET['ip']);
 ?>
<script>
window.open("http://play.GAME.pie.cool/?ip=<?php echo $_GET['ip']; ?>","_self");
</script>
