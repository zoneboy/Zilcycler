import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, BookOpen } from 'lucide-react';
import { BlogPost } from '../types';

const BlogList: React.FC = () => {
  const { blogPosts } = useApp();
  const [selectedBlog, setSelectedBlog] = useState<BlogPost | null>(null);

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-xl font-bold text-gray-800 dark:text-white">Recycling Tips</h2>
           <p className="text-xs text-gray-500 dark:text-gray-400">Stay informed, stay sustainable.</p>
        </div>
        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-700 dark:text-green-400">
            <BookOpen className="w-5 h-5" />
        </div>
      </div>

      <div className="grid gap-6">
        {blogPosts.length === 0 ? (
           <div className="text-center py-10 text-gray-400">
               <p>No tips available at the moment.</p>
           </div>
        ) : (
          blogPosts.map((blog) => (
            <article key={blog.id} className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
              <div className="relative">
                 <img src={blog.image} alt={blog.title} className="w-full h-40 object-cover" />
                 <div className="absolute top-3 left-3">
                    <span className="text-[10px] font-bold text-white bg-black/50 backdrop-blur px-2 py-1 rounded-full uppercase tracking-wider">
                      {blog.category}
                    </span>
                 </div>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2 leading-tight">{blog.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">{blog.excerpt}</p>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button 
                    onClick={() => setSelectedBlog(blog)}
                    className="text-green-700 dark:text-green-400 font-bold text-sm hover:underline"
                  >
                    Read More
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Blog Detail Modal - FIXED SCROLL STRUCTURE */}
      {selectedBlog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedBlog(null)}></div>
              <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl relative z-10 flex flex-col max-h-[80vh] animate-fade-in-up">
                 
                 {/* Sticky Header with Close Button (Overlay on Image style or solid bar) */}
                 {/* Using solid bar for better scrolling logic separation */}
                 <div className="flex-none flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800">
                     <h3 className="font-bold text-gray-800 dark:text-white line-clamp-1">{selectedBlog.title}</h3>
                     <button onClick={() => setSelectedBlog(null)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                         <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                     </button>
                 </div>
                 
                 {/* Scrollable Body */}
                 <div className="flex-1 overflow-y-auto">
                     <img src={selectedBlog.image} className="w-full h-56 object-cover" alt={selectedBlog.title} />
                     
                     <div className="p-6">
                         <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
                            {selectedBlog.category}
                         </span>
                         <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{selectedBlog.title}</h2>
                         <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                            {selectedBlog.excerpt}
                            <br /><br />
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                         </p>
                         
                         <button onClick={() => setSelectedBlog(null)} className="w-full bg-green-700 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-800 transition-transform active:scale-95">
                            Close Article
                         </button>
                     </div>
                 </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default BlogList;