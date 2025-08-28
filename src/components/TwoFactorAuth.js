import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, Button, Form, Alert, Modal, Row, Col, Badge } from 'react-bootstrap';
import { generateRandomBase32, otpauthURL, verifyTOTP } from '../utils/totp';
import { QRCodeCanvas } from 'qrcode.react';
import logger from '../utils/logger';
import { hashString } from '../utils/crypto';

const TwoFactorAuth = () => {
  const { currentUser, userProfile, enableTwoFactor, disableTwoFactor } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [secretKey, setSecretKey] = useState('');
  const [otpAuthUrl, setOtpAuthUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
    // QR canvas ref removed — we no longer provide open/download QR fallbacks

  useEffect(() => {
    if (userProfile) {
      setTwoFactorEnabled(Boolean(userProfile.twoFactorEnabled));
    }
  }, [userProfile]);

  const generateBackupCodes = () => {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  };

  const startSetup = () => {
    setError('');
    setSuccess('');
    const secret = (userProfile && userProfile.twoFactorSecret) || generateRandomBase32(16);
    const otp = otpauthURL({ secret, label: currentUser?.email || 'user', issuer: 'DEV@Deakin' });
    setSecretKey(secret);
    setOtpAuthUrl(otp);
    setBackupCodes(generateBackupCodes());
    setShowSetupModal(true);
  };

  const handleVerifyAndEnable = async (e) => {
    e?.preventDefault();
    setError('');
    setSuccess('');
    if (!/^[0-9]{6}$/.test(verificationCode)) {
      setError('Please enter the 6-digit code from your authenticator app');
      return;
    }

    setLoading(true);
    try {
      const ok = await verifyTOTP(secretKey, verificationCode);
      if (!ok) {
        setError('Invalid authentication code. Please try again.');
        setLoading(false);
        return;
      }

      await enableTwoFactor(currentUser.uid, secretKey);

      try {
        const hashed = await Promise.all(backupCodes.map(c => hashString(c)));
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { backupCodes: hashed, twoFactorEnabledAt: new Date() });
      } catch (innerErr) {
        logger.error('Failed to persist backup codes:', innerErr);
      }

      setTwoFactorEnabled(true);
      setShowVerifyModal(false);
      setShowSetupModal(false);
      setSuccess('Two-factor authentication has been enabled. Save your backup codes somewhere safe.');
      setVerificationCode('');
    } catch (err) {
      logger.error('Error enabling 2FA:', err);
      setError('Failed to enable 2FA: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm('Disable two-factor authentication? This cannot be undone without re-enrolling.')) return;
    setLoading(true);
    setError('');
    try {
      await disableTwoFactor(currentUser.uid);
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { backupCodes: [] });
      setTwoFactorEnabled(false);
      setSuccess('Two-factor authentication disabled');
    } catch (err) {
      logger.error('Failed to disable 2FA:', err);
      setError('Failed to disable 2FA: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const regenerateBackupCodes = async () => {
    setLoading(true);
    setError('');
    try {
      const codes = generateBackupCodes();
      const hashed = await Promise.all(codes.map(c => hashString(c)));
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { backupCodes: hashed });
      setBackupCodes(codes);
      setSuccess('New backup codes generated');
    } catch (err) {
      logger.error('Failed to regenerate backup codes:', err);
      setError('Failed to generate new backup codes: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    try {
      if (!backupCodes || backupCodes.length === 0) {
        setError('No backup codes available to download');
        return;
      }
      const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'backup-codes.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Failed to download backup codes:', err);
      setError('Failed to download backup codes');
    }
  };

  // download/open QR functions removed

  return (
    <div className="container mt-4">
      <Row className="justify-content-center">
        <Col md={8}>
          <Card>
            <Card.Header>
              <h4 className="mb-0">
                <i className="bi bi-shield-lock me-2" />
                Two-Factor Authentication
              </h4>
            </Card.Header>
            <Card.Body>
              {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
              {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h5>Two-Factor Authentication Status</h5>
                  <p className="text-muted mb-0">Add an extra layer of security to your account by requiring a verification code from your mobile device.</p>
                </div>
                <Badge bg={twoFactorEnabled ? 'success' : 'warning'} className="p-2">
                  <i className={`bi ${twoFactorEnabled ? 'bi-shield-check' : 'bi-shield-exclamation'} me-1`} />
                  {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>

              {!twoFactorEnabled ? (
                <div className="text-center">
                  <div className="mb-4">
                    <i className="bi bi-phone display-1 text-muted mb-3" />
                    <h6>Secure Your Account</h6>
                    <p className="text-muted">Enable 2FA to protect your account with an authenticator app (Google Authenticator, Authy, etc.).</p>
                  </div>
                  <Button variant="primary" size="lg" onClick={startSetup} disabled={loading}>{loading ? 'Working...' : 'Enable Two-Factor Authentication'}</Button>
                </div>
              ) : (
                <div>
                  <Alert variant="success">
                    <Alert.Heading><i className="bi bi-shield-check me-2" />Two-Factor Authentication is Active</Alert.Heading>
                    Your account requires a verification code from your authenticator app to sign in.
                  </Alert>
                  <div className="d-grid gap-2">
                    <Button variant="outline-primary" onClick={regenerateBackupCodes} disabled={loading}><i className="bi bi-arrow-clockwise me-2" />Generate New Backup Codes</Button>
                    <Button variant="outline-danger" onClick={handleDisable} disabled={loading}><i className="bi bi-shield-x me-2" />Disable Two-Factor Authentication</Button>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Setup Modal */}
      <Modal show={showSetupModal} onHide={() => setShowSetupModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Setup Two-Factor Authentication</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Row>
              <Col md={6} className="text-center">
              <h6>1. Scan QR Code</h6>
              <p className="text-muted small">Open your authenticator app and use its "Scan QR code" feature, or scan this QR from another device.</p>
              {otpAuthUrl && (
                  <div className="mb-3">
                    <QRCodeCanvas value={otpAuthUrl} size={200} />
                  </div>
              )}
              <div className="d-flex justify-content-center gap-2 mb-2">
                <Button size="sm" onClick={() => navigator.clipboard && navigator.clipboard.writeText(secretKey)}>Copy secret</Button>
                {/* copy otpauth URL / download / open removed per request */}
              </div>
              <p className="text-muted small mt-2">If your phone camera opens a browser when scanning, open your authenticator app and use its internal scanner or enter the secret manually.</p>
            </Col>
            <Col md={6}>
              <h6>2. Manual Entry</h6>
              <p className="text-muted small">Or enter this code manually in your authenticator app:</p>
              <Form.Control type="text" value={secretKey} readOnly className="mb-3 font-monospace" />

              <h6>3. Backup Codes</h6>
              <p className="text-muted small">Save these backup codes in a safe place. Use them if you lose access to your authenticator app.</p>
              <div className="bg-light p-3 rounded mb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {backupCodes.map((c, i) => <div key={i} className="font-monospace small">{c}</div>)}
              </div>
              <div className="d-flex gap-2 mb-2">
                <Button size="sm" onClick={downloadBackupCodes}>Download backup codes</Button>
              </div>
              <Alert variant="warning" className="small"><i className="bi bi-exclamation-triangle me-2" />Keep these codes secure and don't share them.</Alert>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSetupModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => { setShowSetupModal(false); setShowVerifyModal(true); }}>Continue to Verification</Button>
        </Modal.Footer>
      </Modal>

      {/* Verification Modal */}
      <Modal show={showVerifyModal} onHide={() => setShowVerifyModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Verify Authentication Code</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleVerifyAndEnable}>
            <Form.Group className="mb-3">
              <Form.Label>Verification Code</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter 6-digit code from your authenticator app"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center font-monospace"
                style={{ fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                required
              />
              <Form.Text className="text-muted">Enter the 6-digit code from your authenticator app to complete setup</Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowVerifyModal(false)}>Cancel</Button>
          <Button type="submit" variant="success" onClick={handleVerifyAndEnable} disabled={loading || verificationCode.length !== 6}>{loading ? 'Verifying...' : 'Verify & Enable 2FA'}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TwoFactorAuth;
