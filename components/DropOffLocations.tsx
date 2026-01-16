import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock } from 'lucide-react';

const LOCATIONS = [
  { 
    id: 1, 
    name: 'Zilcycler Recyclers Hub', 
    address: 'Harmony Estate Rd, Oko Erin, Kwara', 
    open: '8:00 AM - 6:00 PM', 
    url: 'https://www.google.com/maps/dir//Harmony+Estate+Rd,+Oko+Erin+240101,+Kwara/@8.4902241,4.593401,15z/',
    lat: 8.4902241,
    lng: 4.593401
  },
];

const DropOffLocations: React.FC = () => {
  const [distances, setDistances] = useState<{[key: number]: string}>({});
  const [locationStatus, setLocationStatus] = useState<string>('Locating...');

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('GPS not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        const newDistances: {[key: number]: string} = {};
        
        LOCATIONS.forEach(loc => {
          const d = getDistanceFromLatLonInKm(userLat, userLng, loc.lat, loc.lng);
          newDistances[loc.id] = `${d.toFixed(1)} km`;
        });
        
        setDistances(newDistances);
        setLocationStatus('');
      },
      (error) => {
        console.error("Error getting location", error);
        setLocationStatus('GPS access denied');
      }
    );
  }, []);

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

  const handleDirections = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-green-100 dark:bg-green-900/30 h-48 rounded-3xl flex items-center justify-center relative overflow-hidden transition-colors">
        <MapPin className="w-16 h-16 text-green-600 dark:text-green-500 opacity-50 animate-bounce" />
        <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/OpenStreetMap_Mapnik_example.png')] bg-cover opacity-20 dark:opacity-10"></div>
        <div className="absolute bottom-4 bg-white/90 dark:bg-gray-800/90 px-4 py-1 rounded-full text-xs font-bold text-green-800 dark:text-green-400 shadow-sm backdrop-blur transition-colors">
            Showing locations near you
        </div>
      </div>

      <h2 className="font-bold text-gray-800 dark:text-white text-lg">Nearby Centers</h2>

      <div className="space-y-4">
        {LOCATIONS.map(loc => (
          <div key={loc.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-800 transition-all">
            <div className="flex justify-between items-start mb-2">
               <div>
                 <h3 className="font-bold text-gray-900 dark:text-white">{loc.name}</h3>
                 <p className="text-xs text-gray-500 dark:text-gray-400">{loc.address}</p>
               </div>
               <span className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold px-2 py-1 rounded-lg">
                 {distances[loc.id] || locationStatus}
               </span>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-3">
               <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {loc.open}
               </div>
            </div>

            <button 
              onClick={() => handleDirections(loc.url)}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-xl font-bold text-sm hover:bg-green-600 dark:hover:bg-green-700 hover:text-white dark:hover:text-white transition-colors"
            >
              <Navigation className="w-4 h-4" />
              Get Directions
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DropOffLocations;