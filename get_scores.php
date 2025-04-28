<?php
// get_highscores.php
header('Content-Type: application/json');

$filename = 'highscores.json';

if (file_exists($filename)) {
    $data = file_get_contents($filename);
    echo $data;
} else {
    echo json_encode([]);
}
?>
