// ---------------------------
// Constants & Configuration
// ---------------------------
const CONFIG = {
  WEATHER_API_KEY: 'c8e85b9c5cd854c7aac3bb9042e0801b',
  STOCK_API_KEY: localStorage.getItem('alphaVantageApiKey') || 'R83AYXIEJ0K71FUR',
  CORS_PROXY: 'https://api.allorigins.win/raw?url=',
  DEFAULT_ZIP: '63090',
  DEFAULT_STOCK: 'NVDA',
  DEFAULT_ZONE: 'MOZ070'
};

// ---------------------------
// State Variables
// ---------------------------
let currentZip = localStorage.getItem('weatherZip') || CONFIG.DEFAULT_ZIP;
let currentStockSymbol = localStorage.getItem('stockSymbol') || CONFIG.DEFAULT_STOCK;
let currentZoneId = CONFIG.DEFAULT_ZONE;
let hourFormat = localStorage.getItem('hourFormat') || '12';

let radarActive = true;
let radarMap = null;
let radarLayer = null;
let radarCoordinates = { lat: 38.6270, lng: -90.1994 };
let lastStockFetchTime = 0;
let stockRetryCount = 0;
let carrotInterval = null;

// ---------------------------
// Cached DOM Elements
// ---------------------------
const elements = {
  time: $('#time'),
  date: $('#date'),
  btcPrice: $('#btcprice'),
  stockData: $('#stockData'),
  weatherAlerts: $('#weatherAlerts'),
  currentTemp: $('#currentTemp'),
  currentDesc: $('#weatherDesc'),
  currentIcon: $('#weatherIcon'),
  animalBody: $('#animal-companion .animal-body'),
  animalMessage: $('#animal-companion .animal-message'),
  radarTimestamp: $('#radar-timestamp')
};

// Validate DOM Elements
for (const key in elements) {
  if (elements[key].length === 0) {
    console.warn(`Missing element for: ${key}`);
  }
}

// ---------------------------
// Debug Panel Functions 🐞
// ---------------------------
function createDebugPanel() {
  const debugPanel = document.createElement('div');
  debugPanel.id = 'debug-panel';
  debugPanel.style.position = 'fixed';
  debugPanel.style.bottom = '10px';
  debugPanel.style.left = '10px';
  debugPanel.style.padding = '10px';
  debugPanel.style.background = 'rgba(0,0,0,0.7)';
  debugPanel.style.color = 'lime';
  debugPanel.style.fontSize = '12px';
  debugPanel.style.zIndex = '99999';
  debugPanel.style.borderRadius = '8px';
  debugPanel.style.fontFamily = 'monospace';
  debugPanel.style.maxWidth = '300px';
  debugPanel.style.pointerEvents = 'none';

  debugPanel.innerHTML = `
    <strong>Debug Panel 🐞</strong><br>
    <div id="debug-radar">Radar: Unknown</div>
    <div id="debug-stocks">Stocks: Unknown</div>
    <div id="debug-news">News: Unknown</div>
    <div id="debug-tetris">Tetris: Unknown</div>
    <div id="debug-wolf">Wolf 3D: Unknown</div>
    <div id="debug-carrot">Carrot Mode: Unknown</div>
  `;

  debugPanel.style.display = 'none';
  document.body.appendChild(debugPanel);
}

function updateDebugPanel() {
  const debugRadar  = document.getElementById('debug-radar');
  const debugStocks = document.getElementById('debug-stocks');
  const debugNews   = document.getElementById('debug-news');
  const debugTetris = document.getElementById('debug-tetris');
  const debugWolf   = document.getElementById('debug-wolf');
  const debugCarrot = document.getElementById('debug-carrot');

  if (debugRadar)  debugRadar.textContent  = `Radar: ${$('#radar-container').hasClass('active') ? 'ON' : 'OFF'}`;
  if (debugStocks) debugStocks.textContent = `Stocks: ${$('#stocks-container').is(':visible') ? 'Visible' : 'Hidden'}`;
  if (debugNews)   debugNews.textContent   = `News: ${$('#news-ticker').is(':visible') ? 'Visible' : 'Hidden'}`;
  if (debugTetris) debugTetris.textContent = `Tetris: ${$('#tetris-wrapper').is(':visible') ? 'Visible' : 'Hidden'}`;
  if (debugWolf)   debugWolf.textContent   = `Wolf 3D: ${$('#wolf3d-wrapper').is(':visible') ? 'Visible' : 'Hidden'}`;
  if (debugCarrot) debugCarrot.textContent = `Carrot Mode: ${document.body.classList.contains('carrot-mode') ? 'Active' : 'Inactive'}`;
}

