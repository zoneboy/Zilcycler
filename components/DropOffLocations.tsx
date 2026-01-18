import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

const DropOffLocations: React.FC = () => {
  const { dropOffLocations } = useApp();
  const [distances, setDistances] = useState<{[key: string]: string}>({});
  const [locationStatus, setLocationStatus] = useState<string>('Locating...');
  const [userCoords, setUserCoords] = useState<{lat: number; lng: number} | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isLocating, setIsLocating] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('GPS not supported');
      setIsLocating(false);
      return;
    }

    // Use watchPosition to get continuous updates as GPS accuracy improves
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserCoords({ 
            lat: position.coords.latitude, 
            lng: position.coords.longitude 
        });
        setLocationStatus('');
        setIsLocating(false);
        setPermissionDenied(false);
      },
      (error) => {
        console.error("Error watching location", error);
        // Only set error state if we haven't received any coordinates yet
        setUserCoords(prev => {
            if (!prev) {
                setLocationStatus('GPS access denied');
                setPermissionDenied(true);
            }
            return prev;
        });
        setIsLocating(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 20000, 
        maximumAge: 1000 
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Calculate distances whenever coords or locations change
  useEffect(() => {
    if (userCoords && dropOffLocations.length > 0) {
        const newDistances: {[key: string]: string} = {};
        dropOffLocations.forEach(loc => {
          // 1. Calculate straight-line distance
          const straightLineKm = getDistanceFromLatLonInKm(userCoords.lat, userCoords.lng, loc.lat, loc.lng);
          
          // 2. Apply "Tortuosity Factor" (approx 1.4x) to estimate actual driving distance 
          // (Straight line is usually ~70% of road distance in cities)
          const estimatedDrivingKm = straightLineKm * 1.4;

          newDistances[loc.id] = estimatedDrivingKm < 1 
            ? `${(estimatedDrivingKm * 1000).toFixed(0)} m` 
            : `${estimatedDrivingKm.toFixed(1)} km`;
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

  const handleManualRefresh = () => {
      setIsLocating(true);
      setLocationStatus('Refreshing...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
            setUserCoords({ 
                lat: position.coords.latitude, 
                lng: position.coords.longitude 
            });
            setIsLocating(false);
            setLocationStatus('');
        },
        () => setIsLocating(false),
        { enableHighAccuracy: true, timeout: 10000 }
      );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-green-100 dark:bg-green-900/30 h-48 rounded-3xl flex items-center justify-center relative overflow-hidden transition-colors">
        <MapPin className="w-16 h-16 text-green-600 dark:text-green-500 opacity-50 animate-bounce" />
        <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/OpenStreetMap_Mapnik_example.png')] bg-cover opacity-20 dark:opacity-10"></div>
        
        {permissionDenied ? (
             <div className="absolute bottom-4 bg-red-100 dark:bg-red-900/80 px-4 py-2 rounded-xl text-xs font-bold text-red-700 dark:text-red-200 shadow-sm backdrop-blur flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Enable GPS for distances
                <button onClick={handleManualRefresh} className="ml-2 bg-white/50 p-1 rounded-full hover:bg-white/80"><RefreshCw className="w-3 h-3" /></button>
            </div>
        ) : (
            <div className="absolute bottom-4 bg-white/90 dark:bg-gray-800/90 px-4 py-1.5 rounded-full text-xs font-bold text-green-800 dark:text-green-400 shadow-sm backdrop-blur transition-colors flex items-center gap-2">
                {isLocating ? (
                    <><Loader2 className="w-3 h-3 animate-spin"/> {locationStatus}</>
                ) : userCoords ? (
                    <span className="flex items-center gap-2">
                        GPS Active 
                        <button onClick={handleManualRefresh} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full" title="Refresh Location"><RefreshCw className="w-3 h-3" /></button>
                    </span>
                ) : (
                    <><Loader2 className="w-3 h-3 animate-spin"/> Locating...</>
                )}
            </div>
        )}
      </div>

      <div className="flex justify-between items-center">
          <h2 className="font-bold text-gray-800 dark:text-white text-lg">Nearby Centers</h2>
          {userCoords && <span className="text-[10px] text-green-600 font-medium">Tracking</span>}
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
                <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg block ${distances[loc.id] ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                        {distances[loc.id] || (permissionDenied ? 'Unknown' : 'Calculating...')}
                    </span>
                    {distances[loc.id] && <span className="text-[9px] text-gray-400 uppercase tracking-wide">Est. Drive</span>}
                </div>
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