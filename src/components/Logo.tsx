export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt="BMU AI Tutor"
        className="h-full w-full object-contain"
      />
    </span>
  );
}
