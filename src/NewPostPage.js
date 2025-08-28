// src/NewPostPage.js
import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import PostTypeSelector from './PostTypeSelector';
import QuestionForm from './QuestionForm';
import ArticleForm from './ArticleForm';
import ImageUpload from './ImageUpload';

const NewPostPage = () => {
  const { currentUser, userProfile } = useAuth();
  const [postType, setPostType] = useState('question');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    abstract: '',
    articleText: '',
    tags: ''
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleTypeChange = (type) => {
    setPostType(type);
    setFormData({
      title: '',
      description: '',
      abstract: '',
      articleText: '',
      tags: ''
    });
    setSelectedImage(null);
    setErrorMessage('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageSelect = (image) => {
    setSelectedImage(image);
    setErrorMessage('');
  };

  const uploadImage = async (image) => {
    if (!image) {
      return null;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/gif'];
    if (!validTypes.includes(image.type)) {
      setErrorMessage('Please use a PNG, JPG, or GIF image.');
      return null;
    }

    if (image.size > 700 * 1024) {
      setErrorMessage('Image size must be less than 700KB.');
      return null;
    }

    try {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = () => {
          resolve(reader.result);
        };
        reader.onerror = () => {
          reject(new Error('Failed to convert image to base64'));
        };
        reader.readAsDataURL(image);
      });
    } catch (error) {
      setErrorMessage('Image processing failed, but post will be saved without an image.');
      throw error;
    }
  };

  const getUserDisplayName = () => {
    if (userProfile?.displayName) return userProfile.displayName;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    return 'Anonymous User';
  };

  const handlePost = async () => {
    if (!formData.title.trim()) {
      setErrorMessage('Please enter a title');
      return;
    }

    if (postType === 'question' && !formData.description.trim()) {
      setErrorMessage('Please enter a description for your question');
      return;
    }

    if (postType === 'article' && !formData.articleText.trim()) {
      setErrorMessage('Please enter article content');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      let imageUrl = null;

      if (selectedImage && postType === 'article') {
        imageUrl = await uploadImage(selectedImage);
      }

      const postData = {
        type: postType,
        title: formData.title,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        createdAt: serverTimestamp(),
        imageUrl: imageUrl || null,
        // User information
        userId: currentUser.uid,
        authorName: getUserDisplayName(),
        authorEmail: currentUser.email,
        authorPhoto: currentUser.photoURL || null,
        // Post metrics
        views: 0,
        likes: 0,
        comments: 0
      };

      if (postType === 'question') {
        postData.description = formData.description;
      } else {
        postData.abstract = formData.abstract;
        postData.articleText = formData.articleText;
      }

      const docRef = await addDoc(collection(db, 'posts'), postData);
      alert(`${postType.charAt(0).toUpperCase() + postType.slice(1)} posted successfully!`);
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        abstract: '',
        articleText: '',
        tags: ''
      });
      setSelectedImage(null);
    } catch (error) {
      setErrorMessage(`Error posting: ${error.message}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="mb-4">
            <div className="d-flex align-items-center mb-4">
              <h2 className="mb-0 me-3">New Post</h2>
              <div className="d-flex align-items-center text-muted">
                <i className="bi bi-person-circle me-2"></i>
                <span>Posting as: <strong>{getUserDisplayName()}</strong></span>
              </div>
            </div>
            
            {errorMessage && (
              <div className="alert alert-danger" role="alert">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {errorMessage}
              </div>
            )}

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
              <>
                <ImageUpload 
                  selectedImage={selectedImage}
                  onImageSelect={handleImageSelect}
                />
                <ArticleForm 
                  formData={formData} 
                  onInputChange={handleInputChange} 
                />
              </>
            )}
            
            <div className="text-center mt-4">
              <button 
                type="button" 
                className="btn btn-primary btn-lg px-4"
                onClick={handlePost}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Posting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send me-2"></i>
                    Post {postType.charAt(0).toUpperCase() + postType.slice(1)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewPostPage;