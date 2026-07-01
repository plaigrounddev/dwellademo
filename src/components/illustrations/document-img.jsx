export function DocumentImgIllustration({ className = "" }) {
  return (
    <div className={`document-illustration document-illustration--img ${className}`} aria-hidden="true">
      <div className="document-illustration__page document-illustration__page--media">
        <span className="document-illustration__fold" />
        <span className="document-illustration__sun" />
        <span className="document-illustration__hill document-illustration__hill--one" />
        <span className="document-illustration__hill document-illustration__hill--two" />
      </div>
      <span className="document-illustration__badge">IMG</span>
    </div>
  );
}

export default DocumentImgIllustration;
