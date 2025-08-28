const API_KEY = 'SU3S9RR4MV83U40H';
const BASE_URL = 'https://www.alphavantage.co/query';

// DOM elements
const form = document.getElementById('ticker-form');
const tickerInput = document.getElementById('ticker-input');
const formErrorEl = document.getElementById('form-error');
const startBtn = document.getElementById('start-btn');

const gameSection = document.getElementById('game-section');
const activeTickerEl = document.getElementById('active-ticker');
const currentDateEl = document.getElementById('current-date');
const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedback');

const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const btnEnd = document.getElementById('btn-end');

const chartCanvas = document.getElementById('price-chart');
let chartInstance = null;

// Game state
let gameState = {
  symbol: null,
  datesAsc: [], // ascending dates (YYYY-MM-DD)
  closeByDate: {}, // map date -> close number
  startIndex: null, // index of the chosen start date in datesAsc
  currentIndex: null, // moves forward each guess
  score: 0,
  running: false
};

function setLoading(loading) {
  startBtn.disabled = loading;
  if (loading) {
    startBtn.textContent = 'Loading…';
  } else {
    startBtn.textContent = 'Start Game';
  }
}

function setPredictingDisabled(disabled) {
  btnUp.disabled = disabled;
  btnDown.disabled = disabled;
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA + 'T00:00:00Z');
  const b = new Date(dateB + 'T00:00:00Z');
  const diffMs = Math.abs(b - a);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  return day >= 1 && day <= 5; // Mon..Fri
}

