<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>GAME Server List</title>
    <link rel="stylesheet" href="//grantscdn.xyz/lib/grant.js/css/grant.js/0.1.css" />
    <script src="//grantscdn.xyz/lib/jquery/3.2.1.min.js"></script>
    <script src="//grantscdn.xyz/lib/grant.js/version/grant.js/0.1.js"></script>
  </head>
  <body>
    <div class="content">
      <ul>
        <?php
        $data=json_decode(file_get_contents("servers.json"),true);
        foreach($data as $server){
          echo "<li>
          <a href='redirect.php?ip=".$server['ip']."'>".$server['name']." (".$server['ip'].")</a>
          </li>";
        }
         ?>
      </ul>
    </div>
  </body>
</html>
