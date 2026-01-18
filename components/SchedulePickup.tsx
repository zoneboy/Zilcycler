import React, { useState } from 'react';
import { User, PickupTask } from '../types';
import { Calendar, Clock, Camera, MapPin, CheckCircle, Upload, Phone } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SchedulePickupProps {
  user: User;
  onBack: () => void;
  onSubmit: () => void;
}

const SchedulePickup: React.FC<SchedulePickupProps> = ({ user, onBack, onSubmit }) => {
  const { schedulePickup } = useApp();
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  
  // Form State
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTypes.length === 0) {
      alert("Please select at least one waste type.");
      return;
    }

    // Create a local URL for the image (simulating upload)
    const imageUrl = imageFile ? URL.createObjectURL(imageFile) : undefined;

    const newTask: PickupTask = {
        id: '', // Server generated
        userId: user.id,
        location: address,
        time: time,
        date: date,
        items: selectedTypes.join(', '),
        status: 'Pending',
        contact: user.name,
        phoneNumber: phone,
        wasteImage: imageUrl
    };

    // Add to Global Context
    schedulePickup(newTask);

    setSuccess(true);
    setTimeout(onSubmit, 2500);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Pickup Scheduled!</h2>
        <p className="text-gray-500">A collector will be assigned shortly. You can track status in your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-gray-600 hover:text-green-700 font-medium">
          &larr; Back
        </button>
        <h2 className="text-xl font-bold text-gray-800">Schedule Pickup</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Waste Type */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">Waste Type (Select all that apply)</label>
          <div className="grid grid-cols-2 gap-3">
            {['Plastic', 'Paper', 'Glass', 'Metal', 'Electronics', 'Organic'].map((type) => (
              <label 
                key={type} 
                className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-colors ${selectedTypes.includes(type) ? 'bg-green-50 border-green-500' : 'hover:bg-gray-50 border-gray-200'}`}
              >
                <input 
                  type="checkbox" 
                  checked={selectedTypes.includes(type)}
                  onChange={() => toggleType(type)}
                  className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 accent-green-600" 
                />
                <span className="text-sm text-gray-700">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date & Time */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-10 p-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500" 
                required 
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <div className="relative">
              <Clock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <input 
                type="time" 
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full pl-10 p-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500" 
                required 
              />
            </div>
          </div>
        </div>

        {/* Contact Info & Address */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Calling Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 p-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500" 
                  placeholder="e.g. +234 800 000 0000" 
                  required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <textarea 
                  rows={2} 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-10 p-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500" 
                  placeholder="Enter full address..." 
                  required
              ></textarea>
            </div>
          </div>
        </div>

        {/* Image Upload */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">Photo of Waste (Optional)</label>
          <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${fileName ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:bg-gray-50'}`}>
            <input type="file" id="waste-image" className="hidden" accept="image/*" onChange={handleFileChange} />
            <label htmlFor="waste-image" className="cursor-pointer flex flex-col items-center w-full h-full">
              {fileName ? (
                  <>
                     <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                     <span className="text-sm font-bold text-green-700 break-all">{fileName}</span>
                     <span className="text-xs text-green-600 mt-1">Tap to change</span>
                  </>
              ) : (
                  <>
                    <Camera className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Tap to upload image</span>
                  </>
              )}
            </label>
          </div>
        </div>

        <button type="submit" className="w-full bg-green-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-green-800 transition-transform active:scale-95">
          Confirm Schedule
        </button>
      </form>
    </div>
  );
};

export default SchedulePickup;