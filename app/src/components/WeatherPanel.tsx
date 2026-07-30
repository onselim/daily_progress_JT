import { useWeatherForecast } from '../lib/useWeatherForecast';

interface WeatherPanelProps {
  lat: number | null;
  lng: number | null;
}

export function WeatherPanel({ lat, lng }: WeatherPanelProps) {
  const { days, error } = useWeatherForecast(lat, lng);

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