// Auto-update debug panel every second
setInterval(updateDebugPanel, 1000);

// ---------------------------
// Utility Functions
// ---------------------------
async function fetchWithRetry(url, options = {}, retries = 3, delay = 3000) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retrying fetch (${retries} left)...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

function promptUserSettings() {
  const newZip = prompt("Enter ZIP Code:", currentZip);
  if (newZip && /^\d{5}$/.test(newZip)) {
    currentZip = newZip;
    localStorage.setItem('weatherZip', newZip);
    fetchWeather();
    fetchForecast();
    fetchWeatherAlerts();
  }

  const newStock = prompt("Enter Stock Symbol:", currentStockSymbol);
  if (newStock) {
    currentStockSymbol = newStock.toUpperCase();
    localStorage.setItem('stockSymbol', currentStockSymbol);
    fetchStockData();
  }

  const newFormat = prompt("Time Format (12/24):", hourFormat);
  if (newFormat === '12' || newFormat === '24') {
    hourFormat = newFormat;
    localStorage.setItem('hourFormat', newFormat);
    updateTime();
  }

  const newApiKey = prompt("Enter AlphaVantage API Key:", CONFIG.STOCK_API_KEY);
  if (newApiKey) {
    CONFIG.STOCK_API_KEY = newApiKey;
    localStorage.setItem('alphaVantageApiKey', newApiKey);
    fetchStockData();
  }
}

// ---------------------------
// ---------------------------
// WEATHER FUNCTIONS
// ----------------------------

const getWeatherUrl = () =>
  `https://api.openweathermap.org/data/2.5/weather?zip=${currentZip},US&appid=${CONFIG.WEATHER_API_KEY}&units=imperial`;

const getForecastUrl = () =>
  `https://api.openweathermap.org/data/2.5/forecast?zip=${currentZip},US&appid=${CONFIG.WEATHER_API_KEY}&units=imperial`;

const getAlertsUrl = () =>
  `https://api.weather.gov/alerts/active/zone/${currentZoneId}`;

async function fetchWeather() {
  try {
    console.log('🌦️ Fetching current weather...');
    elements.currentTemp.text('Loading...');
    elements.currentDesc.text('Loading...');

    const data = await fetchWithRetry(getWeatherUrl());
    console.log('[OpenWeather API Response]', data);

    if (!data || !data.main || !Array.isArray(data.weather) || !data.weather.length) {
      throw new Error('Malformed weather data');
    }

    updateCurrentWeather(data);
    $(document).trigger('dataUpdated', ['weather']);
  } catch (error) {
    console.error('❌ Weather fetch failed:', error);
    elements.currentTemp.text('N/A');
    elements.currentDesc.text('Weather unavailable');
    elements.currentIcon.html('<span style="color:red;">⚠️</span>');
    setTimeout(fetchWeather, 30000);
  }
}

