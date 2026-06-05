import React, { useEffect, useState } from 'react';

const CustomCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPointer, setIsPointer] = useState(false);
  
  useEffect(() => {
    const updateCursorPosition = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
      
      // Cek apakah elemen yang dihover adalah yang bisa di-klik (link, button)
      const target = e.target;
      if (
        window.getComputedStyle(target).cursor === 'pointer' || 
        target.tagName.toLowerCase() === 'a' ||
        target.tagName.toLowerCase() === 'button' ||
        target.closest('a') ||
        target.closest('button')
      ) {
        setIsPointer(true);
      } else {
        setIsPointer(false);
      }
    };
    
    window.addEventListener('mousemove', updateCursorPosition);
    return () => {
      window.removeEventListener('mousemove', updateCursorPosition);
    };
  }, []);
  
  // Sembunyikan cursor jika di layar kecil (mobile)
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return null;
  }
  
  return (
    <>
      <div 
        className={`fixed top-0 left-0 w-4 h-4 rounded-full pointer-events-none z-[99999] transition-transform duration-100 ease-out mix-blend-screen ${isPointer ? 'bg-amber-400 scale-[2.5] blur-[1px]' : 'bg-emerald-400 scale-100 blur-[2px] shadow-[0_0_10px_rgba(52,211,153,0.8)]'}`}
        style={{
          transform: `translate3d(${position.x - 8}px, ${position.y - 8}px, 0) scale(${isPointer ? 2.5 : 1})`,
        }}
      />
      <div 
        className={`fixed top-0 left-0 w-1 h-1 rounded-full bg-white pointer-events-none z-[100000] transition-opacity duration-150 ${isPointer ? 'opacity-0' : 'opacity-100'}`}
        style={{
          transform: `translate3d(${position.x - 2}px, ${position.y - 2}px, 0)`,
        }}
      />
    </>
  );
};

export default CustomCursor;
