// Weather App using react.js and node.js
// Author: Hunter Monaghan    

// input: City or Country 
// output: temperature and forecast

//     Filename: App.js

'strict'

import React, { useState } from 'react';
const api = {
  key: process.env.REACT_APP_WEATHER_API_KEY,
  base: "https://api.openweathermap.org/data/2.5/"
}

function App() {

const [query, setQuery] = useState('')
const [weather, setWeather] = useState({});
const [apiError, setApiError] = useState(null);

const search = evt => {
  if (evt.key !== "Enter") return;
  setApiError(null);
  if (!api.key) {
    setApiError("Missing REACT_APP_WEATHER_API_KEY. Add it to .env locally or GitHub Actions secrets, then rebuild.");
    return;
  }
  const q = encodeURIComponent(query.trim());
  if (!q) return;
  fetch(`${api.base}weather?q=${q}&units=metric&APPID=${api.key}`)
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok || data.cod === 401 || data.cod === "401") {
        setWeather({});
        setApiError(data.message || `Weather API error (${res.status}). Check your API key on OpenWeather.`);
        return;
      }
      if (data.cod && String(data.cod) !== "200") {
        setWeather({});
        setApiError(data.message || "Could not load weather for that search.");
        return;
      }
      setWeather(data);
      setQuery('');
    })
    .catch(() => {
      setApiError("Network error. Try again.");
    });
}



const dateBuilder = (d) => {
  let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
   "October","November", "December"];
   let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
   "Friday", "Saturday"];

   let day = days[d.getDay()];
   let date = d.getDate();
   let month = months[d.getMonth()];
   let year = d.getFullYear();

   return `${day} ${date} ${month} ${year}`
}



  return (
    <div className={(typeof weather.main != "undefined") ? ((weather.main.temp > 16) ? 'app warm' : 'app') : 'app' }>
      <main>
    
        <div className="search-box">
          
          <input 
            type="text"
            className="search-bar"
            placeholder="search..."
            onChange={e => setQuery(e.target.value)}
            value={query}
            onKeyDown={search}
            /> 
        </div>
        {apiError && (
          <div className="api-error" role="alert">{apiError}</div>
        )}

        {/* <h1 id="header">
        The Daily Forcast
      </h1> */}
      {(typeof weather.main != "undefined") ? (
  <div>
      <div className="location-box">
      <div className="location">{weather.name}, {weather.sys.country}</div>
      <div className="date">{dateBuilder(new Date())}</div>
    </div>
      <div className="weather-box">
      <div className="temp">
       {Math.round(weather.main.temp)}°C
     </div>
      <div className="weather">{weather.weather[0].main}</div>
    </div>
  </div>
         ) : ('')}
      </main>
    </div>
  
  );
}


export default App;
