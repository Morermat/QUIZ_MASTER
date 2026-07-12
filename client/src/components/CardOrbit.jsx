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
  const [location, setLocation] = useState("неизвестное местоположение");
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const frameRef = useRef(null);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!navigator.geolocation) {
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
            parts.push(`г. ${address.city || address.town || address.village}`);
          }
          if (address.road) {
            let road = address.road;
            if (address.house_number) road += `, д. ${address.house_number}`;
            parts.push(road);
          }
          setLocation(`${coordsStr}, ${parts.join(", ")}`);
        } catch {
          const { latitude, longitude } = position.coords;
          setLocation(`${latitude.toFixed(5)}° с.ш., ${longitude.toFixed(5)}° в.д.`);
        } finally {
          setLoading(false);
        }
      },
      () => setLoading(false),
      { timeout: 5000, enableHighAccuracy: false }
    );
  }, []);

  useEffect(() => {
    if (loading) return;

    intervalRef.current = setInterval(() => {
      const raw = PREDICTIONS[Math.floor(Math.random() * PREDICTIONS.length)];
      setPrediction(raw.replace(/\{location\}/g, location));
      setShowPrediction(true);
      setTimeout(() => setShowPrediction(false), 4000);
    }, 8000 + Math.random() * 4000);

    return () => clearInterval(intervalRef.current);
  }, [loading, location]);

  useEffect(() => {
    let last = performance.now();

    const animate = (time) => {
      const delta = time - last;
      last = time;
      setRotation((r) => (r + delta * 0.03) % 360);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const cards = Array.from({ length: CARDS_COUNT }).map((_, i) => {
    const angle = (i / CARDS_COUNT) * Math.PI * 2 + (rotation * Math.PI) / 180;
    const x = Math.sin(angle) * 115;
    const z = Math.cos(angle) * RADIUS;
    const y = Math.sin(angle * 2) * 8;
    const depth = (z + RADIUS) / (RADIUS * 2);
    const scale = 0.55 + depth * 0.45;
    const opacity = 0.25 + depth * 0.75;

    return {
      id: i,
      x,
      y,
      z,
      depth,
      scale,
      opacity,
      angle,
      image: `/cards/${(i % 15) + 1}.png`,
    };
  });

  cards.sort((a, b) => a.z - b.z);

  return (
    <div
      className="hidden md:block fixed bottom-4 right-4 w-64 h-64 pointer-events-none z-40 md:w-80 md:h-80 lg:w-96 lg:h-96"
      style={{
        perspective: "1600px",
        perspectiveOrigin: "center center",
      }}
    >
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{ transformStyle: "preserve-3d" }}
      >
        {cards.map((card) => (
          <div
            key={card.id}
            className="absolute w-20 h-28 rounded-xl border border-gold/30"
            style={{
              transform: `
                translate3d(${card.x}px, ${card.y}px, ${card.z}px)
                rotateY(${Math.sin(card.angle) * 18}deg)
                scale(${card.scale})
              `,
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              backgroundImage: `url(${card.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: card.opacity,
              zIndex: Math.round(card.depth * 1000),
              filter: `
                brightness(${0.55 + card.depth * 0.65})
                saturate(${0.8 + card.depth * 0.35})
              `,
              boxShadow: `
                0 ${10 + card.depth * 20}px
                ${25 + card.depth * 25}px
                rgba(0,0,0,${0.45 - card.depth * 0.2})
              `,
              willChange: "transform",
            }}
          />
        ))}

        {showPrediction && prediction && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: "translate3d(0, -60px, 300px) scale(1)",
              zIndex: 9999,
              pointerEvents: "auto",
            }}
          >
            <div
              className="bg-[var(--bg-card)] border border-gold/40 rounded-xl p-5 shadow-2xl max-w-xs text-center text-sm text-[var(--text-secondary)] animate-fade-in-up"
              style={{
                animation: "fadeInUp 0.6s ease-out forwards",
                cursor: "pointer",
              }}
              onClick={() => setShowPrediction(false)}
            >
              {prediction}
              <div className="text-xs opacity-50 mt-1 italic">(нажми, чтобы скрыть)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}