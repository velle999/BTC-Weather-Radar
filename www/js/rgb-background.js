document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('rgbBackground');
    const ctx = canvas.getContext('2d');
    
    // Set canvas to full window size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        drawGradient(); // Redraw when resizing
    }
    
    // Create smooth RGB gradient
    function drawGradient() {
        // Create gradient that covers entire screen
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        
        // Current hue values
        const hue1 = hue % 360;
        const hue2 = (hue + 120) % 360; // 120° for RGB triad
        const hue3 = (hue + 240) % 360;
        
        gradient.addColorStop(0, `hsl(${hue1}, 80%, 50%)`);
        gradient.addColorStop(0.5, `hsl(${hue2}, 80%, 50%)`);
        gradient.addColorStop(1, `hsl(${hue3}, 80%, 50%)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Animation variables
    let hue = 0;
    const speed = 0.3;
    
    function animateBackground() {
        hue = (hue + speed) % 360;
        drawGradient();
        requestAnimationFrame(animateBackground);
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    animateBackground();
});