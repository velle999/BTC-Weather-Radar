$(document).ready(() => {
  initializeApp();
});

// Constants & Configuration
const CONFIG = {
  WEATHER_API_KEY: 'c8e85b9c5cd854c7aac3bb9042e0801b',
  STOCK_API_KEY: 'R83AYXIEJ0K71FUR',
  CORS_PROXY: "https://api.allorigins.win/raw?url=",
  DEFAULT_ZIP: '63090',
  DEFAULT_STOCK: 'NVDA',
  DEFAULT_ZONE: 'MOZ070'
};

// State variables
let currentZip = localStorage.getItem('weatherZip') || CONFIG.DEFAULT_ZIP;
let currentStockSymbol = localStorage.getItem('stockSymbol') || CONFIG.DEFAULT_STOCK;
let currentZoneId = CONFIG.DEFAULT_ZONE;
let controlsVisible = true;
let hourFormat = localStorage.getItem('hourFormat') || '12';
let radarLayer = null;
let lastStockFetchTime = 0;
let stockRetryCount = 0;
let radarMap = null;
let radarActive = true;
let radarCoordinates = { lat: 38.6270, lng: -90.1994 };

// DOM Elements
const elements = {
    time: $('#time'),
    date: $('#date'),
    btcPrice: $('#btcprice'),
    stockData: $('#stockData'),
    weatherAlerts: $('#weatherAlerts'),
    currentTemp: $('.currentTemp .temp'),
    currentDesc: $('#current .desc'),
    currentIcon: $('#current .icon'),
    animalMessage: $('#animal-companion .animal-message'),
    animalBody: $('#animal-companion .animal-body'),
    radarTimestamp: $('#radar-timestamp'),
    controls: $('#controls'),
    showControls: $('#showControls')
};

$('#settings-button').on('click', promptUserSettings);

// ----------------------------
// GENERALIZED HOVER SETUP
// ----------------------------
function setupAnimalHover() {
    const companions = [
        { id: '#animal-companion', bodyClass: '.animal-body', messageClass: '.animal-message', carrotClass: null },
        { id: '#bunny-companion', bodyClass: '.bunny-body', messageClass: '.bunny-message', carrotClass: '.bunny-carrot' }
    ];

    companions.forEach(({ id, bodyClass, messageClass, carrotClass }) => {
        const el = document.querySelector(id);
        if (!el) {
            console.warn(`🐾 Companion ${id} not found`);
            return;
        }

        const body = el.querySelector(bodyClass);
        const message = el.querySelector(messageClass);
        const carrot = carrotClass ? el.querySelector(carrotClass) : null;

        el.addEventListener('mouseenter', () => {
            if (body) body.classList.add('hovering');
            if (message) message.style.opacity = '1';
            if (carrot) carrot.style.opacity = '1';
        });

        el.addEventListener('mouseleave', () => {
            if (body) body.classList.remove('hovering');
            if (message) message.style.opacity = '0';
            if (carrot) carrot.style.opacity = '0';
        });
    });
}

function startCarrotRain() {
  setInterval(() => {
    if (Math.random() < 0.5) {
      const carrot = document.createElement('div');
      carrot.className = 'carrot';
      carrot.textContent = '🥕';
      carrot.style.left = Math.random() * 100 + 'vw';
      carrot.style.animationDuration = (3 + Math.random() * 2) + 's';
      document.getElementById('carrot-rain').appendChild(carrot);
      setTimeout(() => carrot.remove(), 6000);
    }
  }, 10000);
}
function createClouds(amount) {
  const cloudContainer = document.createDocumentFragment();
  for (let i = 0; i < amount; i++) {
    const cloud = document.createElement('div');
    cloud.className = 'cloud';
    
    // Randomize cloud size and position
    cloud.style.width = `${150 + Math.random() * 150}px`;
    cloud.style.height = `${80 + Math.random() * 70}px`;
    cloud.style.top = `${Math.random() * 80}vh`;
    cloud.style.animationDuration = `${50 + Math.random() * 50}s`;
    cloud.style.left = `${-200 - Math.random() * 200}px`;

    cloudContainer.appendChild(cloud);
  }
  document.body.appendChild(cloudContainer);
}

