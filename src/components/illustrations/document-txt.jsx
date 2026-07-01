export function DocumentTxtIllustration({ className = "" }) {
  return (
    <div className={`document-illustration document-illustration--txt ${className}`} aria-hidden="true">
      <div className="document-illustration__page">
        <span className="document-illustration__fold" />
        <span className="document-illustration__line document-illustration__line--wide" />
        <span className="document-illustration__line" />
        <span className="document-illustration__line document-illustration__line--short" />
        <span className="document-illustration__line document-illustration__line--wide" />
        <span className="document-illustration__line" />
      </div>
      <span className="document-illustration__badge">TXT</span>
    </div>
  );
}

export default DocumentTxtIllustration;
