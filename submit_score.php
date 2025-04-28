<?php
$servername = "localhost";   // or your server
$username = "your_db_username";
$password = "your_db_password";
$dbname = "your_database_name";

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $user = $_POST['username'];
    $score = intval($_POST['score']);
    
    if (!$user || !$score) {
        http_response_code(400);
        echo "Invalid input.";
        exit;
    }

    $conn = new mysqli($servername, $username, $password, $dbname);
    if ($conn->connect_error) {
        http_response_code(500);
        echo "Database connection error.";
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO highscores (username, score) VALUES (?, ?)");
    $stmt->bind_param("si", $user, $score);

    if ($stmt->execute()) {
        echo "Success";
    } else {
        http_response_code(500);
        echo "Database insert error.";
    }

    $stmt->close();
    $conn->close();
}
?>
