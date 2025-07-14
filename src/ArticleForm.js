import React from 'react';

const ArticleForm = ({ formData, onInputChange }) => {
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
            placeholder="Enter a descriptive title"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="abstract" className="form-label">Abstract</label>
          <textarea
            className="form-control"
            id="abstract"
            name="abstract"
            rows="3"
            value={formData.abstract}
            onChange={onInputChange}
            placeholder="Enter a 1-paragraph abstract"
          ></textarea>
        </div>
        
        <div className="mb-3">
          <label htmlFor="articleText" className="form-label">Article Text</label>
          <textarea
            className="form-control"
            id="articleText"
            name="articleText"
            rows="6"
            value={formData.articleText}
            onChange={onInputChange}
            placeholder="Enter article content"
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
            placeholder="Please add up to 3 tags to describe what your article is about e.g., Java"
          />
        </div>
      </div>
    </div>
  );
};

export default ArticleForm;
