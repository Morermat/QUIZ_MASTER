import { useState, useEffect } from 'react';
import axios from 'axios';

const predictions = [
  "Шутки шутками, смех смехом, но когда сова на скакалке попадается — это значит, что твой следующий проигрыш уже будет не в игре. {location} жди...",
  "Ты думаешь, что выиграл? Ха. Вселенная просто даёт тебе ложную надежду.",
  "Звёзды предупреждают: твоя самоуверенность — единственное, что работает хуже твоей интуиции.",
  "Карты говорят, что ты слишком много думаешь. Это не помогает, это просто смешно.",
  "Сегодня ты — звезда. Завтра ты — статистика. Разница лишь в том, кто будет смеяться последним.",
  "Предсказание: ты будешь сидеть на этом сайте до утра, пытаясь доказать, что ты умнее. Спойлер: нет.",
  "Вселенная шепчет: твой IQ сейчас равен количеству правильных ответов. И она смеётся.",
  "Ты победил? Поздравляю. Теперь твоя удача будет отдыхать ближайшие полгода.",
  "Знаешь, что общего между тобой и совой на скакалке? Оба не понимаете, что происходит, но делаете вид, что контролируете ситуацию.",
  "Твоя интуиция — это как случайный выбор в квизе. Иногда работает, чаще — нет.",
  "Сегодня ты выиграл. Завтра ты проиграешь.",
  "Карты Таро говорят: ты слишком серьёзно относишься к предсказаниям. Но ты всё равно это читаешь.",
  "Ты думаешь, я шучу? Я никогда не шучу. Я просто говорю правду, а ты называешь это шуткой. {location} жди...",
];

export default function PredictionCard() {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [location, setLocation] = useState(null);
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

    const show = () => {
      const raw = predictions[Math.floor(Math.random() * predictions.length)];
      const locationText = location || 'неизвестное местоположение';
      setText(raw.replace(/\{location\}/g, locationText));
      setVisible(true);
      setTimeout(() => setVisible(false), 6000);
    };

    const timer = setTimeout(show, 2000);

    const handleRouteChange = () => {
      setVisible(false);
      setTimeout(show, 1500);
    };
    window.addEventListener('popstate', handleRouteChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [location, loading]);

  if (!visible) return null;

  return (
    <div className="prediction-card animate-fade-in" onClick={() => setVisible(false)}>
      <div className="text">{text}</div>
      {location && !location.includes('неизвестное') && (
        <div className="text-xs opacity-50 mt-1">📍 {location}</div>
      )}
      <div className="text-xs opacity-50 mt-0.5 italic">(нажми, чтобы скрыть)</div>
    </div>
  );
}