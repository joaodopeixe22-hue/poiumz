function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function CoverImage({
  src,
  alt,
  seed,
  className = "",
}: {
  src?: string | null;
  alt?: string;
  seed?: string;
  className?: string;
}) {
  if (src) {
    return <img src={src} alt={alt ?? ""} loading="lazy" className={`object-cover ${className}`} />;
  }
  const hue = seed ? hashStr(seed) % 360 : 130;
  return (
    <div
      className={`grid place-items-center ${className}`}
      style={{
        background: `linear-gradient(135deg, oklch(0.35 0.06 ${hue}), oklch(0.18 0.05 ${(hue + 60) % 360}))`,
      }}
    >
      <span className="material-symbols text-[28px] text-white/40" aria-hidden>
        graphic_eq
      </span>
    </div>
  );
}
