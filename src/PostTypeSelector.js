import React from 'react';

const PostTypeSelector = ({ selectedType, onTypeChange }) => {
  return (
    <div className="mb-4">
      <label className="form-label fw-bold">Select Post Type:</label>
      <div className="d-flex gap-3">
        <div className="form-check">
          <input
            className="form-check-input"
            type="radio"
            name="postType"
            id="question"
            value="question"
            checked={selectedType === 'question'}
            onChange={(e) => onTypeChange(e.target.value)}
          />
          <label className="form-check-label" htmlFor="question">
            Question
          </label>
        </div>
        <div className="form-check">
          <input
            className="form-check-input"
            type="radio"
            name="postType"
            id="article"
            value="article"
            checked={selectedType === 'article'}
            onChange={(e) => onTypeChange(e.target.value)}
          />
          <label className="form-check-label" htmlFor="article">
            Article
          </label>
        </div>
      </div>
    </div>
  );
};

export default PostTypeSelector;