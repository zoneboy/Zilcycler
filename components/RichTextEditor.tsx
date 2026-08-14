import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Heading2, Heading3, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, RemoveFormatting, Loader2 } from 'lucide-react';
import { captureImage, pickImageFromInput, uploadToCloudinary } from '../utils/imageUpload';

interface Props {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

// Lightweight contentEditable rich text editor (no external editor dependency).
// Output HTML is sanitized with utils/html.ts before it is ever rendered.
const RichTextEditor: React.FC<Props> = ({ value, onChange, placeholder }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    // Only push external value into the DOM when it actually differs,
    // otherwise the caret jumps on every keystroke.
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const emitChange = () => {
        if (editorRef.current) onChange(editorRef.current.innerHTML);
    };

    const exec = (command: string, arg?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, arg);
        emitChange();
    };

    const handleLink = () => {
        const url = window.prompt('Link URL (https://...)');
        if (!url) return;
        if (!/^https?:\/\//i.test(url)) {
            alert('Link must start with http:// or https://');
            return;
        }
        exec('createLink', url);
    };

    const handleImage = async () => {
        if (uploading) return;
        setUploading(true);
        try {
            // Native picker first (Capacitor); falls back to the hidden file input on web
            let captured = await captureImage();
            if (!captured && fileInputRef.current) {
                captured = await pickImageFromInput(fileInputRef.current);
            }
            if (!captured) return;
            const url = await uploadToCloudinary(captured.file, 'zilcycler_blog');
            if (url) exec('insertImage', url);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const ToolButton = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
        <button
            type="button"
            title={title}
            onMouseDown={(e) => e.preventDefault()} // keep selection in the editor
            onClick={onClick}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
        >
            {children}
        </button>
    );

    return (
        <div className="border rounded-xl bg-gray-50 overflow-hidden">
            <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-white">
                <ToolButton onClick={() => exec('formatBlock', '<h2>')} title="Heading"><Heading2 className="w-4 h-4" /></ToolButton>
                <ToolButton onClick={() => exec('formatBlock', '<h3>')} title="Subheading"><Heading3 className="w-4 h-4" /></ToolButton>
                <span className="w-px h-4 bg-gray-200 mx-1" />
                <ToolButton onClick={() => exec('bold')} title="Bold"><Bold className="w-4 h-4" /></ToolButton>
                <ToolButton onClick={() => exec('italic')} title="Italic"><Italic className="w-4 h-4" /></ToolButton>
                <ToolButton onClick={() => exec('underline')} title="Underline"><Underline className="w-4 h-4" /></ToolButton>
                <span className="w-px h-4 bg-gray-200 mx-1" />
                <ToolButton onClick={() => exec('insertUnorderedList')} title="Bullet list"><List className="w-4 h-4" /></ToolButton>
                <ToolButton onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered className="w-4 h-4" /></ToolButton>
                <span className="w-px h-4 bg-gray-200 mx-1" />
                <ToolButton onClick={handleLink} title="Insert link"><LinkIcon className="w-4 h-4" /></ToolButton>
                <ToolButton onClick={handleImage} title="Insert image">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                </ToolButton>
                <span className="w-px h-4 bg-gray-200 mx-1" />
                <ToolButton onClick={() => { exec('removeFormat'); exec('formatBlock', '<p>'); }} title="Clear formatting"><RemoveFormatting className="w-4 h-4" /></ToolButton>
            </div>
            <div
                ref={editorRef}
                contentEditable
                onInput={emitChange}
                onBlur={emitChange}
                data-placeholder={placeholder || 'Write your content...'}
                className="rich-content rich-editor min-h-[140px] max-h-[300px] overflow-y-auto p-3 text-sm text-gray-800 focus:outline-none"
            />
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" />
        </div>
    );
};

export default RichTextEditor;