function updateCurrentWeather(data) {
  try {
    const currentTemp = Math.round(data.main.temp);
    const weatherDesc = data.weather[0].description;
    const weatherIcon = data.weather[0].icon;
    let mainWeather = data.weather[0].main.toLowerCase();

    elements.currentTemp.text(`${currentTemp}°F`);
    elements.currentDesc.text(weatherDesc);
    elements.currentIcon.html(`<img src="https://openweathermap.org/img/wn/${weatherIcon}.png" alt="${weatherDesc}">`);

    document.body.classList.remove(
      'weather-clear', 'weather-clouds', 'weather-rain',
      'weather-snow', 'weather-thunderstorm', 'weather-fog'
    );

    if (mainWeather.includes('cloud')) {
      document.body.classList.add('weather-clouds');
    } else if (mainWeather.includes('rain') || mainWeather.includes('drizzle')) {
      document.body.classList.add('weather-rain');
    } else if (mainWeather.includes('snow')) {
      document.body.classList.add('weather-snow');
    } else if (mainWeather.includes('thunderstorm')) {
      document.body.classList.add('weather-thunderstorm');
    } else if (['mist', 'fog', 'haze'].some(x => mainWeather.includes(x))) {
      document.body.classList.add('weather-fog');
    } else {
      document.body.classList.add('weather-clear');
    }

    if (typeof data.coord.lat === 'number' && typeof data.coord.lon === 'number') {
      updateRadarLocation(data.coord.lat, data.coord.lon);
    }

    // Optional effects function
    if (typeof applyWeatherEffects === 'function') {
      applyWeatherEffects(weatherDesc);
    }

  } catch (error) {
    console.error('❌ updateCurrentWeather() failed:', error);
    elements.currentTemp.text('N/A');
    elements.currentDesc.text('Unavailable');
    elements.currentIcon.html('<span style="color:red;">⚠️</span>');
  }
}


async function fetchForecast() {
  console.log('📅 Fetching 5-day forecast...');
  try {
    $('#five-day-forecast').html('<div>Loading...</div>');
    const data = await fetchWithRetry(getForecastUrl());
    updateForecast(data);
  } catch (error) {
    console.error('Forecast fetch failed:', error);
    $('#five-day-forecast').html('<div>Forecast unavailable</div>');
  }
}

function applyWeatherEffects(description = '') {
  const rainLayer = document.querySelector('.rain-layer');
  const snowLayer = document.querySelector('.snow-layer');
  const windLayer = document.querySelector('.wind-layer');
  const cloudLayer = document.getElementById('cloud-layer');

  // Hide all layers first
  if (rainLayer) rainLayer.style.opacity = '0';
  if (snowLayer) snowLayer.style.opacity = '0';
  if (windLayer) windLayer.style.opacity = '0';
  if (cloudLayer) cloudLayer.style.opacity = '0';

  const desc = description.toLowerCase();

  if (desc.includes('rain') || desc.includes('drizzle')) {
    if (rainLayer) rainLayer.style.opacity = '1';
  }

  if (desc.includes('snow')) {
    if (snowLayer) snowLayer.style.opacity = '1';
  }

  if (desc.includes('wind')) {
    if (windLayer) windLayer.style.opacity = '1';
  }

  if (desc.includes('cloud') || desc.includes('overcast')) {
    if (cloudLayer) cloudLayer.style.opacity = '1';
  }

  if (desc.includes('storm') || desc.includes('thunder')) {
    flashLightning();
  }
}

function flashLightning() {
  const flash = document.createElement('div');
  flash.className = 'lightning-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 500);
}


/** Render the forecast cards */
function updateForecast(data) {
  const container = $('#five-day-forecast');
  container.empty();
  const forecasts = data.list.filter(item => item.dt_txt.includes('12:00:00')).slice(0, 5);

  forecasts.forEach(forecast => {
    const day = moment(forecast.dt_txt).format('ddd');
    const icon = forecast.weather[0].icon;
    const temp = Math.round(forecast.main.temp_max);
    container.append(`
      <div class="forecast-day">
        <div class="forecast-icon">
          <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${forecast.weather[0].description}">
        </div>
        <div class="forecast-text">${day}: ${temp}°F</div>
      </div>
    `);
  });
}

// Radar-related and other UI interactions

function initRadar() {
  $('#radar-container').addClass('active');
  $('#radar-toggle').text('Refresh Radar');

  const leafletCSS = document.createElement('link');
  leafletCSS.rel = 'stylesheet';
  leafletCSS.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
  document.head.appendChild(leafletCSS);

  const leafletScript = document.createElement('script');
  leafletScript.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
  leafletScript.onload = setupRadarMap;
  document.head.appendChild(leafletScript);

  $('#radar-toggle').on('click', toggleRadar);
}

