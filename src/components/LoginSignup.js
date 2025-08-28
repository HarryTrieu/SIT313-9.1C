
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Modal, Button, Form, Alert, Tabs, Tab } from 'react-bootstrap';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

const LoginSignup = ({ show, onHide }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  });
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { login, signup, signInWithGoogle, resetPassword, error, verifyTwoFactorCode, requireTwoFactor, clearPendingTwoFactor, pendingTwoFactor } = useAuth();
  const [show2FAVerify, setShow2FAVerify] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [pendingUid, setPendingUid] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setLocalError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setLocalError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setLocalError('');
      const user = await login(formData.email, formData.password);
      // After successful password login, check if user has 2FA enabled
      const current = auth.currentUser || user;
      if (!current) {
        // fallback: show verify input
        setShow2FAVerify(true);
        return;
      }
      const userRef = doc(db, 'users', current.uid);
      const snap = await getDoc(userRef);
      const needs2FA = snap.exists() && snap.data().twoFactorEnabled;
      if (needs2FA) {
        setPendingUid(current.uid);
        requireTwoFactor(current.uid);
        setShow2FAVerify(true);
      } else {
        // no 2FA required — finish login
        onHide();
      }
    } catch (error) {
      setLocalError('Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFACode.trim()) return;
    try {
      setLoading(true);
      // Use pendingUid if set, otherwise fallback to current authenticated user
      const uid = pendingUid || (auth.currentUser && auth.currentUser.uid);
      if (!uid) throw new Error('No authenticated user for 2FA verification');
      const ok = await verifyTwoFactorCode(uid, twoFACode.trim());
      if (!ok) {
        setLocalError('Invalid 2FA code');
        return;
      }
      // success — clear pending and close modal
      try { clearPendingTwoFactor(); } catch (e) {}
      onHide();
      setFormData({ email: '', password: '', confirmPassword: '', displayName: '' });
      setPendingUid(null);
    } catch (err) {
      setLocalError('2FA verification failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.displayName) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      setLocalError('');
      await signup(formData.email, formData.password, formData.displayName);
      setSuccessMessage('Account created successfully! Welcome to DEV@Deakin!');
      setTimeout(() => {
        onHide();
        setFormData({ email: '', password: '', confirmPassword: '', displayName: '' });
        setSuccessMessage('');
      }, 2000);
    } catch (error) {
      setLocalError('Failed to create account. Email may already be in use.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setLocalError('');
      const user = await signInWithGoogle();
      // After Google sign-in, check if the user requires 2FA and prompt if so
      const current = auth.currentUser || user;
      if (current) {
        const userRef = doc(db, 'users', current.uid);
        const snap = await getDoc(userRef);
        const needs2FA = snap.exists() && snap.data().twoFactorEnabled;
        if (needs2FA) {
          setPendingUid(current.uid);
          requireTwoFactor(current.uid);
          setShow2FAVerify(true);
          return;
        }
      }
      // no 2FA required — finish login
      onHide();
    } catch (error) {
      setLocalError('Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setLocalError('Please enter your email address first');
      return;
    }

    try {
      setLoading(true);
      setLocalError('');
      await resetPassword(formData.email);
      setSuccessMessage('Password reset email sent! Check your inbox.');
    } catch (error) {
      setLocalError('Failed to send reset email. Please check your email address.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ email: '', password: '', confirmPassword: '', displayName: '' });
    setLocalError('');
    setSuccessMessage('');
  };

  const handleTabSelect = (tab) => {
    setActiveTab(tab);
    resetForm();
  };

  const currentError = localError || error;

  // When there's a pending 2FA requirement, make the modal static (non-closable)
  const modalBackdrop = pendingTwoFactor ? 'static' : undefined;
  const modalKeyboard = !pendingTwoFactor;
  const showClose = !pendingTwoFactor;

  return (
    <Modal show={show} centered backdrop={modalBackdrop} keyboard={modalKeyboard} onHide={pendingTwoFactor ? undefined : onHide}>
      <Modal.Header closeButton={showClose}>
        <Modal.Title>Welcome to DEV@Deakin</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {currentError && (
          <Alert variant="danger" className="mb-3">
            {currentError}
          </Alert>
        )}
        
        {successMessage && (
          <Alert variant="success" className="mb-3">
            {successMessage}
          </Alert>
        )}

        <Tabs
          activeKey={activeTab}
          onSelect={handleTabSelect}
          className="mb-3"
          fill
        >
          <Tab eventKey="login" title="Sign In">
            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                />
              </Form.Group>

              <div className="d-grid gap-2">
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={loading}
                  size="lg"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </Button>
                
                <Button 
                  variant="outline-primary" 
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <i className="bi bi-google me-2"></i>
                  Sign In with Google
                </Button>

                <Button
                  variant="link"
                  size="sm"
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Forgot Password?
                </Button>
              </div>
              {show2FAVerify && (
                <div className="mt-3">
                  <Form.Group className="mb-2">
                    <Form.Label>Two-Factor Code</Form.Label>
                    <Form.Control value={twoFACode} onChange={(e) => setTwoFACode(e.target.value)} />
                  </Form.Group>
                  <div className="d-grid gap-2">
                    <Button onClick={handleVerify2FA} disabled={loading}>Verify 2FA</Button>
                  </div>
                </div>
              )}
            </Form>
          </Tab>

          <Tab eventKey="signup" title="Sign Up">
            <Form onSubmit={handleSignup}>
              <Form.Group className="mb-3">
                <Form.Label>Display Name</Form.Label>
                <Form.Control
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  placeholder="Enter your display name"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password (min 6 characters)"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Confirm Password</Form.Label>
                <Form.Control
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  required
                />
              </Form.Group>

              <div className="d-grid gap-2">
                <Button 
                  type="submit" 
                  variant="success" 
                  disabled={loading}
                  size="lg"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
                
                <Button 
                  variant="outline-primary" 
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <i className="bi bi-google me-2"></i>
                  Sign Up with Google
                </Button>
              </div>
            </Form>
          </Tab>
        </Tabs>
      </Modal.Body>
    </Modal>
  );
};

export default LoginSignup;