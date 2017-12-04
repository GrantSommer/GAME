<?php
require("parsedown.php");
$Parsedown = new Parsedown();

echo $Parsedown->text(file_get_contents("info.md"));
 ?>