function setupRadarMap() {
  radarMap = L.map('radar-map', {
    attributionControl: false,
    zoomControl: false,
    dragging: false
  }).setView([radarCoordinates.lat, radarCoordinates.lng], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(radarMap);
  loadRadarData();
}

// ---------------------------
// Weather Alerts (Emergency System)
// ---------------------------
async function fetchWeatherAlerts() {
  console.log('🚨 Fetching weather alerts...');
  try {
    elements.weatherAlerts.html('<div>Checking alerts...</div>');
    const data = await fetchWithRetry(getAlertsUrl());
    updateWeatherAlerts(data);
  } catch (error) {
    console.error('Alerts fetch failed:', error);
    elements.weatherAlerts.html('<div>Alerts unavailable</div>');
  }
}

function updateWeatherAlerts(data) {
  if (data.features && data.features.length > 0) {
    const alertsHtml = data.features.map(alert => {
      const severity = alert.properties.severity.toLowerCase();
      const event = alert.properties.event;
      const description = alert.properties.description;
      return `
        <div class="alert ${severity}">
          <strong>${event}</strong><br>
          <em>${description}</em>
        </div>
      `;
    }).join('<hr>');
    elements.weatherAlerts.html(alertsHtml);
    checkAndPlaySevereAlert(data.features);
  } else {
    elements.weatherAlerts.html('<div>No active alerts</div>');
  }
}

function checkAndPlaySevereAlert(alerts) {
  const severeKeywords = ["Tornado Warning", "Severe Thunderstorm Warning", "Flash Flood Warning"];
  const lastAlertId = localStorage.getItem('lastAlertId');
  alerts.forEach(alert => {
    const event = alert.properties.event;
    const alertId = alert.id;
    if (severeKeywords.some(keyword => event.includes(keyword))) {
      if (alertId !== lastAlertId) {
        playEmergencyAlert(alert);
        localStorage.setItem('lastAlertId', alertId);
      }
    }
  });
}

function playEmergencyAlert(alert) {
  const overlay = document.getElementById('emergency-overlay');
  const message = document.getElementById('emergency-message');
  const stopButton = document.getElementById('stop-button');
  const introEl = document.getElementById('emergency-intro');
  const scrollboxEl = document.getElementById('emergency-scrollbox');

  overlay.style.display = 'block';
  message.style.display = 'block';
  stopButton.style.display = 'block';
  introEl.innerText = `⚠️ ${alert.properties.event}`;
  scrollboxEl.innerText = alert.properties.description;

  if (!window.emergencyAudio) {
    window.emergencyAudio = new Audio('sounds/tornado_alert.mp3');
    window.emergencyAudio.loop = true;
    window.emergencyAudio.play().catch(err => console.error('Emergency audio failed:', err));
  }
}

function stopEmergency() {
  document.getElementById('emergency-overlay').style.display = 'none';
  document.getElementById('emergency-message').style.display = 'none';
  document.getElementById('stop-button').style.display = 'none';
  if (window.emergencyAudio) {
    window.emergencyAudio.pause();
    window.emergencyAudio.currentTime = 0;
    window.emergencyAudio = null;
  }
}

// ---------------------------
// Radar Map (RainViewer Integration)
// ---------------------------
function initRadar() {
  $('#radar-container').addClass('active');
  $('#radar-toggle').text('Refresh Radar');

  const leafletCSS = document.createElement('link');
  leafletCSS.rel = 'stylesheet';
  leafletCSS.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
  document.head.appendChild(leafletCSS);

  const leafletScript = document.createElement('script');
  leafletScript.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
  leafletScript.onload = setupRadarMap;
  document.head.appendChild(leafletScript);

  $('#radar-toggle').on('click', toggleRadar);
}

function setupRadarMap() {
  radarMap = L.map('radar-map', {
    attributionControl: false,
    zoomControl: false,
    dragging: false
  }).setView([radarCoordinates.lat, radarCoordinates.lng], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(radarMap);
  loadRadarData();
}

async function loadRadarData() {
  if (!radarActive || !radarMap) return;
  try {
    const data = await fetchWithRetry('https://api.rainviewer.com/public/weather-maps.json');
    if (data.radar?.past?.length) {
      const latestFrame = data.radar.past[data.radar.past.length - 1];
      const radarUrl = `https://tilecache.rainviewer.com${latestFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;
      if (radarLayer) radarMap.removeLayer(radarLayer);
      radarLayer = L.tileLayer(radarUrl, { opacity: 0.7 });
      radarLayer.addTo(radarMap);
      const timestamp = new Date(latestFrame.time * 1000).toLocaleTimeString();
      elements.radarTimestamp.text(`Updated: ${timestamp}`);
      $(document).trigger('dataUpdated', ['radar']);
    }
  } catch (error) {
    console.error('Radar data fetch failed:', error);
    elements.radarTimestamp.text('Radar unavailable');
  }
}

function toggleRadar() {
  radarActive = !radarActive;
  $('#radar-container').toggleClass('active', radarActive);
  $('#radar-toggle').text(radarActive ? 'Refresh Radar' : 'Show Radar');
  if (radarActive) loadRadarData();
}

function updateRadarLocation(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return;
  radarCoordinates = { lat, lon };
  if (radarMap) {
    radarMap.setView([lat, lon], 8);
    if (radarActive) loadRadarData();
  }
}

// ---------------------------
// Companion Interactions
// ---------------------------
function createCarrot() {
  const carrotLayer = document.getElementById('carrot-layer');
  if (!carrotLayer) return;
  const carrot = document.createElement('div');
  carrot.className = 'carrot';
  carrot.textContent = '🥕';
  carrot.style.left = Math.random() * window.innerWidth + 'px';
  carrot.style.top = '-50px';
  carrot.style.transform = `scale(${0.8 + Math.random() * 0.4})`;
  const fallDuration = 5 + Math.random() * 5;
  carrot.style.animation = `fall ${fallDuration}s linear`;
  carrotLayer.appendChild(carrot);
  setTimeout(() => carrot.remove(), fallDuration * 1000);
}

function giveDogTreat() {
  const dog = document.getElementById('dog-companion');
  if (!dog) return;
  const treat = document.createElement('div');
  treat.className = 'dog-treat';
  treat.textContent = '🦴';
  dog.appendChild(treat);
  setTimeout(() => {
    treat.style.transform = 'translateY(-100px)';
    treat.style.opacity = '0';
  }, 800);
  setTimeout(() => treat.remove(), 3000);
  dog.style.animation = 'none';
  dog.offsetHeight;
  dog.classList.add('dog-happy');
  setTimeout(() => {
    dog.classList.remove('dog-happy');
    dog.style.animation = 'dog-roam 24s linear infinite alternate';
  }, 2000);
}

function giveMountainDew() {
  const fox = document.getElementById('animal-companion');
  if (!fox) return;
  const soda = document.createElement('div');
  soda.className = 'fox-soda';
  soda.innerText = '🥤';
  soda.style.position = 'absolute';
  soda.style.bottom = '80px';
  soda.style.left = '30px';
  soda.style.fontSize = '28px';
  soda.style.opacity = '1';
  soda.style.transition = 'all 2s ease-out';
  fox.appendChild(soda);
  setTimeout(() => {
    soda.style.transform = 'translateY(-100px)';
    soda.style.opacity = '0';
  }, 50);
  setTimeout(() => soda.remove(), 2200);
  fox.style.animation = 'none';
  fox.offsetHeight;
  fox.classList.add('fox-happy');
  setTimeout(() => {
    fox.classList.remove('fox-happy');
    fox.style.animation = 'roam 20s linear infinite alternate';
  }, 2000);
}

// ---------------------------
// Main UI Controls
// ---------------------------
function setupUIControls() {
  // Settings Button
  const settingsButton = document.getElementById('settings-button');
  settingsButton?.addEventListener('click', promptUserSettings);

  // Stocks Toggle
  const stocksToggle = document.getElementById('stocks-toggle');
  const stocksContainer = document.getElementById('stocks-container');
  if (stocksToggle && stocksContainer) {
    stocksToggle.addEventListener('click', () => {
      const isHidden = stocksContainer.style.display === 'none';
      stocksContainer.style.display = isHidden ? 'block' : 'none';
      stocksToggle.textContent = isHidden ? 'Hide CNBC' : 'Show CNBC';
    });
  }

  // News Ticker Toggle
  const newsToggle = document.getElementById('news-toggle');
  const newsTicker = document.getElementById('news-ticker');
  const newsItems = document.getElementById('news-items');
  if (newsToggle && newsTicker && newsItems) {
    newsToggle.addEventListener('click', () => {
      const isHidden = newsTicker.style.display === 'none' || !newsTicker.style.display;
      if (isHidden) {
        fetchNewsHeadlines();
        newsTicker.style.display = 'block';
        newsToggle.textContent = 'Hide Headlines';
      } else {
        newsTicker.style.display = 'none';
        newsToggle.textContent = 'Show Headlines';
      }
    });
  }

  // Carrot Rain Toggle
  const carrotToggle = document.getElementById('carrot-toggle');
  if (carrotToggle) {
    carrotToggle.addEventListener('click', () => {
      if (!carrotInterval) {
        carrotInterval = setInterval(createCarrot, 250);
        document.body.classList.add('carrot-mode');
        carrotToggle.textContent = 'Stop Carrot Rain';
      } else {
        clearInterval(carrotInterval);
        carrotInterval = null;
        document.body.classList.remove('carrot-mode');
        carrotToggle.textContent = 'Carrot Rain 🥕';
        const carrotLayer = document.getElementById('carrot-layer');
        if (carrotLayer) carrotLayer.innerHTML = '';
      }
    });
  }

  // Treat + Dew
  document.getElementById('treat-toggle')?.addEventListener('click', giveDogTreat);
  document.getElementById('dew-toggle')?.addEventListener('click', giveMountainDew);

// 🎮 Tetris Toggle
const tetrisToggle = document.getElementById('tetris-toggle');
const tetrisWrapper = document.getElementById('tetris-wrapper');

if (tetrisToggle && tetrisWrapper) {
  tetrisToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevents bubbling from interfering with other UI

    const isActive = tetrisWrapper.classList.toggle('tetris-active');
    tetrisToggle.textContent = isActive ? 'Hide Tetris 🎮' : 'Play Tetris 🎮';

    // Optional: Focus on the Tetris canvas after activation
    const canvas = tetrisWrapper.querySelector('canvas');
    if (isActive && canvas) {
      setTimeout(() => canvas.focus(), 50); // Delay to ensure canvas is visible
    }
  });
}


// ===== GLOBAL KEYBOARD CONTROLS =====
document.addEventListener('keydown', (event) => {
  const wrapper = document.getElementById('tetris-wrapper');
  if (!wrapper || wrapper.style.display === 'none') return;

  switch (event.key) {
    case 'ArrowLeft':
      if (typeof moveLeft === 'function') moveLeft();
      break;
    case 'ArrowRight':
      if (typeof moveRight === 'function') moveRight();
      break;
    case 'ArrowDown':
      if (typeof moveDown === 'function') moveDown();
      break;
    case 'ArrowUp':
    case 'x':
      if (typeof rotate === 'function') rotate();
      break;
    case ' ':
      if (typeof dropInstantly === 'function') dropInstantly();
      break;
  }
});


  // Wolf3D
// Wolf3D
const wolfGunToggle = document.getElementById('wolf3d-gun-toggle');
const wolfWrapper = document.getElementById('wolf3d-wrapper');
const wolfIframe = document.getElementById('wolf3d-iframe');

if (wolfGunToggle && wolfWrapper && wolfIframe) {
  wolfGunToggle.addEventListener('click', () => {
    const isVisible = wolfWrapper.classList.toggle('active');

    // 🔫 Animate the gun
    wolfGunToggle.classList.add('animate-fire');
    setTimeout(() => wolfGunToggle.classList.remove('animate-fire'), 300);

    // 🕹️ Load the game only once
    if (isVisible && !wolfIframe.src) {
      wolfIframe.src = "https://dos.zone/wolfenstein-3d-may-05-1992/";
    }

    wolfWrapper.style.display = isVisible ? 'block' : 'none';
  });
}
}

// ---------------------------
// Financial Data Fetch
// ---------------------------
const getStockUrl = () =>
  `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${currentStockSymbol}&apikey=${CONFIG.STOCK_API_KEY}`;

async function fetchStockData() {
  const now = Date.now();
  if (now - lastStockFetchTime < 12000) {
    console.log('⏳ Waiting to avoid stock fetch spam...');
    setTimeout(fetchStockData, 12000 - (now - lastStockFetchTime));
    return;
  }

  try {
    elements.stockData.html('<div class="loading">Loading stock data...</div>');
    lastStockFetchTime = Date.now();

    let stockInfo, dataSource = 'AlphaVantage';

    try {
      const data = await fetchWithRetry(getStockUrl());
      console.log('[AlphaVantage Response]', data);

      const quote = data["Global Quote"];
      if (!quote || !quote["05. price"]) throw new Error('Invalid AlphaVantage data');

      stockInfo = {
        price: parseFloat(quote["05. price"]).toFixed(2),
        change: parseFloat(quote["09. change"] || 0).toFixed(2),
        changePercent: (parseFloat(quote["10. change percent"]) || 0).toFixed(2)
      };
    } catch (err) {
      console.warn('🔁 AlphaVantage fallback triggered. Trying Yahoo Finance...');

      const yfUrl = `${CONFIG.CORS_PROXY}https://query1.finance.yahoo.com/v8/finance/chart/${currentStockSymbol}`;
      const yfData = await fetchWithRetry(yfUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const result = yfData.chart.result?.[0];

      if (!result?.meta?.regularMarketPrice) throw new Error('Yahoo Finance data unavailable');

      const price = result.meta.regularMarketPrice;
      const prevClose = result.meta.chartPreviousClose;
      stockInfo = {
        price: price.toFixed(2),
        change: (price - prevClose).toFixed(2),
        changePercent: ((price / prevClose - 1) * 100).toFixed(2)
      };
      dataSource = 'Yahoo Finance';
    }

    const changeColor = parseFloat(stockInfo.change) >= 0 ? '#4CAF50' : '#F44336';
    elements.stockData.html(`
      <div>
        ${currentStockSymbol}: $${stockInfo.price} 
        <span style="color: ${changeColor}">
          (${parseFloat(stockInfo.change) >= 0 ? '+' : ''}${stockInfo.change} / ${stockInfo.changePercent}%)
        </span>
        <small>(${dataSource})</small>
      </div>
    `);

    stockRetryCount = 0;
    $(document).trigger('dataUpdated', ['stock']);

  } catch (error) {
    console.error('❌ Stock fetch failed:', error);
    elements.stockData.html(`<div class="error">${currentStockSymbol}: Data unavailable</div>`);
    stockRetryCount++;
    const retryDelay = Math.min(30000, 1000 * Math.pow(2, stockRetryCount));
    setTimeout(fetchStockData, retryDelay);
  }
}

async function fetchBitcoinPrice() {
  console.log('₿ Fetching Bitcoin price...');
  try {
    const data = await fetchWithRetry('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (data.bitcoin && data.bitcoin.usd) {
      const price = data.bitcoin.usd;
      elements.btcPrice.text(`BTC: $${price.toLocaleString()}`);
    } else {
      elements.btcPrice.text('BTC: N/A');
    }
    $(document).trigger('dataUpdated', ['btc']);
  } catch (error) {
    console.error('Bitcoin price fetch failed:', error);
    elements.btcPrice.text('BTC: N/A');
  }
}

function fetchNewsHeadlines() {
  console.log('📰 Fetching news headlines...');
  fetch(`${CONFIG.CORS_PROXY}https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en`)
    .then(response => response.text())
    .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
    .then(data => {
      const items = data.querySelectorAll("item");
      const headlines = Array.from(items).slice(0, 10).map(item => item.querySelector("title").textContent);
      const newsItemsEl = document.getElementById('news-items');
      if (newsItemsEl) {
        newsItemsEl.innerHTML = headlines.join(' 🥕 ');
        newsItemsEl.style.animation = 'none';
        void newsItemsEl.offsetWidth;
        newsItemsEl.style.animation = 'scrollNews 60s linear infinite';
      }
      $(document).trigger('dataUpdated', ['news']);
    })
    .catch(error => {
      console.error('Error fetching Google News:', error);
      const newsItemsEl = document.getElementById('news-items');
      if (newsItemsEl) {
        newsItemsEl.innerHTML = "Failed to load news.";
      }
    });
}

// ---------------------------
// Time & App Initialization
// ---------------------------
function updateTime() {
  const now = moment();
  elements.time.text(now.format(hourFormat === '12' ? 'hh:mm:ss A' : 'HH:mm:ss'));
  elements.date.text(now.format('MMM DD, YYYY'));
  setTimeout(updateTime, 1000 - now.milliseconds());
}

function applyNightMode() {
  console.warn('applyNightMode() not implemented yet.');
}

function initializeApp() {
  console.log('🚀 Initializing App...');
  createDebugPanel();
  applyNightMode();
  initRadar();
  updateTime();
  fetchWeather();
  fetchForecast();
  fetchStockData();
  fetchBitcoinPrice();
  fetchWeatherAlerts();
  fetchNewsHeadlines();
  setupUIControls();
  setInterval(fetchWeather, 600000);
  setInterval(fetchForecast, 600000);
  setInterval(fetchStockData, 65000);
  setInterval(fetchBitcoinPrice, 60000);
  setInterval(fetchWeatherAlerts, 900000);
  setInterval(fetchNewsHeadlines, 600000);
}

// Start the app when the DOM is ready
$(document).ready(initializeApp);

function toggleIframeDisplay(buttonId, wrapperId, labelOn, labelOff) {
  const button = document.getElementById(buttonId);
  const wrapper = document.getElementById(wrapperId);

  if (button && wrapper) {
    button.addEventListener('click', () => {
      const isVisible = wrapper.classList.toggle('active');
      wrapper.style.display = isVisible ? 'block' : 'none';
      button.textContent = isVisible ? labelOff : labelOn;
    });
  }
}

document.getElementById('debug-toggle')?.addEventListener('click', () => {
  const panel = document.getElementById('debug-panel');
  if (panel) {
    const visible = panel.style.display === 'block';
    panel.style.display = visible ? 'none' : 'block';
    if (!visible) updateDebugPanel(); // refresh values right away
  }
});


// === Spotify Juice WRLD Playlist Controls ===
const spotifyPlayButton = document.getElementById('spotifyPlayButton');
const spotifyStopButton = document.getElementById('spotifyStopButton');
const spotifyPlayer = document.getElementById('spotifyPlayer');
const spotifyIframe = document.getElementById('spotifyIframe');

const spotifyPlaylistURL = "https://open.spotify.com/embed/playlist/37i9dQZF1DZ06evO2O09Hg";

spotifyPlayButton?.addEventListener('click', () => {
  if (spotifyPlayer.style.display === 'none' || !spotifyPlayer.style.display) {
    spotifyPlayer.style.display = 'block';
    if (spotifyIframe.src !== spotifyPlaylistURL) {
      spotifyIframe.src = spotifyPlaylistURL;
    }
    spotifyStopButton.style.display = 'inline-block';
  }
});

spotifyStopButton?.addEventListener('click', () => {
  spotifyPlayer.style.display = 'none';
  spotifyIframe.src = ""; // unload to stop playback
  spotifyStopButton.style.display = 'none';
});
