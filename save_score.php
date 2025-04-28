<?php
// save_score.php

if (isset($_POST['initials']) && isset($_POST['score'])) {
    $initials = substr(preg_replace("/[^A-Z]/", "", strtoupper($_POST['initials'])), 0, 3);
    $score = intval($_POST['score']);

    if ($initials && $score >= 0) {
        $line = date('Y-m-d H:i:s') . " | $initials | $score\n";
        file_put_contents('highscores.txt', $line, FILE_APPEND | LOCK_EX);
        echo "✅ Score saved!";
    } else {
        echo "❌ Invalid data.";
    }
} else {
    echo "❌ Missing data.";
}
?>
