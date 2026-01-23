"use client"; 

// Frontend React Component for Arcade Queue Management
// This application manages player queues for arcade cabinets 
// restricting editing access based on the user's geolocation location.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import Image from 'next/image';

import chuMaiIcon from '../public/laundryico.png'; // Logo image
import bemaco from '../public/Artboard_1.png'; // Bemaco logo

import { 
  
  Users, User, Gamepad2, Trash2, GripVertical, 
  Edit2, Check, X, Plus, History,
  Network, SendToBack, MapPinned, Lock, Unlock,
  AlertTriangle, Database, Trophy, RefreshCw, Shield,
  KeyRound, LogOut,
} from 'lucide-react'; // Icon library

// Gelocation config
// coord define the central point of allowed editing area
// only users within MAX_DISTANCE_KM can edit the queue

const LOCATIONS = [
  
  { 
    name: 'Amborukmo Plaza', 
    lat: -7.782357, 
    lon: 110.401167, 
    radius_km: 0.15
  }, {
    name: 'DP Mall Semarang',
    lat: -6.982970,
    lon: 110.412266,
    radius_km: 0.15
  },
  {
    name: 'Summarecon Mall Bekasi',
    lat: -6.226771,
    lon: 107.00069,
    radius_km: 0.15
  },
  {
    name: 'Local Testing',
    lat: -6.265856,
    lon: 106.944008,
    radius_km: 0.15
  },
]

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL; // Base URL for API
const API_ACCESS = process.env.MOD_ACCESS ? JSON.parse(process.env.MOD_ACCESS) : []; // Mod access codes

if (!API_BASE_URL) throw new Error('NEXT_PUBLIC_API_URL is not defined in environment variables');
if (API_ACCESS.length === 0) console.warn('No MOD_ACCESS codes defined in environment variables');

// Login Modal Component
const LoginModal = ({ isOpen, onClose, onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password || API_ACCESS.includes(password)) {
      onLogin();
        onClose();
    } else {
      setError('Invalid Access Code');
    }
  };

  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-pink-100/30 border border-pink-600 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="text-pink-500" /> Moderator Access
            </h3>
            <button onClick={onClose}><X className="text-white hover:text-white" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-white uppercase mb-1">Access Code</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-white" size={16} />
              <input 
                type="password"
                autoFocus
                className="w-full bg-pink-600/50 border border-orange-500 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter Mod Code"
              />
            </div>
            {error && <p className="text-red-400 text-xs mt-2 font-bold flex items-center gap-1"><AlertTriangle size={12}/> {error}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="w-full bg-red-50 py-3 rounded-xl font-bold text-red-400 hover:bg-red-200 shadow-lg shadow-indigo-900/20 transition-all">Unlock Access</button>
          </div>
        </form>
      </div>
    </div>
  );

}

