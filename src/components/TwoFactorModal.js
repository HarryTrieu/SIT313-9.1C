import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { generateRandomBase32, otpauthURL, verifyTOTP } from '../utils/totp';
import { QRCodeCanvas } from 'qrcode.react';

const TwoFactorModal = ({ show, onHide, userProfile, saveSecret }) => {
  const [secret, setSecret] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('show'); // show, verify, done
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setError('');
      setOtp('');
      // if userProfile has secret use it otherwise generate
      if (userProfile && userProfile.twoFactorSecret) {
        setSecret(userProfile.twoFactorSecret);
      } else {
        setSecret(generateRandomBase32(16));
      }
    }
  }, [show, userProfile]);

  const handleVerify = async () => {
    setError('');
    try {
      const ok = await verifyTOTP(secret, otp);
      if (!ok) throw new Error('Invalid code');
      // user verified - persist via callback
      await saveSecret(secret);
      setStep('done');
    } catch (err) {
      setError('Invalid authentication code. Please try again.');
    }
  };

  const otpAuth = otpauthURL({ secret, label: userProfile?.email || 'user', issuer: 'DEV@Deakin' });

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Two-Factor Authentication</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        {step === 'show' && (
          <div>
            <p>Scan the QR code with your authenticator app (open the authenticator app and use its "Scan QR code" feature), or enter the secret manually.</p>
            <div className="text-center mb-3">
              <QRCodeCanvas value={otpAuth} />
            </div>
            <p className="text-monospace">Secret: {secret}</p>
            <div className="d-flex gap-2 mt-2">
              <Button size="sm" onClick={() => navigator.clipboard && navigator.clipboard.writeText(secret)}>Copy secret</Button>
              <Button size="sm" onClick={() => navigator.clipboard && navigator.clipboard.writeText(otpAuth)}>Copy otpauth URL</Button>
            </div>
            <p className="text-muted small mt-2">If your phone camera shows a link and opens a browser ("This page doesn't exist"), that means the camera can't open the otpauth scheme—open your authenticator app and scan the QR from inside the app, or copy the secret into the app manually.</p>
            <div className="d-grid gap-2 mt-3">
              <Button onClick={() => setStep('verify')}>I have scanned the code</Button>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div>
            <Form.Group className="mb-3">
              <Form.Label>Enter the 6-digit code from your authenticator app</Form.Label>
              <Form.Control value={otp} onChange={(e) => setOtp(e.target.value)} />
            </Form.Group>
            <div className="d-grid gap-2">
              <Button onClick={handleVerify}>Verify & Enable 2FA</Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div>
            <Alert variant="success">Two-Factor Authentication enabled on your account.</Alert>
            <div className="d-grid gap-2 mt-3">
              <Button onClick={onHide}>Close</Button>
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default TwoFactorModal;
