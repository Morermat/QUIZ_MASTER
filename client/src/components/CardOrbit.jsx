import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const CARDS_COUNT = 12;
const RADIUS = 180;
const PREDICTIONS = [
  "Шутки шутками, смех смехом, но веселье заканчивается когда сова на скакалке попадается — это значит, что твой следующий проигрыш уже будет не в игре. {location} жди...",
  "Ты думаешь, что выиграл? Ха. Вселенная просто даёт тебе ложную надежду.",
  "Звёзды предупреждают: твоя самоуверенность — единственное, что работает хуже твоей интуиции.",
  "Карты говорят, что ты слишком много думаешь. Это не помогает, это просто смешно.",
  "Предсказание: ты будешь сидеть на этом сайте до утра, пытаясь доказать, что ты умнее. Спойлер: нет.",
  "Вселенная шепчет: твой IQ сейчас равен количеству правильных ответов. И она смеётся.",
  "Ты победил? Поздравляю. Теперь твоя удача будет отдыхать ближайшие полгода.",
  "Знаешь, что общего между тобой и совой на скакалке? Ничего.",
  "Твоя интуиция — это как случайный выбор в квизе. Иногда работает, чаще — нет.",
  "Сегодня ты выиграл. Завтра ты проиграешь.",
  "Карты Таро говорят: ты слишком серьёзно относишься к предсказаниям. Но ты всё равно это читаешь.",
  "Ты думаешь, я шучу? Я никогда не шучу. Я просто говорю правду, а ты называешь это шуткой. {location} жди...",
];

export default function CardOrbit() {
  const [prediction, setPrediction] = useState(null);
  const [showPrediction, setShowPrediction] = useState(false);
  const intervalRef = useRef(null);
  const [location, setLocation] = useState('неизвестное местоположение');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation('неизвестное местоположение');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const coordsStr = `${latitude.toFixed(5)}° с.ш., ${longitude.toFixed(5)}° в.д.`;
          const response = await axios.get(
            `https://geocode.maps.co/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ru`
          );
          const address = response.data.address;
          const parts = [];
          if (address.country) parts.push(address.country);
          if (address.state) parts.push(address.state);
          if (address.city || address.town || address.village) {
            const city = address.city || address.town || address.village;
            parts.push(`г. ${city}`);
          }
          if (address.road) {
            let road = address.road;
            if (address.house_number) road += `, д. ${address.house_number}`;
            parts.push(road);
          }
          const addressStr = parts.join(', ');
          setLocation(`${coordsStr}, ${addressStr}`);
        } catch (err) {
          console.warn('Геокодинг не удался:', err);
          const { latitude, longitude } = position.coords;
          setLocation(`${latitude.toFixed(5)}° с.ш., ${longitude.toFixed(5)}° в.д.`);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.warn('Геолокация отклонена:', err);
        setLocation('неизвестное местоположение');
        setLoading(false);
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  }, []);

  useEffect(() => {
    if (loading) return;

    const startInterval = () => {
      intervalRef.current = setInterval(() => {
        const raw = PREDICTIONS[Math.floor(Math.random() * PREDICTIONS.length)];
        const locationText = location || 'неизвестное местоположение';
        const text = raw.replace(/\{location\}/g, locationText);
        setPrediction(text);
        setShowPrediction(true);
        setTimeout(() => {
          setShowPrediction(false);
        }, 4000);
      }, 8000 + Math.random() * 4000);
    };
    startInterval();
    return () => clearInterval(intervalRef.current);
  }, [location, loading]);

  return (
    <div className="fixed bottom-8 right-8 w-80 h-80 pointer-events-none z-40" style={{ perspective: '1000px' }}>
      <div className="relative w-full h-full">
        <div
          className="absolute inset-0 flex items-center justify-center animate-spin-slow"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {Array.from({ length: CARDS_COUNT }).map((_, i) => {
            const angle = (i / CARDS_COUNT) * 360;
            const rad = (angle * Math.PI) / 180;
            const sin = Math.sin(rad);
            const cos = Math.cos(rad);
            const scale = 0.6 + 0.4 * (cos + 1) / 2;
            const opacity = 0.3 + 0.7 * (cos + 1) / 2;
            const tilt = -10;

            return (
              <div
                key={i}
                className="absolute w-20 h-28 bg-[var(--bg-card)] border border-gold/30 rounded-xl shadow-lg"
                style={{
                  transform: `rotateY(${angle}deg) translateZ(${RADIUS}px) rotateX(${tilt}deg) scale(${scale})`,
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                  backgroundImage: `url('/cards/${(i % 15) + 1}.png')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: opacity,
                  transition: 'opacity 0.1s, transform 0.1s',
                }}
              />
            );
          })}
        </div>

        {showPrediction && prediction && (
          <div className="absolute inset-0 flex items-center justify-center animate-fade-in-up">
            <div className="bg-[var(--bg-card)] border border-gold/40 rounded-xl p-4 shadow-2xl max-w-xs text-center text-sm text-[var(--text-secondary)]">
              {prediction}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}