import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Layout from '../components/Layout';
import api from '../api/axios';

const MessagesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const { user, setUnreadMessages } = useAuth();
  const { socket, joinChat, sendMessage: socketSendMessage, startTyping, stopTyping } = useSocket();

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => { 
    fetchConversations(); 
    
    // Check if navigated from profile with directChatUser
    if (location.state?.directChatUser) {
      setSelectedUser(location.state.directChatUser);
      // Clear the state after using it
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => { 
    if (selectedUser) {
      fetchMessages(selectedUser._id);
      // Join the chat room
      if (socket && user) {
        joinChat(user._id, selectedUser._id);
      }
    }
  }, [selectedUser, socket]);

  // Listen for incoming messages
  useEffect(() => {
    if (socket) {
      socket.on('receive_message', (messageData) => {
        if (selectedUser && 
            (messageData.senderId === selectedUser._id || messageData.receiverId === selectedUser._id)) {
          setMessages(prev => [...prev, {
            _id: messageData._id || Date.now(),
            sender: { _id: messageData.senderId, username: messageData.senderName, avatar: messageData.senderAvatar },
            receiver: { _id: messageData.receiverId },
            text: messageData.text,
            sharedPost: messageData.sharedPost,
            read: false,
            createdAt: messageData.createdAt || new Date()
          }]);
        }
        fetchConversations();
      });

      socket.on('new_message_notification', () => {
        fetchUnreadCount();
        fetchConversations();
      });

      socket.on('user_typing', ({ userId }) => {
        if (selectedUser && userId === selectedUser._id) {
          setIsTyping(true);
        }
      });

      socket.on('user_stop_typing', ({ userId }) => {
        if (selectedUser && userId === selectedUser._id) {
          setIsTyping(false);
        }
      });

      return () => {
        socket.off('receive_message');
        socket.off('new_message_notification');
        socket.off('user_typing');
        socket.off('user_stop_typing');
      };
    }
  }, [socket, selectedUser]);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/messages/unread-count');
      setUnreadMessages(res.data.count);
    } catch (err) { /* ignore */ }
  };

  const fetchConversations = async () => {
    try {
      const res = await api.get('/messages/conversations');
      // Filter out duplicates
      const uniqueConversations = [];
      const seenUserIds = new Set();
      
      for (const conv of res.data) {
        if (conv.user && conv.user._id && !seenUserIds.has(conv.user._id)) {
          seenUserIds.add(conv.user._id);
          uniqueConversations.push(conv);
        }
      }
      
      setConversations(uniqueConversations);
    } catch (err) { /* ignore */ }
    setLoading(false);
  };

  const fetchMessages = async (userId) => {
    try {
      const res = await api.get(`/messages/${userId}`);
      setMessages(res.data);
      const unreadRes = await api.get('/messages/unread-count');
      setUnreadMessages(unreadRes.data.count);
      fetchConversations();
    } catch (err) { /* ignore */ }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const res = await api.get(`/users/search?q=${query}`);
      setSearchResults(res.data);
    } catch (err) { /* ignore */ }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;
    
    try {
      const res = await api.post(`/messages/${selectedUser._id}`, { text: newMessage });
      
      // Add message to local state immediately
      setMessages(prev => [...prev, res.data]);
      
      // Send via socket for real-time
      socketSendMessage({
        _id: res.data._id,
        senderId: user._id,
        senderName: user.username,
        senderAvatar: user.avatar,
        receiverId: selectedUser._id,
        text: newMessage,
        createdAt: new Date()
      });
      
      setNewMessage('');
      stopTyping(user._id, selectedUser._id);
      fetchConversations();
    } catch (err) { /* ignore */ }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (selectedUser && socket) {
      startTyping(user._id, selectedUser._id);
      // Stop typing after 2 seconds of no input
      clearTimeout(window.typingTimeout);
      window.typingTimeout = setTimeout(() => {
        stopTyping(user._id, selectedUser._id);
      }, 2000);
    }
  };

  const goToProfile = (userId) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="card overflow-hidden h-[calc(100vh-180px)] dark:bg-zinc-900">
          <div className="flex h-full">
            {/* Conversations List */}
            <div className={`w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col ${selectedUser ? 'hidden md:flex' : ''}`}>
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="text-xl font-bold mb-4 dark:text-white">Messages</h2>
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  value={searchQuery} 
                  onChange={(e) => handleSearch(e.target.value)} 
                  className="w-full input-modern px-4 py-2 text-sm focus:outline-none dark:text-white" 
                />
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map(u => (
                    <div 
                      key={u._id} 
                      onClick={() => { setSelectedUser(u); setSearchQuery(''); setSearchResults([]); }} 
                      className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800"
                    >
                      <img src={u.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                      <div>
                        <p className="font-semibold dark:text-white">{u.username}</p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm capitalize">{u.role}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  conversations.map(conv => (
                    <div 
                      key={conv.user?._id} 
                      onClick={() => setSelectedUser(conv.user)} 
                      className={`p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 ${selectedUser?._id === conv.user?._id ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                    >
                      <div className="relative">
                        <img src={conv.user?.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                        {conv.unreadCount > 0 && (
                          <>
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                              {conv.unreadCount}
                            </span>
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                          </>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`dark:text-white ${conv.unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>
                          {conv.user?.username}
                        </p>
                        <div className="flex items-center gap-1">
                          <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            {conv.lastMessage?.sharedPost ? '📸 Shared a post' : conv.lastMessage?.text}
                          </p>
                          {conv.lastMessage?.sender === user._id && conv.lastMessage?.read && (
                            <span className="text-xs text-red-500">✓✓</span>
                          )}
                          {conv.lastMessage?.sender === user._id && !conv.lastMessage?.read && (
                            <span className="text-xs text-zinc-400">✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                
                {conversations.length === 0 && searchResults.length === 0 && !loading && (
                  <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                    <i className="fas fa-inbox text-4xl mb-2"></i>
                    <p>No conversations yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col ${!selectedUser ? 'hidden md:flex' : ''}`}>
              {selectedUser ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
                    <button onClick={() => setSelectedUser(null)} className="md:hidden text-xl mr-2 dark:text-white">
                      <i className="fas fa-arrow-left"></i>
                    </button>
                    <img 
                      src={selectedUser.avatar} 
                      alt="" 
                      className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                      onClick={() => goToProfile(selectedUser._id)}
                    />
                    <div className="flex-1">
                      <span 
                        className="font-semibold dark:text-white cursor-pointer hover:text-red-500 transition-colors"
                        onClick={() => goToProfile(selectedUser._id)}
                      >
                        {selectedUser.username}
                      </span>
                      {isTyping && (
                        <p className="text-xs text-green-500">typing...</p>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 bg-zinc-50 dark:bg-zinc-950/50">
                    {messages.map(msg => (
                      <div key={msg._id} className={`mb-4 ${msg.sender?._id === user._id ? 'text-right' : ''}`}>
                        {/* Shared Post Card */}
                        {msg.sharedPost && msg.sharedPost.image && (
                          <div className={`inline-block max-w-xs lg:max-w-sm mb-2 ${msg.sender?._id === user._id ? 'ml-auto' : 'mr-auto'}`}>
                            <div className="bg-white dark:bg-zinc-800 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm">
                              <div className="p-2 border-b border-zinc-100 dark:border-zinc-700">
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                  <i className="fas fa-share mr-1"></i>
                                  Shared post from @{msg.sharedPost.username}
                                </p>
                              </div>
                              <img 
                                src={msg.sharedPost.image} 
                                alt="Shared post" 
                                className="w-full max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              />
                              {msg.sharedPost.caption && (
                                <div className="p-2">
                                  <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">
                                    {msg.sharedPost.caption}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Message Text */}
                        {(!msg.sharedPost || !msg.sharedPost.image) && (
                          <span className={`inline-block px-4 py-2 max-w-xs lg:max-w-md rounded-2xl ${
                            msg.sender?._id === user._id 
                              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white rounded-br-md' 
                              : 'bg-white dark:bg-zinc-800 dark:text-white rounded-bl-md shadow-sm'
                          }`}>
                            {msg.text}
                          </span>
                        )}
                        <div className={`flex items-center gap-1 mt-1 ${msg.sender?._id === user._id ? 'justify-end' : 'justify-start'}`}>
                          <p className="text-xs text-zinc-400">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {msg.sender?._id === user._id && (
                            <span className={`text-xs ${msg.read ? 'text-red-500' : 'text-zinc-400'}`}>
                              {msg.read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Message..." 
                      value={newMessage} 
                      onChange={handleTyping} 
                      className="flex-1 input-modern px-4 py-3 focus:outline-none dark:text-white rounded-full" 
                    />
                    <button 
                      type="submit" 
                      disabled={!newMessage.trim()}
                      className="btn-primary text-white px-6 py-3 rounded-full font-semibold disabled:opacity-50 transition-all"
                    >
                      <i className="fas fa-paper-plane"></i>
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                      <i className="fas fa-comments text-4xl text-zinc-400"></i>
                    </div>
                    <p className="text-xl font-medium dark:text-white">Select a conversation</p>
                    <p className="text-sm mt-1">Choose from your existing chats or search for someone new</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MessagesPage;
