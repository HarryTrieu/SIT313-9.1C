// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import NavigationBar from './NavigationBar';
import NewPostPage from './NewPostPage';
import FindQuestionPage from './FindQuestionPage';
import ProfilePage from './components/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import MessagingSystem from './components/MessagingSystem';

// Add Bootstrap Icons
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css';
document.head.appendChild(link);

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <NavigationBar />
          <Routes>
            <Route path="/" element={
              <div className="container mt-4">
                <div className="jumbotron bg-primary text-white p-5 rounded mb-4">
                  <h1 className="display-4">Welcome to DEV@Deakin</h1>
                  <p className="lead">
                    Connect with developers, ask questions, share knowledge, and collaborate on projects.
                  </p>
                  <hr className="my-4" style={{borderColor: 'rgba(255,255,255,0.3)'}} />
                  <p>Join our community of developers and start your journey today!</p>
                </div>
              </div>
            } />
            <Route path="/find-question" element={<FindQuestionPage />} />
            <Route path="/post" element={
              <ProtectedRoute>
                <NewPostPage />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/messages" element={
              <ProtectedRoute>
                <MessagingSystem />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <div className="container mt-4">
                  <h2>Settings</h2>
                  <p>Settings page coming soon...</p>
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;