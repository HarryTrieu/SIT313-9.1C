import React from 'react';

const QuestionCard = ({ question, isExpanded, onCardClick, onDelete }) => {
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateText = (text, maxLength = 150) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="card h-100 shadow-sm question-card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h5 
            className="card-title mb-2 text-primary" 
            style={{ cursor: 'pointer' }}
            onClick={onCardClick}
          >
            {question.title}
            {isExpanded ? (
              <i className="bi bi-chevron-up ms-2"></i>
            ) : (
              <i className="bi bi-chevron-down ms-2"></i>
            )}
          </h5>
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete question"
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>

        <div className="mb-3">
          <small className="text-muted">
            <i className="bi bi-calendar me-1"></i>
            {formatDate(question.createdAt)}
          </small>
        </div>

        <div className="mb-3">
          {isExpanded ? (
            <p className="card-text">{question.description}</p>
          ) : (
            <p className="card-text">{truncateText(question.description)}</p>
          )}
        </div>

        {question.tags && question.tags.length > 0 && (
          <div className="mb-2">
            {question.tags.map((tag, index) => (
              <span key={index} className="badge bg-secondary me-1">
                {tag}
              </span>
            ))}
          </div>
        )}

        {isExpanded && (
          <div className="mt-3 pt-3 border-top">
            <div className="d-flex gap-2">
              <button className="btn btn-primary btn-sm">
                <i className="bi bi-chat-dots me-1"></i>
                Answer Question
              </button>
              <button className="btn btn-outline-secondary btn-sm">
                <i className="bi bi-eye me-1"></i>
                View Solutions
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionCard;