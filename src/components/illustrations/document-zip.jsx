export function DocumentZipIllustration({ className = "" }) {
  return (
    <div className={`document-illustration document-illustration--zip ${className}`} aria-hidden="true">
      <div className="document-illustration__page document-illustration__page--zip">
        <span className="document-illustration__fold" />
        <span className="document-illustration__zip-track">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="document-illustration__zip-pull" />
      </div>
      <span className="document-illustration__badge">ZIP</span>
    </div>
  );
}

export default DocumentZipIllustration;
