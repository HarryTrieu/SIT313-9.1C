// src/components/MessagingSystem.js
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  where,
  serverTimestamp,
  doc,
  updateDoc,
  getDocs,
  deleteDoc,
  increment
  , arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase';
import { Card, Form, Button, ListGroup, Badge, Modal, Alert } from 'react-bootstrap';
import logger from '../utils/logger';
import { sendToChatGPT } from '../utils/chatgpt';

const MessagingSystem = () => {
  const { currentUser, userProfile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const messagesEndRef = useRef(null);
  const convoUnsubRef = useRef(null);
  const msgUnsubRef = useRef(null);
  const convoPollRef = useRef(null);
  const msgPollRef = useRef(null);
  const convoRetryRef = useRef(0);
  const msgRetryRef = useRef(0);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Delete conversation handler
  const handleDeleteConversation = async () => {
    if (!activeConversation) return;
    setShowDeleteModal(false);
    setLoading(true);
    setError('');
    const convoId = activeConversation.id;
    try {
      // Mark conversation as hidden for current user instead of deleting globally
      const conversationRef = doc(db, 'conversations', convoId);
      // Fetch latest version of the conversation doc to check other participants' hide state
      const convoData = activeConversation;

      // If other participants have already hidden this conversation, perform full delete
      const otherParticipantId = convoData.participants.find(p => p !== currentUser.uid);
      const otherHidden = convoData.hidden?.[otherParticipantId];

      if (otherHidden) {
        // Both sides hidden -> clean up completely
        const messagesSnap = await getDocs(query(collection(db, 'messages'), where('conversationId', '==', convoId)));
        const deletePromises = [];
        messagesSnap.forEach(m => deletePromises.push(deleteDoc(doc(db, 'messages', m.id))));
        await Promise.all(deletePromises);
        await deleteDoc(conversationRef);
      } else {
        // Soft-hide for current user
        await updateDoc(conversationRef, {
          [`hidden.${currentUser.uid}`]: true
        });
      }

      // Update local state to remove from this user's view
      setActiveConversation(null);
      setMessages([]);
      setConversations(prev => prev.filter(c => c.id !== convoId));
      setError(otherHidden ? 'Conversation fully deleted' : 'Conversation removed from your view');
    } catch (err) {
      logger.error('Failed to delete conversation:', err);
      setError('Failed to delete conversation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete single message handler (confirmed)
  const handleDeleteMessageConfirmed = async () => {
    if (!messageToDelete || !activeConversation) return;
    setShowDeleteMessageModal(false);
    setLoading(true);
    setError('');

    const msgId = messageToDelete.id;
    const convoId = activeConversation.id;
    try {
      // Delete the message doc
      await deleteDoc(doc(db, 'messages', msgId));

      // Recompute latest message for the conversation without requiring a composite index
      const allMessagesSnap = await getDocs(query(collection(db, 'messages'), where('conversationId', '==', convoId)));
      let latestMessage = null;
      allMessagesSnap.forEach(d => {
        const data = d.data();
        if (!data) return;
        const created = data.createdAt;
        const t = created && created.toDate ? created.toDate().getTime() : (created ? new Date(created).getTime() : 0);
        if (!latestMessage || t > latestMessage.time) {
          latestMessage = { time: t, text: data.text || '' };
        }
      });

      const conversationRef = doc(db, 'conversations', convoId);
      if (!latestMessage) {
        await updateDoc(conversationRef, {
          lastMessage: '',
          lastMessageAt: serverTimestamp()
        });
      } else {
        await updateDoc(conversationRef, {
          lastMessage: latestMessage.text,
          lastMessageAt: serverTimestamp()
        });
      }

      // Update local state quickly
      setMessages(prev => prev.filter(m => m.id !== msgId));
      // if removed message was last in UI, the conversation listener will pick up updated lastMessage
      setMessageToDelete(null);
    } catch (err) {
      logger.error('Failed to delete message:', err);
      setError('Failed to delete message: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mark messages as read for the current user and clear unreadCount
  const markMessagesAsRead = React.useCallback(async (convoId, msgs) => {
    if (!currentUser || !convoId || !Array.isArray(msgs)) return;
    try {
      const toUpdate = msgs.filter(m => !(m.readBy || []).includes(currentUser.uid));
      if (toUpdate.length === 0) {
        // still clear unreadCount if necessary
        await updateDoc(doc(db, 'conversations', convoId), { [`unreadCount.${currentUser.uid}`]: 0 });
        return;
      }

      const updatePromises = toUpdate.map(m => updateDoc(doc(db, 'messages', m.id), { readBy: arrayUnion(currentUser.uid) }));
      await Promise.all(updatePromises);

      // Clear unread counter on conversation for this user
      await updateDoc(doc(db, 'conversations', convoId), { [`unreadCount.${currentUser.uid}`]: 0 });
    } catch (err) {
      logger.error('Failed to mark messages read:', err);
    }
  }, [currentUser]);

  // Load user's conversations
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessageAt', 'desc')
    );

    // Start a listener with retry/backoff on error
    const startConvoListener = () => {
      // cleanup existing
      // stop any existing watch
      if (convoUnsubRef.current) {
        try { convoUnsubRef.current(); } catch (e) {}
        convoUnsubRef.current = null;
      }
      // stop polling if active
      if (convoPollRef.current) { clearInterval(convoPollRef.current); convoPollRef.current = null; }

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        convoRetryRef.current = 0; // reset retry counter on success
        const convos = [];
        querySnapshot.forEach((doc) => {
          convos.push({ id: doc.id, ...doc.data() });
        });
        setConversations(convos);
      }, (err) => {
        console.error('Firestore conversations listener error:', err);
        setError('Realtime update error (conversations): ' + err.message);
        // schedule retry with exponential backoff
        convoUnsubRef.current = null;
        convoRetryRef.current = (convoRetryRef.current || 0) + 1;
        const delay = Math.min(2000 * convoRetryRef.current, 30000);

        // If this is an INTERNAL ASSERTION from Firestore watch, fall back to polling to avoid crashing
        try {
          const msg = err && err.message ? String(err.message) : '';
          if (msg.includes('INTERNAL ASSERTION')) {
            logger.warn('Switching conversations listener to polling mode due to Firestore internal assertion');
            // start polling every 3s
            if (!convoPollRef.current) {
              convoPollRef.current = setInterval(async () => {
                try {
                  const snap = await getDocs(q);
                  const convos = [];
                  snap.forEach(d => convos.push({ id: d.id, ...d.data() }));
                  setConversations(convos);
                } catch (e) {
                  logger.error('Polling conversations failed:', e);
                }
              }, 3000);
            }
            return; // don't schedule watch retry while polling
          }
        } catch (ex) {
          // ignore parsing errors and continue with retry
        }

        setTimeout(() => startConvoListener(), delay);
      });

      convoUnsubRef.current = unsubscribe;
    };

    startConvoListener();

    return () => {
      if (convoUnsubRef.current) {
        try { convoUnsubRef.current(); } catch (e) {}
        convoUnsubRef.current = null;
      }
  if (convoPollRef.current) { clearInterval(convoPollRef.current); convoPollRef.current = null; }
    };
  }, [currentUser]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversation) {
      // cleanup any previous message listener
      if (msgUnsubRef.current) { try { msgUnsubRef.current(); } catch (e) {} msgUnsubRef.current = null; }
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', activeConversation.id),
      orderBy('createdAt', 'asc')
    );

    const startMsgListener = () => {
  if (msgUnsubRef.current) { try { msgUnsubRef.current(); } catch (e) {} msgUnsubRef.current = null; }
  if (msgPollRef.current) { clearInterval(msgPollRef.current); msgPollRef.current = null; }

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        msgRetryRef.current = 0;
        const msgs = [];
        querySnapshot.forEach((doc) => {
          msgs.push({ id: doc.id, ...doc.data() });
        });
  setMessages(msgs);
  // mark as read for current user
  if (activeConversation) markMessagesAsRead(activeConversation.id, msgs);
      }, (err) => {
        console.error('Firestore messages listener error:', err);
        setError('Realtime update error (messages): ' + err.message);
        msgUnsubRef.current = null;
        msgRetryRef.current = (msgRetryRef.current || 0) + 1;
        const delay = Math.min(2000 * msgRetryRef.current, 30000);

        // If this is an INTERNAL ASSERTION from Firestore watch, fall back to polling for this conversation
        try {
          const msg = err && err.message ? String(err.message) : '';
          if (msg.includes('INTERNAL ASSERTION')) {
            logger.warn('Switching messages listener to polling mode due to Firestore internal assertion');
            if (!msgPollRef.current) {
              msgPollRef.current = setInterval(async () => {
                  try {
                    const snap = await getDocs(q);
                    const msgs = [];
                    snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
                    setMessages(msgs);
                    if (activeConversation) markMessagesAsRead(activeConversation.id, msgs);
                  } catch (e) {
                    logger.error('Polling messages failed:', e);
                  }
                }, 2000);
            }
            return; // don't schedule watch retry while polling
          }
        } catch (ex) {}

        setTimeout(() => startMsgListener(), delay);
      });

      msgUnsubRef.current = unsubscribe;
    };

    startMsgListener();

    return () => {
  if (msgUnsubRef.current) { try { msgUnsubRef.current(); } catch (e) {} msgUnsubRef.current = null; }
  if (msgPollRef.current) { clearInterval(msgPollRef.current); msgPollRef.current = null; }
    };
  }, [activeConversation, markMessagesAsRead]);

  // Start new conversation
  const startNewConversation = async (e) => {
    e.preventDefault();
    if (!newChatEmail.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Find user by email. Try exact match first, then lowercased email to handle case differences.
      const usersRef = collection(db, 'users');
      let q = query(usersRef, where('email', '==', newChatEmail));
      let querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        q = query(usersRef, where('email', '==', newChatEmail.toLowerCase()));
        querySnapshot = await getDocs(q);
      }
      
      if (querySnapshot.empty) {
        setError('User not found with this email address');
        setLoading(false);
        return;
      }

      const otherUser = querySnapshot.docs[0];
      const otherUserData = otherUser.data();

      // Check if conversation already exists
      const existingConvo = conversations.find(convo => 
        convo.participants.includes(otherUser.id)
      );

      if (existingConvo) {
        setActiveConversation(existingConvo);
        setShowNewChat(false);
        setNewChatEmail('');
        setLoading(false);
        return;
      }

      // Create new conversation
      const conversationData = {
        participants: [currentUser.uid, otherUser.id],
        participantNames: {
          [currentUser.uid]: userProfile?.displayName || currentUser.displayName || 'User',
          [otherUser.id]: otherUserData.displayName || 'User'
        },
        participantEmails: {
          [currentUser.uid]: currentUser.email,
          [otherUser.id]: otherUserData.email
        },
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        lastMessage: '',
        unreadCount: {
          [currentUser.uid]: 0,
          [otherUser.id]: 0
        }
      };

      const docRef = await addDoc(collection(db, 'conversations'), conversationData);
      setShowNewChat(false);
      setNewChatEmail('');
      
      // Set as active conversation
      setActiveConversation({ id: docRef.id, ...conversationData });
      
    } catch (error) {
      setError('Failed to start conversation: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      // Add message to Firestore
      const messageData = {
        conversationId: activeConversation.id,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || 'User',
        text: messageText,
        createdAt: serverTimestamp(),
        edited: false,
        readBy: [currentUser.uid]
      };

      await addDoc(collection(db, 'messages'), messageData);

      // If AI assistant is enabled for this conversation, request a reply
      try {
        const convoRef = doc(db, 'conversations', activeConversation.id);
        const convoSnap = activeConversation; // local copy
        const aiEnabled = convoSnap?.aiEnabled;
        if (aiEnabled) {
          // assemble a prompt and recent messages for context
          const recent = messages.slice(-10).map(m => ({ role: m.senderId === currentUser.uid ? 'user' : 'assistant', content: m.text }));
          // include the newly sent message as the last user message
          recent.push({ role: 'user', content: messageText });
          // call ChatGPT proxy
          sendToChatGPT(messageText, convoSnap, recent)
            .then(async (reply) => {
              if (!reply) return;
              const assistantMessage = {
                conversationId: activeConversation.id,
                senderId: 'assistant',
                senderName: 'Assistant',
                text: reply,
                createdAt: serverTimestamp(),
                edited: false,
                readBy: []
              };
              await addDoc(collection(db, 'messages'), assistantMessage);

              // increment unread for human recipient
              const otherId = getOtherParticipant();
              if (otherId) {
                await updateDoc(convoRef, { [`unreadCount.${otherId}`]: increment(1) });
              }
            })
            .catch(err => {
              logger.error('ChatGPT proxy error:', err);
            });
        }
      } catch (aiErr) {
        logger.error('AI assistant flow error:', aiErr);
      }

      // Update conversation's last message and increment unread count for the other participant (if found)
      const conversationRef = doc(db, 'conversations', activeConversation.id);
      const otherId = getOtherParticipant();
      const updateData = {
        lastMessage: messageText,
        lastMessageAt: serverTimestamp()
      };

      if (otherId) {
  updateData[`unreadCount.${otherId}`] = increment(1);
  // Also un-hide conversation for the recipient in case they had hidden it
  updateData[`hidden.${otherId}`] = false;
      }

      await updateDoc(conversationRef, updateData);

    } catch (error) {
      setError('Failed to send message: ' + error.message);
    }
  };

  // Get other participant in conversation
  const getOtherParticipant = () => {
    if (!activeConversation) return null;
    return activeConversation.participants.find(p => p !== currentUser.uid);
  };

  // Format message timestamp
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  return (
    <div className="container-fluid mt-4" style={{ height: '80vh' }}>
      <div className="row h-100">
        {/* Conversations Sidebar */}
        <div className="col-md-4 border-end">
          <Card className="h-100">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Messages</h5>
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => setShowNewChat(true)}
              >
                <i className="bi bi-plus-circle"></i>
              </Button>
              <div className="ms-2 d-flex align-items-center" />
            </Card.Header>
            <Card.Body className="p-0" style={{ overflowY: 'auto' }}>
              {conversations.length === 0 ? (
                <div className="text-center p-4">
                  <i className="bi bi-chat-dots display-1 text-muted mb-3"></i>
                  <p className="text-muted">No conversations yet</p>
                  <Button 
                    variant="outline-primary"
                    onClick={() => setShowNewChat(true)}
                  >
                    Start a conversation
                  </Button>
                </div>
              ) : (
                <ListGroup variant="flush">
                  {conversations.map((conversation) => {
                    const otherParticipantId = conversation.participants.find(p => p !== currentUser.uid);
                    const otherParticipantName = conversation.participantNames[otherParticipantId];
                    const unreadCount = conversation.unreadCount?.[currentUser.uid] || 0;
                    
                    return (
                      <ListGroup.Item
                        key={conversation.id}
                        action
                        active={activeConversation?.id === conversation.id}
                        onClick={() => setActiveConversation(conversation)}
                        className="d-flex justify-content-between align-items-start"
                      >
                        <div className="flex-grow-1">
                          <h6 className="mb-1">{otherParticipantName}</h6>
                          <p className="mb-1 text-muted small">
                            {conversation.lastMessage || 'No messages yet'}
                          </p>
                          <small className="text-muted">
                            {formatMessageTime(conversation.lastMessageAt)}
                          </small>
                        </div>
                        {unreadCount > 0 && (
                          <Badge bg="primary" pill>{unreadCount}</Badge>
                        )}
                      </ListGroup.Item>
                    );
                  })}
                </ListGroup>
              )}
            </Card.Body>
          </Card>
        </div>

        {/* Messages Area */}
        <div className="col-md-8">
          <Card className="h-100 d-flex flex-column">
            {activeConversation ? (
              <>
                {/* Chat Header */}
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-0">
                      <i className="bi bi-person-circle me-2"></i>
                      {activeConversation.participantNames?.[getOtherParticipant()]}
                    </h6>
                    <small className="text-muted">
                      {activeConversation.participantEmails?.[getOtherParticipant()]}
                    </small>
                  </div>

                  <div>
                      <Button
                        variant={activeConversation?.aiEnabled ? 'success' : 'outline-secondary'}
                        size="sm"
                        className="me-2"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const convoRef = doc(db, 'conversations', activeConversation.id);
                            const newVal = !activeConversation?.aiEnabled;
                            await updateDoc(convoRef, { aiEnabled: newVal });
                            // update local state copy
                            setActiveConversation(prev => ({ ...prev, aiEnabled: newVal }));
                            setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, aiEnabled: newVal } : c));
                          } catch (err) {
                            logger.error('Failed to toggle AI for conversation:', err);
                            setError('Failed to update AI setting: ' + (err?.message || err));
                          }
                        }}
                      >
                        <i className="bi bi-robot me-1"></i>
                        {activeConversation?.aiEnabled ? 'AI On' : 'AI Off'}
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => setShowDeleteModal(true)}
                        disabled={loading}
                      >
                        <i className="bi bi-trash me-1"></i>
                        Delete
                      </Button>
                  </div>
                </Card.Header>

                {/* Messages */}
                <Card.Body 
                  className="flex-grow-1 p-3" 
                  style={{ overflowY: 'auto', maxHeight: '60vh' }}
                >
                  {error && (
                    <Alert variant="danger" dismissible onClose={() => setError('')}>
                      {error}
                    </Alert>
                  )}
                  
                  {messages.length === 0 ? (
                    <div className="text-center text-muted">
                      <i className="bi bi-chat-square-text display-1 mb-3"></i>
                      <p>Start the conversation by sending a message!</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`d-flex mb-3 ${
                          message.senderId === currentUser.uid ? 'justify-content-end' : 'justify-content-start'
                        }`}
                      >
                        <div
                          className={`p-3 rounded-3 ${
                            message.senderId === currentUser.uid
                              ? 'bg-primary text-white'
                              : 'bg-light'
                          }`}
                          style={{ maxWidth: '70%' }}
                        >
                          {message.senderId !== currentUser.uid && (
                            <small className="fw-bold d-block mb-1">
                              {message.senderName}
                            </small>
                          )}
                          <div>{message.text}</div>
                          <div className="d-flex align-items-center justify-content-between mt-1">
                            <small 
                              className={`d-block ${
                                message.senderId === currentUser.uid ? 'text-white-50' : 'text-muted'
                              }`}
                            >
                              {formatMessageTime(message.createdAt)}
                              {message.edited && (
                                <span className="ms-1">(edited)</span>
                              )}
                            </small>
                            {message.senderId === currentUser.uid && (
                              <Button
                                variant={message.senderId === currentUser.uid ? 'link' : 'light'}
                                className={message.senderId === currentUser.uid ? 'text-white-50 p-0 ms-2' : 'p-0 ms-2'}
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setMessageToDelete(message); setShowDeleteMessageModal(true); }}
                                aria-label="Delete message"
                              >
                                <i className="bi bi-trash" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </Card.Body>

                {/* Message Input */}
                <Card.Footer>
                  <Form onSubmit={sendMessage}>
                    <div className="input-group">
                      <Form.Control
                        type="text"
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={loading}
                      />
                      <Button 
                        type="submit" 
                        variant="primary"
                        disabled={!newMessage.trim() || loading}
                      >
                        <i className="bi bi-send"></i>
                      </Button>
                    </div>
                  </Form>
                </Card.Footer>
              </>
            ) : (
              /* No conversation selected */
              <Card.Body className="d-flex align-items-center justify-content-center">
                <div className="text-center">
                  <i className="bi bi-chat-left-dots display-1 text-muted mb-3"></i>
                  <h5 className="text-muted">Select a conversation to start messaging</h5>
                  <p className="text-muted">Choose from your existing conversations or start a new one</p>
                </div>
              </Card.Body>
            )}
          </Card>
        </div>
      </div>

      {/* New Chat Modal */}
      <Modal show={showNewChat} onHide={() => setShowNewChat(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Start New Conversation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert variant="danger">{error}</Alert>
          )}
          <Form onSubmit={startNewConversation}>
            <Form.Group className="mb-3">
              <Form.Label>User Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter user's email address"
                value={newChatEmail}
                onChange={(e) => setNewChatEmail(e.target.value)}
                required
              />
              <Form.Text className="text-muted">
                Start a conversation with any registered user by entering their email
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNewChat(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={startNewConversation}
            disabled={loading || !newChatEmail.trim()}
          >
            {loading ? 'Starting...' : 'Start Conversation'}
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Conversation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>This will permanently delete the conversation and all its messages. This cannot be undone. Continue?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteConversation} disabled={loading}>{loading ? 'Deleting...' : 'Delete'}</Button>
        </Modal.Footer>
      </Modal>
      {/* Delete Message Confirmation Modal */}
      <Modal show={showDeleteMessageModal} onHide={() => setShowDeleteMessageModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Message</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to permanently delete this message? This cannot be undone.</p>
          {messageToDelete && (
            <div className="border rounded p-2 mt-2">
              <small className="text-muted">{messageToDelete.senderName}</small>
              <div>{messageToDelete.text}</div>
              <small className="text-muted">{formatMessageTime(messageToDelete.createdAt)}</small>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteMessageModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteMessageConfirmed} disabled={loading}>{loading ? 'Deleting...' : 'Delete Message'}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MessagingSystem;