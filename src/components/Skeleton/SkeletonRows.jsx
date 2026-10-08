export default function SkeletonRows({ rows = 3 }) {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton skeleton--row" key={i} />
      ))}
    </div>
  );
}
