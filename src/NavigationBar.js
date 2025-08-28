// src/NavigationBar.js
import React, { useState } from 'react';
import { Navbar, Container, Nav, Button, Dropdown } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useAuth } from './contexts/AuthContext';
import logger from './utils/logger';
import LoginSignup from './components/LoginSignup';

const NavigationBar = () => {
  const [showAuth, setShowAuth] = useState(false);
  const { currentUser, userProfile, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
    logger.error('Error logging out:', error);
    }
  };

  const getUserDisplayName = () => {
    if (userProfile?.displayName) return userProfile.displayName;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    return 'User';
  };

  return (
    <>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <LinkContainer to="/">
            <Navbar.Brand>DEV@Deakin</Navbar.Brand>
          </LinkContainer>
          
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <LinkContainer to="/">
                <Nav.Link className="mx-3">Home</Nav.Link>
              </LinkContainer>
              <LinkContainer to="/find-question">
                <Nav.Link className="mx-3">Find Question</Nav.Link>
              </LinkContainer>
              
                <LinkContainer to="/post">
                  <Nav.Link className="mx-3">Post</Nav.Link>
                </LinkContainer>
            
            </Nav>
            
            <Nav className="ms-auto">
              {currentUser ? (
                <Dropdown align="end">
                  <Dropdown.Toggle variant="outline-light" id="user-dropdown">
                    <i className="bi bi-person-circle me-2"></i>
                    {getUserDisplayName()}
                  </Dropdown.Toggle>
                  
                  <Dropdown.Menu>
                    <LinkContainer to="/profile">
                      <Dropdown.Item>
                        <i className="bi bi-person me-2"></i>
                        My Profile
                      </Dropdown.Item>
                    </LinkContainer>
                    <LinkContainer to="/messages">
                      <Dropdown.Item>
                        <i className="bi bi-chat-dots me-2"></i>
                        Messages
                      </Dropdown.Item>
                    </LinkContainer>
                    <LinkContainer to="/settings">
                      <Dropdown.Item>
                        <i className="bi bi-gear me-2"></i>
                        Settings
                      </Dropdown.Item>
                    </LinkContainer>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={handleLogout}>
                      <i className="bi bi-box-arrow-right me-2"></i>
                      Logout
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : (
                <Button 
                  variant="outline-light" 
                  onClick={() => setShowAuth(true)}
                >
                  <i className="bi bi-person me-2"></i>
                  Login / Sign Up
                </Button>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <LoginSignup 
        show={showAuth} 
        onHide={() => setShowAuth(false)} 
      />
    </>
  );
};

export default NavigationBar;