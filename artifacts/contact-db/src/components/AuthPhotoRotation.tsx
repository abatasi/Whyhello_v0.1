import { useEffect, useState } from "react";

const imageBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/images`;

const photos = [
  `${imageBase}/business-collaboration.jpg`,
  `${imageBase}/business-team-meeting.jpg`,
  `${imageBase}/business-colleagues.jpg`,
];

export default function AuthPhotoRotation() {
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      setActivePhoto((current) => (current + 1) % photos.length);
    }, 6000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {photos.map((photo, index) => (
        <img
          key={photo}
          src={photo}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${
            index === 0 ? "object-[65%_center]" : "object-center"
          } transition-opacity duration-1000 ease-in-out ${
            index === activePhoto ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </div>
  );
}