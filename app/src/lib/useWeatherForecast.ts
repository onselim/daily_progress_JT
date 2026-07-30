import { useEffect, useState } from 'react';

export interface DayForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  precipProbability: number;
}

export function useWeatherForecast(lat: number | null, lng: number | null) {
  const [days, setDays] = useState<DayForecast[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;
    setError(null);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const daily = data.daily;
        if (!daily) {
          setError('No forecast data.');
          return;
        }
        setDays(
          daily.time.map((date: string, i: number) => ({
            date,
            tempMax: Math.round(daily.temperature_2m_max[i]),
            tempMin: Math.round(daily.temperature_2m_min[i]),
            precipProbability: daily.precipitation_probability_max[i],
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setError('Could not load forecast.');
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return { days, error };
}
