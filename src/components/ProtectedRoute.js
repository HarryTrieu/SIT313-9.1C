// src/components/ProtectedRoute.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginSignup from './LoginSignup';
import { Alert, Button } from 'react-bootstrap';

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  if (!currentUser) {
    return (
      <>
        <div className="container mt-4">
          <div className="row justify-content-center">
            <div className="col-md-6">
              <Alert variant="info" className="text-center">
                <Alert.Heading>
                  <i className="bi bi-shield-lock display-1 mb-3"></i>
                </Alert.Heading>
                <h4>Authentication Required</h4>
                <p>
                  You need to be logged in to access this page. 
                  Please sign in or create an account to continue.
                </p>
                <hr />
                <div className="d-grid gap-2">
                  <Button 
                    variant="primary" 
                    size="lg"
                    onClick={() => setShowAuth(true)}
                  >
                    <i className="bi bi-person me-2"></i>
                    Login / Sign Up
                  </Button>
                </div>
              </Alert>
            </div>
          </div>
        </div>

        <LoginSignup 
          show={showAuth} 
          onHide={() => setShowAuth(false)} 
        />
      </>
    );
  }

  return children;
};

export default ProtectedRoute;