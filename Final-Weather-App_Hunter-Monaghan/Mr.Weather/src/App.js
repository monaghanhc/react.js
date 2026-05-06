// Weather App — Mr. Weather
// Author: Hunter Monaghan

import React, { useState, useEffect, useRef, useCallback } from 'react';

const api = {
  key: process.env.REACT_APP_WEATHER_API_KEY,
  base: 'https://api.openweathermap.org/data/2.5/',
};

const GEO_BASE = 'https://api.openweathermap.org/geo/1.0/direct';

function formatPlace(s) {
  const parts = [s.name];
  if (s.state) parts.push(s.state);
  parts.push(s.country);
  return parts.join(', ');
}

function App() {
  const [query, setQuery] = useState('');
  const [weather, setWeather] = useState({});
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [highlight, setHighlight] = useState(-1);
  const [geoLoading, setGeoLoading] = useState(false);

  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const hasWeather = typeof weather.main !== 'undefined';

  const closeSuggestions = useCallback(() => {
    setSuggestions([]);
    setHighlight(-1);
  }, []);

  const applyWeatherPayload = useCallback((data, res) => {
    if (!res.ok || data.cod === 401 || data.cod === '401') {
      setWeather({});
      setApiError(
        data.message || `Weather API error (${res.status}). Check your OpenWeather API key.`
      );
      return false;
    }
    if (data.cod && String(data.cod) !== '200') {
      setWeather({});
      setApiError(data.message || 'Could not find weather for that search.');
      return false;
    }
    setWeather(data);
    setQuery('');
    return true;
  }, []);

  const fetchWeather = useCallback(
    ({ lat, lon, q }) => {
      if (!api.key) {
        setApiError(
          'Missing API key. Add REACT_APP_WEATHER_API_KEY to .env (local) or GitHub Actions secrets, then rebuild.'
        );
        return;
      }

      setApiError(null);
      setWeather({});
      setLoading(true);
      closeSuggestions();

      const url =
        lat != null && lon != null
          ? `${api.base}weather?lat=${lat}&lon=${lon}&units=metric&APPID=${api.key}`
          : `${api.base}weather?q=${encodeURIComponent(q.trim())}&units=metric&APPID=${api.key}`;

      fetch(url)
        .then(async (res) => {
          const data = await res.json();
          applyWeatherPayload(data, res);
        })
        .catch(() => {
          setApiError('Network error. Check your connection and try again.');
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [applyWeatherPayload, closeSuggestions]
  );

  const pickSuggestion = useCallback(
    (s) => {
      setQuery(formatPlace(s));
      closeSuggestions();
      fetchWeather({ lat: s.lat, lon: s.lon });
    },
    [fetchWeather, closeSuggestions]
  );

  const runSearch = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (highlight >= 0 && suggestions[highlight]) {
      pickSuggestion(suggestions[highlight]);
      return;
    }
    if (!api.key) {
      setApiError(
        'Missing API key. Add REACT_APP_WEATHER_API_KEY to .env (local) or GitHub Actions secrets, then rebuild.'
      );
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) return;
    fetchWeather({ q: trimmed });
  };

  /* Debounced geocoding autocomplete */
  useEffect(() => {
    if (!api.key) {
      setSuggestions([]);
      setGeoLoading(false);
      return;
    }

    const t = query.trim();
    if (t.length < 2) {
      setSuggestions([]);
      setHighlight(-1);
      setGeoLoading(false);
      return;
    }

    let cancelled = false;
    setGeoLoading(true);

    const timer = setTimeout(() => {
      fetch(`${GEO_BASE}?q=${encodeURIComponent(t)}&limit=8&appid=${api.key}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          if (!Array.isArray(data)) {
            setSuggestions([]);
            return;
          }
          setSuggestions(data);
          setHighlight(-1);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setGeoLoading(false);
        });
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  /* Click outside closes suggestions */
  useEffect(() => {
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        closeSuggestions();
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [closeSuggestions]);

  /* Keep highlighted item in view */
  useEffect(() => {
    if (highlight < 0 || !listRef.current) return;
    const node = listRef.current.children[highlight];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight]);

  const onSearchKeyDown = (e) => {
    if (!suggestions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => {
        if (h < 0) return 0;
        return h < suggestions.length - 1 ? h + 1 : h;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h > 0 ? h - 1 : -1));
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
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
    hasWeather && weather.weather && weather.weather[0] ? weather.weather[0].main : '';

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

  const showSuggestList = suggestions.length > 0 && query.trim().length >= 2;

  return (
    <div className={`app${isWarm ? ' warm' : ''}`}>
      <main className="shell">
        <header className="brand">
          <p className="brand-kicker">Current conditions</p>
          <h1 className="brand-title">Mr. Weather</h1>
          <p className="brand-sub">
            Search a city—suggestions appear as you type. Pick one or press Search.
          </p>
        </header>

        <form className="search-form" onSubmit={runSearch} noValidate>
          <label htmlFor="city-search" className="sr-only">
            City or town name
          </label>
          <div className="search-wrap" ref={wrapRef}>
            <div className="search-row">
              <div className="search-input-wrap">
                <input
                  id="city-search"
                  type="search"
                  className="search-input"
                  placeholder="Start typing a city…"
                  autoComplete="off"
                  enterKeyHint="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  disabled={loading}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showSuggestList}
                  aria-controls="city-suggestions"
                  aria-activedescendant={
                    showSuggestList && highlight >= 0 ? `suggest-${highlight}` : undefined
                  }
                />
                {geoLoading && (
                  <span className="geo-hint" aria-hidden>
                    …
                  </span>
                )}
              </div>
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

            {showSuggestList && (
              <ul
                id="city-suggestions"
                ref={listRef}
                className="suggest-list"
                role="listbox"
                aria-label="Matching cities"
              >
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.lat}-${s.lon}-${s.name}-${i}`}
                    role="option"
                    id={`suggest-${i}`}
                    aria-selected={i === highlight}
                  >
                    <button
                      type="button"
                      className={`suggest-item${i === highlight ? ' is-active' : ''}`}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => pickSuggestion(s)}
                    >
                      <span className="suggest-name">{formatPlace(s)}</span>
                      <span className="suggest-meta">
                        {s.lat.toFixed(2)}°, {s.lon.toFixed(2)}°
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
              Type at least two letters to see city suggestions, click one—or enter any city and
              press Search.
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
