/* Welcome screen for the bedroom TV. ES5 only, so it runs in older TV browsers. */
(function () {
  "use strict";

  var CITY = { name: "Johannesburg", lat: -26.2041, lon: 28.0473, tz: "Africa/Johannesburg" };
  // South Africa has no daylight saving, so a fixed UTC+2 offset keeps the
  // clock right even if the TV browser does not know about time zones.
  var UTC_OFFSET_HOURS = 2;
  var WEATHER_REFRESH_MS = 30 * 60 * 1000;
  var WEATHER_STALE_MS = 3 * 60 * 60 * 1000;
  var BG_ROTATE_MS = 20 * 60 * 1000;

  var BACKGROUNDS = [
    { file: "bg/highveld-dusk.svg", name: "Highveld Dusk" },
    { file: "bg/blue-hour.svg", name: "Blue Hour" },
    { file: "bg/coast-morning.svg", name: "Coast Morning" },
    { file: "bg/golden-dunes.svg", name: "Golden Dunes" }
  ];

  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function $(id) { return document.getElementById(id); }

  var store = {
    get: function (k) { try { return JSON.parse(window.localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  var reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---------- Clock ----------
  function localNow() {
    var d = new Date(new Date().getTime() + UTC_OFFSET_HOURS * 3600 * 1000);
    return { h: d.getUTCHours(), m: d.getUTCMinutes(), day: d.getUTCDay(), date: d.getUTCDate(), month: d.getUTCMonth() };
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function hhmm(h, m) { var h12 = h % 12 === 0 ? 12 : h % 12; return h12 + ":" + pad(m); }

  function tickClock() {
    var t = localNow();
    $("time").innerHTML = hhmm(t.h, t.m);
    $("ampm").innerHTML = t.h < 12 ? "AM" : "PM";
    $("date").innerHTML = DAYS[t.day] + ", " + t.date + " " + MONTHS[t.month];
    $("greeting").innerHTML = t.h < 5 ? "Good night" : t.h < 12 ? "Good morning" : t.h < 17 ? "Good afternoon" : "Good evening";
  }

  function playWelcome() {
    var hero = $("hero");
    if (reducedMotion) return;
    hero.className = "hero";
    void hero.offsetWidth; // restart the animation
    hero.className = "hero enter";
  }

  // ---------- Backgrounds ----------
  var bgIndex = store.get("bgIndex");
  if (typeof bgIndex !== "number" || bgIndex < 0 || bgIndex >= BACKGROUNDS.length) bgIndex = 0;
  var bgFront = $("bgA"), bgBack = $("bgB");

  function showBackground(i) {
    bgIndex = (i + BACKGROUNDS.length) % BACKGROUNDS.length;
    store.set("bgIndex", bgIndex);
    var bg = BACKGROUNDS[bgIndex];
    bgBack.style.backgroundImage = "url('" + bg.file + "')";
    bgBack.className = "bg show";
    bgFront.className = "bg";
    var t = bgFront; bgFront = bgBack; bgBack = t;
    $("bgName").innerHTML = bg.name;
  }

  // Preload so the crossfade never shows a half-loaded scene.
  for (var p = 0; p < BACKGROUNDS.length; p++) { var img = new Image(); img.src = BACKGROUNDS[p].file; }

  // ---------- Weather ----------
  // WMO weather codes used by Open-Meteo.
  function describe(code, isDay) {
    if (code === 0) return { label: isDay ? "Clear" : "Clear night", icon: isDay ? "sun" : "moon" };
    if (code === 1 || code === 2) return { label: "Partly cloudy", icon: isDay ? "partly" : "partlyNight" };
    if (code === 3) return { label: "Overcast", icon: "cloud" };
    if (code === 45 || code === 48) return { label: "Fog", icon: "fog" };
    if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "rain" };
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", icon: "rain" };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", icon: "snow" };
    if (code >= 95) return { label: "Thunderstorms", icon: "storm" };
    return { label: "—", icon: "cloud" };
  }

  var S = 'fill="none" stroke="#f4f1ec" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  var CLOUD = '<path ' + S + ' d="M7 18h10.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.7-1.2A4 4 0 0 0 7 18z"/>';
  var ICONS = {
    sun: '<circle ' + S + ' cx="12" cy="12" r="4.2"/><path ' + S + ' d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    moon: '<path ' + S + ' d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
    partly: '<path ' + S + ' d="M8.5 3.2v1.4M3.2 8.5h1.4M4.8 4.8l1 1M12.2 4.8l-1 1"/><path ' + S + ' d="M5.6 10.8a3.2 3.2 0 0 1 5.8-2.4"/>' + CLOUD,
    partlyNight: '<path ' + S + ' d="M11.5 7.2A4 4 0 0 1 5.3 3.5a4 4 0 1 0 6.2 3.7z"/>' + CLOUD,
    cloud: CLOUD,
    fog: '<path ' + S + ' d="M4 9h16M6 13h12M4 17h16"/>',
    rain: '<g transform="translate(0 -3)">' + CLOUD + '</g><path ' + S + ' d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
    snow: '<g transform="translate(0 -3)">' + CLOUD + '</g><path ' + S + ' d="M9 19.5h.01M12 21h.01M15 19.5h.01"/>',
    storm: '<g transform="translate(0 -3)">' + CLOUD + '</g><path ' + S + ' d="M12.5 15L10.5 18h3l-2 3.5"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' + (ICONS[name] || ICONS.cloud) + "</svg>"; }

  function renderWeather(wx) {
    if (!wx) return;
    var now = describe(wx.current.weather_code, wx.current.is_day === 1);
    $("wxIcon").innerHTML = icon(now.icon);
    $("wxTemp").innerHTML = Math.round(wx.current.temperature_2m);
    $("wxLabel").innerHTML = now.label;

    var html = "";
    for (var i = 0; i < wx.daily.time.length && i < 4; i++) {
      var parts = wx.daily.time[i].split("-");
      var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
      var name = i === 0 ? "Today" : DAYS[d.getUTCDay()].slice(0, 3);
      var desc = describe(wx.daily.weather_code[i], true);
      html += '<div class="wx-day"><div class="d">' + name + '</div><div class="i">' + icon(desc.icon) +
        '</div><div class="t">' + Math.round(wx.daily.temperature_2m_max[i]) + "&deg;<span>" +
        Math.round(wx.daily.temperature_2m_min[i]) + "&deg;</span></div></div>";
    }
    $("wxDays").innerHTML = html;
    updateWeatherMeta(wx);
  }

  function updateWeatherMeta(wx) {
    var meta = $("wxMeta");
    if (!wx) return;
    var age = new Date().getTime() - wx.fetchedAt;
    var t = new Date(wx.fetchedAt + UTC_OFFSET_HOURS * 3600 * 1000);
    var at = hhmm(t.getUTCHours(), t.getUTCMinutes()) + (t.getUTCHours() < 12 ? " AM" : " PM");
    if (age > WEATHER_STALE_MS) { meta.className = "wx-meta stale"; meta.innerHTML = "Offline &middot; last updated " + at; }
    else { meta.className = "wx-meta"; meta.innerHTML = "Updated " + at; }
  }

  function fetchWeather() {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + CITY.lat + "&longitude=" + CITY.lon +
      "&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min" +
      "&timezone=" + encodeURIComponent(CITY.tz) + "&forecast_days=4";
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = 15000;
    xhr.onload = function () {
      if (xhr.status !== 200) return onWeatherFail();
      try {
        var data = JSON.parse(xhr.responseText);
        data.fetchedAt = new Date().getTime();
        store.set("weather", data);
        renderWeather(data);
      } catch (e) { onWeatherFail(); }
    };
    xhr.onerror = xhr.ontimeout = onWeatherFail;
    xhr.send();
  }

  function onWeatherFail() {
    var cached = store.get("weather");
    if (cached) renderWeather(cached); // the meta line shows "Offline" once the cache is genuinely stale
    else { $("wxLabel").innerHTML = "Weather unavailable"; $("wxMeta").innerHTML = "Offline &middot; will retry"; $("wxMeta").className = "wx-meta stale"; }
  }

  // ---------- Remote control ----------
  document.addEventListener("keydown", function (e) {
    var k = e.keyCode;
    if (k === 37) { showBackground(bgIndex - 1); e.preventDefault(); }       // Left
    else if (k === 39) { showBackground(bgIndex + 1); e.preventDefault(); }  // Right
  });
  $("prevBg").onclick = function () { showBackground(bgIndex - 1); };
  $("nextBg").onclick = function () { showBackground(bgIndex + 1); };

  // Replay the welcome when the TV wakes and the page becomes visible again.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    tickClock();
    playWelcome();
    var cached = store.get("weather");
    if (!cached || new Date().getTime() - cached.fetchedAt > WEATHER_REFRESH_MS) fetchWeather();
  });

  // ---------- Start ----------
  tickClock();
  playWelcome();
  showBackground(bgIndex);
  renderWeather(store.get("weather"));
  fetchWeather();
  setInterval(tickClock, 5000);
  setInterval(fetchWeather, WEATHER_REFRESH_MS);
  setInterval(function () { updateWeatherMeta(store.get("weather")); }, 60000);
  setInterval(function () { showBackground(bgIndex + 1); }, BG_ROTATE_MS);
})();