// After you detect weather:
function applyWeatherEffects(weatherCondition) {
  // Clear previous clouds if any
  document.querySelectorAll('.cloud').forEach(cloud => cloud.remove());

  if (weatherCondition.includes('cloud') || weatherCondition.includes('fog') || weatherCondition.includes('rain') || weatherCondition.includes('snow')) {
    createClouds(6); // more clouds on cloudy/foggy/rainy/snowy
  } else if (weatherCondition.includes('clear')) {
    createClouds(2); // few clouds on clear day
  }
}

// ----------------------------
// UTILITY FUNCTIONS
// ----------------------------
function promptUserSettings() {
    const newZip = prompt("Enter ZIP Code:", currentZip);
    if (newZip && /^\d{5}$/.test(newZip)) {
        currentZip = newZip;
        localStorage.setItem('weatherZip', newZip);
        $('#locationInput').val(newZip);
        fetchWeather();
        fetchForecast();
        fetchWeatherAlerts();
    }

    const newStock = prompt("Enter Stock Symbol:", currentStockSymbol);
    if (newStock) {
        currentStockSymbol = newStock.toUpperCase();
        localStorage.setItem('stockSymbol', currentStockSymbol);
        $('#stockInput').val(currentStockSymbol);
        fetchStockData();
    }

    const newFormat = prompt("Time Format (12/24):", hourFormat);
    if (newFormat === '12' || newFormat === '24') {
        hourFormat = newFormat;
        localStorage.setItem('hourFormat', newFormat);
        $('#hourFormat').val(newFormat);
        updateTime();
    }
}

async function fetchWithRetry(url, options, retries = 3) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw err;
    }
}

// ----------------------------
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
        elements.currentDesc.text('Loading...');
        const data = await fetchWithRetry(getWeatherUrl());
        updateCurrentWeather(data);
        $(document).trigger('dataUpdated', ['weather']);
    } catch (error) {
        console.error('Weather fetch failed:', error);
        elements.currentTemp.text('N/A');
        elements.currentDesc.text('Weather unavailable');
        setTimeout(fetchWeather, 30000);
    }
}

function updateCurrentWeather(data) {
    const currentTemp = Math.round(data.main.temp);
    const weatherDesc = data.weather[0].description;
    const weatherIcon = data.weather[0].icon;
    let mainWeather = data.weather[0].main.toLowerCase();

    elements.currentTemp.text(`${currentTemp}°F`);
    elements.currentDesc.text(weatherDesc);
    elements.currentIcon.html(`<img src="https://openweathermap.org/img/wn/${weatherIcon}.png" alt="${weatherDesc}">`);
    
    document.body.classList.remove('weather-clear', 'weather-clouds', 'weather-rain', 
        'weather-snow', 'weather-thunderstorm', 'weather-fog');
    
    if (mainWeather.includes('cloud')) {
        document.body.classList.add('weather-clouds');
    } else if (mainWeather.includes('rain') || mainWeather.includes('drizzle')) {
        document.body.classList.add('weather-rain');
    } else if (mainWeather.includes('snow')) {
        document.body.classList.add('weather-snow');
    } else if (mainWeather.includes('thunderstorm')) {
        document.body.classList.add('weather-thunderstorm');
    } else if (mainWeather.includes('mist') || mainWeather.includes('fog') || mainWeather.includes('haze')) {
        document.body.classList.add('weather-fog');
    } else {
        document.body.classList.add('weather-clear');
    }

    if (typeof data.coord.lat === 'number' && typeof data.coord.lon === 'number') {
        updateRadarLocation(data.coord.lat, data.coord.lon);
    }
}

function showWeatherEffects(mainWeather) {
  $('.rain-layer, .snow-layer, .wind-layer').css('opacity', 0);

  if (mainWeather.includes('rain') || mainWeather.includes('drizzle')) {
    $('.rain-layer').css('opacity', 0.5);
    applyWindToCompanions(true);
  } else if (mainWeather.includes('snow')) {
    $('.snow-layer').css('opacity', 0.5);
    applyWindToCompanions(false);
  } else if (mainWeather.includes('wind') || mainWeather.includes('storm')) {
    $('.wind-layer').css('opacity', 0.4);
    applyWindToCompanions(true);
  } else {
    applyWindToCompanions(false);
  }
}

