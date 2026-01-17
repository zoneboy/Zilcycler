import React, { useState, useEffect } from 'react';
import { Send, ArrowLeft, User, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Message, User as UserType, UserRole } from '../types';

// Helper to determine the "other" user in a conversation
const getCorrespondentId = (msg: Message, currentUserId: string) => {
    return msg.senderId === currentUserId ? msg.receiverId : msg.senderId;
};

const Messages: React.FC = () => {
  const { messages, sendMessage, users } = useApp();
  
  // Identify Current User (Simulated session retrieval, in real app this comes from Auth Context/Props)
  // For this component to work isolated we need the ID. 
  // We'll hack it by finding the first available user if we don't have props, 
  // BUT realistically this component is rendered inside App.tsx which has the user.
  // We'll trust the main App passes the user ID down, but `Messages` is currently defined without props in the router switch.
  // To fix this cleanly without changing App.tsx routing structure significantly, we'll try to find the "active" user from context or local storage.
  // Ideally, `Messages` should accept `user` prop. Let's assume the first active user for now or try to get it from context if we stored session there.
  // Since we don't have `currentUser` in AppContext, we'll implement a simple user picker for testing or assume 'u_current' if not provided.
  // WAIT: App.tsx renders Messages inside renderScreen(), but it doesn't pass the user! 
  // I will assume for now we need to grab the user ID from the parent component or modify App.tsx. 
  // HOWEVER, I cannot modify App.tsx easily to pass props without breaking the interface defined in the prompt files potentially.
  // ACTUALLY, I can just modify App.tsx to pass user prop to Messages. I'll do that in a separate change if needed.
  // For now, let's look at `App.tsx`... `case Screen.MESSAGES: return <Messages />;` -> It does NOT pass user.
  // I will assume `Messages` needs to find the logged in user. Since we don't store session in Context, this is tricky.
  // STRATEGY: I will modify App.tsx to pass the user to Messages.

  // NOTE: For this specific file, I will define props.
  return <MessagesContent />; 
};

// Internal component to handle logic
const MessagesContent: React.FC = () => {
   // To make this work without changing App.tsx signature too much, 
   // we'll assume we can get the current user ID from the Context if we added it, but we didn't.
   // Workaround: We will use a temporary hook or look for the user in the users array who is "logged in" in the main app state.
   // But main app state is local.
   // FIX: I will modify App.tsx to pass `user={effectiveUser}` to `<Messages />`.
   // So here I will treat it as if I receive props.
   
   // Actually, to avoid "Prop 'user' is missing" error until App.tsx is updated, I'll use a placeholder
   // and let the user select a contact to start.
   // But wait, the prompt says "Change to live deployment".
   
   // Let's rely on a small hack: We'll assume the `users[0]` is the current user if we can't get it, 
   // OR better, we update App.tsx to pass the user. I will update App.tsx.
   
   return <div className="p-4 text-center">Please update App.tsx to pass user prop to Messages component.</div>;
};

// Redefining the export to include the logic assuming props are passed (I will update App.tsx next)
interface MessagesProps {
    user: UserType;
}

