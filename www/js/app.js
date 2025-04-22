// Constants
const WEATHER_API_KEY = 'c8e85b9c5cd854c7aac3bb9042e0801b';
const STOCK_API_KEY = 'R83AYXIEJ0K71FUR';
const DEFAULT_ZIP = '63090';
const DEFAULT_STOCK = 'NVDA';
const DEFAULT_ZONE = 'MOZ070';
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

// State variables
let currentZip = localStorage.getItem('weatherZip') || DEFAULT_ZIP;
let currentStockSymbol = localStorage.getItem('stockSymbol') || DEFAULT_STOCK;
let currentZoneId = DEFAULT_ZONE;
let controlsVisible = true;
let hourFormat = localStorage.getItem('hourFormat') || '12';

// DOM Elements
const elements = {
    time: $('#time'),
    date: $('#date'),
    btcPrice: $('#btcprice'),
    stockData: $('#stockData'),
    weatherAlerts: $('#weatherAlerts'),
    currentTemp: $('.currentTemp .temp'),
    currentDesc: $('#current .desc'),
    currentIcon: $('#current .icon')
};

// URL Generators
const getWeatherUrl = () => 
    `https://api.openweathermap.org/data/2.5/weather?zip=${currentZip},US&appid=${WEATHER_API_KEY}&units=imperial`;

const getForecastUrl = () => 
    `https://api.openweathermap.org/data/2.5/forecast?zip=${currentZip},US&appid=${WEATHER_API_KEY}&units=imperial`;

const getStockUrl = () => 
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${currentStockSymbol}&apikey=${STOCK_API_KEY}`;

const getAlertsUrl = () => 
    `https://api.weather.gov/alerts/active/zone/${currentZoneId}`;

// Control Panel Functions
function showControlsPanel() {
    $('#controls').removeClass('hidden');
    $('#showControls').fadeOut(200);
    controlsVisible = true;
}

function hideControlsPanel() {
    $('#controls').addClass('hidden');
    $('#showControls').fadeIn(200);
    controlsVisible = false;
}

function setupControlPanel() {
    // Load saved preferences
    $('#locationInput').val(currentZip);
    $('#stockInput').val(currentStockSymbol);
    $('#hourFormat').val(hourFormat);

    // Set up event handlers
    $('#hideControls').click(hideControlsPanel);
    $('#showControls').click(showControlsPanel);
    
    $('#updateLocation').click(updateLocation);
    $('#updateStock').click(updateStock);
    
    // Add this new event handler for the hour format
    $('#hourFormat').change(function() {
        hourFormat = $(this).val();
        localStorage.setItem('hourFormat', hourFormat);
        updateTime(); // Immediately update the display
    });
    
    $(document).click((e) => {
        if (controlsVisible && !$(e.target).closest('#controls').length) {
            hideControlsPanel();
        }
    });
    
    $('#locationInput, #stockInput').focus(showControlsPanel);
}
// Data Fetching Functions
async function fetchWeather() {
    try {
        elements.currentDesc.text('Loading...');
        elements.currentTemp.text('--°F');
        
        const response = await fetch(getWeatherUrl());
        if (!response.ok) throw new Error(`Weather API error: ${response.statusText}`);
        
        const data = await response.json();
        updateCurrentWeather(data);
    } catch (error) {
        console.error('Error fetching weather:', error);
        elements.currentTemp.text('N/A');
        elements.currentDesc.text('Weather unavailable');
        // Retry after 30 seconds if failed
        setTimeout(fetchWeather, 30000);
    }
}

function updateCurrentWeather(data) {
    const currentTemp = Math.round(data.main.temp);
    const weatherDesc = data.weather[0].description;
    const weatherIcon = data.weather[0].icon;

    elements.currentTemp.text(`${currentTemp}°F`);
    elements.currentDesc.text(weatherDesc);
    elements.currentIcon.html(`<img src="https://openweathermap.org/img/wn/${weatherIcon}.png" alt="${weatherDesc}">`);
    
    // Update radar location
    updateRadarLocation(data.coord.lat, data.coord.lon);
}

