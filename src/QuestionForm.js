import React from 'react';

const QuestionForm = ({ formData, onInputChange }) => {
  return (
    <div className="card">
      <div className="card-header">
        <h5 className="card-title mb-0">What do you want to ask or share?</h5>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <label htmlFor="title" className="form-label">Title</label>
          <input
            type="text"
            className="form-control"
            id="title"
            name="title"
            value={formData.title}
            onChange={onInputChange}
            placeholder="Start your question with how, what, why, etc."
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="description" className="form-label">Describe your problem</label>
          <textarea
            className="form-control"
            id="description"
            name="description"
            rows="4"
            value={formData.description}
            onChange={onInputChange}
            placeholder="Describe your problem in detail..."
          ></textarea>
        </div>
        
        <div className="mb-3">
          <label htmlFor="tags" className="form-label">Tags</label>
          <input
            type="text"
            className="form-control"
            id="tags"
            name="tags"
            value={formData.tags}
            onChange={onInputChange}
            placeholder="Please add up to 3 tags to describe what your question is about e.g., Java"
          />
        </div>
      </div>
    </div>
  );
};

export default QuestionForm;