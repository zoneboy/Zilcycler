import React, { useState } from 'react';
import { Send, ArrowLeft, User } from 'lucide-react';

const MOCK_MESSAGES = [
  { 
      id: 1, 
      sender: 'Admin Support', 
      preview: 'Please confirm your pickup location for...', 
      time: '10:30 AM', 
      unread: true,
      fullConversation: [
          { from: 'them', text: 'Hello, we noticed a discrepancy in your pickup address.' },
          { from: 'them', text: 'Please confirm your pickup location for tomorrow.' }
      ]
  },
  { 
      id: 2, 
      sender: 'Mrs. Johnson', 
      preview: 'I have extra plastic bottles, can you...', 
      time: 'Yesterday', 
      unread: false,
      fullConversation: [
          { from: 'me', text: 'Hi Mrs. Johnson, are you ready for pickup?' },
          { from: 'them', text: 'Yes, I have extra plastic bottles, can you bring a larger bag?' }
      ]
  },
  { 
      id: 3, 
      sender: 'System', 
      preview: 'Your weekly report is ready.', 
      time: 'Mon', 
      unread: false,
      fullConversation: [
          { from: 'them', text: 'Your weekly recycling report is ready. You earned 450 ZOINTS this week!' }
      ]
  },
];

const Messages: React.FC = () => {
  const [selectedChat, setSelectedChat] = useState<typeof MOCK_MESSAGES[0] | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedChat) return;
    
    // Add message to local state mockup
    const newMessage = { from: 'me', text: replyText };
    const updatedChat = { ...selectedChat, fullConversation: [...selectedChat.fullConversation, newMessage] };
    setSelectedChat(updatedChat);
    setReplyText('');
  };

  if (selectedChat) {
      return (
          <div className="flex flex-col h-[calc(100vh-140px)]">
              {/* Chat Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <button onClick={() => setSelectedChat(null)} className="p-2 hover:bg-gray-100 rounded-full">
                      <ArrowLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700">
                          <User className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-gray-800">{selectedChat.sender}</span>
                  </div>
              </div>

              {/* Chat Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                  {selectedChat.fullConversation.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                              msg.from === 'me' 
                                  ? 'bg-green-600 text-white rounded-br-none' 
                                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
                          }`}>
                              {msg.text}
                          </div>
                      </div>
                  ))}
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="pt-2 flex gap-2">
                  <input 
                    type="text" 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a message..." 
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:border-green-500 transition-colors"
                  />
                  <button type="submit" className="p-2 bg-green-600 rounded-full text-white hover:bg-green-700 transition-colors disabled:opacity-50" disabled={!replyText.trim()}>
                      <Send className="w-5 h-5" />
                  </button>
              </form>
          </div>
      );
  }

  return (
    <div className="space-y-4 h-full overflow-y-auto pb-20">
      <h2 className="font-bold text-gray-800 text-lg mb-4">Messages</h2>
      {MOCK_MESSAGES.map((msg) => (
        <div 
            key={msg.id} 
            onClick={() => setSelectedChat(msg)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer hover:bg-gray-50 ${msg.unread ? 'bg-white border-green-200 shadow-sm' : 'bg-gray-50 border-transparent'}`}
        >
           <div className="flex justify-between items-start mb-1">
              <h3 className={`font-bold ${msg.unread ? 'text-green-800' : 'text-gray-700'}`}>{msg.sender}</h3>
              <span className="text-[10px] text-gray-400 font-medium">{msg.time}</span>
           </div>
           <p className={`text-sm ${msg.unread ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>{msg.preview}</p>
        </div>
      ))}
    </div>
  );
};

export default Messages;