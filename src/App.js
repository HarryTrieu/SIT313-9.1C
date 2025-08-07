import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavigationBar from './NavigationBar';
import NewPostPage from './NewPostPage';
import FindQuestionPage from './FindQuestionPage';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// Add Bootstrap Icons
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css';
document.head.appendChild(link);

function App() {
  return (
    <Router>
      <div className="App">
        <NavigationBar />
        <Routes>
          <Route path="/" element={<div className="container mt-4"><h1>Welcome to DEV@Deakin</h1><p>Use the navigation bar to create posts or find questions.</p></div>} />
          <Route path="/post" element={<NewPostPage />} />
          <Route path="/find-question" element={<FindQuestionPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;