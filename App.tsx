
import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message, User, ChatType, AppLanguage } from './types';
import { SearchIcon, MenuIcon, PhoneIcon, MoreIcon, SendIcon, BackIcon } from './components/Icons';
import { getAIResponse } from './services/geminiService';
import { checkContent, getBlockedMessage, getBlockedUntil } from './services/moderationService';
import { translations } from './services/translations';

const INITIAL_CHATS: Chat[] = [
  {
    id: 'admin_1',
    name: 'Uzgram Support',
    avatar: 'https://ui-avatars.com/api/?name=Uzgram+Support&background=0099FF&color=fff',
    lastMessage: 'Assalomu alaykum! Xush kelibsiz.',
    unreadCount: 0,
    type: 'private',
    isOnline: true,
    messages: [{ id: 'm1', text: 'Assalomu alaykum! Uzgram-ga xush kelibsiz. Sizning xavfsizligingiz biz uchun muhim.', sender: 'assistant', timestamp: Date.now() }],
    ownerId: 'system',
    admins: [],
    coOwners: [],
    members: ['system']
  }
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('uzgram_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('uzgram_chats');
    return saved ? JSON.parse(saved) : INITIAL_CHATS;
  });

  const [lang, setLang] = useState<AppLanguage>(user?.language || 'uz');
  const t = translations[lang];

  // Auth State
  const [authStep, setAuthStep] = useState<'login' | 'verify'>('login');
  const [authMethod, setAuthMethod] = useState<'phone' | 'email' | 'guest'>('phone');
  const [authInput, setAuthInput] = useState('');

  // UI State
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCalling, setIsCalling] = useState(false);
  const [view, setView] = useState<'chats' | 'settings' | 'edit_profile' | 'contacts'>('chats');
  
  // Creation/Edit State
  const [creationStep, setCreationStep] = useState<1 | 2 | 3>(1);
  const [showCreateModal, setShowCreateModal] = useState<ChatType | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [selectedCoOwners, setSelectedCoOwners] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhoneSearch, setNewPhoneSearch] = useState('');

  // Search/ID State
  const [searchQuery, setSearchQuery] = useState('');
  const [secretCode, setSecretCode] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChat = chats.find(c => c.id === activeChatId);

  // Persistence
  useEffect(() => {
    if (user) {
      localStorage.setItem('uzgram_user', JSON.stringify(user));
      setLang(user.language);
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('uzgram_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  // Unique ID Generator
  const generateID = () => `@uz_${Math.floor(10000 + Math.random() * 90000)}`;

  const handleAuth = () => {
    if (!authInput) return;
    setAuthStep('verify');
    setTimeout(() => {
      const newUser: User = {
        id: generateID(),
        name: authInput.split('@')[0],
        phone: authMethod === 'phone' ? authInput : undefined,
        email: authMethod === 'email' ? authInput : undefined,
        avatar: `https://ui-avatars.com/api/?name=${authInput}&background=0099FF&color=fff`,
        language: 'uz',
        contacts: ['admin_1'],
        isPremium: false,
        bio: 'Mening Uzgram sahifam'
      };
      setUser(newUser);
    }, 1500);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChatId || !user) return;
    if (user.isBlocked || user.isPermanentlyBlocked) return;

    const mod = checkContent(inputText);
    if (mod.level !== 'none') {
      const blockedUntil = getBlockedUntil(mod.level);
      setUser({
        ...user,
        isBlocked: true,
        isPermanentlyBlocked: mod.level === 'critical_perm',
        blockReason: mod.reason,
        blockedUntil
      });
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: Date.now()
    };

    setChats(prev => prev.map(chat => 
      chat.id === activeChatId 
        ? { ...chat, messages: [...chat.messages, newMessage], lastMessage: inputText }
        : chat
    ));
    setInputText('');

    if (activeChat?.type === 'private' && activeChat.id === 'admin_1') {
      const response = await getAIResponse('Support', [...activeChat.messages, newMessage]);
      const aiMsg: Message = { id: Date.now() + '-ai', text: response, sender: 'assistant', timestamp: Date.now() };
      setChats(prev => prev.map(c => c.id === 'admin_1' ? { ...c, messages: [...c.messages, aiMsg], lastMessage: response } : c));
    }
  };

  const addContactByIdOrPhone = (query: string) => {
    if (!user || user.contacts.includes(query)) return;
    setUser({ ...user, contacts: [...user.contacts, query] });
    const newChat: Chat = {
      id: query,
      name: query.startsWith('@') ? `User ${query}` : `Phone ${query}`,
      avatar: `https://ui-avatars.com/api/?name=${query.replace('@', '')}&background=random`,
      unreadCount: 0,
      type: 'private',
      messages: [],
      ownerId: user.id,
      admins: [],
      coOwners: [],
      members: [user.id, query]
    };
    setChats([newChat, ...chats]);
    alert(`Kontakt qo'shildi: ${query}`);
    setSearchQuery('');
    setNewPhoneSearch('');
  };

  const startCreationFlow = (type: ChatType) => {
    setShowCreateModal(type);
    setCreationStep(1);
    setSelectedMembers([]);
    setSelectedAdmins([]);
    setSelectedCoOwners([]);
  };

  const finalizeCreation = () => {
    if (!newName || !user) return;
    const newChat: Chat = {
      id: 'chat_' + Date.now(),
      name: newName,
      avatar: `https://picsum.photos/seed/${newName}/200/200`,
      unreadCount: 0,
      type: showCreateModal || 'group',
      messages: [{ id: 'sys-' + Date.now(), text: `${newName} yaratildi`, sender: 'system', timestamp: Date.now() }],
      ownerId: user.id,
      admins: selectedAdmins,
      coOwners: selectedCoOwners,
      members: [user.id, ...selectedMembers]
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setShowCreateModal(null);
    setNewName('');
    setIsSidebarOpen(false);
  };

  const claimVipBonus = () => {
    if (!user?.isPremium) return;
    const now = Date.now();
    if (user.premiumBonusesClaimed && now - user.premiumBonusesClaimed < 365 * 24 * 60 * 60 * 1000) {
      alert("Bonus faqat yilda bir marta beriladi!");
      return;
    }
    setUser({ ...user, premiumBonusesClaimed: now });
    alert("Yillik Super Bonus: 10,000 Uzgram Coin va 2 ta bepul maxsus mahsulot savatchangizga qo'shildi! 🎁");
  };

  const updateProfile = (data: Partial<User>) => {
    if (user) setUser({ ...user, ...data });
  };

  if (!user) {
    return (
      <div className="h-screen bg-[#0099FF] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 text-center animate-in zoom-in duration-300">
          <div className="w-24 h-24 bg-[#0099FF] rounded-3xl flex items-center justify-center mx-auto mb-8 text-white font-black text-4xl italic">Ug</div>
          <h1 className="text-3xl font-bold mb-2">{t.welcome}</h1>
          <p className="text-gray-400 mb-10 text-sm">{t.subtitle}</p>
          
          {authStep === 'login' ? (
            <div className="space-y-4">
              <div className="flex bg-gray-50 p-1 rounded-2xl">
                {(['phone', 'email', 'guest'] as const).map(m => (
                  <button key={m} onClick={() => setAuthMethod(m)} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${authMethod === m ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>
                    {t[m] || m}
                  </button>
                ))}
              </div>
              <input 
                type="text" 
                placeholder={authMethod === 'guest' ? 'Ismingizni kiriting' : 'Kiriting...'}
                value={authInput}
                onChange={(e) => setAuthInput(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-transparent focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm font-bold"
              />
              <button onClick={handleAuth} className="w-full bg-[#0099FF] text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-200 uppercase tracking-widest">{t.continue}</button>
            </div>
          ) : (
            <div className="animate-in fade-in duration-500">
              <p className="mb-4 text-sm font-bold">Xavfsiz ulanish...</p>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 animate-[progress_1.5s_ease-in-out]"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen bg-white overflow-hidden relative ${user.isPremium ? 'premium-theme' : ''}`}>
      <style>{`
        .premium-theme .pattern-bg { 
          background-image: radial-gradient(#FFD70015 1px, transparent 1px);
          background-color: #fcfaf3;
        }
        .premium-emoji { filter: drop-shadow(0 0 5px #FFD700); }
      `}</style>

      {/* Moderation Overlay */}
      {(user.isBlocked || user.isPermanentlyBlocked) && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 backdrop-blur-lg">
          <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
               <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <h2 className="text-2xl font-black mb-4">Kirish Cheklandi</h2>
            <p className="text-gray-500 mb-8 text-sm">{getBlockedMessage(user.blockReason || '', user.isPermanentlyBlocked ? 'critical_perm' : 'warning_12h')}</p>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full bg-black text-white py-4 rounded-2xl font-bold">Tizimdan chiqish</button>
          </div>
        </div>
      )}

      {/* Creation Modal (Multi-step) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
            {creationStep === 1 ? (
              <>
                <h3 className="text-xl font-black mb-6">Odamlarni qo'shing</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 mb-6 no-scrollbar">
                  {user.contacts.map(cid => (
                    <div 
                      key={cid} 
                      onClick={() => setSelectedMembers(prev => prev.includes(cid) ? prev.filter(i => i !== cid) : [...prev, cid])}
                      className={`p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all ${selectedMembers.includes(cid) ? 'bg-blue-50 border-blue-200 border' : 'bg-gray-50'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedMembers.includes(cid) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                        {selectedMembers.includes(cid) && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>}
                      </div>
                      <span className="text-sm font-bold">{cid}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setCreationStep(2)} className="w-full bg-blue-500 text-white py-4 rounded-2xl font-black">Keyingi</button>
              </>
            ) : creationStep === 2 ? (
              <>
                <h3 className="text-xl font-black mb-6">Ma'murlar tayinlang</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 mb-6 no-scrollbar">
                  {selectedMembers.map(cid => (
                    <div key={cid} className="flex gap-2">
                       <button onClick={() => setSelectedAdmins(p => p.includes(cid) ? p.filter(i => i!==cid) : [...p, cid])} className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedAdmins.includes(cid) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>Admin: {cid}</button>
                       <button onClick={() => setSelectedCoOwners(p => p.includes(cid) ? p.filter(i => i!==cid) : [...p, cid])} className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedCoOwners.includes(cid) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'}`}>Ega: {cid}</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setCreationStep(3)} className="w-full bg-blue-500 text-white py-4 rounded-2xl font-black">Keyingi</button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black mb-6">Nomi va Tavsifi</h3>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Kanal yoki guruh nomi..." 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-transparent mb-6 outline-none focus:bg-white focus:border-blue-500 font-bold"
                />
                <div className="flex gap-3">
                  <button onClick={() => setCreationStep(2)} className="flex-1 text-gray-400 font-bold">Orqaga</button>
                  <button onClick={finalizeCreation} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black">Yaratish</button>
                </div>
              </>
            )}
            <button onClick={() => setShowCreateModal(null)} className="mt-4 w-full text-xs text-gray-300 font-bold uppercase tracking-widest">Bekor qilish</button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-full md:w-80' : 'hidden'} md:flex flex-col border-r border-gray-100 bg-white z-10`}>
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg ${user.isPremium ? 'bg-amber-400' : 'bg-blue-500'}`}>Ug</div>
            <h1 className="font-black text-xl">Uzgram</h1>
          </div>
          <button onClick={() => setView('settings')} className="p-2.5 text-gray-400 hover:bg-gray-50 rounded-xl transition-colors"><MenuIcon /></button>
        </div>

        {view === 'chats' ? (
          <>
            <div className="px-5 mb-5 flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-4 top-3 text-gray-400"><SearchIcon /></span>
                <input 
                  type="text" 
                  placeholder="ID yoki tel..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && (searchQuery.startsWith('@') || /^\+?[0-9]{5,}$/.test(searchQuery)) && addContactByIdOrPhone(searchQuery)}
                  className="w-full bg-gray-50 pl-11 pr-5 py-3 rounded-2xl text-xs font-bold outline-none border border-transparent focus:bg-white focus:border-gray-200" 
                />
              </div>
              {(searchQuery.startsWith('@') || /^\+?[0-9]{5,}$/.test(searchQuery)) && (
                <button onClick={() => addContactByIdOrPhone(searchQuery)} className="bg-blue-500 text-white p-3 rounded-2xl shadow-lg hover:scale-105 transition-all"><SendIcon /></button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
              {chats.map(chat => (
                <div 
                  key={chat.id}
                  onClick={() => { setActiveChatId(chat.id); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                  className={`flex items-center gap-4 p-4 mx-2 rounded-2xl cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-[#0099FF] text-white shadow-xl shadow-blue-100' : 'hover:bg-gray-50'}`}
                >
                  <img src={chat.avatar} className="w-14 h-14 rounded-2xl object-cover shadow-sm" alt="" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-bold truncate text-sm flex items-center gap-1">
                        {chat.name}
                        {chat.admins.includes(user.id) && <span className="text-[8px] bg-white/20 px-1 rounded">ADM</span>}
                        {chat.coOwners.includes(user.id) && <span className="text-[8px] bg-amber-400/20 px-1 rounded">OWN</span>}
                      </h3>
                      <span className="text-[10px] opacity-40">12:00</span>
                    </div>
                    <p className="text-xs truncate font-medium opacity-60">{chat.lastMessage}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 grid grid-cols-2 gap-2">
               <button onClick={() => startCreationFlow('group')} className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm text-[10px] font-black uppercase text-gray-500 hover:bg-gray-50">+ Guruh</button>
               <button onClick={() => startCreationFlow('channel')} className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm text-[10px] font-black uppercase text-gray-500 hover:bg-gray-50">+ Kanal</button>
            </div>
          </>
        ) : view === 'settings' ? (
          <div className="flex-1 overflow-y-auto px-5 py-2 animate-in slide-in-from-left-4 duration-300 no-scrollbar">
             <button onClick={() => setView('chats')} className="mb-6 flex items-center gap-2 text-blue-500 font-bold text-sm"><BackIcon /> Orqaga</button>
             <div className="text-center mb-8">
                <img src={user.avatar} className="w-24 h-24 rounded-[2.5rem] mx-auto mb-4 border-4 border-white shadow-xl" alt="" />
                <h3 className="font-black text-lg">{user.name} {user.isPremium && '👑'}</h3>
                <p className="text-xs text-blue-500 font-black">{user.id}</p>
                <button onClick={() => setView('edit_profile')} className="mt-2 text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline">Profilni Tahrirlash</button>
             </div>

             <div className="space-y-4">
                <div className="bg-gray-50 p-5 rounded-3xl">
                   <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-3">Til va Bulutli Parol</h4>
                   <div className="flex gap-2 mb-3">
                      {(['uz', 'ru', 'en'] as const).map(l => (
                        <button key={l} onClick={() => setUser({...user, language: l})} className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-all ${user.language === l ? 'bg-blue-500 text-white' : 'bg-white text-gray-300'}`}>{l}</button>
                      ))}
                   </div>
                   <input type="password" placeholder="Bulutli parol qo'shish..." value={user.cloudPassword || ''} onChange={e => updateProfile({cloudPassword: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-white border border-gray-100 text-xs font-bold" />
                </div>

                {!user.isPremium && (
                   <div className="bg-gray-50 p-5 rounded-3xl">
                      <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">VIP Aktivatsiya</h4>
                      <input type="password" placeholder="VIP Kod (UZB2025)" value={secretCode} onChange={e => setSecretCode(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white border border-gray-100 text-xs font-bold mb-2" />
                      <button onClick={() => { if(secretCode === 'UZB2025') { setUser({...user, isPremium: true}); setSecretCode(''); alert('VIP OCHILDI!'); } }} className="w-full py-2 bg-amber-400 text-white rounded-xl text-[10px] font-black uppercase">Aktivlashtirish</button>
                   </div>
                )}

                {user.isPremium && (
                  <div className="bg-gradient-to-br from-amber-400 to-yellow-500 p-6 rounded-[2rem] text-white shadow-xl">
                     <div className="flex justify-between items-start mb-4">
                        <h4 className="font-black text-sm">Milliy VIP Bonus</h4>
                        <span className="text-[20px] premium-emoji">🎁</span>
                     </div>
                     <p className="text-[10px] opacity-80 mb-4 font-bold">Har yili yangi super bonuslar va bepul mahsulotlarni oling.</p>
                     <button onClick={claimVipBonus} className="w-full py-3 bg-white text-amber-600 rounded-xl text-xs font-black uppercase shadow-lg">Bonusni olish</button>
                  </div>
                )}

                <button onClick={() => setUser(null)} className="w-full py-4 text-red-500 font-black text-xs uppercase tracking-widest">Tizimdan chiqish</button>
             </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-2 animate-in slide-in-from-left-4 duration-300 no-scrollbar">
            <button onClick={() => setView('settings')} className="mb-6 flex items-center gap-2 text-blue-500 font-bold text-sm"><BackIcon /> Orqaga</button>
            <h3 className="text-xl font-black mb-6">Profil Tahriri</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase">Avatar URL</label>
                <input type="text" value={user.avatar} onChange={e => updateProfile({avatar: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-transparent font-bold text-sm outline-none focus:bg-white focus:border-blue-100" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase">Ism</label>
                <input type="text" value={user.name} onChange={e => updateProfile({name: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-transparent font-bold text-sm outline-none focus:bg-white focus:border-blue-100" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase">Username (ID)</label>
                <input type="text" value={user.id} readOnly className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-transparent font-bold text-sm outline-none cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase">Bio</label>
                <textarea value={user.bio} onChange={e => updateProfile({bio: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-transparent font-bold text-sm outline-none focus:bg-white focus:border-blue-100 h-24" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase">Telefon</label>
                <input type="text" value={user.phone || ''} onChange={e => updateProfile({phone: e.target.value})} placeholder="+998..." className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-transparent font-bold text-sm outline-none focus:bg-white focus:border-blue-100" />
              </div>
              <button onClick={() => setView('settings')} className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-100">Saqlash</button>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-gray-100 flex items-center gap-3">
          <img src={user.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black truncate">{user.name}</p>
            <p className="text-[10px] text-gray-400 font-bold">{user.id}</p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-[#F2F6F9] relative ${!activeChatId && 'hidden md:flex'}`}>
        {!activeChat ? (
          <div className="flex-1 flex items-center justify-center text-center p-10 pattern-bg">
            <div className="max-w-sm scale-110">
              <div className="w-28 h-28 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center mx-auto mb-10 text-[#0099FF] font-black text-6xl italic border-8 border-blue-50">Ug</div>
              <h2 className="text-3xl font-black text-gray-800 tracking-tight">Uzgram Milliy</h2>
              <p className="text-gray-400 mt-4 text-sm font-medium leading-relaxed">Xavfsiz, tez va milliy aloqa tizimi. Har bir xabar va ma'lumotingiz ishonchli himoyada.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="bg-white/90 backdrop-blur-xl border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-gray-400"><BackIcon /></button>
                <img src={activeChat.avatar} className="w-12 h-12 rounded-2xl object-cover shadow-md" alt="" />
                <div>
                  <h2 className="font-black text-base leading-none mb-1.5 flex items-center gap-2">
                    {activeChat.name}
                    {user.isPremium && <span className="premium-emoji">✨</span>}
                  </h2>
                  <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">{activeChat.id.startsWith('@') ? activeChat.id : activeChat.type}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsCalling(true)} className="p-3 text-gray-400 hover:text-blue-500 bg-gray-50 rounded-xl transition-all"><PhoneIcon /></button>
                <button className="p-3 text-gray-400 hover:text-blue-500 bg-gray-50 rounded-xl transition-all"><MoreIcon /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar pattern-bg">
              {activeChat.messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'}`}>
                  {msg.sender === 'system' ? (
                    <span className="bg-gray-200/50 backdrop-blur-md text-gray-500 px-5 py-1.5 rounded-full text-[9px] uppercase font-black tracking-widest">{msg.text}</span>
                  ) : (
                    <div className={`max-w-[85%] md:max-w-[70%] px-5 py-3.5 rounded-3xl shadow-sm text-sm font-medium relative ${msg.sender === 'user' ? (user.isPremium ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white' : 'bg-[#0099FF] text-white shadow-blue-100') : 'bg-white text-gray-800 border border-gray-50'}`}>
                      {msg.text}
                      <div className={`text-[9px] mt-2 text-right font-black ${msg.sender === 'user' ? 'text-blue-100' : 'text-gray-300'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {(activeChat.type !== 'channel' || activeChat.admins.includes(user.id) || activeChat.ownerId === user.id) ? (
              <div className="bg-white p-4 md:p-6 flex items-center gap-4 border-t border-gray-50">
                <button className="p-3 text-gray-400 hover:text-blue-500 bg-gray-50 rounded-2xl transition-all">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </button>
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Xabar yozing..." 
                  className="flex-1 bg-gray-50 rounded-2xl px-6 py-4 focus:bg-white border border-transparent focus:border-blue-100 outline-none text-sm font-bold shadow-inner"
                />
                <button onClick={handleSendMessage} className={`p-4 rounded-2xl transition-all shadow-xl ${inputText.trim() ? (user.isPremium ? 'bg-amber-400 text-white scale-110' : 'bg-[#0099FF] text-white') : 'bg-gray-100 text-gray-300'}`}>
                  <SendIcon />
                </button>
              </div>
            ) : (
              <div className="bg-white p-6 text-center text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] border-t border-gray-50">Kanalda faqat ma'murlar yozishi mumkin</div>
            )}
          </>
        )}
      </div>

      {/* Call UI */}
      {isCalling && (
        <div className="fixed inset-0 z-[300] bg-gradient-to-b from-blue-600 to-blue-900 flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
           <div className="relative mb-10">
              <img src={activeChat?.avatar} className="w-44 h-44 rounded-[3.5rem] border-8 border-white/10 shadow-2xl animate-pulse object-cover" alt="" />
              <div className="absolute -top-5 -right-5 bg-white text-blue-600 px-5 py-2 rounded-full font-black text-xs shadow-xl uppercase">Uzgram HD</div>
           </div>
           <h2 className="text-4xl font-black mb-2 tracking-tight">{activeChat?.name}</h2>
           <p className="text-blue-100 font-bold uppercase tracking-widest text-xs animate-pulse">Chaqirilmoqda...</p>
           
           <div className="mt-32 flex gap-12">
              <button className="w-20 h-20 bg-white/5 backdrop-blur-lg border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"><MenuIcon /></button>
              <button onClick={() => setIsCalling(false)} className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 hover:scale-110 transition-all shadow-2xl shadow-red-900/40">
                 <svg className="w-10 h-10 rotate-[135deg]" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
              </button>
              <button className="w-20 h-20 bg-white/5 backdrop-blur-lg border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"><PhoneIcon /></button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
