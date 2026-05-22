import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Cloud, CloudRain, CloudSnow, Wind, Droplets, Thermometer, ChevronRight, X, AlertTriangle, Wind as WindIcon, Trees, CloudLightning } from 'lucide-react';
import { cn } from '../lib/utils';

interface DailyWeather {
  time: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
}

interface WeatherData {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  pm10: number;
  pm25: number;
  birchPollen: number;
  grassPollen: number;
  ragweedPollen: number;
  daily: DailyWeather[];
}

export default function WeatherWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWeather = async (lat: number, lon: number) => {
    try {
      setLoading(true);
      // Fetch current weather and 7 days forecast
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
      );
      const weatherJson = await weatherRes.json();

      // Fetch air quality and pollen
      const airRes = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,birch_pollen,grass_pollen,ragweed_pollen`
      );
      const airJson = await airRes.json();

      const daily: DailyWeather[] = weatherJson.daily?.time?.slice(0, 7).map((t: string, i: number) => ({
        time: t,
        weatherCode: weatherJson.daily.weather_code[i],
        tempMax: weatherJson.daily.temperature_2m_max[i],
        tempMin: weatherJson.daily.temperature_2m_min[i],
      })) || [];

      setData({
        temperature: weatherJson.current.temperature_2m,
        windSpeed: weatherJson.current.wind_speed_10m,
        weatherCode: weatherJson.current.weather_code,
        pm10: airJson.current.pm10,
        pm25: airJson.current.pm2_5,
        birchPollen: airJson.current.birch_pollen || 0,
        grassPollen: airJson.current.grass_pollen || 0,
        ragweedPollen: airJson.current.ragweed_pollen || 0,
        daily,
      });
      setError(null);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError('Erreur météo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => setError('Localisation requise')
      );
    } else {
      setError('Géo non supportée');
    }
  }, []);

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isOpen) {
      timerRef.current = setTimeout(() => {
        setIsOpen(false);
      }, 8000); // give users more time to read the week forecast
    }
  };

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  const getWeatherIcon = (code: number, size: number = 24) => {
    if (code === 0) return <Sun size={size} className="text-yellow-500" />;
    if (code >= 1 && code <= 3) return <Cloud size={size} className="text-gray-400" />;
    if (code >= 51 && code <= 67) return <CloudRain size={size} className="text-blue-400" />;
    if (code >= 71 && code <= 77) return <CloudSnow size={size} className="text-blue-200 drop-shadow-sm" />;
    if (code >= 80 && code <= 82) return <CloudRain size={size} className="text-blue-500" />;
    if (code >= 85 && code <= 86) return <CloudSnow size={size} className="text-blue-200" />;
    if (code >= 95 && code <= 99) return <CloudLightning size={size} className="text-purple-500" />;
    return <Sun size={size} className="text-yellow-500" />;
  };

  const getSophisticatedWeatherLabel = (code: number) => {
    if (code === 0) return 'Radieux et Cristallin';
    if (code >= 1 && code <= 3) return 'Subtilement Voilé';
    if (code >= 51 && code <= 67) return 'Ondée Poétique';
    if (code >= 71 && code <= 77) return 'Ornement Hivernal';
    if (code >= 80 && code <= 82) return 'Averses Mélancoliques';
    if (code >= 85 && code <= 86) return 'Symphonie Neigeuse';
    if (code >= 95 && code <= 99) return 'Tumulte Orageux';
    return 'Splendeur Dégagée';
  };

  const getPollenStatus = (val: number) => {
    if (val < 10) return 'Faible';
    if (val < 50) return 'Modéré';
    return 'Prononcé';
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  };

  return (
    <div 
      className="flex flex-col items-end relative z-[60]"
      onMouseEnter={resetTimer}
      onMouseMove={resetTimer}
    >
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        className={cn(
          "h-10 flex items-center gap-3 px-4 rounded-full shadow-sm transition-all border border-outline-variant group",
          isOpen ? "bg-primary-container text-white border-transparent" : "bg-white text-on-surface-variant hover:bg-surface"
        )}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <div className="group-hover:scale-110 transition-transform">
            {data && getWeatherIcon(data.weatherCode, 18)}
          </div>
        )}
        <div className="flex flex-col items-start leading-none pr-2">
          <span className="text-[10px] font-black uppercase tracking-tighter">
            {loading ? 'Synchro...' : error || (data ? `${data.temperature}°C` : 'Météo')}
          </span>
          {data && (
            <span className="text-[8px] font-bold uppercase opacity-50 tracking-widest mt-0.5">
              AQI: {data.pm10 < 50 ? 'Pritstine' : 'Moyen'}
            </span>
          )}
        </div>
        <div className={cn("transition-transform duration-500", isOpen && "rotate-180")}>
           <ChevronRight size={14} />
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="mt-2 absolute top-full right-0 w-[340px] sm:w-[380px] bg-white rounded-[32px] shadow-2xl border border-outline-variant overflow-hidden"
          >
            <div className="p-6 sm:p-8 space-y-8">
              {/* Weather Info */}
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1 flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    {data && getWeatherIcon(data.weatherCode, 24)}
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-container">Actuel</span>
                  </div>
                  <h3 className="font-display text-4xl font-bold tracking-tighter text-on-surface">{data?.temperature}°</h3>
                  <p className="text-sm text-on-surface-variant font-medium pt-1 line-clamp-2 md:line-clamp-none">{data && getSophisticatedWeatherLabel(data.weatherCode)}</p>
                </div>
                <div className="p-4 bg-background rounded-2xl border border-outline-variant shrink-0 flex flex-col items-center justify-center">
                   <div className="flex items-center gap-2 text-on-surface-variant mb-2">
                     <WindIcon size={14} />
                     <span className="text-[10px] font-bold uppercase tracking-wider">Brisé</span>
                   </div>
                   <p className="text-lg font-bold text-on-surface leading-none">{data?.windSpeed} <span className="text-xs font-normal">km/h</span></p>
                </div>
              </div>

              {/* Pollution & Pollen */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background/50 p-4 rounded-2xl border border-outline-variant">
                     <div className="flex items-center gap-2 text-on-surface-variant mb-2">
                       <Droplets size={14} />
                       <span className="text-[10px] font-bold uppercase tracking-wider">Pollution</span>
                     </div>
                     <div className="flex items-end gap-2">
                       <span className={cn(
                         "text-xs font-bold py-1 px-3 rounded-full uppercase tracking-wider",
                         (data?.pm10 || 0) < 50 ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                       )}>
                         { (data?.pm10 || 0) < 50 ? 'Pristine' : 'Altéré' }
                       </span>
                     </div>
                  </div>
                  <div className="bg-background/50 p-4 rounded-2xl border border-outline-variant">
                     <div className="flex items-center gap-2 text-on-surface-variant mb-2">
                       <Trees size={14} />
                       <span className="text-[10px] font-bold uppercase tracking-wider">Pollen (Gram.)</span>
                     </div>
                     <span className={cn(
                       "text-xs font-bold py-1 px-3 rounded-full uppercase tracking-wider",
                       (data?.grassPollen || 0) < 10 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                     )}>
                       { getPollenStatus(data?.grassPollen || 0) }
                     </span>
                  </div>
                </div>

                <div className="px-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60 flex items-center justify-between">
                   <span>PM2.5: {data?.pm25} µg/m³</span>
                   <span>Bouleau: {getPollenStatus(data?.birchPollen || 0)}</span>
                </div>
              </div>

              {/* Weekly Forecast */}
              {data && data.daily && data.daily.length > 0 && (
                <div className="pt-6 border-t border-outline-variant">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-4">Prévisions Sophistiquées</h4>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
                    {data.daily.map((day, idx) => (
                      <div key={idx} className="snap-start shrink-0 flex flex-col items-center gap-2 p-3 bg-background rounded-2xl border border-outline-variant min-w-[72px]">
                        <span className="text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">{idx === 0 ? "Auj." : getDayName(day.time)}</span>
                        {getWeatherIcon(day.weatherCode, 20)}
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                           <span className="text-on-surface">{Math.round(day.tempMax)}°</span>
                           <span className="text-on-surface-variant opacity-60 text-[10px]">{Math.round(day.tempMin)}°</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
