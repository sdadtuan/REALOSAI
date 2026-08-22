type WinSodBannerProps = {
  sodId?: string;
  message: string;
};

export function WinSodBanner({ sodId, message }: WinSodBannerProps) {
  const label = sodId ? `SoD-${sodId}` : 'SoD';
  return (
    <div className="win-sod-banner" role="alert">
      <span className="win-sod-banner__icon" aria-hidden="true">
        ⛔
      </span>
      <div>
        <strong>{label}:</strong> {message}
      </div>
    </div>
  );
}
