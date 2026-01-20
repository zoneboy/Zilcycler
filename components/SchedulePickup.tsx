import React, { useState } from 'react';
import { User, PickupTask } from '../types';
import { Calendar, Clock, Camera, MapPin, CheckCircle, Upload, Phone, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SchedulePickupProps {
  user: User;
  onBack: () => void;
  onSubmit: () => void;
}

const validateImage = (file: File) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
  }
  
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 5MB.');
  }
};

const SchedulePickup: React.FC<SchedulePickupProps> = ({ user, onBack, onSubmit }) => {
  const { schedulePickup } = useApp();
  const [success, setSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // File State
  const [fileName, setFileName] = useState<string | null>(null);
  const [wasteFile, setWasteFile] = useState<File | null>(null); // Store raw file for upload
  const [previewImage, setPreviewImage] = useState<string | undefined>(undefined); // Base64 for local preview only
  
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
      const file = e.target.files[0];

      try {
        validateImage(file);
      } catch (err: any) {
        alert(err.message);
        e.target.value = ''; // Reset input
        return;
      }

      setFileName(file.name);
      setWasteFile(file);
      
      // Convert to Base64 for local preview UI only
      const reader = new FileReader();
      reader.onloadend = () => {
          setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadToCloudinary = async (file: File): Promise<string | null> => {
      try {
          // 1. Get Authentication Token
          const token = localStorage.getItem('zilcycler_token');
          if (!token) {
              alert("You must be logged in to upload images.");
              return null;
          }

          // 2. Request Signature from Backend
          const signRes = await fetch('/api/auth/sign-upload', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ folder: 'zilcycler_pickups' })
          });

          if (!signRes.ok) {
              throw new Error('Failed to sign upload request.');
          }

          const { signature, timestamp, apiKey, cloudName, folder } = await signRes.json();

          // 3. Prepare Form Data for Cloudinary
          const formData = new FormData();
          formData.append('file', file);
          formData.append('api_key', apiKey);
          formData.append('timestamp', timestamp.toString());
          formData.append('signature', signature);
          formData.append('folder', folder);

          // 4. Upload to Cloudinary
          const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
              method: 'POST',
              body: formData
          });

          if (!uploadRes.ok) {
              const errorData = await uploadRes.json();
              throw new Error(errorData.error?.message || 'Upload failed');
          }

          const data = await uploadRes.json();
          return data.secure_url;
      } catch (error) {
          console.error("Cloudinary Upload Error:", error);
          alert("Failed to upload image. Please check your internet connection or try again.");
          return null;
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTypes.length === 0) {
      alert("Please select at least one waste type.");
      return;
    }

    setIsUploading(true);
    let finalImageUrl = undefined;

    // Upload Image if selected
    if (wasteFile) {
        const url = await uploadToCloudinary(wasteFile);
        if (!url) {
            setIsUploading(false);
            return; // Stop if upload failed
        }
        finalImageUrl = url;
    }

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
        wasteImage: finalImageUrl
    };

    // Add to Global Context
    await schedulePickup(newTask);

    setIsUploading(false);
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
        <button onClick={onBack} disabled={isUploading} className="text-gray-600 hover:text-green-700 font-medium disabled:opacity-50">
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
                  disabled={isUploading}
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
                disabled={isUploading}
                className="w-full pl-10 p-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50" 
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
                disabled={isUploading}
                className="w-full pl-10 p-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50" 
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
                  disabled={isUploading}
                  className="w-full pl-10 p-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50" 
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
                  disabled={isUploading}
                  className="w-full pl-10 p-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50" 
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
            <input 
                type="file" 
                id="waste-image" 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
                disabled={isUploading}
            />
            <label htmlFor="waste-image" className={`cursor-pointer flex flex-col items-center w-full h-full ${isUploading ? 'pointer-events-none opacity-50' : ''}`}>
              {fileName ? (
                  <>
                     <div className="relative">
                        {previewImage && <img src={previewImage} alt="Preview" className="w-20 h-20 rounded-lg object-cover mb-2 border border-green-200" />}
                        <CheckCircle className="w-6 h-6 text-green-500 absolute -top-2 -right-2 bg-white rounded-full" />
                     </div>
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

        <button 
            type="submit" 
            disabled={isUploading}
            className="w-full bg-green-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-green-800 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Uploading & Scheduling...
              </>
          ) : (
              'Confirm Schedule'
          )}
        </button>
      </form>
    </div>
  );
};

export default SchedulePickup;