async function fetchTimeSeriesDaily(symbol) {
  const url = `${BASE_URL}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${API_KEY}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Network error fetching data');
  }
  const data = await res.json();

  if (data.Note) {
    throw new Error('Rate limit reached. Please wait a minute and try again.');
  }
  if (data['Error Message']) {
    throw new Error('Invalid ticker symbol. Please try another.');
  }
  const series = data['Time Series (Daily)'];
  if (!series || typeof series !== 'object') {
    throw new Error('Data not available for this ticker.');
  }

  const closeByDate = {};
  const dates = Object.keys(series);
  for (const date of dates) {
    const closeStr = series[date]['4. close'] || series[date]['5. adjusted close'];
    const close = Number(closeStr);
    if (!Number.isFinite(close)) continue;
    closeByDate[date] = close;
  }
  const datesAsc = Object.keys(closeByDate).sort((a, b) => new Date(a) - new Date(b));
  return { datesAsc, closeByDate };
}

function pickRandomStartIndex(datesAsc) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Build eligible indices that satisfy constraints
  const eligible = [];
  for (let i = 0; i < datesAsc.length; i++) {
    const dateStr = datesAsc[i];
    const ageDays = daysBetween(dateStr, todayStr);
    if (ageDays >= 7 && ageDays <= 100 && isWeekday(dateStr)) {
      // Need at least 7 prior trading days and at least 1 next day
      if (i - 7 >= 0 && i + 1 < datesAsc.length) {
        eligible.push(i);
      }
    }
  }
  if (eligible.length === 0) return null;
  const idx = Math.floor(Math.random() * eligible.length);
  return eligible[idx];
}

function initChart(labels, values, startDate) {
  if (chartInstance) {
    chartInstance.destroy();
  }
  chartInstance = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Close Price',
          data: values,
          borderColor: '#4f9cff',
          backgroundColor: 'rgba(79,156,255,0.12)',
          tension: 0.25,
          pointRadius: 3,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            color: '#93a1ad'
          },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: {
            color: '#93a1ad',
            callback: (v) => `$${v}`
          },
          grid: { color: 'rgba(255,255,255,0.06)' }
        }
      },
      plugins: {
        legend: { labels: { color: '#93a1ad' } },
        tooltip: {
          callbacks: {
            label: (ctx) => `Close: $${Number(ctx.parsed.y).toFixed(2)}`
          }
        },
        annotation: {}
      }
    }
  });
}

function updateChartWithNewPoint(dateLabel, closeValue) {
  if (!chartInstance) return;
  chartInstance.data.labels.push(dateLabel);
  chartInstance.data.datasets[0].data.push(closeValue);
  chartInstance.update();
}

function resetGameUI() {
  formErrorEl.textContent = '';
  feedbackEl.textContent = '';
  scoreEl.textContent = '0';
  currentDateEl.textContent = '';
  setPredictingDisabled(false);
}

async function startGame(symbolRaw) {
  const symbol = symbolRaw.trim().toUpperCase();
  if (!symbol) {
    formErrorEl.textContent = 'Please enter a ticker symbol.';
    return;
  }
  setLoading(true);
  resetGameUI();
  try {
    const { datesAsc, closeByDate } = await fetchTimeSeriesDaily(symbol);

    const startIndex = pickRandomStartIndex(datesAsc);
    if (startIndex === null) {
      throw new Error('Not enough recent data to start a game (7-100 days window).');
    }

    gameState.symbol = symbol;
    gameState.datesAsc = datesAsc;
    gameState.closeByDate = closeByDate;
    gameState.startIndex = startIndex;
    gameState.currentIndex = startIndex; // Start at chosen date
    gameState.score = 0;
    gameState.running = true;

    activeTickerEl.textContent = symbol;
    const startDate = datesAsc[startIndex];
    currentDateEl.textContent = startDate;
    scoreEl.textContent = '0';

    // Prepare initial chart data: 7 days before + start date
    const startOfWindow = startIndex - 7;
    const initialLabels = [];
    const initialValues = [];
    for (let i = startOfWindow; i <= startIndex; i++) {
      const d = datesAsc[i];
      initialLabels.push(d);
      initialValues.push(closeByDate[d]);
    }
    initChart(initialLabels, initialValues, startDate);

    // Reveal game section
    gameSection.classList.remove('hidden');
    feedbackEl.textContent = 'Predict whether the next day closes higher or lower.';
  } catch (err) {
    formErrorEl.textContent = err.message || 'Failed to start game.';
  } finally {
    setLoading(false);
  }
}

function handlePrediction(direction) {
  if (!gameState.running) return;
  setPredictingDisabled(true);
  try {
    const i = gameState.currentIndex;
    const nextIndex = i + 1;
    if (nextIndex >= gameState.datesAsc.length) {
      feedbackEl.textContent = 'No more data available. You reached the most recent day.';
      setPredictingDisabled(true);
      gameState.running = false;
      return;
    }

    const dateToday = gameState.datesAsc[i];
    const dateNext = gameState.datesAsc[nextIndex];
    const priceToday = gameState.closeByDate[dateToday];
    const priceNext = gameState.closeByDate[dateNext];

    const wentUp = priceNext > priceToday;
    const userGuessedUp = direction === 'up';
    const correct = wentUp === userGuessedUp;
    if (correct) {
      gameState.score += 1;
      feedbackEl.textContent = `Correct! ${dateNext} close: $${priceNext.toFixed(2)} (${wentUp ? 'up' : 'down'})`;
    } else {
      feedbackEl.textContent = `Wrong. ${dateNext} close: $${priceNext.toFixed(2)} (${wentUp ? 'up' : 'down'})`;
    }
    scoreEl.textContent = String(gameState.score);

    // Reveal next day's point on chart and advance current date
    updateChartWithNewPoint(dateNext, priceNext);
    gameState.currentIndex = nextIndex;
    currentDateEl.textContent = dateNext;

    // If this was the last available data point, end game automatically
    if (gameState.currentIndex + 1 >= gameState.datesAsc.length) {
      feedbackEl.textContent += ' — No further data. Game over!';
      setPredictingDisabled(true);
      gameState.running = false;
    } else {
      setPredictingDisabled(false);
    }
  } catch (e) {
    feedbackEl.textContent = 'An error occurred. Please try again.';
    setPredictingDisabled(false);
  }
}

function endGame() {
  gameState.running = false;
  setPredictingDisabled(true);
  feedbackEl.textContent = 'Game ended. Start a new one with another ticker!';
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  startGame(tickerInput.value);
});

btnUp.addEventListener('click', () => handlePrediction('up'));
btnDown.addEventListener('click', () => handlePrediction('down'));
btnEnd.addEventListener('click', endGame);

