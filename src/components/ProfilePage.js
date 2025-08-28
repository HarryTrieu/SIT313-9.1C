// src/components/ProfilePage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import logger from '../utils/logger';
import { db } from '../firebase';
import { Card, Row, Col, Badge, Button, Tab, Tabs, Form, InputGroup, Alert } from 'react-bootstrap';
import TwoFactorAuth from './TwoFactorAuth';

const ProfilePage = () => {
  const { currentUser, userProfile, pendingTwoFactor, pendingTwoFactorUid, verifyTwoFactorCode, clearPendingTwoFactor } = useAuth();
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPosts: 0,
    questions: 0,
    articles: 0
  });
  // TwoFactorAuth is rendered inline; no modal state required here

  useEffect(() => {
    if (!currentUser) {
      // No authenticated user — avoid leaving the profile spinner active
      setLoading(false);
      return;
    }

    // Fetch user's posts
    const q = query(
      collection(db, 'posts'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    let cancelled = false;
    // safety timer: if snapshot doesn't respond in 4s, clear loading so UI doesn't hang
    const loadTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4000);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (cancelled) return;
      clearTimeout(loadTimer);
      const posts = [];
      let questionCount = 0;
      let articleCount = 0;

      querySnapshot.forEach((doc) => {
        const postData = { id: doc.id, ...doc.data() };
        posts.push(postData);
        
        if (postData.type === 'question') questionCount++;
        else if (postData.type === 'article') articleCount++;
      });

      setUserPosts(posts);
      setStats({
        totalPosts: posts.length,
        questions: questionCount,
        articles: articleCount
      });
      setLoading(false);
    }, (err) => {
      // onSnapshot error: stop spinner and surface nothing
      logger.error('Profile posts listener error:', err);
      clearTimeout(loadTimer);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(loadTimer);
      try { unsubscribe(); } catch (e) {}
    };
  }, [currentUser]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getUserDisplayName = () => {
    if (userProfile?.displayName) return userProfile.displayName;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    return 'User';
  };

  const renderPost = (post) => (
    <Card key={post.id} className="mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h6 className="card-title mb-1">
            <Badge bg={post.type === 'question' ? 'primary' : 'success'} className="me-2">
              {post.type.toUpperCase()}
            </Badge>
            {post.title}
          </h6>
          <small className="text-muted">{formatDate(post.createdAt)}</small>
        </div>
        
        <p className="card-text text-muted mb-2">
          {post.type === 'question' ? post.description : post.abstract}
        </p>
        
        {post.tags && post.tags.length > 0 && (
          <div>
            {post.tags.map((tag, index) => (
              <Badge key={index} bg="secondary" className="me-1">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );

  if (loading) {
    return (
      <div className="container mt-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading profile...</span>
          </div>
        </div>
      </div>
    );
  }
  // If this user must complete 2FA, show a lock screen instead of profile
  const isBlockedBy2FA = Boolean(pendingTwoFactor && currentUser && pendingTwoFactorUid === currentUser.uid);
  if (isBlockedBy2FA) {
    return (
      <div className="container mt-4">
        <Row className="justify-content-center">
          <Col md={6}>
            <Card className="text-center">
              <Card.Body>
                <h4><i className="bi bi-shield-lock me-2" />Two-Factor Verification Required</h4>
                <p className="text-muted">For your security, please enter the 6-digit code from your authenticator app to access your profile.</p>
                {verifyError && <Alert variant="danger">{verifyError}</Alert>}
                <InputGroup className="mb-3 justify-content-center" style={{ maxWidth: '260px', margin: '0 auto' }}>
                  <Form.Control
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/[^0-9]/g, '').slice(0,6))}
                    placeholder="Enter 6-digit code"
                    className="text-center font-monospace"
                    style={{ fontSize: '1.25rem', letterSpacing: '0.35rem' }}
                  />
                </InputGroup>
                <div className="d-grid gap-2">
                  <Button variant="primary" disabled={verifyLoading || verifyCode.length !== 6} onClick={async () => {
                    setVerifyError('');
                    setVerifyLoading(true);
                    try {
                      const ok = await verifyTwoFactorCode(currentUser.uid, verifyCode);
                      if (!ok) {
                        setVerifyError('Invalid code. Please try again.');
                        setVerifyLoading(false);
                        return;
                      }
                      // success — ensure pending cleared (verifyTwoFactorCode clears it) and reload
                      try { clearPendingTwoFactor(); } catch (e) {}
                    } catch (err) {
                      setVerifyError('Verification failed: ' + (err?.message || err));
                    } finally {
                      setVerifyLoading(false);
                    }
                  }}>{verifyLoading ? 'Verifying...' : 'Verify & Continue'}</Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <>
    <div className="container mt-4">
      <Row>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body className="text-center">
              <div className="mb-3">
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Profile"
                    className="rounded-circle"
                    style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                  />
                ) : (
                  <div 
                    className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white"
                    style={{ width: '100px', height: '100px', margin: '0 auto' }}
                  >
                    <i className="bi bi-person" style={{ fontSize: '3rem' }}></i>
                  </div>
                )}
              </div>
              
              <h4 className="mb-2">{getUserDisplayName()}</h4>
              <p className="text-muted mb-3">{currentUser?.email}</p>
              
              <div className="mb-3">
                <small className="text-muted">
                  Member since {formatDate(userProfile?.createdAt)}
                </small>
              </div>

              <Button variant="outline-primary" size="sm">
                <i className="bi bi-pencil me-2"></i>
                Edit Profile
              </Button>
              <div className="mb-3">
                {/* Render TwoFactorAuth inline for a single unified UI */}
                <TwoFactorAuth />
              </div>
            </Card.Body>
          </Card>

          {/* Stats Card */}
          <Card>
            <Card.Header>
              <h6 className="mb-0">Activity Stats</h6>
            </Card.Header>
            <Card.Body>
              <div className="row text-center">
                <div className="col-4">
                  <div className="h4 text-primary mb-0">{stats.totalPosts}</div>
                  <small className="text-muted">Total Posts</small>
                </div>
                <div className="col-4">
                  <div className="h4 text-info mb-0">{stats.questions}</div>
                  <small className="text-muted">Questions</small>
                </div>
                <div className="col-4">
                  <div className="h4 text-success mb-0">{stats.articles}</div>
                  <small className="text-muted">Articles</small>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">My Posts</h5>
            </Card.Header>
            <Card.Body>
              {userPosts.length === 0 ? (
                <div className="text-center py-4">
                  <i className="bi bi-journal-x display-1 text-muted mb-3"></i>
                  <h6 className="text-muted">No posts yet</h6>
                  <p className="text-muted">Start by creating your first post!</p>
                  <Button variant="primary" href="/post">
                    <i className="bi bi-plus-circle me-2"></i>
                    Create Post
                  </Button>
                </div>
              ) : (
                <Tabs defaultActiveKey="all" className="mb-3">
                  <Tab eventKey="all" title={`All (${stats.totalPosts})`}>
                    {userPosts.map(renderPost)}
                  </Tab>
                  <Tab eventKey="questions" title={`Questions (${stats.questions})`}>
                    {userPosts.filter(post => post.type === 'question').map(renderPost)}
                  </Tab>
                  <Tab eventKey="articles" title={`Articles (${stats.articles})`}>
                    {userPosts.filter(post => post.type === 'article').map(renderPost)}
                  </Tab>
                </Tabs>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
  </div>
  {/* Legacy modal removed — TwoFactorAuth is rendered inline above */}
    </>
  );
};

export default ProfilePage;