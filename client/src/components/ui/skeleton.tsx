function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted-foreground/20 ${className}`} />
  );
}

export { Skeleton };
