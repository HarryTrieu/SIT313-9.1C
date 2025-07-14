import React, { useState } from 'react';
import PostTypeSelector from './PostTypeSelector';
import QuestionForm from './QuestionForm';
import ArticleForm from './ArticleForm';

const NewPostPage = () => {
  const [postType, setPostType] = useState('question');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    abstract: '',
    articleText: '',
    tags: ''
  });

  //after switching post type, reset form data
  const handleTypeChange = (type) => {
    setPostType(type);
    setFormData({
      title: '',
      description: '',
      abstract: '',
      articleText: '',
      tags: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePost = () => {
    console.log('Post data:', { type: postType, ...formData });
    alert(`${postType.charAt(0).toUpperCase() + postType.slice(1)} will be posted! (Functionality to be implemented in future tasks)`);
  };

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="mb-4">
            <h2 className="text-left mb-4">New Post</h2>
            
            <PostTypeSelector 
              selectedType={postType} 
              onTypeChange={handleTypeChange} 
            />
            
            {postType === 'question' ? (
              <QuestionForm 
                formData={formData} 
                onInputChange={handleInputChange} 
              />
            ) : (
              <ArticleForm 
                formData={formData} 
                onInputChange={handleInputChange} 
              />
            )}
            
            <div className="text-center mt-4">
              <button 
                type="button" 
                className="btn btn-primary btn-lg"
                onClick={handlePost}
              >
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewPostPage;