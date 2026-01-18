import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

const DropOffLocations: React.FC = () => {
  const { dropOffLocations } = useApp();
  const [distances, setDistances] = useState<{[key: string]: string}>({});
  const [locationStatus, setLocationStatus] = useState<string>('Locating...');
  const [userCoords, setUserCoords] = useState<{lat: number; lng: number} | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('GPS not supported');
      return;
    }

    setIsLocating(true);
    setLocationStatus('Locating...');
    setPermissionDenied(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({ 
            lat: position.coords.latitude, 
            lng: position.coords.longitude 
        });
        setLocationStatus('');
        setIsLocating(false);
      },
      (error) => {
        console.error("Error getting location", error);
        setLocationStatus('GPS access denied');
        setPermissionDenied(true);
        setIsLocating(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 0 
      }
    );
  };

  // Initial fetch
  useEffect(() => {
    getLocation();
  }, []);

  // Calculate distances whenever coords or locations change
  useEffect(() => {
    if (userCoords && dropOffLocations.length > 0) {
        const newDistances: {[key: string]: string} = {};
        dropOffLocations.forEach(loc => {
          const d = getDistanceFromLatLonInKm(userCoords.lat, userCoords.lng, loc.lat, loc.lng);
          newDistances[loc.id] = d < 1 ? `${(d * 1000).toFixed(0)} m` : `${d.toFixed(1)} km`;
        });
        setDistances(newDistances);
    }
  }, [userCoords, dropOffLocations]);

  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  const handleDirections = (lat: number, lng: number) => {
    if (userCoords) {
        // Construct dynamic Google Maps Directions URL
        const url = `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${lat},${lng}&travelmode=driving`;
        window.open(url, '_blank');
    } else {
        // Fallback to searching the location coordinates if user location is unknown
        const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-green-100 dark:bg-green-900/30 h-48 rounded-3xl flex items-center justify-center relative overflow-hidden transition-colors">
        <MapPin className="w-16 h-16 text-green-600 dark:text-green-500 opacity-50 animate-bounce" />
        <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/OpenStreetMap_Mapnik_example.png')] bg-cover opacity-20 dark:opacity-10"></div>
        
        {permissionDenied ? (
             <div className="absolute bottom-4 bg-red-100 dark:bg-red-900/80 px-4 py-2 rounded-xl text-xs font-bold text-red-700 dark:text-red-200 shadow-sm backdrop-blur flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Enable GPS for distances
                <button onClick={getLocation} className="ml-2 bg-white/50 p-1 rounded-full hover:bg-white/80"><RefreshCw className="w-3 h-3" /></button>
            </div>
        ) : (
            <div className="absolute bottom-4 bg-white/90 dark:bg-gray-800/90 px-4 py-1 rounded-full text-xs font-bold text-green-800 dark:text-green-400 shadow-sm backdrop-blur transition-colors flex items-center gap-2">
                {isLocating ? (
                    <><Loader2 className="w-3 h-3 animate-spin"/> {locationStatus}</>
                ) : userCoords ? (
                    <span className="flex items-center gap-2">
                        Locations near you 
                        <button onClick={getLocation} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full" title="Refresh Location"><RefreshCw className="w-3 h-3" /></button>
                    </span>
                ) : (
                    <><Loader2 className="w-3 h-3 animate-spin"/> Locating...</>
                )}
            </div>
        )}
      </div>

      <div className="flex justify-between items-center">
          <h2 className="font-bold text-gray-800 dark:text-white text-lg">Nearby Centers</h2>
          {userCoords && <span className="text-[10px] text-green-600 font-medium">GPS Active</span>}
      </div>

      <div className="space-y-4">
        {dropOffLocations.length === 0 ? (
             <div className="text-center py-8 text-gray-400">
                 <p>No locations available.</p>
             </div>
        ) : (
            dropOffLocations.map(loc => (
            <div key={loc.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-800 transition-all">
                <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{loc.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">{loc.address}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${distances[loc.id] ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                    {distances[loc.id] || (permissionDenied ? 'Unknown' : 'Calculating...')}
                </span>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-3">
                <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {loc.open}
                </div>
                </div>

                <button 
                onClick={() => handleDirections(loc.lat, loc.lng)}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity active:scale-95"
                >
                <Navigation className="w-4 h-4" />
                Get Directions
                </button>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default DropOffLocations;