
import React, { useState, useEffect, useCallback } from 'react';
import { useGeminiLive, LiveStatus, DemoBooking } from './hooks/useGeminiLive';
import Visualizer from './components/Visualizer';

// --- Types ---
interface Lead {
  id: string;
  name: string;
  phone: string;
  status: 'pending' | 'called' | 'booked';
}

// --- Icons ---
const PhoneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 5.25V4.5Z" clipRule="evenodd" /></svg>;
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-9.75 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>;
const UserPlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6.25 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM3.25 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM19.75 7.5a.75.75 0 0 0-1.5 0v2.25H16a.75.75 0 0 0 0 1.5h2.25v2.25a.75.75 0 0 0 1.5 0v-2.25H22a.75.75 0 0 0 0-1.5h-2.25V7.5Z" /></svg>;
const ArrowLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M11.03 3.97a.75.75 0 0 1 0 1.06l-6.22 6.22H21a.75.75 0 0 1 0 1.5H4.81l6.22 6.22a.75.75 0 1 1-1.06 1.06l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.636-1.452ZM12.9 8.17a.75.75 0 0 1 .75.75v6.546a.75.75 0 0 1-1.5 0V8.92a.75.75 0 0 1 .75-.75Zm-3.8 0a.75.75 0 0 1 .75.75v6.546a.75.75 0 0 1-1.5 0V8.92a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>;
const CalendarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M6.75 2.25a.75.75 0 0 1 .75.75v1.5h9v-1.5a.75.75 0 0 1 1.5 0v1.5h.75a3 3 0 0 1 3 3v2.5h-18v-2.5a3 3 0 0 1 3-3h.75v-1.5a.75.75 0 0 1 .75-.75ZM1.5 11.25v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5H1.5Zm4.5 3a.75.75 0 0 1 .75.75v.005a.75.75 0 0 1-1.5 0v-.005a.75.75 0 0 1 .75-.75Zm3.75 0a.75.75 0 0 1 .75.75v.005a.75.75 0 0 1-1.5 0v-.005a.75.75 0 0 1 .75-.75Zm3.75 0a.75.75 0 0 1 .75.75v.005a.75.75 0 0 1-1.5 0v-.005a.75.75 0 0 1 .75-.75Zm3.75 0a.75.75 0 0 1 .75.75v.005a.75.75 0 0 1-1.5 0v-.005a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>;
const XMarkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>;