function applyWindToCompanions(enable) {
  const bunnyLeftEar = document.querySelector('#bunny-companion .bunny-ear.left');
  const bunnyRightEar = document.querySelector('#bunny-companion .bunny-ear.right');
  const foxTail = document.querySelector('#animal-companion .animal-hearts');
  const bunnyBody = document.querySelector('#bunny-companion .bunny-body');
  const foxBody = document.querySelector('#animal-companion .animal-body');

  if (enable) {
    bunnyLeftEar?.classList.add('wind-wiggle');
    bunnyRightEar?.classList.add('wind-wiggle');
    foxTail?.classList.add('wind-wiggle');
    bunnyBody?.classList.add('wind-blown');
    foxBody?.classList.add('wind-blown');
  } else {
    bunnyLeftEar?.classList.remove('wind-wiggle');
    bunnyRightEar?.classList.remove('wind-wiggle');
    foxTail?.classList.remove('wind-wiggle');
    bunnyBody?.classList.remove('wind-blown');
    foxBody?.classList.remove('wind-blown');
  }
}

async function fetchForecast() {
    try {
        $('.forecast .day').text('Loading...');
        const data = await fetchWithRetry(getForecastUrl());
        updateForecast(data);
    } catch (error) {
        console.error('Forecast fetch failed:', error);
        $('.forecast .day').text('N/A');
    }
}

function updateForecast(data) {
    const dailyForecasts = data.list.filter(item => item.dt_txt.includes('12:00:00'));
    dailyForecasts.slice(0, 5).forEach((forecast, index) => {
        const dayElement = $(`#forecast${index + 1}`);
        const day = moment(forecast.dt_txt).format('ddd');
        const weatherIcon = forecast.weather[0].icon;
        const highTemp = Math.round(forecast.main.temp_max);
        const lowTemp = Math.round(forecast.main.temp_min);

        dayElement.find('.day').text(day);
        dayElement.find('.icon').html(`<img src="https://openweathermap.org/img/wn/${weatherIcon}.png">`);
        dayElement.find('.high').text(`${highTemp}°F`);
        dayElement.find('.low').text(`${lowTemp}°F`);
    });
}

// ----------------------------
// STOCK FUNCTIONS
// ----------------------------
const getStockUrl = () => 
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${currentStockSymbol}&apikey=${CONFIG.STOCK_API_KEY}`;

async function fetchStockData() {
    const now = Date.now();
    if (now - lastStockFetchTime < 12000) {
        setTimeout(fetchStockData, 12000 - (now - lastStockFetchTime));
        return;
    }

    try {
        elements.stockData.html('<div class="loading">Loading stock data...</div>');
        lastStockFetchTime = Date.now();
        
        let stockInfo, dataSource = 'AlphaVantage';
        try {
            const data = await fetchWithRetry(getStockUrl());
            stockInfo = data['Global Quote'];
            if (!stockInfo || !stockInfo['05. price']) throw new Error('Invalid AlphaVantage data');
        } catch {
            const yfUrl = `${CONFIG.CORS_PROXY}https://query1.finance.yahoo.com/v8/finance/chart/${currentStockSymbol}`;
            const yfData = await fetchWithRetry(yfUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            const result = yfData.chart.result?.[0];
            stockInfo = {
                price: result.meta.regularMarketPrice?.toFixed(2),
                change: (result.meta.regularMarketPrice - result.meta.chartPreviousClose).toFixed(2),
                changePercent: ((result.meta.regularMarketPrice / result.meta.chartPreviousClose - 1) * 100).toFixed(2)
            };
            dataSource = 'Yahoo Finance';
        }

        const changeColor = stockInfo.change >= 0 ? '#4CAF50' : '#F44336';
        elements.stockData.html(`
            <div>
                ${currentStockSymbol}: $${stockInfo.price} 
                <span style="color: ${changeColor}">(${stockInfo.change >= 0 ? '+' : ''}${stockInfo.change} / ${stockInfo.changePercent}%)</span>
                <small>(${dataSource})</small>
            </div>
        `);
        stockRetryCount = 0;
        $(document).trigger('dataUpdated', ['stock']);
    } catch (error) {
        console.error('Stock fetch failed:', error);
        elements.stockData.html(`<div class="error">${currentStockSymbol}: Data unavailable</div>`);
        stockRetryCount++;
        const retryDelay = Math.min(30000, 1000 * Math.pow(2, stockRetryCount));
        setTimeout(fetchStockData, retryDelay);
    }
}

