export function DocumentDocxIllustration({ className = "" }) {
  return (
    <div className={`document-illustration document-illustration--docx ${className}`} aria-hidden="true">
      <div className="document-illustration__page">
        <span className="document-illustration__fold" />
        <span className="document-illustration__line document-illustration__line--full" />
        <span className="document-illustration__line document-illustration__line--wide" />
        <span className="document-illustration__line" />
        <span className="document-illustration__line document-illustration__line--short" />
        <span className="document-illustration__line document-illustration__line--wide" />
      </div>
      <span className="document-illustration__badge">DOCX</span>
    </div>
  );
}

export default DocumentDocxIllustration;
