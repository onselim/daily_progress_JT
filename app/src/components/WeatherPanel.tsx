import { useEffect, useState } from 'react';

interface DayForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  precipProbability: number;
}

interface WeatherPanelProps {
  lat: number | null;
  lng: number | null;
}

export function WeatherPanel({ lat, lng }: WeatherPanelProps) {
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

  if (lat == null || lng == null) return <p className="accordion-empty">No asset location available.</p>;
  if (error) return <p className="accordion-empty">{error}</p>;
  if (!days) return <p className="accordion-empty">Loading forecast…</p>;

  return (
    <>
      {days.map((d) => (
        <div key={d.date} className="weather-day-row">
          <span>{new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
          <span>
            {d.tempMin}° / {d.tempMax}°
          </span>
          <span style={{ color: d.precipProbability > 50 ? '#ef4444' : '#00d4aa' }}>{d.precipProbability}%</span>
        </div>
      ))}
    </>
  );
}