// ----------------------------
// BITCOIN PRICE
// ----------------------------
async function fetchBitcoinPrice() {
    try {
        elements.btcPrice.text('Loading BTC price...');
        const data = await fetchWithRetry('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        elements.btcPrice.text(`BTC: $${data.bitcoin.usd.toLocaleString()}`);
        $(document).trigger('dataUpdated', ['bitcoin']);
    } catch (error) {
        console.error('BTC fetch failed:', error);
        elements.btcPrice.text('BTC: $--');
        setTimeout(fetchBitcoinPrice, 30000);
    }
}

// ----------------------------
// WEATHER ALERTS
// ----------------------------
async function fetchWeatherAlerts() {
    try {
        elements.weatherAlerts.html('<div class="loading">Checking alerts...</div>');
        const data = await fetchWithRetry(getAlertsUrl());
        updateWeatherAlerts(data);
    } catch (error) {
        console.error("Alerts fetch failed:", error);
        elements.weatherAlerts.html('<div>Error loading alerts</div>');
        applyWeatherEffects(weatherDescription.toLowerCase());

    }
}

function updateWeatherAlerts(data) {
    if (data.features?.length > 0) {
        const alerts = data.features.map(alert => {
            const severity = alert.properties.severity.toLowerCase();
            return `
                <div class="alert ${severity}">
                    <strong>${alert.properties.event}</strong>: ${alert.properties.headline}
                    <br><em>${alert.properties.description}</em>
                </div>
            `;
        }).join('<hr>');
        elements.weatherAlerts.html(alerts);
    } else {
        elements.weatherAlerts.html('<div>No active alerts</div>');
    }
}

// ----------------------------
// RADAR FUNCTIONS
// ----------------------------
function initRadar() {
    $('#radar-container').addClass('active');
    $('#radar-toggle').text('Refresh Radar');
    loadRadarData();
    $('#radar-toggle').on('click', toggleRadar);
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
    script.onload = setupRadarMap;
    document.head.appendChild(script);
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
    if (!radarActive) return;
    
    try {
        const data = await fetchWithRetry('https://api.rainviewer.com/public/weather-maps.json');
        if (data.radar?.past?.length) {
            const latestRadar = data.radar.past.slice(-1)[0];
            const radarUrl = `https://tilecache.rainviewer.com${latestRadar.path}/256/{z}/{x}/{y}/2/1_1.png`;
            
            if (radarLayer) radarMap.removeLayer(radarLayer);
            
            radarLayer = L.tileLayer(radarUrl, {
                opacity: 0.7,
                attribution: 'Weather data © RainViewer'
            }).addTo(radarMap);
            
            elements.radarTimestamp.text('Updated: ' + new Date(latestRadar.time * 1000).toLocaleTimeString());
        }
    } catch (error) {
        console.error('Radar failed:', error);
        elements.radarTimestamp.text('Radar unavailable');
    }
}

function toggleRadar() {
    radarActive = !radarActive;
    $('#radar-container').toggleClass('active', radarActive);
    $('#radar-toggle').text(radarActive ? 'Refresh Radar' : 'Show Radar');
    if (radarActive) loadRadarData();
}

function updateRadarLocation(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    radarCoordinates = { lat, lng };
    if (radarMap) {
        radarMap.setView([lat, lng], 8);
        if (radarActive) loadRadarData();
    }
}

// ----------------------------
// CORE FUNCTIONS
// ----------------------------
function updateTime() {
    const now = moment();
    elements.time.text(now.format(hourFormat === '12' ? 'hh:mm:ss A' : 'HH:mm:ss'));
    elements.date.text(now.format('MMM DD, YYYY'));
    setTimeout(updateTime, 1000 - now.milliseconds());
}

function setupControlPanel() {
    $('#locationInput').val(currentZip);
    $('#stockInput').val(currentStockSymbol);
    $('#hourFormat').val(hourFormat);

    $('#hideControls').on('click', () => {
        elements.controls.addClass('hidden');
        elements.showControls.fadeIn(200);
        controlsVisible = false;
    });

    $('#showControls').on('click', () => {
        elements.controls.removeClass('hidden');
        elements.showControls.fadeOut(200);
        controlsVisible = true;
    });

    $('#updateLocation').on('click', () => {
        const newZip = $('#locationInput').val().trim();
        if (/^\d{5}$/.test(newZip)) {
            currentZip = newZip;
            localStorage.setItem('weatherZip', newZip);
            fetchWeather();
            fetchForecast();
            fetchWeatherAlerts();
        } else {
            elements.animalMessage.text('Invalid ZIP Code!').css('opacity', 1);
            setTimeout(() => elements.animalMessage.css('opacity', 0), 2000);
        }
    });

    $(document).on('click', e => {
        if (controlsVisible && !$(e.target).closest('#controls').length) {
            $('#hideControls').trigger('click');
        }
    });
}

function initializeApp() {
    setupControlPanel();
    updateTime();
    initRadar();
    applyNightMode();
    setupAnimalHover();

    fetchWeather();
    fetchForecast();
    fetchBitcoinPrice();
    fetchStockData();
    fetchWeatherAlerts();

    setInterval(fetchWeather, 600000);
    setInterval(fetchForecast, 600000);
    setInterval(fetchBitcoinPrice, 60000);
    setInterval(fetchStockData, 65000);
    setInterval(fetchWeatherAlerts, 900000);

    startCarrotRain();

    setInterval(() => {
        const fox = document.getElementById('animal-companion');
        if (Math.random() < 0.4) {
            fox.style.animation = 'fox-dash 3s ease-in-out forwards';
            setTimeout(() => {
                fox.style.animation = 'roam 20s linear infinite alternate';
            }, 3000);
        }
    }, 7000);

    // Initialize bunny animations
    startBunnyAnimations();

    $(document).on('dataUpdated', (e, dataType) => {
        const messages = {
            weather: "New weather data!",
            stock: "Stock update received!",
            bitcoin: "Crypto prices updated!",
            radar: "Radar refreshed!"
        };
        
        if (messages[dataType]) {
            elements.animalMessage.text(messages[dataType]).stop().css('opacity', 1).animate({opacity: 0}, 2000);
            elements.animalBody.css('transform', 'translateY(-15px)').animate({transform: 'translateY(0)'}, 300);
        }
    });
}

function startBunnyAnimations() {
  const bunny = document.getElementById('bunny-companion');
  
  // Random ear twitch
  setInterval(() => {
    if (Math.random() < 0.3) {
      bunny.querySelector('.bunny-ear.left').style.animation = 'none';
      bunny.querySelector('.bunny-ear.right').style.animation = 'none';
      setTimeout(() => {
        bunny.querySelector('.bunny-ear.left').style.animation = '';
        bunny.querySelector('.bunny-ear.right').style.animation = '';
      }, 50);
    }
  }, 5000);

  // Random nose wiggle
  setInterval(() => {
    if (Math.random() < 0.4) {
      bunny.querySelector('.bunny-nose').style.transform = 'scale(1.1)';
      setTimeout(() => {
        bunny.querySelector('.bunny-nose').style.transform = 'scale(1)';
      }, 200);
    }
  }, 3000);
}

function applyNightMode() {
  const hour = new Date().getHours();
  const isNight = (hour >= 18 || hour <= 6);

  if (isNight) {
    document.body.classList.add('night-mode');
    $('#weather-effects .rain-layer, #weather-effects .snow-layer, #weather-effects .wind-layer').css('opacity', '0.3');
    document.getElementById('rgbBackground').style.filter = 'brightness(0.6) saturate(0.8)';
  } else {
    document.body.classList.remove('night-mode');
    $('#weather-effects .rain-layer, #weather-effects .snow-layer, #weather-effects .wind-layer').css('opacity', '');
    document.getElementById('rgbBackground').style.filter = '';
  }
}

// ----------------------------
// INITIALIZATION
// ----------------------------
$(document).ready(initializeApp);

document.addEventListener('DOMContentLoaded', function() {
  const gearButton = document.getElementById('gear-button');
  const controls = document.getElementById('controls');
  const closeSettings = document.getElementById('close-settings');

  gearButton.addEventListener('click', function() {
    controls.classList.toggle('hidden');
  });

  closeSettings.addEventListener('click', function() {
    controls.classList.add('hidden');
  });
});

document.addEventListener('DOMContentLoaded', function() {
  const stocksContainer = document.getElementById('stocks-container');
  const stocksToggle = document.getElementById('stocks-toggle');

  stocksToggle.addEventListener('click', () => {
    if (stocksContainer.style.display === 'none' || !stocksContainer.style.display) {
      stocksContainer.style.display = 'block';
      stocksToggle.textContent = 'Hide Stocks';
    } else {
      stocksContainer.style.display = 'none';
      stocksToggle.textContent = 'Show Stocks';
    }
  });

  // Optional: hide stocks by default
  stocksContainer.style.display = 'none';
});

