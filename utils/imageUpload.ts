import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { getToken } from './storage';
import { API_BASE_URL } from '../constants';

// ============================================================
// IMAGE UPLOAD UTILITIES
// Centralizes Cloudinary upload + Capacitor Camera integration
// ============================================================

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface CapturedImage {
    file: File;
    previewUrl: string;
}

/**
 * Validate an image file
 * Throws on validation failure
 */
export const validateImage = (file: File): void => {
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
    }
    if (file.size > MAX_SIZE_BYTES) {
        throw new Error('File too large. Maximum size is 5MB.');
    }
};

/**
 * Convert a Capacitor Photo (web path/dataUrl) to a File object
 */
const photoToFile = async (photo: Photo, filename: string = 'image.jpg'): Promise<File> => {
    if (!photo.webPath) throw new Error('No image path returned');
    
    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    
    // Determine extension from format
    const format = photo.format || 'jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    
    return new File([blob], `${filename}.${ext}`, { type: mimeType });
};

/**
 * Capture or pick an image
 * On native: shows native camera/gallery picker
 * On web: opens file input
 */
export const captureImage = async (): Promise<CapturedImage | null> => {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
        try {
            const photo = await Camera.getPhoto({
                quality: 80,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: CameraSource.Prompt, // User chooses Camera or Gallery
                width: 1920,
                height: 1920,
                correctOrientation: true,
                promptLabelHeader: 'Add Photo',
                promptLabelPhoto: 'Choose from Gallery',
                promptLabelPicture: 'Take Photo',
                promptLabelCancel: 'Cancel',
            });
            
            if (!photo.webPath) return null;
            
            const file = await photoToFile(photo, `zilcycler_${Date.now()}`);
            validateImage(file);
            
            return {
                file,
                previewUrl: photo.webPath,
            };
        } catch (e: any) {
            // User cancellation throws on iOS; check message
            if (e.message && e.message.toLowerCase().includes('cancel')) {
                return null;
            }
            throw e;
        }
    }
    
    // Web fallback - returns null, caller should use file input
    return null;
};

/**
 * Trigger a file input click and return the selected file
 * Used as web fallback when captureImage returns null
 */
export const pickImageFromInput = (input: HTMLInputElement): Promise<CapturedImage | null> => {
    return new Promise((resolve) => {
        const handler = () => {
            const file = input.files?.[0];
            input.removeEventListener('change', handler);
            
            if (!file) {
                resolve(null);
                return;
            }
            
            try {
                validateImage(file);
            } catch (e: any) {
                alert(e.message);
                input.value = '';
                resolve(null);
                return;
            }
            
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve({
                    file,
                    previewUrl: reader.result as string,
                });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        };
        
        input.addEventListener('change', handler);
        input.click();
    });
};

/**
 * Upload a file to Cloudinary using signed upload
 * Folder must match the allowlist on backend
 */
export const uploadToCloudinary = async (
    file: File,
    folder: 'zilcycler_general' | 'zilcycler_avatars' | 'zilcycler_pickups' | 'zilcycler_certificates' | 'zilcycler_blog'
): Promise<string | null> => {
    try {
        const token = await getToken();
        if (!token) {
            alert('You must be logged in to upload images.');
            return null;
        }

        // 1. Get signature from backend
        const signRes = await fetch(`${API_BASE_URL}/auth/sign-upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ folder }),
        });

        if (!signRes.ok) {
            throw new Error('Failed to authorize upload.');
        }

        const { signature, timestamp, apiKey, cloudName, folder: signedFolder } = await signRes.json();

        // 2. Upload directly to Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp.toString());
        formData.append('signature', signature);
        formData.append('folder', signedFolder);

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!uploadRes.ok) {
            const errorData = await uploadRes.json();
            throw new Error(errorData.error?.message || 'Upload failed');
        }

        const data = await uploadRes.json();
        return data.secure_url;
    } catch (error: any) {
        console.error('Cloudinary Upload Error:', error);
        alert(error.message || 'Failed to upload image. Please check your internet connection.');
        return null;
    }
};