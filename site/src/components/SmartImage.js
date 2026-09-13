import Image from "next/image";

// Images from the media store (and /public) go through Next's optimizer, which
// serves each visitor a right-sized WebP/AVIF and lazy-loads it. Anything else
// — an outside URL, or a legacy embedded image not yet migrated — renders as a
// plain lazy <img>.
//
//   fill      cover the parent box (the parent must be position: relative)
//   width/height  the image's natural size, so space is reserved before load
export default function SmartImage({
  src,
  alt = "",
  width,
  height,
  fill = false,
  sizes = "100vw",
  priority = false,
  style,
  className,
}) {
  if (!src) return null;
  const local = src.startsWith("/") && !src.startsWith("//") && !src.endsWith(".svg");

  if (!local) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={className}
        style={
          fill
            ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }
            : { width: "100%", height: "auto", display: "block", ...style }
        }
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        preload={priority}
        className={className}
        style={{ objectFit: "cover", ...style }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width || 1400}
      height={height || 933}
      sizes={sizes}
      preload={priority}
      className={className}
      style={{ width: "100%", height: "auto", display: "block", ...style }}
    />
  );
}
