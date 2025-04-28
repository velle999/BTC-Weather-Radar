<?php
// get_scores.php

$filename = 'highscores.txt';
$scores = [];

if (file_exists($filename)) {
    $lines = file($filename, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \| ([A-Z]{1,3}) \| (\d+)/', $line, $matches)) {
            $scores[] = [
                'initials' => $matches[1],
                'score' => (int)$matches[2]
            ];
        }
    }

    usort($scores, function($a, $b) {
        return $b['score'] - $a['score'];
    });

    $scores = array_slice($scores, 0, 10); // top 10
}

header('Content-Type: application/json');
echo json_encode($scores);
?>
