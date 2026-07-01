export function DocumentHtmlIllustration({ className = "" }) {
  return (
    <div className={`document-illustration document-illustration--html ${className}`} aria-hidden="true">
      <div className="document-illustration__page document-illustration__page--code">
        <span className="document-illustration__fold" />
        <span className="document-illustration__code-line document-illustration__code-line--wide" />
        <span className="document-illustration__code-line" />
        <span className="document-illustration__code-line document-illustration__code-line--short" />
        <span className="document-illustration__code-line document-illustration__code-line--wide" />
      </div>
      <span className="document-illustration__badge">HTML</span>
    </div>
  );
}

export default DocumentHtmlIllustration;