export const MessagesWithUser: React.FC<MessagesProps> = ({ user }) => {
  const { messages, sendMessage, users } = useApp();
  const [selectedCorrespondentId, setSelectedCorrespondentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');

  // 1. Filter messages for this user
  const myMessages = messages.filter(m => m.senderId === user.id || m.receiverId === user.id);

  // 2. Group by correspondent
  const conversations: {[key: string]: Message[]} = {};
  myMessages.forEach(m => {
      const otherId = getCorrespondentId(m, user.id);
      if (!conversations[otherId]) conversations[otherId] = [];
      conversations[otherId].push(m);
  });

  // 3. Sort conversations by latest message
  const sortedCorrespondents = Object.keys(conversations).sort((a, b) => {
      const lastA = conversations[a][conversations[a].length - 1];
      const lastB = conversations[b][conversations[b].length - 1];
      return new Date(lastB.createdAt).getTime() - new Date(lastA.createdAt).getTime();
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedCorrespondentId) return;
    
    const newMsg: Message = {
        id: `msg_${Date.now()}`,
        senderId: user.id,
        receiverId: selectedCorrespondentId,
        content: replyText,
        createdAt: new Date().toISOString(),
        isRead: false
    };

    sendMessage(newMsg);
    setReplyText('');
  };

  const startNewChat = (targetUserId: string) => {
      setSelectedCorrespondentId(targetUserId);
      setIsNewChatOpen(false);
      setNewChatSearch('');
  };

  const getCorrespondentName = (id: string) => {
      const u = users.find(u => u.id === id);
      return u ? u.name : 'Unknown User';
  };

  // --- RENDER CHAT VIEW ---
  if (selectedCorrespondentId) {
      const chatMessages = conversations[selectedCorrespondentId] || [];
      const otherUser = users.find(u => u.id === selectedCorrespondentId);

      return (
          <div className="flex flex-col h-[calc(100vh-140px)]">
              {/* Chat Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
                  <button onClick={() => setSelectedCorrespondentId(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                      <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-700 dark:text-green-400">
                          <User className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-gray-800 dark:text-white">{otherUser?.name || 'Unknown'}</span>
                  </div>
              </div>

              {/* Chat Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3 flex flex-col-reverse">
                  {[...chatMessages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((msg) => (
                      <div key={msg.id} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                              msg.senderId === user.id 
                                  ? 'bg-green-600 text-white rounded-br-none' 
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none'
                          }`}>
                              {msg.content}
                          </div>
                      </div>
                  ))}
                  {chatMessages.length === 0 && (
                      <p className="text-center text-xs text-gray-400 mt-4">Start the conversation...</p>
                  )}
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="pt-2 flex gap-2">
                  <input 
                    type="text" 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a message..." 
                    className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 focus:outline-none focus:border-green-500 transition-colors dark:text-white"
                    autoFocus
                  />
                  <button type="submit" className="p-2 bg-green-600 rounded-full text-white hover:bg-green-700 transition-colors disabled:opacity-50" disabled={!replyText.trim()}>
                      <Send className="w-5 h-5" />
                  </button>
              </form>
          </div>
      );
  }

  // --- RENDER LIST VIEW ---
  return (
    <div className="space-y-4 h-full overflow-y-auto pb-20 relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-gray-800 dark:text-white text-lg">Messages</h2>
        <button onClick={() => setIsNewChatOpen(true)} className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
            <Plus className="w-5 h-5" />
        </button>
      </div>

      {sortedCorrespondents.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
              <p>No messages yet.</p>
              <button onClick={() => setIsNewChatOpen(true)} className="text-green-600 text-sm font-bold mt-2 hover:underline">Start a chat</button>
          </div>
      ) : (
          sortedCorrespondents.map((correspondentId) => {
            const msgs = conversations[correspondentId];
            const lastMsg = msgs[msgs.length - 1];
            const name = getCorrespondentName(correspondentId);
            const time = new Date(lastMsg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            return (
                <div 
                    key={correspondentId} 
                    onClick={() => setSelectedCorrespondentId(correspondentId)}
                    className="p-4 rounded-2xl border bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 transition-all cursor-pointer hover:border-green-300 dark:hover:border-green-700 shadow-sm"
                >
                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-gray-800 dark:text-white">{name}</h3>
                    <span className="text-[10px] text-gray-400 font-medium">{time}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{lastMsg.content}</p>
                </div>
            );
          })
      )}

      {/* New Chat Modal */}
      {isNewChatOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsNewChatOpen(false)}></div>
              <div className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-fade-in-up p-6 h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-900 dark:text-white">New Message</h3>
                      <button onClick={() => setIsNewChatOpen(false)} className="text-gray-500">Close</button>
                  </div>
                  
                  <input 
                    type="text" 
                    placeholder="Search users..." 
                    value={newChatSearch}
                    onChange={e => setNewChatSearch(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-4 focus:outline-none focus:border-green-500 dark:text-white"
                  />

                  <div className="flex-1 overflow-y-auto space-y-2">
                      {users.filter(u => u.id !== user.id && u.name.toLowerCase().includes(newChatSearch.toLowerCase())).map(u => (
                          <button 
                            key={u.id}
                            onClick={() => startNewChat(u.id)}
                            className="w-full text-left p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors"
                          >
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-300">
                                  <User className="w-5 h-5" />
                              </div>
                              <div>
                                  <p className="font-bold text-gray-800 dark:text-white">{u.name}</p>
                                  <p className="text-xs text-gray-500 capitalize">{u.role.toLowerCase()}</p>
                              </div>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default MessagesWithUser;
