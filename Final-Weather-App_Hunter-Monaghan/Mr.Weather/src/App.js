// Weather App — Mr. Weather
// Author: Hunter Monaghan

import React, { useState } from 'react';

const api = {
  key: process.env.REACT_APP_WEATHER_API_KEY,
  base: 'https://api.openweathermap.org/data/2.5/',
};

function App() {
  const [query, setQuery] = useState('');
  const [weather, setWeather] = useState({});
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);

  const hasWeather = typeof weather.main !== 'undefined';

  const runSearch = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setApiError(null);

    if (!api.key) {
      setApiError(
        'Missing API key. Add REACT_APP_WEATHER_API_KEY to .env (local) or GitHub Actions secrets, then rebuild.'
      );
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) return;

    const q = encodeURIComponent(trimmed);
    setWeather({});
    setLoading(true);

    fetch(`${api.base}weather?q=${q}&units=metric&APPID=${api.key}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.cod === 401 || data.cod === '401') {
          setWeather({});
          setApiError(
            data.message ||
              `Weather API error (${res.status}). Check your OpenWeather API key.`
          );
          return;
        }
        if (data.cod && String(data.cod) !== '200') {
          setWeather({});
          setApiError(data.message || 'Could not find weather for that search.');
          return;
        }
        setWeather(data);
        setQuery('');
      })
      .catch(() => {
        setApiError('Network error. Check your connection and try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const dateBuilder = (d) => {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const iconUrl =
    hasWeather && weather.weather && weather.weather[0]
      ? `https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`
      : null;

  const conditionLabel =
    hasWeather && weather.weather && weather.weather[0]
      ? weather.weather[0].main
      : '';

  const feelsLike =
    hasWeather && weather.main && typeof weather.main.feels_like === 'number'
      ? Math.round(weather.main.feels_like)
      : null;

  const humidity =
    hasWeather && weather.main && typeof weather.main.humidity === 'number'
      ? weather.main.humidity
      : null;

  const windMs =
    hasWeather && weather.wind && typeof weather.wind.speed === 'number'
      ? weather.wind.speed
      : null;

  const isWarm = hasWeather && weather.main.temp > 16;

  return (
    <div className={`app${isWarm ? ' warm' : ''}`}>
      <main className="shell">
        <header className="brand">
          <p className="brand-kicker">Current conditions</p>
          <h1 className="brand-title">Mr. Weather</h1>
          <p className="brand-sub">Search a city to see live temperature and details.</p>
        </header>

        <form className="search-form" onSubmit={runSearch} noValidate>
          <label htmlFor="city-search" className="sr-only">
            City or town name
          </label>
          <div className="search-row">
            <input
              id="city-search"
              type="search"
              className="search-input"
              placeholder="Try London, Tokyo, or Austin…"
              autoComplete="off"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="search-btn"
              disabled={loading || !query.trim()}
              aria-busy={loading}
            >
              {loading ? (
                <span className="btn-inner">
                  <span className="spinner" aria-hidden />
                  Searching
                </span>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </form>

        {apiError && (
          <div className="notice notice-error" role="alert">
            <span className="notice-icon" aria-hidden>
              !
            </span>
            <p>{apiError}</p>
          </div>
        )}

        {loading && !apiError && (
          <div className="skeleton-card" aria-live="polite">
            <div className="skeleton-line lg" />
            <div className="skeleton-line sm" />
            <div className="skeleton-block" />
          </div>
        )}

        {!loading && !hasWeather && !apiError && (
          <section className="empty-panel" aria-label="Getting started">
            <div className="empty-icon" aria-hidden>
              ☼
            </div>
            <h2 className="empty-title">Your forecast starts here</h2>
            <p className="empty-copy">
              Enter a city above. We’ll show temperature, how it feels, humidity, and wind—plus a
              condition icon from OpenWeather.
            </p>
          </section>
        )}

        {!loading && hasWeather && (
          <article className="weather-card">
            <div className="weather-card-head">
              <div className="weather-meta">
                <h2 className="place">
                  {weather.name}
                  <span className="country">{weather.sys && weather.sys.country}</span>
                </h2>
                <p className="date-line">{dateBuilder(new Date())}</p>
              </div>
              {iconUrl && (
                <img
                  className="weather-icon"
                  src={iconUrl}
                  alt=""
                  width={120}
                  height={120}
                />
              )}
            </div>

            <div className="temp-row">
              <span className="temp-value">{Math.round(weather.main.temp)}</span>
              <span className="temp-unit">°C</span>
            </div>
            <p className="condition">{conditionLabel}</p>

            <ul className="stats">
              {feelsLike !== null && (
                <li className="stat">
                  <span className="stat-label">Feels like</span>
                  <span className="stat-value">{feelsLike}°</span>
                </li>
              )}
              {humidity !== null && (
                <li className="stat">
                  <span className="stat-label">Humidity</span>
                  <span className="stat-value">{humidity}%</span>
                </li>
              )}
              {windMs !== null && (
                <li className="stat">
                  <span className="stat-label">Wind</span>
                  <span className="stat-value">{windMs.toFixed(1)} m/s</span>
                </li>
              )}
            </ul>
          </article>
        )}
      </main>
    </div>
  );
}

export default App;
