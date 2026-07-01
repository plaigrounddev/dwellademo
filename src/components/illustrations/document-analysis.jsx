export function DocumentAnalysisIllustration({ className = "" }) {
  return (
    <div className={`document-analysis-illustration ${className}`} aria-hidden="true">
      <span className="document-analysis-illustration__corner document-analysis-illustration__corner--tl" />
      <span className="document-analysis-illustration__corner document-analysis-illustration__corner--tr" />
      <span className="document-analysis-illustration__corner document-analysis-illustration__corner--bl" />
      <span className="document-analysis-illustration__corner document-analysis-illustration__corner--br" />
      <div className="document-analysis-illustration__page">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <span className="document-analysis-illustration__beam" />
      <span className="document-analysis-illustration__line" />
    </div>
  );
}

export default DocumentAnalysisIllustration;