// Player Item
const PlayerGroup = ({ group, isMod, onRemove, onEdit, onNext, onSendToBack}) => {
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedP1, setEditedP1] = useState(group.players[0] || '');
  const [editedP2, setEditedP2] = useState(group.players[1] || '');

  const handleSave = () => {
    
    const newPlayer = group.type === 'solo' ? [editedP1] : [editedP1, editedP2].filter(p => p.trim() !== '');
    if (newPlayer.length > 0) {
      onEdit(group.id, newPlayer);
      setIsEditing(false);
    }
  };

  return (
    <div className={`
      relative group p-4 border rounded-xl shadow-lg 
      ${group.isNext ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-800 border-slate-700'}
      hover:bg-slate-700/50 transition-all duration-200
      ${group.id.toString().startsWith('temp') ? 'opacity-50' : ''}
    `}>
      <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${group.type === 'solo' ? 'bg-yellow-400 text-slate-900' : 'bg-pink-500 text-white'}`}>
                {group.type.toUpperCase()}
              </span>
              <span className="text-slate-500 text-[10px] font-mono truncate">ID: {group.id}</span>
            </div>
            {isEditing ? (
              <div className="flex flex-col gap-2 mt-2 w-full max-w-[250px]">
                <input 
                  value={editedP1}
                  onChange={(e) => setEditedP1(e.target.value)}
                  className="bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Player 1"
                />
                {group.type === 'duo' && (
                  <input 
                    value={editedP2}
                    onChange={(e) => setEditedP2(e.target.value)}
                    className="bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Player 2"
                  />
                )}
                <div className="flex gap-2 mt-1">
                   <button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-500 py-1.5 rounded text-white text-xs font-bold transition-colors">Save</button>
                   <button onClick={() => setIsEditing(false)} className="flex-1 bg-slate-600 hover:bg-slate-500 py-1.5 rounded text-white text-xs font-bold transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <div className={`truncate ${group.isNext ? 'text-xl font-bold text-amber-200' : 'text-lg font-semibold text-slate-200'}`}>
                 {group.players.join(' & ')}
              </div>
            )}
          </div>

          {/* MANAGEMENT BUTTONS - ONLY VISIBLE TO MODS */}
          {isMod && !isEditing && (
            <div className="flex flex-row items-center gap-1 shrink-0">
              <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={18} /></button>
              
              {group.isNext ? (
                <button onClick={() => onSendToBack(group.id)} className="p-2 text-slate-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-lg transition-colors" title="Send to Back"><SendToBack size={18} /></button>
              ) : (
                <button onClick={() => onNext(group.id)} className="p-2 text-slate-400 hover:text-green-300 hover:bg-green-500/20 rounded-lg transition-colors" title="Make Next"><Trophy size={18} /></button>
              )}
              
              <button onClick={() => onRemove(group.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={18} /></button>
            </div>
          )}
      </div>

       {/* Drag Handle - ONLY VISIBLE TO MODS */}
      {isMod && !isEditing && !group.id.toString().startsWith('temp') && (
        <GripVertical 
          className="absolute top-1/2 -left-3 transform -translate-y-1/2 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing hidden sm:block" 
          size={20} 
        />
      )}
    </div>
  );
}

export default function ArcadeQueueApp() {
  
  // --- State Management ---
  const [cabinets, setCabinets] = useState([]); // ARRAY of all cabinet objects, including their queues
  const [selectedCabinetId, setSelectedCabinetId] = useState(null); // Selected cabinet ID
  const [currentSessionPoll, setCurrentSessionPoll] = useState(null); // Current session polled separately
  const [statusMessage, setStatusMessage] = useState({ type: 'info', text: 'Welcome to ChuMaiCQ Arcade Queue Manager' }); // General status messages
  const isSubmittingQueueRef = useRef(false); // Ref to track if a queue submission is in progress

  // Permissions
  const [isMod, setIsMod] = useState(false); // Whether the user is a moderator
  const [isInsideLocation, setIsInsideLocation] = useState(false); // Whether the user is within allowed geolocation area
  const [showLoginModal, setShowLoginModal] = useState(false); // Controls visibility of login modal
  const pressTimer = useRef(null); // Ref for long-press timer
  
  // Drag State
  const [draggedItemIndex, setDraggedItemIndex] = useState(null); // Index of the currently dragged item

  // Form State
  const [isAdding, setIsAdding] = useState(false); // Controls visibility of the "Add Player" form
  const [newEntryType, setNewEntryType] = useState('solo'); // 'solo' or 'duo' for new entries
  const [p1Name, setP1Name] = useState('');
  const [p2Name, setP2Name] = useState('');
  const [isAddingCabinet, setIsAddingCabinet] = useState(false); // Controls visibility of "Add Cabinet" form
  const [newCabinetName, setNewCabinetName] = useState('');

  // Guard safe
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent multiple submissions

  // Polling 
  const [queuePoll, setQueuePoll] = useState([]); // Current queue for the selected cabinet
  const [isLoading, setIsLoading] = useState(false); // Loading state for API calls

  // Geolocation State
  const [canEdit, setCanEdit] = useState(false); // Whether the user can edit based on location, True is whenever user is within the allowed area
  const [locationStatus, setLocationStatus] = useState('Checking location...'); // Status message for geolocation

  // Database Connection State
  const [isDbConnected, setIsDbConnected] = useState(false); // Whether the system is connected to database

  // Auth & Init
  useEffect(() => {
    
    // Check if user is already authenticated as mod
    const storedMod = localStorage.getItem('isMod');
    if (storedMod === 'true') {
      setIsMod(true);
    }
  }, []);

  const handleLogin = () => {
    
    setIsMod(true);
    localStorage.setItem('isMod', 'true');
    setStatusMessage({ type: 'success', text: 'Moderator access granted.' });
  }

  const handleLogout = () => {
    
    setIsMod(false);
    localStorage.removeItem('isMod');
    setStatusMessage({ type: 'info', text: 'Logged out from moderator access.' });
  }

  // long press logic
  const handlePressStart = () => {
    
    pressTimer.current = setTimeout(() => {
      setShowLoginModal(true);
    }, 2000); // 2 seconds long press
  }
  const handlePressEnd = () => {
    
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  // --- API Integration ---
  const CABINET_API_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/cabinets`;
  const QUEUE_API_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/queue`;

  // --- Logging Helper ---
  // Useful helper to print axios error details (response / request / message)
  const logAxiosDebug = (error, context = '') => {
    console.error(context || 'API Error', error);
    try {
      if (error && error.response) {
        console.debug(`${context} - response:`, {
          status: error.response.status,
          headers: error.response.headers,
          data: error.response.data,
        });
      } else if (error && error.request) {
        console.debug(`${context} - no response received, request:`, error.request);
      } else {
        console.debug(`${context} - message:`, error && error.message);
      }
    } catch (e) {
      console.debug('logAxiosDebug fallback', e);
    }
  };

  // --- Database Health Check ---
  // Check if the backend database is accessible
  const checkDbHealth = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/health`, { timeout: 15000 }); // 15s timeout
      // If we get a 200-ish response, assume DB is connected
      if (response.status >= 200 && response.status < 300) {
        setIsDbConnected(true);
        console.debug('DB health check passed');
      } else {
        setIsDbConnected(false);
      }
    } catch (error) {
      console.debug('DB health check failed:', error.message);
      setIsDbConnected(false);
    }
  }, [API_BASE_URL]);

  // --- Geolocation Check ---
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; 
    return distance; // Distance in km
  };

  // Request user's geolocation and determine if editing is allowed
  // this only runs when user open the page 
  // Set the 'canEdit' state accordingly
  const checkGeolocation = useCallback(() => {
    
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser. View-only mode.');
      setCanEdit(false);
      return;
    }

    // R1 - single location
    // navigator.geolocation.getCurrentPosition(
      
    //   (position) => {
       
      
      //   const { latitude: userLat, longitude: userLon } = position.coords;
      //   const distance = calculateDistance(
      //     userLat, userLon, TARGET_LAT, TARGET_LON
      //   );

      //   const isWithinRange = distance <= MAX_DISTANCE_KM;
      //   setCanEdit(isWithinRange);

      //   if (isWithinRange) {
      //     setLocationStatus(`You are within the allowed area [ ${distance.toFixed(3)} km ]. | Editing enabled.`);
      //   } else {
      //     setLocationStatus(`You are outside the allowed area [ ${distance.toFixed(3)} km ]. Editing disabled.`);
      //   }
      // }, 

    // R2 - multiple locations
    navigator.geolocation.getCurrentPosition(
      
      (position) => {
        const { latitude, longitude } = position.coords;

        const mathcedLocation = LOCATIONS.find((loc) => {
          const distance = calculateDistance(
            latitude,
            longitude,
            loc.lat,
            loc.lon
          );
          return distance <= loc.radius_km;
        });

        if (mathcedLocation) {
          const distance = calculateDistance(
            latitude,
            longitude,
            mathcedLocation.lat,
            mathcedLocation.lon
          );

          setCanEdit(true);
          setLocationStatus(`Inside Play Area`);
        } else {
          setCanEdit(false);
          setLocationStatus(`Outside Play Area.`);
        }
      },

      (error) => {

        // Handle geolocation errors
        let message = 'Could not retrieve your location.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location denied.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location unavailable.';
        }
        setLocationStatus(message);
        setCanEdit(false);
      },
      // Geolocation options
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);


  // --- DERIVED STATE ---

  // Find the currently selected cabinet 
  const selectedCabinet = useMemo(() => {
    
    if (!Array.isArray(cabinets)) {
      console.error('Cabinets data is not an array:', cabinets);
      return null;
    }
    return cabinets.find(c => c.id === selectedCabinetId);
  }, [cabinets, selectedCabinetId]);

  // Get the queue items for the selected cabinet
  const queue = useMemo(() => {
    
    return selectedCabinet?.queue_items?.slice(1) || [];
  }, [selectedCabinet]);

  // Get the current session (the first item in the queue_items)
  const currentSession = useMemo(() => {
    
    const items = selectedCabinet?.queue_items;
    if (items && items.length > 0) {
      return items[0];
    }
    return null;
  }, [selectedCabinet]);

  // const fetchQueue = useCallback(async () => {
    
    // try {
      //   setIsLoading(true);
      //   const response = await axios.get(CABINET_API_URL);
      //   setQueuePoll(response.data);
      // } catch (error) {
        //   console.error('Error fetching queue poll:', error);
        // } finally {
          //   setIsLoading(false);
          // }
          
    const fetchQueue = useCallback(async (cabinetId, silent = false) => {
      if (!cabinetId) return;
      try {
        const response = await axios.get(`${API_BASE_URL}/api/queue/${cabinetId}`);
        const { queue_items, current_session } = response.data;

        const validatedQueue = (queue_items || []).map(item => ({
          id: item.id,
          players: item.players ? JSON.parse(item.players) : [],
          type: item.type,
          isNext: !!item.is_next,
          order: item.order
        }));

        setQueuePoll(validatedQueue);
        setCurrentSessionPoll(current_session);
        if(!silent) setStatusMessage({ type: 'success', text: 'Queue updated.' });
      } catch (error) {
        if(!silent) setStatusMessage({ type: 'error', text: 'Failed to fetch queue.' });
      }
  }, []);

  // Fetch all cabinets
  // R1
  // const fetchCabinets = async () => {
    
    
    // try {
    //   const response = await axios.get(CABINET_API_URL);
    //   console.debug('fetchCabinets response', { status: response.status, headers: response.headers, data: response.data });
    //   const data = response.data;

    //   // Normalize several common response shapes:
    //   // - []
    //   // - { data: [] }
    //   // - { cabinets: [] }
    //   // - single object -> convert to [obj]
    //   let parsed = [];

    //   if (Array.isArray(data)) {
    //     parsed = data;
    //   } else if (data && Array.isArray(data.data)) {
    //     parsed = data.data;
    //   } else if (data && Array.isArray(data.cabinets)) {
    //     parsed = data.cabinets;
    //   } else if (data && typeof data === 'object') {
    //     // Sometimes API returns a single cabinet object when there's only one
    //     // or returns a keyed object. Try to detect an object with id/name.
    //     if (data.id && data.name) {
    //       parsed = [data];
    //     } else {
    //       // last resort: try to extract any array value from the object
    //       const firstArray = Object.values(data).find(v => Array.isArray(v));
    //       if (firstArray) parsed = firstArray;
    //     }
    //   }

    //   if (Array.isArray(parsed)) {
    //     console.debug('fetchCabinets parsed array length', parsed.length);
    //     setCabinets(parsed);
    //     // Auto-select the first cabinet if none selected
    //     if (parsed.length > 0 && !selectedCabinetId) {
    //       setSelectedCabinetId(parsed[0].id);
    //     }
    //   } else {
    //     console.error('API returned unexpected data for cabinets:', data);
    //     console.debug('fetchCabinets - attempted parsed value:', parsed);
    //     setCabinets([]);
    //   }
    // } catch (error) {
    //   // Network/ CORS / server HTML response will be caught here
    //   logAxiosDebug(error, 'fetchCabinets');
    //   setCabinets([]); // Reset to empty array on error
    // }

    // R2 - simplified
  const fetchCabinets = useCallback(async ()  => {

    try {
      const response = await axios.get(`${API_BASE_URL}/api/cabinets`);
      if (Array.isArray(response.data)) {
        setCabinets(response.data);
        if (response.data.length > 0 && !selectedCabinetId) {
          setSelectedCabinetId(response.data[0].id);
        }
      }
    } catch (error) {
      setStatusMessage({ type: 'error', text: 'Failed to fetch cabinets.' });
    }
  }, [selectedCabinetId]);


  // --- Initial setup and data fetching ---

  // Runs once on component mount and check location
  useEffect(() => {
    
    fetchCabinets();
    fetchQueue();
    checkGeolocation();
    checkDbHealth(); // check DB health on load
    
    // Set up periodic health check every 7 minutes 27 seconds
    const healthInterval = setInterval(checkDbHealth, 447000);
    const geolocationInterval = setInterval(checkGeolocation, 60000); // Re-check geolocation every minute
    const queueInterval = setInterval(fetchCabinets, 5000); // Poll every 5 seconds
    
    return () => {

      clearInterval(healthInterval);
      clearInterval(queueInterval);
      clearInterval(geolocationInterval);
    };
  }, [fetchCabinets, checkGeolocation, checkDbHealth]);

  // --- Cabinet Actions ---

  // Add a new cabinet via API Call
  const addCabinet = async () => {
    
    if (!isMod) return;
    if (!canEdit || !newCabinetName.trim() || isSubmitting) return;
    try {
      const resp = await axios.post(CABINET_API_URL, { name: newCabinetName });
      console.debug('addCabinet response', { status: resp.status, data: resp.data, headers: resp.headers });
      setNewCabinetName('');
      setIsAddingCabinet(false);
      await fetchCabinets(); // Refresh cabinets after adding  
    } catch (error) {
      logAxiosDebug(error, 'addCabinet');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove a cabinet via API Call
  const removeCabinet = async (cabinetId) => {
    
    if (!isMod) return;
    if (!canEdit) return;
    try {
      const resp = await axios.delete(`${CABINET_API_URL}/${cabinetId}`);
      console.debug('removeCabinet response', { status: resp.status, data: resp.data });
      if (selectedCabinetId === cabinetId) {
        setSelectedCabinetId(null);
      }
      await fetchCabinets(); // Refresh cabinets after adding
    } catch (error) {
      logAxiosDebug(error, 'removeCabinet');
    }
  };

  // --- Queue Actions ---

  // adds a new entry to the queue  
  const addToQueue = async () => {
    
    // if (!isMod) return;
    if (!canEdit) return;
    if (!selectedCabinetId) return;
    if (!p1Name.trim()) return;
    if (newEntryType === 'duo' && !p2Name.trim()) return;
    
    if (isSubmittingQueueRef.current) return;
    isSubmittingQueueRef.current = true;

    const payload = {
      type: newEntryType,
      players: newEntryType === 'solo'
        ? [p1Name.trim()] 
        : [p1Name.trim(), p2Name.trim()],
      cabinet_id: selectedCabinetId
    }

    const tempId = `temp-${Date.now()}`;

    setQueuePoll((prev) => [...prev, {
      ...payload,
      id: tempId, // Temporary ID for optimistic UI
      created_at: new Date().toISOString(),
      pending: true,
    }]); // Trigger re-render
    
    try {
      await axios.post(QUEUE_API_URL, payload);
      // Refresh cabinets to update the main state, triggering useMemo re-evaluation
      await fetchCabinets(); 
      resetForm();
    } catch (error) {
      console.error('Error adding to queue:', error);
      setQueuePoll((prev) => prev.filter((q) => q.id !== tempId)); // Remove optimistic entry on error
    } finally {
      isSubmittingQueueRef.current = false;
    }
  };

  // Reset the add player form
  const resetForm = () => {
    
    setP1Name('');
    setP2Name('');
    setIsAdding(false);
  };

  // Remove an entry from the queue
  // @param id - ID of the queue item to remove
  const removeFromQueue = async (id) => {
    
    if (!isMod) return;
    if (!canEdit) return;
    try {
      await axios.delete(`${QUEUE_API_URL}/${id}`);
      // Refresh Cabinets to update the main state
      await fetchCabinets(); 
    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  };

  // NOTE: This client-side reordering/updating is only visual and will be reset if you refresh.
  // Ideally, drag-and-drop should update the backend position of the queue items.
  const updateGroup = async (id, newPlayers) => {
    
    if (!isMod) return;
    if (!canEdit) return;
    try {
      // Here you would send an API request to update the player names
      const resp = await axios.patch(`${QUEUE_API_URL}/${id}`, { players: newPlayers });
      console.debug('updateGroup response', { status: resp.status, data: resp.data });
      // Refresh Cabinets to get the updated data from backend
      await fetchQueue();
    } catch (error) {
      logAxiosDebug(error, 'updateGroup');

    // CLIENT-SIDE ONLY UPDATE (NOT PERSISTED)
    //   const updatedCabinets = cabinets.map(cab => {
    //   if (cab.id === selectedCabinetId) {
    //     return {
    //       ...cab,
    //       queue_items: cab.queue_items.map(item => 
    //         item.id === id ? { ...item, players: newPlayers } : item
    //       )
    //     };
    //   }
    //   return cab;
    // });
    // setCabinets(updatedCabinets);

    }
  };

  // Finish the current game and cycle the queue
  const finishGame = async () => {
    
    if (!isMod) return;
    if (!canEdit || !currentSession) return;
    try {
      // Endpoint to cycle the queue
      await axios.post(`${QUEUE_API_URL}/${currentSession.id}/cycle`);
      // Refresh Cabinets to get the new queue state after cycling
      await fetchCabinets(); 
    } catch (error) {
      logAxiosDebug(error, 'finishGame');
    }
  };

  // --- Drag and Drop Logic (Native HTML5) ---

  // Start dragging an item, storing its index of dragged item
  // @pram {object} e - Drag event
  // @param {number} index - Index of the WAITING item array being dragged
  const onDragStart = (e, index) => {
    
    if (!isMod) return;
    if (!canEdit) {
      e.preventDefault();
      return;
    }
    // Only allow dragging of items *in* the waiting queue (not the current session)
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle drag over another item to reorder
  // NOTE: the API call is triggered *immediately* on drag over to provide instant feedback.
  // @param {object} e - Drag event
  // @param {number} index - Index of the WAITING item array being hovered over
  const onDragOver = (e, index) => {
    
    if (!isMod) return;
    e.preventDefault();
    if (!canEdit || draggedItemIndex === null || draggedItemIndex === index) return;
    
    // 1. Local state reordering (optimistic update)
    const newQueue = [...queue];
    const draggedItem = newQueue[draggedItemIndex];
    newQueue.splice(draggedItemIndex, 1); // Remove from old position
    newQueue.splice(index, 0, draggedItem); // Insert into new position
    
    // Update the local state with the newly ordered queue
    const updatedCabinets = cabinets.map(cab => {
        if (cab.id === selectedCabinetId) {
            // Reconstruct the full queue_items array: [currentSession, ...newQueue]
            return { ...cab, queue_items: [currentSession, ...newQueue] };
        }
        return cab;
    });
    setCabinets(updatedCabinets);
    setDraggedItemIndex(index); // Update dragged index to the new position

    // 2. Persist the new order to the backend
    // The backend should accept a list of IDs in the new desired order for the waiting queue
    const newQueueIds = newQueue.map(item => item.id);
    
    // PATCH request to update the queue order for the selected cabinet
    axios.patch(`${CABINET_API_URL}/${selectedCabinetId}/reorder`, { new_order: newQueueIds })
      .then(resp => console.debug('reorder response', { status: resp.status, data: resp.data }))
      .catch(error => {
        logAxiosDebug(error, 'reorder');
        // Optionally, refetch cabinets to revert to the correct order if API fails
        fetchCabinets(); 
      });
  };

  // End dragging, reset the dragged item index
  const onDragEnd = () => {
    setDraggedItemIndex(null);
  };

  // --- Cabinet Selector UI ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-20">
      
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLogin={handleLogin} />
      
      {/* Navbar */}
      <header className="bg-pink-50/50 border-b border-pink-100 sticky top-0 z-30 shadow-xl shadow-amber-50 backdrop-blur-sm">
        <div className="grid grid-cols-7 mx-auto px-4 h-20 items-center self-center max-w-3xl">
          <div className="flex col-span-3 items-center gap-2">
            <div className=""
              onPointerDown={handlePressStart}
              onPointerUp={handlePressEnd}
              onPointerLeave={handlePressEnd}
            >
              {/* <Gamepad2 className="w-6 h-6 text-gray-900" /> */}
              <Image src={chuMaiIcon} className="w-14 md:size-18" alt='image icon' />
            </div>
            <h1 className="text-base md:text-xl font-bold bg-linear-to-tr from-slate-700 to-gray-900 bg-clip-text text-transparent text-shadow-xl text-shadow-amber-200">
              ChuMaiCQ {isMod && <span className="text-sm font-normal text-green-600">(MOD)</span>}
            </h1>
          </div>
          <div className="col-span-1 md:col-span-2"></div>
          <div className="text-xs col-span-3 md:col-span-2 justify-center font-mono text-gray-800">
            SYSTEM: {canEdit ? (
              <span className="flex items-center gap-1">
                <Unlock size={12} className="text-green-600" /> EDITING ENABLED
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Lock size={12} className="text-red-600" /> VIEW-ONLY MODE
              </span>

            )}
              <span className="flex items-center gap-1">
                <Database size={12} className={isDbConnected ? 'text-green-600' : 'text-red-600'} />
                {isDbConnected ? 'DB: CONNECTED' : 'DB: DISCONNECTED'}
              </span>
            <span className="flex items-center gap-1">
              <MapPinned size={12} className="text-pink-600" /> {locationStatus}
              {isMod && <button onClick={handleLogout} className="text-slate-400 hover:text-white" title="Logout"><LogOut size={16} /></button>}      
            </span>
          </div>
        </div>
      </header>

      <img 
          src="/image3.jpg" 
          alt="Arcade Machine" 
          className="fixed inset-0 w-full h-full object-cover opacity-100 z-10 pointer-events-none select-none"
      />

      <main className="max-w-3xl mx-auto px-4 md:pt-8 space-y-4">
        
        {/* Geolocation Status Bar
        <div className={
          `p-3 rounded-lg flex items-center text-base text-gray-900 italic
          ${canEdit 
            ? 'bg-lime-200/50 border border-green-500/30'
            : (locationStatus.includes('Checking') || locationStatus.includes('unavailable'))
            ? 'bg-yellow-200/50 border border-yellow-500/30 text-yellow-200'
            : 'bg-red-200/50 border border-red-500/30 text-red-200'}
          }`}
        >
          {canEdit ? <MapPinned size={18} /> : <AlertTriangle size={18} />}
          <span className="ml-2">{locationStatus}</span>
          {!canEdit && locationStatus.includes('Location verified') && (
            <button
            onClick={checkGeolocation}
            className="ml-auto bg-slate-700 text-slate-300 px-3 py-1 rounded-lg text-sm font-bold hover:bg-slate-600 transition-colors"
            >
              Retry Location Check
            </button>
          )}
        </div> */}

        <Image src={bemaco} alt="bemaco logo" className="w-full rounded-lg relative pt-6 z-10" />
        
        {/* Cabinet Selector */}
        <section className="mb-6 relative z-20 backdrop-blur-xs bg-amber-50/50 rounded-2xl p-4">
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              Cab list
            </h2>
            <button
              onClick={() => setIsAddingCabinet(true)}
              disabled={!canEdit || !isMod}
              className={`text-base font-bold px-2 py-1 bg-pink-400 hover:bg-pink-600 text-white 
                rounded-md flex items-center gap-1 transition-colors
                ${(!canEdit || !isMod) ? 'opacity-50 bg-pink-200 hover:bg-pink-300 text-gray-300 cursor-not-allowed' : 'cursor-default'}`}
            >
              <Plus size={14} /> Add Cabinet
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cabinets.map(cabinet => (
              <div 
                key={cabinet.id} 
                className={`flex items-center gap-1 px-3 py-1 rounded-lg cursor-pointer border transition-colors 
                  ${selectedCabinetId === cabinet.id ? 
                    'bg-pink-700 bg- text-white border-red-400' :  
                    'bg-slate-800 text-slate-200 border-pink-400 hover:bg-slate-600'}`}
                onClick={() => setSelectedCabinetId(cabinet.id)}
              >
                <span>{cabinet.name}</span>
                {canEdit && isMod && (
                  <button
                  onClick={e => { e.stopPropagation(); removeCabinet(cabinet.id); }}
                  className="ml-1 text-xs text-red-400 hover:text-red-600"
                  title="Delete Cabinet"
                >
                  <Trash2 size={14} />
                </button>)}
              </div>
            ))}
          </div>
          {isAddingCabinet && (
            <div className="mt-3 flex gap-2 items-center">
              <input
                type="text"
                value={newCabinetName}
                onChange={e => setNewCabinetName(e.target.value)}
                placeholder="Cabinet name"
                className="rounded-lg border px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-indigo-400 
                bg-slate-800/80 border-pink-400 text-white placeholder:text-gray-300"
                autoFocus
                disabled={!canEdit || !isMod}
              />
              <button
                onClick={addCabinet}
                disabled={!canEdit || !isMod}
                className="bg-pink-400 text-slate-900 py-2 px-4 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => { setIsAddingCabinet(false); setNewCabinetName(''); }}
                className="px-4 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-bold hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </section>

        {/* Current Session (Active Game) */}
        <section className="mb-6 relative z-20 backdrop-blur-xs bg-amber-50/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <Network className="w-6 h-6 text-red-600" />
              Queue Cabinet 
              <p className="text-pink-500"> {cabinets.find(c => c.id === selectedCabinetId)?.name || ''}</p>
            </h2>
            {currentSession && (
               <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-lime-200/50 text-red-400 text-xs font-medium border border-green-500/20 animate-pulse">
                 <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                 PLAYING NOW
               </span>
            )}
          </div>

          {currentSession ? (
            <div className="bg-linear-to-br from-pink-900/10 to-pink-400 border border-red-100 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-lg shadow-yellow-300/30 relative overflow-hidden group">
              {/* Background decoration */}
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
              
              <div className="flex items-center gap-4 z-10">
                <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center shadow-inner shadow-black/20 border-4 border-lime-400">
                   {currentSession.type === 'solo' ? <User size={32} /> : <Users size={32} />}
                </div>
                <div>
                  <div className="text-xs text-gray-800 font-mono mb-1">
                    {currentSession.type.toUpperCase()} MODE
                  </div>
                  <div className="text-2xl font-bold text-gray-800">
                    {currentSession.players.join(' & ')}
                  </div>
                </div>
              </div>

              <button 
                onClick={finishGame}
                disabled={!canEdit || !isMod}
                className={`z-10 w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-600 border border-red-200 hover:border-red-200 text-white 
                rounded-lg font-medium transition-all active:scale-95 flex items-center justify-center gap-2
                ${(!canEdit || !isMod) ? 'opacity-50 cursor-not-allowed bg-slate-400 hover:bg-slate-200' : 'cursor-default'}`}
              >
                Finish Game
                <SendToBack className="w-6 h-6 text-white" />
              </button>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-600">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <div className="text-slate-400">The machine is empty!</div>
              {/* Changed logic here: if queue is NOT empty, we can rely on the next player being the first item after the next cycle */}
              {queue.length > 0 && (
                <div className="text-xs text-slate-500">
                  {/* NOTE: Removed the startGame button as its logic was problematic */}
                  Ready for the next challenger!
                </div>
              )}
            </div>
          )}
        </section>

        {/* The Queue */}
        <section className="mb-6 relative z-20 backdrop-blur-xs bg-amber-50/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <History className="w-6 h-6" />
              Queue ({queue.length})
            </h2>
            
            {!isAdding && (
              <button 
                onClick={() => {
                  if (selectedCabinetId) {
                    setIsAdding(true);
                  } else {
                    console.log('Please select a cabinet first.');
                  }
                }}
                disabled={!canEdit || !selectedCabinetId}
                className={`text-base font-bold px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors 
                  ${selectedCabinetId ? 
                    'bg-gray-800 hover:bg-gray-600 text-white' : 
                    'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
              >
                <Plus size={20} /> Add Player
              </button>
            )}
          </div>

          {/* Add Player Form */}
          {isAdding && (
            <div className="mb-6 bg-linear-to-tl from-pink-900/10 to-pink-400/80 border border-pink-100 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white">New Entry</h3>
                <div className="flex bg-pink-50/70 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setNewEntryType('solo')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${newEntryType === 'solo' ? 'bg-yellow-200 text-gray-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    disabled={!canEdit}
                  >
                    SOLO
                  </button>
                  <button
                    type="button" 
                    onClick={() => setNewEntryType('duo')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${newEntryType === 'duo' ? 'bg-pink-600 text-gray-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                    disabled={!canEdit}
                  >
                    DUO
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-1">Player 1 Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Enter name..." 
                    value={p1Name}
                    onChange={(e) => setP1Name(e.target.value)}
                    className="w-full bg-slate-800/80 border border-amber-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-green-600 text-gray-50 placeholder:text-gray-300"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('joint-queue-btn').focus();
                      }
                    }}
                    disabled={!canEdit}
                  />
                </div>
                
                {newEntryType === 'duo' && (
                  <div>
                    <label className="block text-base font-medium text-gray-900 mb-1">Player 2 Name</label>
                    <input 
                      type="text" 
                      placeholder="Enter partner name..." 
                      value={p2Name}
                      onChange={(e) => setP2Name(e.target.value)}
                      className="w-full bg-slate-800/80 border border-yellow-600 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-pink-600 text-gray-50 placeholder:text-gray-300"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          document.getElementById('joint-queue-btn').focus();
                        }
                      }}
                      disabled={!canEdit}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  id="joint-queue-btn"
                  type="button"
                  onClick={addToQueue}
                  disabled={!canEdit || isSubmittingQueueRef.current}
                  // className="flex-1 bg-white text-slate-900 py-2 rounded-lg text-sm font-bold hover:bg-green-400 transition-colors"
                  className={`flex-1 py-2 rounded-lg text-sm text-slate-900 font-bold transition-colors
                    ${isSubmittingQueueRef.current
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-white hover:bg-green-400'}
                    `}
                >
                  {isSubmittingQueueRef.current ? 'Joining...' : 'Join Queue'}
                </button>
                <button 
                  onClick={resetForm}
                  className="px-4 bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-bold hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="space-y-2 relative min-h-[100px]">
            {queue.length === 0 && !isAdding && (
              <div className="text-center py-10 text-gray-900 italic">
                Queue is empty. Be the first!
              </div>
            )}

            {queue.map((group, index) => (
              <QueueItem 
                key={group.id} 
                group={group} 
                index={index}
                onRemove={removeFromQueue}
                onUpdate={updateGroup}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                isDragging={draggedItemIndex === index}
                canEdit={canEdit}
                isMod={isMod}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// --- Sub Component: Queue Item ---
function QueueItem({ group, index, onRemove, onUpdate, onDragStart, onDragOver, onDragEnd, isDragging, canEdit, isMod }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editP1, setEditP1] = useState(group.players[0]);
  const [editP2, setEditP2] = useState(group.players[1] || '');

  const handleSave = () => {
    if (!editP1.trim()) return; 
    if (group.type === 'duo' && !editP2.trim()) return;
    
    // NOTE: This client-side update only updates the local state, not the backend.
    const newPlayers = group.type === 'solo' ? [editP1] : [editP1, editP2];
    onUpdate(group.id, newPlayers); 
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditP1(group.players[0]);
    setEditP2(group.players[1] || '');
    setIsEditing(false);
  };

  // Don't allow drag if editing
  return (
    <div 
      draggable={!isEditing && canEdit}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      className={`
        group relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200
        ${isDragging ? 
          'opacity-30 scale-95 bg-pink-100/80 border-2 border-yellow-400' : 
          'bg-linear-to-r from-pink-400/90 to-pink-200/20 hover:bg-amber-200 border-pink-100 hover:border-sky-700'}
        ${isEditing ? 'ring-2 ring-amber-200 border-transparent bg-pink-200/70' : ''}
        ${!canEdit && !isMod ? 'opacity-70 cursor-not-allowed' : 'cursor-default'}
      `}
    >
      {/* Drag Handle */}
      {canEdit && isMod && (
        <div className={`cursor-grab active:cursor-grabbing text-gray-900 hover:text-sky-500 ${isEditing ? 'invisible' : ''}`}>
          <GripVertical size={20} />
        </div>
      )}
      {(!canEdit && isMod && 
        <div className="text-slate-500">
          <Lock size={20} />
        </div>
      )}

      {/* Index Number */}
      <div className="shrink-0 w-6 text-center font-mono text-gray-900 text-sm font-bold">
        {index + 1}
      </div>

      {/* Content */}
      <div className="flex-1">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input 
                className="w-full bg-slate-800/80 border border-amber-200 rounded-lg px-2 py-1 text-base text-gray-50 focus:outline-none focus:border-green-600"
                value={editP1}
                onChange={(e) => setEditP1(e.target.value)}
                placeholder="Player 1"
                autoFocus
                disabled={!canEdit || !isMod}
              />
              {group.type === 'duo' && (
                 <input 
                 className="w-full bg-slate-800/80 border border-yellow-600 rounded-lg px-2 py-1 text-base text-gray-50 focus:outline-none focus:border-pink-600"
                 value={editP2}
                 onChange={(e) => setEditP2(e.target.value)}
                 placeholder="Player 2"
                disabled={!canEdit || !isMod}
               />
              )}
            </div>
            <div className="flex gap-2 justify-end">
               <button onClick={cancelEdit} className="p-1 bg-red-400 hover:bg-red-500 rounded text-red-900 px-4"><X size={20} /></button>
               <button onClick={handleSave} className="p-1 bg-green-600 hover:bg-green-500 rounded text-green-200 px-4"><Check size={20} /></button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${group.type === 'solo' ? 'bg-yellow-200 text-gray-900' : 'bg-pink-600 text-gray-900'}`}>
                  {group.type.toUpperCase()}
                </span>
                <span className="text-gray-900 text-xs">ID: {group.id}</span>
              </div>
              <div className="text-xl font-semibold text-gray-900 mt-0.5">
                 {group.players.join(' & ')}
              </div>
            </div>

            {/* Actions (Visible if canEdit is true) */}
            {canEdit && isMod && (
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  title="Edit Players"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => onRemove(group.id)}
                  className="p-2 text-slate-400 hover:text-gray-900 hover:bg-red-400 rounded-lg transition-colors"
                  title="Remove from Queue"
                >
                  <Trash2 size={16} />
                </button>
              </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}