async function fetchForecast() {
    try {
        $('.forecast .day').text('Loading...');
        
        const response = await fetch(getForecastUrl());
        const data = await response.json();
        updateForecast(data);
    } catch (error) {
        console.error('Error fetching forecast:', error);
        $('.forecast .day').text('N/A');
    }
}

function updateForecast(data) {
    const dailyForecasts = data.list.filter(item => item.dt_txt.includes('12:00:00'));

    dailyForecasts.slice(0, 5).forEach((forecast, index) => {
        const dayElement = $(`#forecast${index + 1}`);
        const day = moment(forecast.dt_txt).format('ddd');
        const weatherDesc = forecast.weather[0].description;
        const weatherIcon = forecast.weather[0].icon;
        const highTemp = Math.round(forecast.main.temp_max);
        const lowTemp = Math.round(forecast.main.temp_min);

        dayElement.find('.day').text(day);
        dayElement.find('.icon').html(`<img src="https://openweathermap.org/img/wn/${weatherIcon}.png" alt="${weatherDesc}">`);
        dayElement.find('.desc').text(weatherDesc);
        dayElement.find('.high').text(`${highTemp}°F`);
        dayElement.find('.low').text(`${lowTemp}°F`);
    });
}

async function fetchBitcoinPrice() {
    try {
        elements.btcPrice.text('Loading BTC price...');
        
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        if (!response.ok) throw new Error(`Bitcoin API error: ${response.statusText}`);
        
        const data = await response.json();
        elements.btcPrice.text(`BTC: $${data.bitcoin.usd.toLocaleString()}`);
    } catch (error) {
        console.error('Error fetching Bitcoin price:', error);
        elements.btcPrice.text('BTC: $--');

        // Retry after 30 seconds if failed
        setTimeout(fetchBitcoinPrice, 30000);
    }
}

let lastStockFetchTime = 0;
let stockRetryCount = 0; // Add this to track retry attempts

