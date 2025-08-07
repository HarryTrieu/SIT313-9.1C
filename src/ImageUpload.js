import React from 'react';

const ImageUpload = ({ selectedImage, onImageSelect }) => {
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      
      onImageSelect(file);
    }
  };

  const handleRemoveImage = () => {
    onImageSelect(null);
  };

  return (
    <div className="card mt-3">
      <div className="card-header">
        <h5 className="card-title mb-0">Article Image (Optional)</h5>
      </div>
      <div className="card-body">
        {!selectedImage ? (
          <div>
            <input
              type="file"
              className="form-control"
              accept="image/*"
              onChange={handleImageChange}
              id="imageUpload"
            />
            <small className="form-text text-muted">
              Upload an image for your article (max 5MB, JPG/PNG/GIF)
            </small>
          </div>
        ) : (
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-success">
                <i className="bi bi-check-circle me-2"></i>
                {selectedImage.name}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={handleRemoveImage}
              >
                Remove
              </button>
            </div>
            <div className="mt-2">
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Preview"
                className="img-thumbnail"
                style={{ maxWidth: '200px', maxHeight: '200px' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;