const App: React.FC = () => {
  // --- State ---
  const [leads, setLeads] = useState<Lead[]>(() => {
      const saved = localStorage.getItem('om_leads');
      return saved ? JSON.parse(saved) : [];
  });
  const [bookings, setBookings] = useState<DemoBooking[]>(() => {
      const saved = localStorage.getItem('om_bookings');
      return saved ? JSON.parse(saved) : [];
  });

  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [showAddLead, setShowAddLead] = useState(false);
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const activeLead = leads.find(l => l.id === activeLeadId);

  // --- Effects ---
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // --- Callback for when Agent books a demo ---
  const handleBooking = useCallback((newBooking: DemoBooking) => {
      // Enrich booking with lead data
      // Note: Since this callback is stable, we use functional state update to access latest bookings,
      // but for activeLead we rely on the booking data passed from the tool or ref if needed.
      // To keep it simple and avoid closing over stale 'activeLead', the hook passes what it knows.
      // If we need activeLead info, we can grab it from current state if we include it in deps, 
      // but to keep 'connect' stable we avoid changing deps. 
      // Strategy: The booking object from the hook already has customerName if the model extracted it.
      // If we want to force the active lead name, we can do it here but we need to be careful about deps.
      
      setBookings(prev => {
          const updated = [newBooking, ...prev];
          localStorage.setItem('om_bookings', JSON.stringify(updated));
          return updated;
      });

      // We need to know which lead ID to update. 
      // Since we can't easily pass ID through the voice tool unless we add it to context,
      // we'll trust the user is on the active lead page.
      // To access 'activeLeadId' without breaking stability, we can use a ref or just accept that
      // if activeLeadId changes, the callback changes, and we reconnect.
      // For now, let's allow the callback to change when activeLeadId changes. 
      // The hook handles ref updates so it won't break connection.
      
      // Actually, looking at useGeminiLive implementation, it uses a Ref for onBooking.
      // So we can safely depend on activeLeadId here without breaking the socket.
      if (activeLeadId) {
          setLeads(prev => {
              const updated = prev.map(l => {
                  if (l.id === activeLeadId) return { ...l, status: 'booked' as const };
                  return l;
              });
              localStorage.setItem('om_leads', JSON.stringify(updated));
              return updated;
          });
      }
  }, [activeLeadId]); // This dependency is safe because useGeminiLive wraps this in a Ref.

  const { status, connect, disconnect, isSpeaking, audioLevel, error } = useGeminiLive({
      onBooking: handleBooking
  });

  // --- Persistence for Leads ---
  useEffect(() => {
      localStorage.setItem('om_leads', JSON.stringify(leads));
  }, [leads]);

  // --- Handlers ---
  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadPhone) return;
    
    const newLead: Lead = {
      id: Date.now().toString(),
      name: newLeadName.trim() || "Jeweller", 
      phone: newLeadPhone,
      status: 'pending',
    };
    setLeads([...leads, newLead]);
    setNewLeadName('');
    setNewLeadPhone('');
    setShowAddLead(false);
  };

  const handleDeleteLead = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation(); 
    
    if (window.confirm("Delete this lead?")) {
      setLeads(prev => prev.filter(l => l.id !== id));
      if (activeLeadId === id) {
        setActiveLeadId(null);
        disconnect();
      }
    }
  };

  const handleClearBookings = () => {
      if(window.confirm("Clear all booking history?")) {
          setBookings([]);
          localStorage.removeItem('om_bookings');
      }
  };

  const handleStartAI = () => {
    if (!activeLead) return;
    if (status !== LiveStatus.DISCONNECTED) {
        disconnect();
    }
    // Start immediately
    connect();
  };

  const handleNextLead = () => {
    disconnect();
    if (activeLeadId) {
        const currentIndex = leads.findIndex(l => l.id === activeLeadId);
        if (currentIndex < leads.length - 1) {
            setActiveLeadId(leads[currentIndex + 1].id);
        } else {
            setActiveLeadId(null); 
        }
    }
  };

  const markAsCalled = () => {
      if (activeLeadId) {
          setLeads(prev => prev.map(l => l.id === activeLeadId && l.status !== 'booked' ? {...l, status: 'called' as const} : l));
          handleNextLead();
      }
  }

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 text-slate-50 flex flex-col md:flex-row overflow-hidden">
      
      {/* --- SIDEBAR: Lead List --- */}
      <aside className={`
        bg-slate-950 border-r border-slate-800 flex-col z-20 shadow-xl transition-all duration-300
        w-full md:w-80 h-full
        ${activeLeadId ? 'hidden md:flex' : 'flex'}
      `}>
        <div className="p-5 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center justify-between mb-1">
             <h2 className="font-bold text-lg text-yellow-500 flex items-center gap-2">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
               Lead List
             </h2>
             <div className="flex gap-1">
                {/* PWA Install Button */}
                {deferredPrompt && (
                    <button type="button" onClick={handleInstallApp} className="text-slate-400 hover:text-yellow-400 p-2 rounded-full hover:bg-slate-800 animate-pulse" title="Install App">
                        <DownloadIcon />
                    </button>
                )}
                <button type="button" onClick={() => setShowBookingsModal(true)} className="text-slate-400 hover:text-green-400 p-2 rounded-full hover:bg-slate-800 relative" title="View Bookings">
                    <CalendarIcon />
                    {bookings.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></span>}
                </button>
                <button type="button" onClick={() => setShowAddLead(!showAddLead)} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800" title="Add Lead">
                    <UserPlusIcon />
                </button>
             </div>
          </div>
          <p className="text-xs text-slate-500">Tap a lead to start dialing workflow</p>
        </div>

        {showAddLead && (
          <form onSubmit={handleAddLead} className="p-4 bg-slate-900 border-b border-slate-800 shrink-0">
            <input 
                value={newLeadName} 
                onChange={e => setNewLeadName(e.target.value)} 
                placeholder="Name (Optional)" 
                className="w-full bg-slate-800 text-sm p-3 rounded mb-2 border border-slate-700 text-white outline-none focus:border-yellow-500" 
            />
            <input 
                value={newLeadPhone} 
                onChange={e => setNewLeadPhone(e.target.value)} 
                placeholder="Phone Number (Required)" 
                className="w-full bg-slate-800 text-sm p-3 rounded mb-2 border border-slate-700 text-white outline-none focus:border-yellow-500" 
            />
            <button type="button" onClick={() => setShowAddLead(false)} className="w-full mb-2 text-slate-500 text-xs hover:text-white">Cancel</button>
            <button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-bold py-3 rounded shadow-md">ADD LEAD</button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1 pb-20 md:pb-2">
          {leads.length === 0 && !showAddLead && (
            <div className="text-center text-slate-600 mt-10 p-4">
              <p className="text-sm">No leads yet.</p>
              <p className="text-xs mt-2">Tap the <span className="inline-block align-middle"><UserPlusIcon /></span> button to add one.</p>
            </div>
          )}
          {leads.map(lead => (
            <div 
              key={lead.id}
              onClick={() => setActiveLeadId(lead.id)}
              className={`p-4 md:p-3 rounded-lg cursor-pointer transition-all border border-transparent group relative
                ${activeLeadId === lead.id ? 'bg-slate-800 border-yellow-500/50 shadow-lg' : 'hover:bg-slate-900 bg-slate-900/30'}
              `}
            >
              <div className="flex justify-between items-center">
                <div className="overflow-hidden pr-8">
                  <div className={`font-medium text-lg md:text-base truncate ${activeLeadId === lead.id ? 'text-white' : 'text-slate-300'}`}>
                      {lead.name}
                  </div>
                  <div className="text-sm md:text-xs text-slate-500 truncate">{lead.phone}</div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0 pl-2 absolute right-2 top-1/2 transform -translate-y-1/2">
                  {lead.status === 'booked' && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded font-bold mr-2">BOOKED</span>}
                  {lead.status === 'called' && <span className="bg-slate-700 text-slate-400 text-xs px-2 py-1 rounded mr-2">CALLED</span>}
                  
                  <button 
                    type="button"
                    onClick={(e) => handleDeleteLead(e, lead.id)}
                    className="p-3 text-slate-500 hover:text-red-500 hover:bg-slate-800/50 rounded-full transition-all z-10 relative"
                    title="Delete Lead"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* --- MAIN: Active Dialing Interface --- */}
      <main className={`
        relative bg-gradient-to-br from-slate-900 to-slate-950 flex-col items-center justify-center p-4 md:p-8
        w-full md:flex-1 h-full overflow-y-auto
        ${activeLeadId ? 'flex' : 'hidden md:flex'}
      `}>
        
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
           <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 rounded-full blur-3xl"></div>
           <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-yellow-600/5 rounded-full blur-3xl"></div>
        </div>

        {activeLeadId && (
            <button 
                onClick={() => {
                    disconnect();
                    setActiveLeadId(null);
                }} 
                className="md:hidden absolute top-4 left-4 p-2 bg-slate-800/80 backdrop-blur rounded-full text-slate-300 z-50 border border-slate-700 shadow-lg"
            >
                <ArrowLeftIcon />
            </button>
        )}

        {activeLead ? (
          <div className="z-10 w-full max-w-lg bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-6 md:p-8 text-center relative mt-8 md:mt-0">
             
             <div className="mb-6 md:mb-8">
                <div className="inline-block px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-bold tracking-widest mb-4">
                  ACTIVE LEAD
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{activeLead.name}</h1>
                <p className="text-slate-400 text-lg font-mono">{activeLead.phone}</p>
             </div>

             <div className="space-y-5 md:space-y-6">
                {/* STEP 1 */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-3 tracking-wider">Step 1: Dial & Speaker</div>
                    <a 
                      href={`tel:${activeLead.phone}`}
                      className="flex items-center justify-center gap-3 w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 md:py-3 rounded-lg shadow-lg transition-transform active:scale-95 hover:scale-105"
                    >
                      <PhoneIcon /> Call via SIM
                    </a>
                    <p className="text-[10px] text-slate-500 mt-2">Tap to open phone dialer. <span className="text-yellow-500 font-bold">Put call on Speaker.</span></p>
                </div>

                {/* STEP 2 */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-3 tracking-wider">Step 2: Start Agent</div>
                    
                    {status === LiveStatus.CONNECTED || status === LiveStatus.CONNECTING ? (
                        <button 
                          onClick={disconnect}
                          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-lg shadow-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
                        >
                          <span>Stop Agent</span>
                          <span className="text-[10px] font-normal opacity-80">Tap to end conversation</span>
                        </button>
                    ) : (
                        <button 
                          onClick={handleStartAI}
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                           <MicIcon /> Connect AI Agent
                        </button>
                    )}

                    <div className="h-24 mt-4 flex items-center justify-center">
                        <Visualizer 
                          isActive={status === LiveStatus.CONNECTED} 
                          level={audioLevel} 
                          color={isSpeaking ? '#EAB308' : '#3B82F6'} 
                        />
                    </div>
                    <div className="text-center text-xs text-slate-400 mt-[-10px] h-4">
                        {status === LiveStatus.CONNECTING && "Connecting to Gemini Live..."}
                        {status === LiveStatus.CONNECTED && (isSpeaking ? "Agent Speaking..." : "Listening...")}
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={markAsCalled} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-3 md:py-2 rounded text-sm font-medium active:bg-slate-600">
                       Mark Called & Next
                    </button>
                    <button onClick={handleNextLead} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 py-3 md:py-2 rounded text-sm font-medium active:bg-slate-700">
                       Skip Lead
                    </button>
                </div>
             </div>

          </div>
        ) : (
          <div className="text-center text-slate-500 p-8">
             <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <PhoneIcon />
             </div>
             <h3 className="text-xl font-semibold text-slate-300 mb-2">Offline Sales Agent</h3>
             <p className="max-w-xs mx-auto text-sm">Select a lead from the sidebar to start the automated script workflow.</p>
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg text-sm font-bold animate-bounce w-max max-w-[90%] text-center z-50">
            {error}
          </div>
        )}
        
      </main>

      {/* --- BOOKINGS MODAL --- */}
      {showBookingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          <CalendarIcon /> Booked Demos
                      </h2>
                      <button onClick={() => setShowBookingsModal(false)} className="text-slate-400 hover:text-white">
                          <XMarkIcon />
                      </button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 space-y-3">
                      {bookings.length === 0 ? (
                          <div className="text-center text-slate-500 py-8">No demos scheduled yet.</div>
                      ) : (
                          bookings.map(b => (
                              <div key={b.id} className="bg-slate-800/50 p-3 rounded border border-slate-700">
                                  <div className="flex justify-between items-start">
                                      <div className="font-bold text-white">{b.customerName}</div>
                                      <div className="text-xs text-slate-500">{b.timestamp}</div>
                                  </div>
                                  <div className="text-green-400 font-mono text-sm my-1">📅 {b.scheduledTime}</div>
                                  {b.notes && <div className="text-slate-400 text-sm italic border-l-2 border-slate-600 pl-2 mt-1">{b.notes}</div>}
                              </div>
                          ))
                      )}
                  </div>
                  {bookings.length > 0 && (
                    <div className="p-4 border-t border-slate-700 bg-slate-900 rounded-b-xl">
                        <button 
                            onClick={handleClearBookings}
                            className="w-full text-red-400 text-sm hover:text-red-300 py-2 border border-dashed border-red-900 rounded hover:bg-red-900/20"
                        >
                            Clear History
                        </button>
                    </div>
                  )}
              </div>
          </div>
      )}

    </div>
  );
};

export default App;