async function fetchStockData() {
    const now = Date.now();
    const minDelay = 12000; // 12 seconds between requests
    
    if (now - lastStockFetchTime < minDelay) {
        setTimeout(fetchStockData, minDelay - (now - lastStockFetchTime));
        return;
    }

    try {
        elements.stockData.html('<div class="loading">Loading stock data...</div>');
        lastStockFetchTime = Date.now();
        
        // Try Alpha Vantage first
        const avResponse = await fetch(getStockUrl());
        if (avResponse.ok) {
            const data = await avResponse.json();
            if (data['Global Quote'] && data['Global Quote']['05. price']) {
                updateStockData(data);
                stockRetryCount = 0; // Reset retry count on success
                return;
            }
        }

        // Fallback to Yahoo Finance
        const yfResponse = await fetch(`${CORS_PROXY}https://query1.finance.yahoo.com/v8/finance/chart/${currentStockSymbol}`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (yfResponse.ok) {
            const yfData = await yfResponse.json();
            const result = yfData.chart.result?.[0];
            if (result && result.meta?.regularMarketPrice && result.meta?.chartPreviousClose) {
                const price = result.meta.regularMarketPrice.toFixed(2);
                const previousClose = result.meta.chartPreviousClose.toFixed(2);
                const change = (price - previousClose).toFixed(2);
                const changePercent = ((change / previousClose) * 100).toFixed(2);
                const changeColor = change >= 0 ? '#4CAF50' : '#F44336';

                elements.stockData.html(`
                    <div>
                        ${currentStockSymbol}: $${price} 
                        <span style="color: ${changeColor}">(${change >= 0 ? '+' : ''}${change} / ${changePercent}%)</span>
                        <small>(Yahoo Finance)</small>
                    </div>
                `);
                stockRetryCount = 0; // Reset retry count on success
                return;
            }
        }

        throw new Error('Both stock APIs failed');

    } catch (error) {
        console.error('Stock fetch error:', error);
        elements.stockData.html(`
            <div class="stock-error">
                ${currentStockSymbol}: Data unavailable
                <small>Next try in 30s</small>
            </div>
        `);

        stockRetryCount++;
        const retryDelay = Math.min(30000, 1000 * Math.pow(2, stockRetryCount));
        setTimeout(fetchStockData, retryDelay);
    }
}

async function fetchWeatherAlerts() {
    try {
        elements.weatherAlerts.html('<div class="loading">Checking alerts...</div>');
        
        const response = await fetch(getAlertsUrl());
        const data = await response.json();
        updateWeatherAlerts(data);
    } catch (error) {
        console.error("Error fetching alerts:", error);
        elements.weatherAlerts.html('<div>Error loading alerts</div>');
    }
}

function updateWeatherAlerts(data) {
    if (data.features && data.features.length > 0) {
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

// Update Functions
function updateTime() {
    const now = moment();
    if (hourFormat === '12') {
        elements.time.text(now.format('hh:mm:ss A'));  // 12-hour format with AM/PM
    } else {
        elements.time.text(now.format('HH:mm:ss'));    // 24-hour format
    }
    elements.date.text(now.format('MMM DD, YYYY'));
    
    // Schedule the next update to align with the second change
    const delay = 1000 - now.milliseconds();
    setTimeout(updateTime, delay);
}

function updateLocation() {
    const newZip = $('#locationInput').val().trim();
    if (!/^\d{5}$/.test(newZip)) {
        alert('Please enter a valid 5-digit ZIP code');
        return;
    }

    currentZip = newZip;
    localStorage.setItem('weatherZip', newZip);
    $('#locationInput').val('');
    fetchWeather();
    fetchForecast();
    fetchWeatherAlerts();
}

function updateStockData(data) {
    const stockInfo = data['Global Quote'];
    if (!stockInfo || !stockInfo['05. price']) {
        // If Alpha Vantage fails but we have data from Yahoo, don't overwrite
        if (!elements.stockData.text().includes('Yahoo Finance')) {
            elements.stockData.html(`
                <div class="stock-error">
                    ${currentStockSymbol}: Data unavailable
                    <small>Next try in 30s</small>
                </div>
            `);
        }
        return;
    }
    
    const stockPrice = parseFloat(stockInfo['05. price']).toFixed(2);
    const priceChange = parseFloat(stockInfo['10. change percent']).toFixed(2);
    const changeColor = priceChange >= 0 ? '#4CAF50' : '#F44336';
    
    elements.stockData.html(`
        <div>
            ${currentStockSymbol}: $${stockPrice} 
            <span style="color: ${changeColor}">(${priceChange}%)</span>
            <small>(Alpha Vantage)</small>
        </div>
    `);
}
// Radar variables
let radarMap;
let radarActive = false;
let radarCoordinates = { lat: 38.6270, lng: -90.1994 }; // Default to St. Louis coordinates

// Initialize radar
function initRadar() {
    $('#radar-toggle').click(toggleRadar);
    
    // Load Leaflet CSS (dynamically since we don't want to modify HTML)
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
    document.head.appendChild(link);
    
    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
    script.onload = setupRadarMap;
    document.head.appendChild(script);
}

// Setup radar map
function setupRadarMap() {
    radarMap = L.map('radar-map', {
        attributionControl: false,
        zoomControl: false,
        dragging: false,
        doubleClickZoom: false,
        scrollWheelZoom: false
    }).setView([radarCoordinates.lat, radarCoordinates.lng], 8);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(radarMap);
    
    loadRadarData();
}

// Toggle radar visibility
function toggleRadar() {
    const container = $('#radar-container');
    radarActive = !radarActive;
    
    if (radarActive) {
        container.addClass('active');
        $('#radar-toggle').text('Hide Radar');
        loadRadarData();
    } else {
        container.removeClass('active');
        $('#radar-toggle').text('Show Radar');
    }
}

// Load radar data from RainViewer API
async function loadRadarData() {
    if (!radarActive) return;
    
    try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await response.json();
        
        if (data.radar && data.radar.past) {
            const latestRadar = data.radar.past[data.radar.past.length - 1];
const radarUrl = `https://tilecache.rainviewer.com${latestRadar.path}/256/{z}/{x}/{y}/2/1_1.png`;
            
            // Clear previous radar layer if it exists
            if (window.radarLayer) {
                radarMap.removeLayer(window.radarLayer);
            }
            
            window.radarLayer = L.tileLayer(radarUrl, {
                opacity: 0.7,
                attribution: 'Weather data © RainViewer'
            }).addTo(radarMap);
            
            const timestamp = new Date(latestRadar.time * 1000);
            $('#radar-timestamp').text('Updated: ' + timestamp.toLocaleTimeString());
        }
    } catch (error) {
        console.error('Error loading radar data:', error);
        $('#radar-timestamp').text('Radar unavailable');
    }
}

// Update radar location based on weather data
function updateRadarLocation(lat, lng) {
    radarCoordinates = { lat, lng };
    if (radarMap) {
        radarMap.setView([lat, lng], 8);
        if (radarActive) {
            loadRadarData();
        }
    }
}

// Initialization
function initializeApp() {
    setupControlPanel();
    updateTime();
    initRadar();
    
    // Initial data fetch
    fetchWeather();
    fetchForecast();
    fetchBitcoinPrice();
    fetchStockData();
    fetchWeatherAlerts();

    // Set up intervals
    setInterval(fetchWeather, 10 * 60 * 1000); // 10 minutes
    $(document).trigger('dataUpdated', ['weather']);
    setInterval(fetchForecast, 10 * 60 * 1000);
    setInterval(fetchBitcoinPrice, 60 * 1000); // 1 minute
    $(document).trigger('dataUpdated', ['bitcoin']);
    setInterval(fetchStockData, 65 * 1000); // 
    elements.stockData.html('<div class="loading">Loading...</div>');
    $(document).trigger('dataUpdated', ['stock']);
    setInterval(fetchWeatherAlerts, 15 * 60 * 1000); // 15 minutes
    elements.weatherAlerts.html('<div class="loading">Checking alerts...</div>');

// React to data updates
$(document).on('dataUpdated', function(e, dataType) {
    const messages = {
        weather: "New weather data!",
        stock: "Stock update received!",
        bitcoin: "Crypto prices updated!",
        radar: "Radar refreshed!"
    };
    
    if (messages[dataType]) {
        $('#animal-companion .animal-message').text(messages[dataType]);
        $('#animal-companion .animal-message').css('opacity', 1);
        setTimeout(() => {
            $('#animal-companion .animal-message').css('opacity', 0);
        }, 2000);
        
        // Jump animation
        $('#animal-companion .animal-body').css('transform', 'translateY(-15px)');
        setTimeout(() => {
            $('#animal-companion .animal-body').css('transform', 'translateY(0)');
        }, 300);
      }
  });
}
// Change ZIP and stock symbol
function promptUserSettings() {
    const newZip = prompt("Enter a new ZIP code:", currentZip);
    if (newZip) {
        currentZip = newZip;
        localStorage.setItem('weatherZip', newZip);
    }

    const newStock = prompt("Enter a new stock symbol:", currentStockSymbol);
    if (newStock) {
        currentStockSymbol = newStock.toUpperCase();
        localStorage.setItem('stockSymbol', currentStockSymbol);
    }

        const newFormat = prompt("Enter time format (12 or 24):", hourFormat);
    if (newFormat === '12' || newFormat === '24') {
        hourFormat = newFormat;
        localStorage.setItem('hourFormat', hourFormat);
    }

    // Optionally refresh your data
    fetchWeather();  // assuming you have this function
    fetchStock();    // and this one too
}

// Hook it up
$('#settings-button').click(promptUserSettings);

// Start the application
$(document).ready(initializeApp);