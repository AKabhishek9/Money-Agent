interface LoaderProps {
  label?: string;
  fullScreen?: boolean;
  className?: string;
}

export default function Loader({ label = 'Loading...', fullScreen = false, className = '' }: LoaderProps) {
  return (
    <div
      className={`${fullScreen ? 'money-loader-screen' : 'money-loader-inline'} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="money-loader" aria-hidden="true">
        <div className="money-loader-box money-loader-box-1">
          <div className="money-loader-side-left" />
          <div className="money-loader-side-right" />
          <div className="money-loader-side-top" />
        </div>
        <div className="money-loader-box money-loader-box-2">
          <div className="money-loader-side-left" />
          <div className="money-loader-side-right" />
          <div className="money-loader-side-top" />
        </div>
        <div className="money-loader-box money-loader-box-3">
          <div className="money-loader-side-left" />
          <div className="money-loader-side-right" />
          <div className="money-loader-side-top" />
        </div>
        <div className="money-loader-box money-loader-box-4">
          <div className="money-loader-side-left" />
          <div className="money-loader-side-right" />
          <div className="money-loader-side-top" />
        </div>
      </div>
      {label && (
        <p className="money-loader-label">
          {label}
        </p>
      )}
    </div>
  );
}
