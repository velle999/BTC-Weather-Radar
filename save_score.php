<?php
$servername = "localhost";   // Change to your server settings
$username = "your_db_username";
$password = "your_db_password";
$dbname = "your_database_name";

// Check POST request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $initials = trim($_POST['initials'] ?? '');
    $score = intval($_POST['score'] ?? 0);

    // VALIDATION RULES
    if (strlen($initials) < 1 || strlen($initials) > 3) {
        http_response_code(400);
        echo "Invalid initials (1-3 letters).";
        exit;
    }

    if ($score <= 0) {
        http_response_code(400);
        echo "Invalid score.";
        exit;
    }

    // Database connect
    $conn = new mysqli($servername, $username, $password, $dbname);

    if ($conn->connect_error) {
        http_response_code(500);
        echo "Database connection failed.";
        exit;
    }

    // Optional: Sanitize initials to uppercase
    $initials = strtoupper($initials);

    // Save the score
    $stmt = $conn->prepare("INSERT INTO highscores (initials, score) VALUES (?, ?)");
    $stmt->bind_param("si", $initials, $score);

    if ($stmt->execute()) {
        echo "Score saved!";
    } else {
        http_response_code(500);
        echo "Failed to save score.";
    }

    $stmt->close();
    $conn->close();
} else {
    http_response_code(405);
    echo "Invalid request method.";
}
?>
