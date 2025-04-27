document.addEventListener('DOMContentLoaded', function() {
  const carrotContainer = document.getElementById('carrot-layer');
  const carrotToggle = document.getElementById('carrot-toggle');
  window.carrotsActive = false;
  let carrotInterval = null;

  function createCarrot() {
    const carrot = document.createElement('div');
    carrot.classList.add('carrot');
    carrot.innerHTML = "🥕";
    carrot.style.left = Math.random() * window.innerWidth + 'px';
    const fallDuration = 5 + Math.random() * 5;
    carrot.style.animationDuration = `${fallDuration}s`;
    carrotContainer.appendChild(carrot);
    setTimeout(() => carrot.remove(), fallDuration * 1000);
  }

  window.startCarrotRain = function() {
    if (!carrotInterval) {
      carrotInterval = setInterval(createCarrot, 300);
    }
  }

  window.stopCarrotRain = function() {
    clearInterval(carrotInterval);
    carrotInterval = null;
    carrotContainer.innerHTML = '';
  }

  if (carrotToggle) {
    carrotToggle.addEventListener('click', () => {
      window.carrotsActive = !window.carrotsActive;
      if (window.carrotsActive) {
        window.startCarrotRain();
      } else {
        window.stopCarrotRain();
      }
    });
  } else {
    console.warn('No #carrot-toggle button found.');
  }
});
