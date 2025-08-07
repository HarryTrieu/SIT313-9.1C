import React, { useMemo } from 'react';

const FilterControls = ({ filters, onFilterChange, questions }) => {
  // Extract unique tags from all questions
  const availableTags = useMemo(() => {
    const tagSet = new Set();
    questions.forEach(question => {
      if (question.tags) {
        question.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [questions]);

  const handleSearchChange = (e) => {
    onFilterChange({ searchTerm: e.target.value });
  };

  const handleTagChange = (e) => {
    onFilterChange({ selectedTag: e.target.value });
  };

  const handleDateChange = (e) => {
    onFilterChange({ dateFilter: e.target.value });
  };

  const clearFilters = () => {
    onFilterChange({
      searchTerm: '',
      selectedTag: '',
      dateFilter: 'all'
    });
  };

  const hasActiveFilters = filters.searchTerm || filters.selectedTag || filters.dateFilter !== 'all';

  return (
    <div className="card">
      <div className="card-body">
        <h6 className="card-title mb-3">Filter Questions</h6>
        
        <div className="row g-3">
          {/* Search by title */}
          <div className="col-md-4">
            <label htmlFor="searchTitle" className="form-label">Search by Title</label>
            <input
              type="text"
              className="form-control"
              id="searchTitle"
              placeholder="Search questions..."
              value={filters.searchTerm}
              onChange={handleSearchChange}
            />
          </div>

          {/* Filter by tag */}
          <div className="col-md-4">
            <label htmlFor="filterTag" className="form-label">Filter by Tag</label>
            <select
              className="form-select"
              id="filterTag"
              value={filters.selectedTag}
              onChange={handleTagChange}
            >
              <option value="">All Tags</option>
              {availableTags.map((tag, index) => (
                <option key={index} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by date */}
          <div className="col-md-4">
            <label htmlFor="filterDate" className="form-label">Filter by Date</label>
            <select
              className="form-select"
              id="filterDate"
              value={filters.dateFilter}
              onChange={handleDateChange}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={clearFilters}
            >
              <i className="bi bi-x-circle me-1"></i>
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterControls;