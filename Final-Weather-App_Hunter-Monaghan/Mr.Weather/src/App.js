// Weather App — Mr. Weather
// Author: Hunter Monaghan

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const api = {
  key: process.env.REACT_APP_WEATHER_API_KEY,
  base: 'https://api.openweathermap.org/data/2.5/',
};

const GEO_BASE = 'https://api.openweathermap.org/geo/1.0/direct';
const FAV_KEY = 'mr-weather-favorites-v1';
const TEMP_UNIT_KEY = 'mr-weather-temp-unit-v1';

function formatPlace(s) {
  const parts = [s.name];
  if (s.state) parts.push(s.state);
  parts.push(s.country);
  return parts.join(', ');
}

function favId(lat, lon) {
  return `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

function formatTemp(tempC, unit) {
  if (typeof tempC !== 'number' || Number.isNaN(tempC)) return null;
  return unit === 'f' ? Math.round((tempC * 9) / 5 + 32) : Math.round(tempC);
}

function tempUnitLabel(unit) {
  return unit === 'f' ? '°F' : '°C';
}

function seededUnit(index, seed) {
  const x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function makeFxItems(count, seed) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const left = seededUnit(n, seed);
    const top = seededUnit(n, seed + 1);
    const delay = seededUnit(n, seed + 2);
    const duration = seededUnit(n, seed + 3);
    const size = seededUnit(n, seed + 4);

    return {
      left: `${(left * 100).toFixed(2)}%`,
      top: `${(top * 100).toFixed(2)}%`,
      delay: `${(-delay * 8).toFixed(2)}s`,
      duration: `${(0.7 + duration * 2.8).toFixed(2)}s`,
      size: `${(4 + size * 12).toFixed(1)}px`,
      opacity: (0.42 + top * 0.5).toFixed(2),
    };
  });
}

function degToCompass(deg) {
  if (deg == null || Number.isNaN(deg)) return '—';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

function moodLine(main, tempC) {
  const m = (main || '').toLowerCase();
  if (m.includes('clear')) return tempC > 24 ? 'Bright and warm — perfect sky.' : 'Crystal clear skies overhead.';
  if (m.includes('cloud')) return 'Soft light through the clouds.';
  if (m.includes('rain') || m.includes('drizzle')) return 'Rain in the air — stay cozy.';
  if (m.includes('snow')) return 'Winter wonderland energy.';
  if (m.includes('thunder')) return 'Electric skies — dramatic weather.';
  if (m.includes('mist') || m.includes('fog')) return 'Soft mist — visibility may vary.';
  if (m.includes('wind')) return 'The wind has something to say.';
  return 'Live conditions from OpenWeather.';
}

function formatCityClock(timezoneSec) {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + timezoneSec * 1000);
}

function formatSunUnix(utcUnixSec, timezoneSec) {
  return new Date((utcUnixSec + timezoneSec) * 1000);
}

export default function App() {
  const [query, setQuery] = useState('');
  const [weather, setWeather] = useState({});
  const [forecast, setForecast] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [highlight, setHighlight] = useState(-1);
  const [geoLoading, setGeoLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [cityClock, setCityClock] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [thunderActive, setThunderActive] = useState(false);
  const [stormFlash, setStormFlash] = useState(0);
  const [tempUnit, setTempUnit] = useState(() => {
    try {
      return localStorage.getItem(TEMP_UNIT_KEY) === 'f' ? 'f' : 'c';
    } catch (_) {
      return 'c';
    }
  });

  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const audioCtxRef = useRef(null);
  const soundEnabledRef = useRef(soundEnabled);
  const thunderTimerRef = useRef(null);
  const thunderResetRef = useRef(null);

  const hasWeather = typeof weather.main !== 'undefined';
  const rainDrops = useMemo(() => makeFxItems(64, 4), []);
  const screenDrops = useMemo(() => makeFxItems(18, 12), []);
  const snowFlakes = useMemo(() => makeFxItems(58, 20), []);
  const snowSplats = useMemo(() => makeFxItems(15, 28), []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch (_) {
      /* ignore */
    }
  }, []);

  const saveFavorites = useCallback((next) => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch (_) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TEMP_UNIT_KEY, tempUnit);
    } catch (_) {
      /* ignore */
    }
  }, [tempUnit]);

  const primeAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtor();
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  const playThunder = useCallback(() => {
    if (!soundEnabledRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== 'running') return;

    const duration = 1.65;
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    let rolling = 0;

    for (let i = 0; i < frameCount; i += 1) {
      const fade = 1 - i / frameCount;
      rolling = rolling * 0.82 + (Math.random() * 2 - 1) * 0.18;
      data[i] = rolling * Math.pow(fade, 2.35);
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(90, now);
    filter.frequency.exponentialRampToValueAtTime(260, now + 0.22);
    filter.frequency.exponentialRampToValueAtTime(65, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.34, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + duration);
  }, []);

  const triggerThunder = useCallback(() => {
    setStormFlash((tick) => tick + 1);
    setThunderActive(true);

    if (typeof window !== 'undefined') {
      if (thunderResetRef.current) {
        window.clearTimeout(thunderResetRef.current);
      }
      thunderResetRef.current = window.setTimeout(() => setThunderActive(false), 850);

      if (window.navigator && typeof window.navigator.vibrate === 'function') {
        window.navigator.vibrate([70, 35, 160]);
      }
    }

    playThunder();
  }, [playThunder]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  /* Live clock for selected city */
  useEffect(() => {
    if (!hasWeather || typeof weather.timezone !== 'number') {
      setCityClock(null);
      return;
    }
    const tick = () => setCityClock(formatCityClock(weather.timezone));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hasWeather, weather.timezone]);

  const closeSuggestions = useCallback(() => {
    setSuggestions([]);
    setHighlight(-1);
  }, []);

  const applyWeatherPayload = useCallback((data, res) => {
    if (!res.ok || data.cod === 401 || data.cod === '401') {
      setWeather({});
      setForecast(null);
      setApiError(
        data.message || `Weather API error (${res.status}). Check your OpenWeather API key.`
      );
      return false;
    }
    if (data.cod && String(data.cod) !== '200') {
      setWeather({});
      setForecast(null);
      setApiError(data.message || 'Could not find weather for that search.');
      return false;
    }
    setWeather(data);
    setQuery('');
    return true;
  }, []);

  const fetchForecast = useCallback((lat, lon) => {
    setForecastLoading(true);
    setForecast(null);
    fetch(
      `${api.base}forecast?lat=${lat}&lon=${lon}&units=metric&cnt=24&APPID=${api.key}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.cod === '200' || data.list) setForecast(data);
        else setForecast(null);
      })
      .catch(() => setForecast(null))
      .finally(() => setForecastLoading(false));
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
      setForecast(null);
      setLoading(true);
      closeSuggestions();

      const url =
        lat != null && lon != null
          ? `${api.base}weather?lat=${lat}&lon=${lon}&units=metric&APPID=${api.key}`
          : `${api.base}weather?q=${encodeURIComponent(q.trim())}&units=metric&APPID=${api.key}`;

      fetch(url)
        .then(async (res) => {
          const data = await res.json();
          const ok = applyWeatherPayload(data, res);
          if (ok && data.coord) {
            fetchForecast(data.coord.lat, data.coord.lon);
          }
        })
        .catch(() => {
          setApiError('Network error. Check your connection and try again.');
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [applyWeatherPayload, closeSuggestions, fetchForecast]
  );

  const refreshWeather = useCallback(() => {
    primeAudio();
    if (!hasWeather || !weather.coord) return;
    fetchWeather({ lat: weather.coord.lat, lon: weather.coord.lon });
  }, [hasWeather, weather.coord, fetchWeather, primeAudio]);

  const pickSuggestion = useCallback(
    (s) => {
      primeAudio();
      setQuery(formatPlace(s));
      closeSuggestions();
      fetchWeather({ lat: s.lat, lon: s.lon });
    },
    [fetchWeather, closeSuggestions, primeAudio]
  );

  const runSearch = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    primeAudio();
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

  const toggleFavorite = useCallback(() => {
    if (!hasWeather || !weather.coord) return;
    const lat = weather.coord.lat;
    const lon = weather.coord.lon;
    const id = favId(lat, lon);
    const entry = {
      id,
      name: weather.name,
      country: weather.sys && weather.sys.country,
      lat,
      lon,
    };
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === id);
      const next = exists ? prev.filter((f) => f.id !== id) : [...prev, entry];
      saveFavorites(next);
      return next;
    });
  }, [hasWeather, weather, saveFavorites]);

  const removeFavorite = useCallback(
    (id) => {
      setFavorites((prev) => {
        const next = prev.filter((f) => f.id !== id);
        saveFavorites(next);
        return next;
      });
    },
    [saveFavorites]
  );

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

  useEffect(() => {
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        closeSuggestions();
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [closeSuggestions]);

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

  const conditionMain =
    hasWeather && weather.weather && weather.weather[0] ? weather.weather[0].main : '';

  const conditionDesc =
    hasWeather && weather.weather && weather.weather[0]
      ? weather.weather[0].description.replace(/\b\w/g, (c) => c.toUpperCase())
      : '';

  const feelsLike =
    hasWeather && weather.main && typeof weather.main.feels_like === 'number'
      ? formatTemp(weather.main.feels_like, tempUnit)
      : null;

  const currentTemp =
    hasWeather && weather.main && typeof weather.main.temp === 'number'
      ? formatTemp(weather.main.temp, tempUnit)
      : null;

  const activeTempUnitLabel = tempUnitLabel(tempUnit);

  const humidity =
    hasWeather && weather.main && typeof weather.main.humidity === 'number'
      ? weather.main.humidity
      : null;

  const windMs =
    hasWeather && weather.wind && typeof weather.wind.speed === 'number'
      ? weather.wind.speed
      : null;

  const windDeg = hasWeather && weather.wind ? weather.wind.deg : null;

  const pressure =
    hasWeather && weather.main && typeof weather.main.pressure === 'number'
      ? weather.main.pressure
      : null;

  const visibilityM =
    hasWeather && typeof weather.visibility === 'number' ? weather.visibility : null;

  const cloudsPct =
    hasWeather && weather.clouds && typeof weather.clouds.all === 'number'
      ? weather.clouds.all
      : null;

  const isWarm = hasWeather && weather.main.temp > 16;

  const conditionSlug = useMemo(() => {
    const m = (conditionMain || 'default').toLowerCase().replace(/\s+/g, '-');
    if (m.includes('clear')) return 'clear';
    if (m.includes('cloud')) return 'clouds';
    if (m.includes('rain') || m.includes('drizzle')) return 'rain';
    if (m.includes('snow')) return 'snow';
    if (m.includes('thunder')) return 'storm';
    if (m.includes('mist') || m.includes('fog')) return 'mist';
    return 'default';
  }, [conditionMain]);

  const isStorm = conditionSlug === 'storm';
  const isRainy = conditionSlug === 'rain' || isStorm;
  const isSnowy = conditionSlug === 'snow';
  const hasScreenWeather = isRainy || isSnowy || isStorm;

  useEffect(() => {
    if (!hasWeather || !isStorm) return;

    let cancelled = false;
    const scheduleThunder = (delay) => {
      thunderTimerRef.current = window.setTimeout(() => {
        if (cancelled) return;
        triggerThunder();
        scheduleThunder(4200 + Math.random() * 5200);
      }, delay);
    };

    scheduleThunder(850);

    return () => {
      cancelled = true;
      if (thunderTimerRef.current) {
        window.clearTimeout(thunderTimerRef.current);
      }
      if (thunderResetRef.current) {
        window.clearTimeout(thunderResetRef.current);
      }
      if (window.navigator && typeof window.navigator.vibrate === 'function') {
        window.navigator.vibrate(0);
      }
    };
  }, [hasWeather, isStorm, triggerThunder]);

  useEffect(() => {
    if (!isStorm && thunderActive) {
      setThunderActive(false);
    }
  }, [isStorm, thunderActive]);

  const showSuggestList = suggestions.length > 0 && query.trim().length >= 2;

  const isFav =
    hasWeather &&
    weather.coord &&
    favorites.some((f) => f.id === favId(weather.coord.lat, weather.coord.lon));

  const sunrise =
    hasWeather && weather.sys && weather.sys.sunrise && typeof weather.timezone === 'number'
      ? formatSunUnix(weather.sys.sunrise, weather.timezone)
      : null;

  const sunset =
    hasWeather && weather.sys && weather.sys.sunset && typeof weather.timezone === 'number'
      ? formatSunUnix(weather.sys.sunset, weather.timezone)
      : null;

  const forecastSlots = useMemo(() => {
    if (!forecast || !forecast.list || !forecast.list.length) return [];
    return forecast.list.slice(0, 8);
  }, [forecast]);

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }),
    []
  );

  const sunFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    []
  );

  const forecastTimeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }),
    []
  );

  return (
    <div
      className={`app${isWarm ? ' warm' : ''} theme-${conditionSlug}${
        thunderActive ? ' is-thundering' : ''
      }`}
      data-condition={conditionSlug}
      onMouseDown={primeAudio}
      onTouchStart={primeAudio}
    >
      <div className="app-atmosphere" aria-hidden />

      {hasWeather && (
        <div className={`weather-effects fx-${conditionSlug}`} aria-hidden="true">
          {conditionSlug === 'clear' && (
            <div className="sun-stage">
              <span className="sun-core" />
              <span className="sun-halo sun-halo-one" />
              <span className="sun-halo sun-halo-two" />
              <span className="sun-ray sun-ray-one" />
              <span className="sun-ray sun-ray-two" />
              <span className="sun-ray sun-ray-three" />
            </div>
          )}

          {(conditionSlug === 'clouds' || conditionSlug === 'mist') && (
            <div className="cloud-bank">
              <span className="cloud-wisp cloud-wisp-one" />
              <span className="cloud-wisp cloud-wisp-two" />
              <span className="cloud-wisp cloud-wisp-three" />
            </div>
          )}

          {isRainy && (
            <div className="rain-field">
              {rainDrops.map((drop, i) => (
                <span
                  key={`rain-${i}`}
                  className="rain-streak"
                  style={{
                    left: drop.left,
                    animationDelay: drop.delay,
                    animationDuration: drop.duration,
                    opacity: drop.opacity,
                  }}
                />
              ))}
            </div>
          )}

          {isSnowy && (
            <div className="snow-field">
              {snowFlakes.map((flake, i) => (
                <span
                  key={`snow-${i}`}
                  className="snow-flake"
                  style={{
                    left: flake.left,
                    width: flake.size,
                    height: flake.size,
                    animationDelay: flake.delay,
                    animationDuration: flake.duration,
                    opacity: flake.opacity,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {hasWeather && hasScreenWeather && (
        <div className={`screen-weather screen-${conditionSlug}`} aria-hidden="true">
          {isRainy &&
            screenDrops.map((drop, i) => (
              <span
                key={`screen-drop-${i}`}
                className="screen-drop"
                style={{
                  left: drop.left,
                  top: drop.top,
                  width: drop.size,
                  height: drop.size,
                  animationDelay: drop.delay,
                  animationDuration: drop.duration,
                  opacity: drop.opacity,
                }}
              />
            ))}

          {isSnowy && (
            <>
              <span className="frost-edge frost-edge-left" />
              <span className="frost-edge frost-edge-right" />
              {snowSplats.map((splat, i) => (
                <span
                  key={`snow-splat-${i}`}
                  className="snow-splat"
                  style={{
                    left: splat.left,
                    top: splat.top,
                    animationDelay: splat.delay,
                  }}
                />
              ))}
            </>
          )}

          {isStorm && <span key={stormFlash} className="lightning-flash" />}
        </div>
      )}

      <main className="shell">
        <header className="brand">
          <p className="brand-kicker">Immersive forecast</p>
          <h1 className="brand-title">Mr. Weather</h1>
          <p className="brand-sub">
            Search with live suggestions, explore details, scroll the 24h outlook, and save favorite
            cities.
          </p>
        </header>

        {favorites.length > 0 && (
          <section className="favorites-bar" aria-label="Saved places">
            <span className="favorites-label">Saved</span>
            <div className="favorites-chips">
              {favorites.map((f) => (
                <div key={f.id} className="fav-chip-wrap">
                  <button
                    type="button"
                    className="fav-chip"
                    onClick={() => {
                      primeAudio();
                      fetchWeather({ lat: f.lat, lon: f.lon });
                    }}
                  >
                    {f.name}
                    <span className="fav-chip-cc">{f.country}</span>
                  </button>
                  <button
                    type="button"
                    className="fav-remove"
                    onClick={() => removeFavorite(f.id)}
                    aria-label={`Remove ${f.name} from saved`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

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
              Type at least two letters for suggestions, or press Search. Save places you love and
              watch the 24-hour outlook scroll by.
            </p>
          </section>
        )}

        {!loading && hasWeather && (
          <>
            <article className="weather-card fade-in">
              <div className="weather-card-toolbar">
                <div className="unit-toggle" role="group" aria-label="Temperature unit">
                  <button
                    type="button"
                    className={`unit-btn${tempUnit === 'c' ? ' is-active' : ''}`}
                    onClick={() => setTempUnit('c')}
                    aria-pressed={tempUnit === 'c'}
                  >
                    °C
                  </button>
                  <button
                    type="button"
                    className={`unit-btn${tempUnit === 'f' ? ' is-active' : ''}`}
                    onClick={() => setTempUnit('f')}
                    aria-pressed={tempUnit === 'f'}
                  >
                    °F
                  </button>
                </div>
                <button type="button" className="toolbar-btn" onClick={refreshWeather}>
                  ⟳ Refresh
                </button>
                {isStorm && (
                  <button
                    type="button"
                    className={`toolbar-btn sound${soundEnabled ? ' is-on' : ''}`}
                    onClick={() => {
                      primeAudio();
                      setSoundEnabled((enabled) => !enabled);
                    }}
                    aria-pressed={soundEnabled}
                  >
                    {soundEnabled ? 'Thunder sound on' : 'Thunder sound off'}
                  </button>
                )}
                <button
                  type="button"
                  className={`toolbar-btn heart${isFav ? ' is-on' : ''}`}
                  onClick={toggleFavorite}
                  aria-pressed={isFav}
                >
                  {isFav ? '★ Saved' : '☆ Save place'}
                </button>
              </div>

              <div className="weather-card-head">
                <div className="weather-meta">
                  <h2 className="place">
                    {weather.name}
                    <span className="country">{weather.sys && weather.sys.country}</span>
                  </h2>
                  <p className="date-line">{dateBuilder(new Date())}</p>
                  {cityClock && (
                    <p className="local-clock">
                      <span className="local-clock-label">There now</span>
                      {timeFmt.format(cityClock)}
                    </p>
                  )}
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

              <p className="mood-line">{moodLine(conditionMain, weather.main.temp)}</p>

              <div className="temp-row">
                <span className="temp-value">{currentTemp}</span>
                <span className="temp-unit temp-unit-live">{activeTempUnitLabel}</span>
              </div>
              <p className="condition">{conditionMain}</p>
              {conditionDesc && <p className="condition-desc">{conditionDesc}</p>}

              {(sunrise || sunset) && (
                <div className="sun-row">
                  {sunrise && (
                    <div className="sun-pill">
                      <span className="sun-emoji" aria-hidden>
                        ☀
                      </span>
                      <span className="sun-label">Sunrise</span>
                      <span className="sun-time">{sunFmt.format(sunrise)}</span>
                    </div>
                  )}
                  {sunset && (
                    <div className="sun-pill">
                      <span className="sun-emoji" aria-hidden>
                        ☽
                      </span>
                      <span className="sun-label">Sunset</span>
                      <span className="sun-time">{sunFmt.format(sunset)}</span>
                    </div>
                  )}
                </div>
              )}

              <ul className="stats stats-wide">
                {feelsLike !== null && (
                  <li className="stat">
                    <span className="stat-label">Feels like</span>
                    <span className="stat-value">
                      {feelsLike}
                      {activeTempUnitLabel}
                    </span>
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
                    <span className="stat-value">
                      {windMs.toFixed(1)} m/s
                      {windDeg != null && (
                        <span className="wind-compass"> {degToCompass(windDeg)}</span>
                      )}
                    </span>
                  </li>
                )}
                {pressure !== null && (
                  <li className="stat">
                    <span className="stat-label">Pressure</span>
                    <span className="stat-value">{pressure} hPa</span>
                  </li>
                )}
                {visibilityM !== null && (
                  <li className="stat">
                    <span className="stat-label">Visibility</span>
                    <span className="stat-value">
                      {visibilityM >= 1000
                        ? `${(visibilityM / 1000).toFixed(1)} km`
                        : `${visibilityM} m`}
                    </span>
                  </li>
                )}
                {cloudsPct !== null && (
                  <li className="stat">
                    <span className="stat-label">Clouds</span>
                    <span className="stat-value">{cloudsPct}%</span>
                  </li>
                )}
              </ul>
            </article>

            <section className="forecast-section fade-in" aria-label="24 hour outlook">
              <div className="forecast-head">
                <h3 className="forecast-title">Next 24 hours</h3>
                <span className="forecast-sub">3-hour steps · scroll sideways</span>
              </div>
              {forecastLoading && (
                <div className="forecast-skeleton" aria-live="polite">
                  <div className="fc-sk-inner" />
                </div>
              )}
              {!forecastLoading && forecastSlots.length > 0 && (
                <div className="forecast-scroll">
                  {forecastSlots.map((slot) => {
                    const ic =
                      slot.weather && slot.weather[0]
                        ? `https://openweathermap.org/img/wn/${slot.weather[0].icon}@2x.png`
                        : null;
                    const t = slot.dt * 1000;
                    return (
                      <div key={slot.dt} className="forecast-slot">
                        <time className="fc-time" dateTime={new Date(t).toISOString()}>
                          {forecastTimeFmt.format(new Date(t))}
                        </time>
                        {ic && <img className="fc-icon" src={ic} alt="" width={48} height={48} />}
                        <span className="fc-temp fc-temp-live">
                          {formatTemp(slot.main.temp, tempUnit)}
                          {activeTempUnitLabel}
                        </span>
                        <span className="fc-main">
                          {slot.weather && slot.weather[0] ? slot.weather[0].main : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {!forecastLoading && (!forecast || !forecastSlots.length) && (
                <p className="forecast-unavailable">Forecast unavailable — try refresh.</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
