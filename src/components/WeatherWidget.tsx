import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Cloud, CloudRain, CloudSnow, Wind, Droplets, Thermometer, ChevronRight, X, AlertTriangle, Wind as WindIcon, Trees } from 'lucide-react';
import { cn } from '../lib/utils';

interface WeatherData {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  pm10: number;
  pm25: number;
  birchPollen: number;
  grassPollen: number;
  ragweedPollen: number;
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
      // Fetch current weather
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m`
      );
      const weatherJson = await weatherRes.json();

      // Fetch air quality and pollen
      const airRes = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,birch_pollen,grass_pollen,ragweed_pollen`
      );
      const airJson = await airRes.json();

      setData({
        temperature: weatherJson.current.temperature_2m,
        windSpeed: weatherJson.current.wind_speed_10m,
        weatherCode: weatherJson.current.weather_code,
        pm10: airJson.current.pm10,
        pm25: airJson.current.pm2_5,
        birchPollen: airJson.current.birch_pollen || 0,
        grassPollen: airJson.current.grass_pollen || 0,
        ragweedPollen: airJson.current.ragweed_pollen || 0,
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
      }, 5000);
    }
  };

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="text-yellow-500" />;
    if (code >= 1 && code <= 3) return <Cloud className="text-gray-400" />;
    if (code >= 51 && code <= 67) return <CloudRain className="text-blue-400" />;
    if (code >= 71 && code <= 77) return <CloudSnow className="text-white drop-shadow-sm" />;
    if (code >= 80 && code <= 82) return <CloudRain className="text-blue-500" />;
    if (code >= 85 && code <= 86) return <CloudSnow className="text-white" />;
    return <Sun className="text-yellow-500" />;
  };

  const getWeatherLabel = (code: number) => {
    if (code === 0) return 'Beau temps';
    if (code >= 1 && code <= 3) return 'Partiellement nuageux';
    if (code >= 51 && code <= 67) return 'Pluie';
    if (code >= 71 && code <= 77) return 'Neigeux';
    if (code >= 80 && code <= 82) return 'Averses';
    if (code >= 85 && code <= 86) return 'Chutes de neige';
    return 'Dégagé';
  };

  const getPollenStatus = (val: number) => {
    if (val < 10) return 'Faible';
    if (val < 50) return 'Moyen';
    return 'Élevé';
  };

  return (
    <div 
      className="fixed top-20 right-8 z-[60] flex flex-col items-end"
      onMouseEnter={resetTimer}
      onMouseMove={resetTimer}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="mb-4 w-72 bg-white rounded-3xl shadow-2xl border border-outline-variant overflow-hidden"
          >
            <div className="p-6 space-y-6">
              {/* Weather Info */}
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {data && getWeatherIcon(data.weatherCode)}
                    <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Locale</span>
                  </div>
                  <h3 className="font-display text-2xl font-bold">{data?.temperature}°C</h3>
                  <p className="text-xs text-on-surface-variant font-medium">{data && getWeatherLabel(data.weatherCode)}</p>
                </div>
                <div className="p-4 bg-background rounded-2xl border border-outline-variant">
                   <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                     <WindIcon size={14} />
                     <span className="text-[10px] font-bold uppercase">Vent</span>
                   </div>
                   <p className="text-sm font-bold">{data?.windSpeed} km/h</p>
                </div>
              </div>

              {/* Pollution & Pollen */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background/50 p-3 rounded-2xl border border-outline-variant">
                     <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                       <Droplets size={12} />
                       <span className="text-[10px] font-bold uppercase">Pollution</span>
                     </div>
                     <span className={cn(
                       "text-[10px] font-bold py-0.5 px-2 rounded-full uppercase",
                       (data?.pm10 || 0) < 50 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                     )}>
                       { (data?.pm10 || 0) < 50 ? 'Bonne' : 'Modérée' }
                     </span>
                  </div>
                  <div className="bg-background/50 p-3 rounded-2xl border border-outline-variant">
                     <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                       <Trees size={12} />
                       <span className="text-[10px] font-bold uppercase">Pollens</span>
                     </div>
                     <span className={cn(
                       "text-[10px] font-bold py-0.5 px-2 rounded-full uppercase",
                       (data?.grassPollen || 0) < 10 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                     )}>
                       { getPollenStatus(data?.grassPollen || 0) }
                     </span>
                  </div>
                </div>

                <div className="text-[10px] font-medium text-on-surface-variant opacity-60 flex items-center justify-between">
                   <span>PM2.5: {data?.pm25} µg/m³</span>
                   <span>Bouleau: {getPollenStatus(data?.birchPollen || 0)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ x: -4 }}
        className={cn(
          "h-10 flex items-center gap-3 pl-4 pr-3 rounded-l-full shadow-lg transition-all border-y border-l border-outline-variant translate-x-4 hover:translate-x-0 group",
          isOpen ? "bg-primary-container text-white border-transparent" : "bg-white text-on-surface-variant"
        )}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <div className="group-hover:scale-110 transition-transform">
            {data && getWeatherIcon(data.weatherCode)}
          </div>
        )}
        <div className="flex flex-col items-start leading-none pr-2">
          <span className="text-[10px] font-black uppercase tracking-tighter">
            {loading ? 'Synchro...' : error || (data ? `${data.temperature}°C` : 'Météo')}
          </span>
          {data && (
            <span className="text-[8px] font-bold uppercase opacity-50 tracking-widest mt-0.5">
              AQI: {data.pm10 < 50 ? 'Bon' : 'Moyen'}
            </span>
          )}
        </div>
        <div className={cn("transition-transform duration-500", isOpen && "rotate-180")}>
           <ChevronRight size={14} />
        </div>
      </motion.button>
    </div>
  );
}
